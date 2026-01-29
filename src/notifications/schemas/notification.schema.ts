import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification extends BaseEntity {
    @Prop({ required: true }) subject: string;
    @Prop({ required: true }) message: string;
    @Prop({ required: true, enum: ['email', 'web'] }) type: 'email' | 'web';

    @Prop({ type: [String], default: [] }) recipients: string[];

    @Prop({ required: true, enum: ['pending', 'sent', 'failed'], default: 'pending' })
    status: 'pending' | 'sent' | 'failed';

    @Prop({ required: true }) sentBy: string;

    @Prop() academicYearId?: string;
    @Prop() classId?: string;
    @Prop() sectionId?: string;

    @Prop() fileUrl?: string;
    @Prop() fileName?: string;
    @Prop() fileType?: string;
    @Prop() fileSize?: number;

    // Track which users have read this notification
    @Prop({ type: [String], default: [] }) readBy: string[];
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.virtual('id').get(function (this: any) {
    return this._id?.toString?.() ?? String(this._id);
});

NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ updatedAt: -1 });
NotificationSchema.index({ type: 1, status: 1 });
NotificationSchema.index({ academicYearId: 1, classId: 1, sectionId: 1 });
NotificationSchema.index({ fileUrl: 1 });
NotificationSchema.index({ subject: 'text', message: 'text' });

const jsonOpts = { versionKey: false, virtuals: true };
NotificationSchema.set('toJSON', jsonOpts as any);
NotificationSchema.set('toObject', jsonOpts as any);
