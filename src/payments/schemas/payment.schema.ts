import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment extends BaseEntity {
    @Prop({ required: true })
    studentId: string;

    @Prop({ required: true })
    productId: string;

    // denormalized for fast filtering
    @Prop({ required: true })
    academicYearId: string;

    @Prop({ required: true })
    classId: string;

    @Prop({ required: true })
    currency: 'INR';

    @Prop({ required: true, min: 1 })
    amount: number; // rupees at time of order

    @Prop({ required: true, enum: ['created', 'paid', 'failed', 'refunded'], default: 'created' })
    status: 'created' | 'paid' | 'failed' | 'refunded';

    @Prop() paidAt?: Date;

    // Razorpay refs
    @Prop() razorpayOrderId?: string;
    @Prop() razorpayPaymentId?: string;
    @Prop() razorpaySignature?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Useful filters
PaymentSchema.index({ studentId: 1, productId: 1 }, { unique: false });
PaymentSchema.index({ academicYearId: 1, classId: 1, productId: 1, status: 1 });
PaymentSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
