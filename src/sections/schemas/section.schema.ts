import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type SectionDocument = Section & Document;

@Schema({ timestamps: true })
export class Section extends BaseEntity {
    @Prop({ required: true, lowercase: true, trim: true })
    name: string;

    @Prop({ required: true, trim: true, index: true })
    classId: string;

    @Prop({ trim: true, index: true })
    assignedTeacherId?: string;

    // Order within a class
    @Prop({ index: true })
    order?: number;
}

export const SectionSchema = SchemaFactory.createForClass(Section);

// One section name per class (case-insensitive via lowercase storage)
SectionSchema.index({ classId: 1, name: 1 }, { unique: true });

// Helpful lookups
SectionSchema.index({ classId: 1, order: 1 });

// Virtual id for consistent client shape
SectionSchema.virtual('id').get(function (this: any) {
    return this._id?.toString?.() ?? String(this._id);
});

SectionSchema.set('toJSON', { versionKey: false, virtuals: true });
SectionSchema.set('toObject', { versionKey: false, virtuals: true });
