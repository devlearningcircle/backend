import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChangeLogDocument = ChangeLog & Document;

@Schema({ timestamps: true, versionKey: false })
export class ChangeLog {
    _id: string;

    @Prop({ type: String, required: true })
    entity: string; // e.g. 'AcademicYear'

    @Prop({ type: String, required: true })
    entityId: string; // keep as string; or Types.ObjectId if you prefer

    @Prop({
        type: String,
        required: true,
        enum: ['create', 'update', 'delete', 'activate', 'set-current'],
    })
    action: 'create' | 'update' | 'delete' | 'activate' | 'set-current';

    // Use Mixed for arbitrary JSON blobs
    @Prop({ type: MongooseSchema.Types.Mixed })
    before?: Record<string, any>;

    @Prop({ type: MongooseSchema.Types.Mixed })
    after?: Record<string, any>;

    // 🔧 EXPLICIT TYPE + default null to allow "nullable"
    @Prop({ type: String, default: null, index: true })
    academicYearId?: string | null;

    @Prop({ type: String, default: null })
    actorUserId?: string | null;

    createdAt: Date;
    updatedAt: Date;
}

export const ChangeLogSchema = SchemaFactory.createForClass(ChangeLog);
