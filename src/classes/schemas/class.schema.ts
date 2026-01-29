import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type ClassDocument = Class & Document;

@Schema({ timestamps: true })
export class Class extends BaseEntity {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  name: string;

  // Determines display order and the "next class" for promotions
  @Prop({ index: true, unique: true, sparse: true })
  order?: number;
}

export const ClassSchema = SchemaFactory.createForClass(Class);

// Virtual id for consistent client shape
ClassSchema.virtual('id').get(function (this: any) {
  return this._id?.toString?.() ?? String(this._id);
});

ClassSchema.set('toJSON', { versionKey: false, virtuals: true });
ClassSchema.set('toObject', { versionKey: false, virtuals: true });
