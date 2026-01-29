import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type Channel = 'email' | 'phone';
export type OtpManagementDocument = HydratedDocument<OtpManagement>;

@Schema({ collection: 'otp_management', timestamps: true })
export class OtpManagement {
    @Prop({ type: String, required: true, enum: ['email', 'phone'] })
    channel!: Channel;

    @Prop({ type: String, required: true })
    identifier!: string;

    @Prop({ type: String, required: true })
    code!: string;

    @Prop({ type: Date, required: true })
    expiresAt!: Date;

    @Prop({ type: Number, default: 0 })
    attempts!: number;

    @Prop({ type: Date, default: null })
    lockedUntil!: Date | null;

    @Prop({ type: Date, default: null })
    lastSentAt!: Date | null;
}

export const OtpManagementSchema = SchemaFactory.createForClass(OtpManagement);

OtpManagementSchema.index({ channel: 1, identifier: 1 }, { unique: true });

OtpManagementSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
