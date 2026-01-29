import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { AdminService } from '../admin/admin.service';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import { Role } from '../common/roles/role.enum';

import { ResetPasswordDto } from './dto/reset-password.dto';
import { OtpService } from './otp.service';
import { NotificationService } from './notification.service';
import { Channel } from './schemas/otp-management.schema';

const AUTH_DEBUG = (process.env.AUTH_DEBUG_OTP || '').toLowerCase() === 'true';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

type FoundUser =
  | { user: any; role: Role.ADMIN }
  | { user: any; role: Role.TEACHER }
  | { user: any; role: Role.STUDENT }
  | null;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly adminService: AdminService,
    private readonly teachersService: TeachersService,
    private readonly studentsService: StudentsService,
    private readonly otpService: OtpService,
    private readonly notificationService: NotificationService,
  ) { }

  // ---------- Normalizers ----------
  private normalizeEmail(value: string) {
    return (value || '').trim().toLowerCase();
  }

  private normalizePhone(value: string) {
    // keep leading + and digits only
    return (value || '').replace(/[^\d+]/g, '');
  }

  private getJwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '1d';
  }

  /**
   * Find a user by email/phone and also return which collection (role) was matched.
   * We do NOT depend on `user.role` being present in the DB doc.
   */
  private async findUserByChannel(
    channel: Channel,
    identifierRaw: string,
  ): Promise<FoundUser> {
    if (channel === 'email') {
      const email = this.normalizeEmail(identifierRaw);
      const [admin, teacher, student] = await Promise.all([
        this.adminService.findByEmail?.(email),
        this.teachersService.findByEmail?.(email),
        this.studentsService.findByEmail?.(email),
      ]);
      if (admin) return { user: admin, role: Role.ADMIN };
      if (teacher) return { user: teacher, role: Role.TEACHER };
      if (student) return { user: student, role: Role.STUDENT };
      return null;
    } else {
      const phone = this.normalizePhone(identifierRaw);
      const [admin, teacher, student] = await Promise.all([
        this.adminService.findByPhone?.(phone),
        this.teachersService.findByPhone?.(phone),
        this.studentsService.findByPhone?.(phone),
      ]);
      if (admin) return { user: admin, role: Role.ADMIN };
      if (teacher) return { user: teacher, role: Role.TEACHER };
      if (student) return { user: student, role: Role.STUDENT };
      return null;
    }
  }

  private resolveContact(channel: Channel, value: string, user?: any): string {
    if (channel === 'email') {
      const email = this.normalizeEmail(value || user?.email || '');
      if (!email)
        throw new BadRequestException(
          'Invalid or expired OTP. Please try again.',
        );
      return email;
    }
    const phone = (this.normalizePhone(value || '') || (user?.phone ?? '')).trim();
    if (!phone)
      throw new BadRequestException(
        'Invalid or expired OTP. Please try again.',
      );
    return phone;
  }

  // ---------- Username/password login ----------
  async validateUser(email: string, password: string) {
    const normalizedEmail = (email || '').trim().toLowerCase();

    // Admin
    const admin = await this.adminService.findByEmail?.(normalizedEmail);
    if (admin && admin.password && (await bcrypt.compare(password, admin.password))) {
      return { id: admin._id, email: admin.email, role: Role.ADMIN };
    }

    // Teacher
    const teacher = await this.teachersService.findByEmail?.(normalizedEmail);
    if (teacher && teacher.password && (await bcrypt.compare(password, teacher.password))) {
      return { id: teacher._id, email: teacher.email, role: Role.TEACHER };
    }

    // Student: use password-included lookup
    const student = await this.studentsService.findByEmailForAuth?.(normalizedEmail);
    if (student && student.password && (await bcrypt.compare(password, student.password))) {
      return { id: student._id, email: student.email, role: Role.STUDENT };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = { sub: user.id, email: user.email, role: user.role };
    const expiresIn = this.getJwtExpiresIn();

    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: { id: user.id, email: user.email, role: user.role },
      expires_in: expiresIn,
    };
  }

  async getMe(user: any) {
    const { id, email, role } = user;
    let name = email?.split('@')[0] || 'User';

    // Fetch full user details based on role to get the name
    try {
      if (role === Role.ADMIN) {
        const admin = await this.adminService.findByEmail(email);
        name = admin?.email?.split('@')[0] || 'Admin';
      } else if (role === Role.TEACHER) {
        const teacher = await this.teachersService.findByEmail(email);
        name = teacher?.name || teacher?.email?.split('@')[0] || 'Teacher';
      } else if (role === Role.STUDENT) {
        const student = await this.studentsService.findByEmail(email);
        name = student?.name || student?.email?.split('@')[0] || 'Student';
      }
    } catch (error) {
      // If user lookup fails, use email fallback
      console.error('Error fetching user details for getMe:', error);
    }

    return { id, email, role, name };
  }

  // ---------- OTP ----------
  async sendOtp(channel: Channel, value: string) {
    const found = await this.findUserByChannel(channel, value);

    // Always return generic success to avoid user enumeration.
    if (found) {
      const to = this.resolveContact(channel, value, found.user);

      const leftMs = await this.otpService.getResendLeftMs(channel, to);
      if (leftMs > 0) {
        const left = Math.ceil(leftMs / 1000);
        throw new BadRequestException(
          `Please wait ${left}s before requesting another OTP.`,
        );
      }

      const code = await this.otpService.create(channel, to);
      const expiresInMinutes = this.otpService.getExpiryMinutes();

      if (AUTH_DEBUG) {
        const keyId = this.otpService.debugNormalizedValue(channel, to);
        // eslint-disable-next-line no-console
        console.log(
          `[AUTH_DEBUG] OTP created for ${channel}:${keyId} code=${code}`,
        );
      }

      await this.notificationService.sendOtp(
        channel,
        to,
        code,
        expiresInMinutes,
      );
    }

    return { message: 'If the account exists, an OTP has been sent.' };
  }

  async verifyOtp(channel: Channel, to: string, otp: string) {
    const found = await this.findUserByChannel(channel, to);
    if (!found)
      throw new BadRequestException(
        'Invalid or expired OTP. Please try again.',
      );

    const contact = this.resolveContact(channel, to, found.user);

    if (AUTH_DEBUG) {
      const keyId = this.otpService.debugNormalizedValue(channel, contact);
      // eslint-disable-next-line no-console
      console.log(
        `[AUTH_DEBUG] Checking ${channel}:${keyId} with otp=${otp}`,
      );
    }

    await this.otpService.check(channel, contact, otp);

    const { attemptsUsed, lockedUntil } =
      await this.otpService.getAttemptsInfo(channel, contact);
    return { ok: true, attemptsUsed, lockedUntil };
  }

  async resendOtp(channel: Channel, to: string) {
    const found = await this.findUserByChannel(channel, to);
    if (!found)
      return { message: 'If the account exists, a new OTP has been sent.' };

    const contact = this.resolveContact(channel, to, found.user);

    const leftMs = await this.otpService.getResendLeftMs(channel, contact);
    if (leftMs > 0) {
      const left = Math.ceil(leftMs / 1000);
      throw new BadRequestException(
        `Please wait ${left}s before requesting another OTP.`,
      );
    }

    const code = await this.otpService.create(channel, contact);
    await this.otpService.markResent(channel, contact);

    if (AUTH_DEBUG) {
      const keyId = this.otpService.debugNormalizedValue(channel, contact);
      // eslint-disable-next-line no-console
      console.log(
        `[AUTH_DEBUG] OTP resent for ${channel}:${keyId} code=${code}`,
      );
    }

    const expiresInMinutes = this.otpService.getExpiryMinutes();
    await this.notificationService.sendOtp(
      channel,
      contact,
      code,
      expiresInMinutes,
    );

    return { message: 'OTP resent successfully.' };
  }

  // ---------- Reset password ----------
  private async updatePasswordForUser(
    userId: string,
    role: Role,
    newPasswordHashed: string,
  ) {
    // IMPORTANT: the underlying services MUST store this hash as-is (no re-hashing).
    if (role === Role.ADMIN)
      return this.adminService.updatePassword(userId, newPasswordHashed);
    if (role === Role.TEACHER)
      return this.teachersService.updatePassword(userId, newPasswordHashed);
    if (role === Role.STUDENT)
      return this.studentsService.updatePassword(userId, newPasswordHashed);

    throw new BadRequestException('Unsupported role for password update.');
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { channel, value, otp, newPassword } = dto;

    const found = await this.findUserByChannel(channel, value);
    if (!found)
      throw new BadRequestException(
        'Invalid or expired OTP. Please try again.',
      );

    const contact = this.resolveContact(channel, value, found.user);

    if (AUTH_DEBUG) {
      const keyId = this.otpService.debugNormalizedValue(channel, contact);
      // eslint-disable-next-line no-console
      console.log(
        `[AUTH_DEBUG] Reset password verify ${channel}:${keyId} otp=${otp}`,
      );
    }

    await this.otpService.verify(channel, contact, otp);

    // Hash here (single source of truth).
    // Ensure admin/teacher/student services DO NOT hash again.
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.updatePasswordForUser(found.user._id, found.role, hashed);

    return { message: 'Password reset successful.' };
  }
}
