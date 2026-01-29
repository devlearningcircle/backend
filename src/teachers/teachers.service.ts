import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Teacher, TeacherDocument } from './schemas/teacher.schema';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

@Injectable()
export class TeachersService {
    constructor(
        @InjectModel(Teacher.name)
        private teacherModel: Model<TeacherDocument>,
    ) { }

    // -------- helpers ----------
    private normEmail(email: string) {
        return (email || '').trim().toLowerCase();
    }
    private normStr(v: string) {
        return (v || '').trim();
    }
    private async handleDupKey(err: any) {
        if (err?.code === 11000) {
            const fields = Object.keys(err.keyPattern || {});
            if (fields.includes('email'))
                throw new BadRequestException('Email already exists');
            throw new BadRequestException('Duplicate key error');
        }
        throw err;
    }

    // -------- CRUD ----------
    async create(dto: CreateTeacherDto) {
        const email = this.normEmail(dto.email);

        const exists = await this.teacherModel.findOne({ email }).lean();
        if (exists) throw new BadRequestException('Email already exists');

        const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

        // Generate unique teacher ID
        const { generateTeacherId } = await import('../common/utils/id-generator');
        const uniqueId = await generateTeacherId(this.teacherModel);

        try {
            const doc = await this.teacherModel.create({
                name: this.normStr(dto.name),
                uniqueId,
                email,
                password: hashedPassword,
                role: 'teacher',
                subject: this.normStr(dto.subject),
                phone: this.normStr(dto.phone),
                // Personal Details
                dateOfBirth: dto.dateOfBirth,
                fatherName: dto.fatherName ? this.normStr(dto.fatherName) : undefined,
                motherName: dto.motherName ? this.normStr(dto.motherName) : undefined,
                mobileNumber: dto.mobileNumber ? this.normStr(dto.mobileNumber) : undefined,
                adhaarNumber: dto.adhaarNumber ? this.normStr(dto.adhaarNumber) : undefined,
                panNumber: dto.panNumber ? this.normStr(dto.panNumber) : undefined,
                address: dto.address ? this.normStr(dto.address) : undefined,
                photoUrl: dto.photoUrl ? this.normStr(dto.photoUrl) : undefined,
                signature: dto.signature ? this.normStr(dto.signature) : undefined,
                // Custom Documents and Images
                customDocuments: dto.customDocuments || [],
                customImages: dto.customImages || [],
                // Education (array)
                education: dto.education || [],
                // Bank Details
                bankName: dto.bankName ? this.normStr(dto.bankName) : undefined,
                accountNumber: dto.accountNumber ? this.normStr(dto.accountNumber) : undefined,
                accountType: dto.accountType ? this.normStr(dto.accountType) : undefined,
                ifscNumber: dto.ifscNumber ? this.normStr(dto.ifscNumber) : undefined,
                // PF Information
                pfMemberId: dto.pfMemberId ? this.normStr(dto.pfMemberId) : undefined,
                pfAccountNumber: dto.pfAccountNumber ? this.normStr(dto.pfAccountNumber) : undefined,
                employeeName: dto.employeeName ? this.normStr(dto.employeeName) : undefined,
                kycStatus: dto.kycStatus ? this.normStr(dto.kycStatus) : undefined,
            });
            return doc.toJSON(); // password removed by schema transform
        } catch (err) {
            await this.handleDupKey(err);
        }
    }

    /** Used by AuthService (needs password hash) */
    async findByEmail(email: string) {
        return this.teacherModel.findOne({ email: this.normEmail(email) }).lean();
    }

    /** Used for password verification (needs password hash) */
    async findByIdForAuth(id: string) {
        return this.teacherModel.findById(id).lean();
    }

    async findByPhone(phone: string) {
        return this.teacherModel.findOne({ phone: this.normStr(phone) }).lean();
    }

    findAll() {
        return this.teacherModel
            .find({}, { password: 0 })
            .sort({ createdAt: -1 })
            .lean({ virtuals: true });
    }

    async searchTeachers(query: string, limit: number = 50) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const searchRegex = new RegExp(query.trim(), 'i');
        return this.teacherModel
            .find(
                {
                    $or: [
                        { name: searchRegex },
                        { email: searchRegex },
                        { subject: searchRegex },
                    ],
                },
                { password: 0 }
            )
            .limit(limit)
            .sort({ name: 1 })
            .lean({ virtuals: true });
    }

    // Minimal list for selection in UIs
    async findMinimal() {
        return this.teacherModel
            .find({}, { name: 1, subject: 1, phone: 1 })
            .sort({ name: 1 })
            .lean({ virtuals: true });
    }

    findOne(id: string) {
        return this.teacherModel.findById(id, { password: 0 }).lean({ virtuals: true });
    }

    async update(id: string, dto: UpdateTeacherDto) {
        const update: any = {};

        // Basic fields
        if (dto.email !== undefined) update.email = this.normEmail(dto.email);
        if (dto.name !== undefined) update.name = this.normStr(dto.name);
        if (dto.subject !== undefined) update.subject = this.normStr(dto.subject);
        if (dto.phone !== undefined) update.phone = this.normStr(dto.phone);

        // Personal Details
        if (dto.dateOfBirth !== undefined) update.dateOfBirth = dto.dateOfBirth;
        if (dto.fatherName !== undefined) update.fatherName = dto.fatherName ? this.normStr(dto.fatherName) : undefined;
        if (dto.motherName !== undefined) update.motherName = dto.motherName ? this.normStr(dto.motherName) : undefined;
        if (dto.mobileNumber !== undefined) update.mobileNumber = dto.mobileNumber ? this.normStr(dto.mobileNumber) : undefined;
        if (dto.adhaarNumber !== undefined) update.adhaarNumber = dto.adhaarNumber ? this.normStr(dto.adhaarNumber) : undefined;
        if (dto.panNumber !== undefined) update.panNumber = dto.panNumber ? this.normStr(dto.panNumber) : undefined;
        if (dto.address !== undefined) update.address = dto.address ? this.normStr(dto.address) : undefined;
        if (dto.photoUrl !== undefined) update.photoUrl = dto.photoUrl ? this.normStr(dto.photoUrl) : undefined;
        if (dto.signature !== undefined) update.signature = dto.signature ? this.normStr(dto.signature) : undefined;

        // Custom Documents and Images
        if (dto.customDocuments !== undefined) update.customDocuments = dto.customDocuments;
        if (dto.customImages !== undefined) update.customImages = dto.customImages;

        // Education (array)
        if (dto.education !== undefined) update.education = dto.education;

        // Bank Details
        if (dto.bankName !== undefined) update.bankName = dto.bankName ? this.normStr(dto.bankName) : undefined;
        if (dto.accountNumber !== undefined) update.accountNumber = dto.accountNumber ? this.normStr(dto.accountNumber) : undefined;
        if (dto.accountType !== undefined) update.accountType = dto.accountType ? this.normStr(dto.accountType) : undefined;
        if (dto.ifscNumber !== undefined) update.ifscNumber = dto.ifscNumber ? this.normStr(dto.ifscNumber) : undefined;

        // PF Information
        if (dto.pfMemberId !== undefined) update.pfMemberId = dto.pfMemberId ? this.normStr(dto.pfMemberId) : undefined;
        if (dto.pfAccountNumber !== undefined) update.pfAccountNumber = dto.pfAccountNumber ? this.normStr(dto.pfAccountNumber) : undefined;
        if (dto.employeeName !== undefined) update.employeeName = dto.employeeName ? this.normStr(dto.employeeName) : undefined;
        if (dto.kycStatus !== undefined) update.kycStatus = dto.kycStatus ? this.normStr(dto.kycStatus) : undefined;

        // Only update password if provided and not empty (min 8 chars enforced by DTO validation)
        if (dto.password !== undefined && dto.password.trim().length > 0) {
            update.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        }

        try {
            const updated = await this.teacherModel.findByIdAndUpdate(id, update, {
                new: true,
                projection: { password: 0 },
            });
            return updated?.toJSON();
        } catch (err) {
            await this.handleDupKey(err);
        }
    }

    delete(id: string) {
        return this.teacherModel.findByIdAndDelete(id);
    }

    /**
     * Updates password for a teacher.
     * IMPORTANT: newPassword is expected to be ALREADY HASHED by the caller (AuthService).
     * Do NOT hash it again here to avoid double hashing.
     */
    async updatePassword(id: string, newPasswordHash: string) {
        const updated = await this.teacherModel.findByIdAndUpdate(
            id,
            { password: newPasswordHash },
            { new: true },
        );
        if (!updated) throw new NotFoundException('Teacher not found');
        return { message: 'Password updated successfully' };
    }
}
