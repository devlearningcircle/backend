import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Section, SectionDocument } from './schemas/section.schema';
import { Model } from 'mongoose';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { toJSON } from '../common/utils/mongo-serializer';

@Injectable()
export class SectionsService {
  constructor(
    @InjectModel(Section.name) private sectionModel: Model<SectionDocument>,
  ) { }

  private norm(v: string) {
    return (v || '').trim();
  }
  private lc(v: string) {
    return (v || '').trim().toLowerCase();
  }

  private handleDup(err: any) {
    if (err?.code === 11000) {
      const fields = Object.keys(err?.keyPattern || {});
      if (fields.includes('name') && fields.includes('classId')) {
        throw new BadRequestException('Section already exists in this class');
      }
      if (fields.includes('classId') && fields.includes('order')) {
        throw new BadRequestException('Section order must be unique within the class');
      }
      throw new BadRequestException('Duplicate value');
    }
    throw err;
  }

  async create(dto: CreateSectionDto) {
    try {
      const doc = await this.sectionModel.create({
        name: this.lc(dto.name),
        classId: this.norm(dto.classId),
        assignedTeacherId: dto.assignedTeacherId ? this.norm(dto.assignedTeacherId) : undefined,
        order: dto.order,
      });
      return doc.toJSON();
    } catch (err) {
      this.handleDup(err);
    }
  }

  async findAll() {
    const sections = await this.sectionModel
      .find()
      .sort({ classId: 1, order: 1, name: 1 })
      .lean();
    return toJSON(sections);
  }

  async findByClass(classId: string) {
    const sections = await this.sectionModel
      .find({ classId: this.norm(classId) })
      .sort({ order: 1, name: 1 })
      .lean();
    return toJSON(sections);
  }

  async findOne(id: string) {
    const section = await this.sectionModel
      .findById(id)
      .lean();
    return toJSON(section);
  }

  async update(id: string, dto: UpdateSectionDto) {
    const update: Partial<Section> = {};
    if (dto.name !== undefined) update.name = this.lc(dto.name);
    if (dto.classId !== undefined) update.classId = this.norm(dto.classId);
    if (dto.assignedTeacherId !== undefined)
      update.assignedTeacherId = dto.assignedTeacherId ? this.norm(dto.assignedTeacherId) : undefined;
    if (dto.order !== undefined) update.order = dto.order;

    try {
      const section = await this.sectionModel
        .findByIdAndUpdate(id, update, { new: true, runValidators: true })
        .lean();
      return toJSON(section);
    } catch (err) {
      this.handleDup(err);
    }
  }

  async delete(id: string) {
    const section = await this.sectionModel
      .findByIdAndDelete(id)
      .lean();
    return toJSON(section);
  }
}
