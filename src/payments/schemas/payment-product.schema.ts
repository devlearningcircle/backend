import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type PaymentProductDocument = PaymentProduct & Document;

@Schema({ timestamps: true })
export class PaymentProduct extends BaseEntity {
    @Prop({ required: true, trim: true })
    name: string;

    @Prop({ trim: true })
    description?: string;

    @Prop({ trim: true, enum: ['tuition', 'exam', 'transport', 'other'], default: 'other' })
    type?: 'tuition' | 'exam' | 'transport' | 'other';

    @Prop({ required: true, default: 'INR' })
    currency: 'INR';

    @Prop({ required: true, min: 1 })
    amount: number; // rupees

    @Prop({ required: true })
    academicYearId: string;

    @Prop({ required: true })
    classId: string;

    @Prop({ default: true })
    isActive: boolean;
}

export const PaymentProductSchema = SchemaFactory.createForClass(PaymentProduct);

PaymentProductSchema.index({ academicYearId: 1, classId: 1, isActive: 1 });
PaymentProductSchema.index({ type: 1 });
