import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/roles/role.enum';
import { BaseEntity } from '../../common/entities/base.entity';
import { Exclude } from 'class-transformer';

export type AdminDocument = Admin & Document;

@Schema({ timestamps: true })
export class Admin extends BaseEntity {
    // Auto-generated unique admin ID (e.g., ADM-2025-0001)
    @Prop({ unique: true, trim: true })
    uniqueId?: string;

    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Exclude()
    @Prop({ required: true })
    password: string;

    @Prop({ default: Role.ADMIN })
    role: Role;

    @Prop({ default: false })
    isDisabled: boolean;

    @Prop({
        unique: true,
        sparse: true,
        trim: true,
    })
    phone?: string;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
