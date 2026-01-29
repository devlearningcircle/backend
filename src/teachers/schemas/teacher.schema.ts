import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';
import { Exclude } from 'class-transformer';

export type TeacherDocument = Teacher & Document;

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
export class Teacher extends BaseEntity {
    // === Personal Details ===
    @Prop({ required: true, trim: true })
    name: string;

    // Auto-generated unique teacher ID (e.g., TCH-2025-0001)
    @Prop({ unique: true, trim: true })
    uniqueId?: string;

    @Prop({ required: true, unique: true, trim: true, lowercase: true })
    email: string;

    @Exclude()
    @Prop({ required: true })
    password: string;

    @Prop({ default: 'teacher' })
    role: string;

    @Prop({ trim: true })
    subject: string;

    // Not forced unique to avoid collisions, but indexed for lookup
    @Prop({ trim: true, index: true })
    phone: string;

    @Prop({ type: Date })
    dateOfBirth?: Date;

    @Prop({ trim: true })
    fatherName?: string;

    @Prop({ trim: true })
    motherName?: string;

    @Prop({ trim: true })
    mobileNumber?: string;

    @Prop({ trim: true })
    adhaarNumber?: string;

    @Prop({ trim: true })
    panNumber?: string;

    @Prop({ trim: true })
    address?: string;

    @Prop({ trim: true })
    photoUrl?: string;

    @Prop({ trim: true })
    signature?: string;

    // === Custom Documents and Images ===
    @Prop({ type: [CustomDocumentSchema], default: [] })
    customDocuments?: CustomDocument[];

    @Prop({ type: [CustomImageSchema], default: [] })
    customImages?: CustomImage[];

    // === Education (converted to array for multiple entries) ===
    @Prop({ type: [EducationEntrySchema], default: [] })
    education?: EducationEntry[];

    // === Bank Details ===
    @Prop({ trim: true })
    bankName?: string;

    @Prop({ trim: true })
    accountNumber?: string;

    @Prop({ trim: true })
    accountType?: string;

    @Prop({ trim: true })
    ifscNumber?: string;

    // === PF Information ===
    @Prop({ trim: true })
    pfMemberId?: string;

    @Prop({ trim: true })
    pfAccountNumber?: string;

    @Prop({ trim: true })
    employeeName?: string;

    @Prop({ trim: true })
    kycStatus?: string;
}

export const TeacherSchema = SchemaFactory.createForClass(Teacher);

// Virtual id for consistent client shape
TeacherSchema.virtual('id').get(function (this: any) {
    return this._id?.toString?.() ?? String(this._id);
});

// Strip password + enable virtuals everywhere
const jsonOpts = {
    versionKey: false,
    virtuals: true,
    transform: (_: any, ret: any) => {
        delete ret.password;
        return ret;
    },
};
TeacherSchema.set('toJSON', jsonOpts as any);
TeacherSchema.set('toObject', jsonOpts as any);
