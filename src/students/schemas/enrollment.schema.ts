import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

@Schema({ timestamps: true })
export class Enrollment {
    @Prop({ required: true, index: true })
    studentId: string;

    @Prop({ required: true, index: true })
    academicYearId: string;

    @Prop({ required: true, index: true })
    classId: string;

    @Prop({ required: true, index: true })
    sectionId: string;

    @Prop({ required: true, trim: true })
    rollNumber: string;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Uniqueness constraints: one enrollment per student per AY; roll unique per AY
EnrollmentSchema.index({ studentId: 1, academicYearId: 1 }, { unique: true });
EnrollmentSchema.index({ academicYearId: 1, rollNumber: 1 }, { unique: true });

// JSON shape
EnrollmentSchema.set('toJSON', { versionKey: false });
EnrollmentSchema.set('toObject', { versionKey: false });
