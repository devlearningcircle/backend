import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type AttendanceDocument = Attendance & Document;
export type AttendanceStatus = 'present' | 'absent';

@Schema({ timestamps: true })
export class Attendance extends BaseEntity {
    @Prop({ required: true })
    studentId: string;

    // Optional (backfilled from Student)
    @Prop()
    classId?: string;

    @Prop()
    sectionId?: string;

    @Prop()
    academicYearId?: string;

    @Prop({ required: true })
    date: string; // 'YYYY-MM-DD'

    @Prop({ required: true, enum: ['present', 'absent'] })
    status: AttendanceStatus;

    @Prop({ required: true })
    markedBy: string;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Unique: one record per student/day
AttendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// Helpful filters
AttendanceSchema.index({ classId: 1, sectionId: 1, date: 1 });
AttendanceSchema.index({ academicYearId: 1 });
