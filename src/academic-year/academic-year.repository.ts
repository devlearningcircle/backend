import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicYear, AcademicYearDocument } from './academic-year.schema';

@Injectable()
export class AcademicYearRepository {
    constructor(@InjectModel(AcademicYear.name) private readonly model: Model<AcademicYearDocument>) { }

    // Helper to ensure _id is always a string and add id field
    private serialize(doc: any): AcademicYear | null {
        if (!doc) return null;
        if (doc._id) {
            if (typeof doc._id !== 'string') doc._id = String(doc._id);
            doc.id = doc._id;
        }
        return doc as AcademicYear;
    }

    private serializeMany(docs: any[]): AcademicYear[] {
        return docs.map(doc => {
            if (doc._id) {
                if (typeof doc._id !== 'string') doc._id = String(doc._id);
                doc.id = doc._id;
            }
            return doc as AcademicYear;
        });
    }

    async create(data: Partial<AcademicYear>): Promise<AcademicYear> {
        const doc = await this.model.create(data);
        const serialized = this.serialize(doc.toJSON());
        if (!serialized) throw new Error('Failed to create academic year');
        return serialized;
    }

    async findById(id: string): Promise<AcademicYear | null> {
        const doc = await this.model.findById(id).lean().exec();
        return this.serialize(doc);
    }

    async findOne(filter: any): Promise<AcademicYear | null> {
        const doc = await this.model.findOne(filter).lean().exec();
        return this.serialize(doc);
    }

    async findMany(filter: any = {}, sort: any = { startDate: -1 }): Promise<AcademicYear[]> {
        const docs = await this.model.find(filter).sort(sort).lean().exec();
        return this.serializeMany(docs || []);
    }

    async updateById(id: string, patch: Partial<AcademicYear>): Promise<AcademicYear | null> {
        const doc = await this.model.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean().exec();
        return this.serialize(doc);
    }

    async unsetAllCurrent() { await this.model.updateMany({ isCurrent: true }, { $set: { isCurrent: false } }); }

    async hasOverlap(startDate: Date, endDate: Date, excludeId?: string) {
        const filter: any = { $and: [{ startDate: { $lte: endDate } }, { endDate: { $gte: startDate } }] };
        if (excludeId) filter._id = { $ne: excludeId };
        return !!(await this.model.exists(filter));
    }
}
