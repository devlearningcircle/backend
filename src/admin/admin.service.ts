import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Admin, AdminDocument } from './schemas/admin.schema';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Admin.name) private adminModel: Model<AdminDocument>,
    ) { }

    async findByEmail(email: string) {
        return this.adminModel.findOne({ email: (email || '').trim().toLowerCase() }).lean();
    }

    async findByIdForAuth(id: string) {
        return this.adminModel.findById(id).lean();
    }

    async findByPhone(phone: string) {
        return this.adminModel.findOne({ phone: (phone || '').trim() }).lean();
    }

    /**
     * Create a new admin with auto-generated unique ID
     */
    async create(dto: { email: string; password: string; phone?: string }) {
        const email = (dto.email || '').trim().toLowerCase();

        const exists = await this.adminModel.findOne({ email }).lean();
        if (exists) throw new BadRequestException('Email already exists');

        const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

        // Generate unique admin ID
        const { generateAdminId } = await import('../common/utils/id-generator');
        const uniqueId = await generateAdminId(this.adminModel);

        const admin = await this.adminModel.create({
            uniqueId,
            email,
            password: hashedPassword,
            phone: dto.phone ? dto.phone.trim() : undefined,
        });

        return admin.toJSON();
    }

    /**
     * Updates password for an admin.
     * IMPORTANT: newPassword is expected to be ALREADY HASHED by the caller (AuthService).
     * Do NOT hash it again here to avoid double hashing.
     */
    async updatePassword(id: string, newPasswordHash: string) {
        const updated = await this.adminModel.findByIdAndUpdate(
            id,
            { password: newPasswordHash },
            { new: true },
        );
        if (!updated) throw new NotFoundException('Admin not found');
        return { message: 'Password updated successfully' };
    }
}
