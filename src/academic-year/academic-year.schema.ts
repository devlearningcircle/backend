import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AcademicYearDocument = AcademicYear & Document;

@Schema({ timestamps: true, versionKey: false })
export class AcademicYear {
    _id: string;

    @Prop({ required: true, trim: true, unique: true })
    name: string; // "2025-26"

    @Prop({ required: true }) startDate: Date;
    @Prop({ required: true }) endDate: Date;

    @Prop({ default: true }) isActive: boolean;
    @Prop({ default: false }) isCurrent: boolean; // Index defined below with schema.index()

    createdAt: Date;
    updatedAt: Date;
}
export const AcademicYearSchema = SchemaFactory.createForClass(AcademicYear);

AcademicYearSchema.pre('validate', function () {
    const self = this as AcademicYearDocument;
    if (self.endDate <= self.startDate) {
        throw new Error('endDate must be greater than startDate');
    }
});

// Indexes
AcademicYearSchema.index({ startDate: 1, endDate: 1 });
AcademicYearSchema.index({ isCurrent: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });

// Ensure _id serializes to string
AcademicYearSchema.set('toJSON', {
    transform: (_: any, ret: any) => {
        if (ret && ret._id && typeof ret._id !== 'string') ret._id = String(ret._id);
        return ret;
    },
});
