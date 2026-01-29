import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Class, ClassDocument } from './schemas/class.schema';
import { Model } from 'mongoose';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { toJSON } from '../common/utils/mongo-serializer';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
  ) { }

  private lc(v: string) {
    return (v || '').trim().toLowerCase();
  }

  private handleDup(err: any) {
    if (err?.code === 11000) {
      // Could be name or order collision
      const fields = Object.keys(err?.keyPattern || {});
      if (fields.includes('name')) {
        throw new BadRequestException('Class already exists');
      }
      if (fields.includes('order')) {
        throw new BadRequestException('Class order must be unique');
      }
      throw new BadRequestException('Duplicate value');
    }
    throw err;
  }

  async create(dto: CreateClassDto) {
    const name = this.lc(dto.name);
    const exists = await this.classModel.findOne({ name }).lean();
    if (exists) throw new BadRequestException('Class already exists');

    try {
      const doc = await this.classModel.create({ name, order: dto.order });
      return doc.toJSON();
    } catch (err) {
      this.handleDup(err);
    }
  }

  async findAll() {
    // Sort by order if set, then by name
    const classes = await this.classModel
      .find()
      .sort({ order: 1, name: 1 })
      .lean();
    return toJSON(classes);
  }

  async findOne(id: string) {
    const classDoc = await this.classModel.findById(id).lean();
    return toJSON(classDoc);
  }

  async update(id: string, dto: UpdateClassDto) {
    const update: Partial<Class> = {};

    // Check if name is being updated to a different value
    if (dto.name !== undefined) {
      const newName = this.lc(dto.name);

      // Check if another class already has this name (excluding current class)
      const existing = await this.classModel.findOne({
        name: newName,
        _id: { $ne: id }
      }).lean();

      if (existing) {
        throw new BadRequestException('Class name already exists');
      }

      update.name = newName;
    }

    // Check if order is being updated to a different value
    if (dto.order !== undefined) {
      // Check if another class already has this order (excluding current class)
      const existingOrder = await this.classModel.findOne({
        order: dto.order,
        _id: { $ne: id }
      }).lean();

      if (existingOrder) {
        throw new BadRequestException('Class order already exists. Please choose a different order.');
      }

      update.order = dto.order;
    }

    try {
      const classDoc = await this.classModel
        .findByIdAndUpdate(id, update, { new: true, runValidators: true })
        .lean();
      return toJSON(classDoc);
    } catch (err) {
      this.handleDup(err);
    }
  }

  async delete(id: string) {
    const classDoc = await this.classModel.findByIdAndDelete(id).lean();
    return toJSON(classDoc);
  }

  // Promotion helper: get the next class based on `order`
  async findNextClass(id: string) {
    const cur = await this.classModel.findById(id).lean();
    if (!cur) return null;
    if (cur.order === undefined || cur.order === null) return null;
    const nextClass = await this.classModel
      .findOne({ order: { $gt: cur.order } })
      .sort({ order: 1 })
      .lean();
    return toJSON(nextClass);
  }
}
