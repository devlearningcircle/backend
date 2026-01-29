import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';
import { Exclude } from 'class-transformer';

export type StudentDocument = Student & Document;

@Schema({ _id: false })
class ParentInfo {
  @Prop() name?: string;
  @Prop() occupation?: string;
  @Prop() monthlyIncome?: string;
  @Prop() phone?: string;
  @Prop() whatsapp?: string;
}
const ParentInfoSchema = SchemaFactory.createForClass(ParentInfo);

@Schema({ _id: false })
class Documents {
  @Prop() photoUrl?: string;
  @Prop() fatherPhotoUrl?: string;
  @Prop() motherPhotoUrl?: string;
  @Prop() birthCertificateUrl?: string;
  @Prop() scstCertificateUrl?: string;
  @Prop() leavingCertificateUrl?: string;
  @Prop() vaccineCardUrl?: string;
}
const DocumentsSchema = SchemaFactory.createForClass(Documents);

@Schema({ _id: false })
class CustomDocument {
  @Prop({ required: true })
  title: string;

  @Prop()
  publishedBy?: string;

  @Prop({ required: true })
  documentUrl: string;

  @Prop({ type: Date, default: Date.now })
  uploadDate: Date;
}
const CustomDocumentSchema = SchemaFactory.createForClass(CustomDocument);

@Schema({ _id: false })
class CustomImage {
  @Prop()
  title?: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ type: Date, default: Date.now })
  uploadDate: Date;
}
const CustomImageSchema = SchemaFactory.createForClass(CustomImage);

@Schema({ _id: false })
class EducationEntry {
  @Prop({ required: true })
  degree: string;

  @Prop({ required: true })
  institution: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop()
  grade?: string;
}
const EducationEntrySchema = SchemaFactory.createForClass(EducationEntry);

@Schema({ timestamps: true })
export class Student extends BaseEntity {
  // Account
  @Prop({ required: true, trim: true })
  name: string;

  // Auto-generated unique student ID (e.g., STU-2025-0001)
  @Prop({ unique: true, trim: true })
  uniqueId?: string;

  // Roll is unique within an academic year (see indexes below)
  @Prop({ required: true, trim: true })
  rollNumber: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  email: string;

  @Exclude()
  @Prop({ required: true })
  password: string;

  @Prop({ default: 'student' })
  role: string;

  // Enrolment (current snapshot)
  @Prop() classId: string;
  @Prop() sectionId: string;
  @Prop() academicYearId: string;
  @Prop() gender: string;
  @Prop() dateOfBirth: Date;

  // Student info
  @Prop() motherTongue?: string;
  @Prop() bloodGroup?: string;
  @Prop() heightCm?: string;
  @Prop() weightKg?: string;
  @Prop() guardianName?: string;
  @Prop() guardianRelation?: string;
  @Prop() phone?: string;
  @Prop() whatsapp?: string;
  @Prop() address?: string;

  // Parents
  @Prop({ type: ParentInfoSchema }) father?: ParentInfo;
  @Prop({ type: ParentInfoSchema }) mother?: ParentInfo;

  // Uploads
  @Prop({ type: DocumentsSchema }) documents?: Documents;

  // Custom Documents and Images
  @Prop({ type: [CustomDocumentSchema], default: [] })
  customDocuments?: CustomDocument[];

  @Prop({ type: [CustomImageSchema], default: [] })
  customImages?: CustomImage[];

  // Education History
  @Prop({ type: [EducationEntrySchema], default: [] })
  education?: EducationEntry[];
}

export const StudentSchema = SchemaFactory.createForClass(Student);

// Helpful indexes
StudentSchema.index({ classId: 1 });
StudentSchema.index({ sectionId: 1 });
StudentSchema.index({ academicYearId: 1 });

// Roll number unique per academic year (for current snapshot)
StudentSchema.index({ academicYearId: 1, rollNumber: 1 }, { unique: true });

// JSON shape
StudentSchema.set('toJSON', { versionKey: false });
StudentSchema.set('toObject', { versionKey: false });
