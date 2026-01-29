import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { Model, PipelineStage, Types } from 'mongoose';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import * as bcrypt from 'bcryptjs';
import { PromoteBulkDto } from './dto/promote-bulk.dto';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { Section, SectionDocument } from '../sections/schemas/section.schema';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';
import { toFullUrl } from '../common/helpers/url.helper';

type DocumentsInput = Partial<{
  photoUrl: string;
  fatherPhotoUrl: string;
  motherPhotoUrl: string;
  birthCertificateUrl: string;
  scstCertificateUrl: string;
  leavingCertificateUrl: string;
  vaccineCardUrl: string;
}>;

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

// Minimal shape we rely on for AcademicYear
type AcademicYearLike = {
  _id: any;
  label?: string;
  order?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  isActive?: boolean;
};

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(Section.name) private sectionModel: Model<SectionDocument>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<EnrollmentDocument>,
  ) { }

  // ---------------- helpers ----------------
  private normEmail(email: string) {
    return (email || '').trim().toLowerCase();
  }
  private normRoll(roll: string) {
    return (roll || '').trim();
  }
  private toDateOrUndefined(iso?: string) {
    return iso ? new Date(iso) : undefined;
  }

  // Convert relative document URLs to full URLs
  private convertDocumentUrls(student: any): any {
    if (!student) return student;

    const convertedStudent = { ...student };

    if (convertedStudent.documents) {
      const docs = convertedStudent.documents;
      convertedStudent.documents = {
        ...docs,
        photoUrl: docs.photoUrl ? toFullUrl(docs.photoUrl) : docs.photoUrl,
        fatherPhotoUrl: docs.fatherPhotoUrl ? toFullUrl(docs.fatherPhotoUrl) : docs.fatherPhotoUrl,
        motherPhotoUrl: docs.motherPhotoUrl ? toFullUrl(docs.motherPhotoUrl) : docs.motherPhotoUrl,
        birthCertificateUrl: docs.birthCertificateUrl ? toFullUrl(docs.birthCertificateUrl) : docs.birthCertificateUrl,
        scstCertificateUrl: docs.scstCertificateUrl ? toFullUrl(docs.scstCertificateUrl) : docs.scstCertificateUrl,
        leavingCertificateUrl: docs.leavingCertificateUrl ? toFullUrl(docs.leavingCertificateUrl) : docs.leavingCertificateUrl,
        vaccineCardUrl: docs.vaccineCardUrl ? toFullUrl(docs.vaccineCardUrl) : docs.vaccineCardUrl,
      };
    }

    // Custom documents array
    if (convertedStudent.customDocuments && Array.isArray(convertedStudent.customDocuments)) {
      convertedStudent.customDocuments = convertedStudent.customDocuments.map((doc: any) => ({
        ...doc,
        documentUrl: doc.documentUrl ? toFullUrl(doc.documentUrl) : doc.documentUrl,
      }));
    }

    // Custom images array
    if (convertedStudent.customImages && Array.isArray(convertedStudent.customImages)) {
      convertedStudent.customImages = convertedStudent.customImages.map((img: any) => ({
        ...img,
        imageUrl: img.imageUrl ? toFullUrl(img.imageUrl) : img.imageUrl,
      }));
    }

    return convertedStudent;
  }

  private async handleDupKey(err: any) {
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || {});
      if (fields.includes('email')) throw new BadRequestException('Email already exists');
      if (fields.includes('rollNumber') || (fields.includes('academicYearId') && fields.includes('rollNumber'))) {
        throw new BadRequestException('Roll number already exists for this academic year');
      }
      throw new BadRequestException('Duplicate key error');
    }
    throw err;
  }

  // Access AY model dynamically (AcademicYear module must be registered in same connection)
  private get ayModel(): Model<any> {
    return (this.studentModel as any).db.model('AcademicYear');
  }

  private parseAYLabel(label?: string): [number, number] | null {
    const m = /^(\d{4})\s*-\s*(\d{4})$/.exec(String(label || ''));
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }

  private async getAcademicYearById(id: string): Promise<AcademicYearLike> {
    const doc = await this.ayModel.findById(id).lean();
    if (!doc) throw new BadRequestException('Academic year not found');
    return doc as AcademicYearLike;
  }

  private async assertIsCurrentAcademicYear(yearId: string) {
    // Try to get explicitly marked current year
    let current: any = await this.ayModel.findOne({ isCurrent: true }).lean();

    // Fallback: get the most recent active academic year (same logic as getCurrent())
    if (!current) {
      const activeYears = await this.ayModel.find({ isActive: true }).lean();
      if (activeYears.length === 0) {
        throw new BadRequestException('No current or active academic year is set. Please set a current year first.');
      }
      // Sort by startDate descending and use the most recent
      const sorted = activeYears.sort((a: any, b: any) => {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        return dateB - dateA;
      });
      current = sorted[0];
    }

    if (String(current._id) !== String(yearId)) {
      throw new BadRequestException('Promotion is only allowed from the current academic year. Please select the current academic year in the topbar.');
    }
  }

  private async assertNextAcademicYear(fromId: string, toId: string) {
    if (String(fromId) === String(toId)) {
      throw new BadRequestException('Target academic year must be the next one (cannot use the same year).');
    }

    // Fetch sequentially to keep types simple (avoids Promise.all inference issues)
    const from = await this.getAcademicYearById(fromId);
    const to = await this.getAcademicYearById(toId);

    // Prefer numeric order if both present
    if (typeof from.order === 'number' && typeof to.order === 'number') {
      if (to.order !== from.order + 1) {
        throw new BadRequestException('Target academic year must be the immediate next year.');
      }
      return;
    }

    // Fallback: parse label "YYYY-YYYY"
    const pf = this.parseAYLabel(from.label);
    const pt = this.parseAYLabel(to.label);
    if (pf && pt) {
      if (pt[0] === pf[0] + 1 && pt[1] === pf[1] + 1) return;
      throw new BadRequestException('Target academic year must be the immediate next year.');
    }

    // Last resort: compare dates if available
    if (from.endDate && to.startDate) {
      const fromEnd = new Date(from.endDate);
      const toStart = new Date(to.startDate);
      if (toStart > fromEnd) return;
    }

    throw new BadRequestException('Cannot verify academic year sequence; ensure the target is the next year.');
  }

  // ---------------- create/update ----------------
  async create(dto: CreateStudentDto, docs?: DocumentsInput) {
    const email = this.normEmail(dto.email);

    if (await this.studentModel.findOne({ email }).lean())
      throw new BadRequestException('Email already exists');

    // Fetch class and section if provided
    let classDoc, sectionDoc, rollNumber;
    if (dto.classId && dto.sectionId) {
      [classDoc, sectionDoc] = await Promise.all([
        this.classModel.findById(dto.classId).select('name').lean(),
        this.sectionModel.findById(dto.sectionId).select('name').lean(),
      ]);

      if (!classDoc) throw new BadRequestException('Class not found');
      if (!sectionDoc) throw new BadRequestException('Section not found');

      // Auto-generate roll number based on class and section
      const { generateRollNumber } = await import('../common/utils/id-generator');
      rollNumber = await generateRollNumber(
        this.enrollmentModel,
        classDoc.name,
        sectionDoc.name,
        dto.academicYearId,
      );
    } else {
      // If class/section not provided, use a temporary roll number
      rollNumber = 'TBD';
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Generate unique student ID
    const { generateStudentId } = await import('../common/utils/id-generator');
    const uniqueId = await generateStudentId(this.studentModel);

    const session = await (this.studentModel as any).db.startSession();
    try {
      await session.withTransaction(async () => {
        const student = await this.studentModel.create([{
          name: (dto.name || '').trim(),
          uniqueId,
          rollNumber,
          email,
          password: hashedPassword,
          role: 'student',
          classId: dto.classId,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          gender: dto.gender,
          dateOfBirth: this.toDateOrUndefined(dto.dateOfBirth),
          motherTongue: dto.motherTongue,
          bloodGroup: dto.bloodGroup,
          heightCm: dto.heightCm,
          weightKg: dto.weightKg,
          guardianName: dto.guardianName,
          guardianRelation: dto.guardianRelation,
          phone: dto.phone,
          whatsapp: dto.whatsapp,
          address: dto.address,
          father: {
            name: dto.fatherName, occupation: dto.fatherOccupation, monthlyIncome: dto.fatherMonthlyIncome,
            phone: dto.fatherPhone, whatsapp: dto.fatherWhatsapp,
          },
          mother: {
            name: dto.motherName, occupation: dto.motherOccupation, monthlyIncome: dto.motherMonthlyIncome,
            phone: dto.motherPhone, whatsapp: dto.motherWhatsapp,
          },
          documents: docs,
          // Dynamic arrays
          customDocuments: dto.customDocuments || [],
          customImages: dto.customImages || [],
          education: dto.education || [],
        }], { session });

        const s = student[0];
        await this.enrollmentModel.create([{
          studentId: String(s._id),
          academicYearId: dto.academicYearId,
          classId: dto.classId,
          sectionId: dto.sectionId,
          rollNumber,
        }], { session });
      });

      return this.studentModel.findOne({ email }, { password: 0 }).lean();
    } catch (err) {
      await this.handleDupKey(err);
    } finally {
      await session.endSession();
    }
  }

  // ---------------- lookups ----------------
  async findByEmailForAuth(email: string) {
    return this.studentModel.findOne({ email: this.normEmail(email) }).lean();
  }
  async findByIdForAuth(id: string) {
    return this.studentModel.findById(id).lean();
  }
  async findByEmail(email: string) {
    return this.studentModel.findOne({ email: this.normEmail(email) }, { password: 0 }).lean();
  }
  async findByPhone(phone: string) {
    return this.studentModel.findOne({ phone }, { password: 0 }).lean();
  }

  async findAll() {
    const students = await this.studentModel.find({}, { password: 0 }).sort({ createdAt: -1 }).lean();
    return students.map(s => this.convertDocumentUrls(s));
  }

  async searchStudents(query: string, limit: number = 50) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchRegex = new RegExp(query.trim(), 'i');
    const students = await this.studentModel
      .find(
        {
          $or: [
            { name: searchRegex },
            { email: searchRegex },
            { rollNumber: searchRegex },
          ],
        },
        { password: 0 }
      )
      .limit(limit)
      .sort({ name: 1 })
      .lean();

    return students.map(s => this.convertDocumentUrls(s));
  }

  async findOne(id: string, academicYearId?: string) {
    if (academicYearId) {
      // Use aggregation to include status for selected academic year
      const objectId = new Types.ObjectId(id);
      const pipeline: PipelineStage[] = [
        { $match: { _id: objectId } },
        {
          $lookup: {
            from: 'enrollments',
            let: { sid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$studentId', { $toString: '$$sid' }] },
                  academicYearId,
                },
              },
            ],
            as: 'enr',
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            uniqueId: 1,
            email: 1,
            role: 1,
            gender: 1,
            dateOfBirth: 1,
            motherTongue: 1,
            bloodGroup: 1,
            heightCm: 1,
            weightKg: 1,
            guardianName: 1,
            guardianRelation: 1,
            phone: 1,
            father: 1,
            mother: 1,
            documents: 1,
            createdAt: 1,
            updatedAt: 1,

            // If enrollment exists for selected AY, use its values; otherwise use current snapshot
            rollNumber: {
              $cond: [
                { $gt: [{ $size: '$enr' }, 0] },
                { $arrayElemAt: ['$enr.rollNumber', 0] },
                '$rollNumber',
              ],
            },
            classId: {
              $cond: [
                { $gt: [{ $size: '$enr' }, 0] },
                { $arrayElemAt: ['$enr.classId', 0] },
                '$classId',
              ],
            },
            sectionId: {
              $cond: [
                { $gt: [{ $size: '$enr' }, 0] },
                { $arrayElemAt: ['$enr.sectionId', 0] },
                '$sectionId',
              ],
            },
            academicYearId: {
              $cond: [
                { $gt: [{ $size: '$enr' }, 0] },
                { $arrayElemAt: ['$enr.academicYearId', 0] },
                '$academicYearId',
              ],
            },

            // Status for selected AY (active if student's current snapshot matches this AY)
            isActiveForSelectedYear: { $eq: ['$academicYearId', academicYearId] },
            statusForSelectedYear: {
              $cond: [
                { $eq: ['$academicYearId', academicYearId] },
                'active',
                'deactivated',
              ],
            },
          },
        },
      ];

      const result = await this.studentModel.aggregate(pipeline).exec();
      return result.length > 0 ? this.convertDocumentUrls(result[0]) : null;
    }

    // No academic year context, return raw student data
    const student = await this.studentModel.findById(id, { password: 0 }).lean();
    return this.convertDocumentUrls(student);
  }

  async update(id: string, dto: UpdateStudentDto) {
    // Check email uniqueness
    if (dto.email !== undefined) {
      const email = this.normEmail(dto.email);
      const emailExists = await this.studentModel.findOne({
        email,
        _id: { $ne: id },
      }).lean();
      if (emailExists) {
        throw new BadRequestException('Email already exists');
      }
    }

    // Check if we're updating academicYearId or rollNumber to avoid duplicate key error
    if (dto.academicYearId !== undefined || dto.rollNumber !== undefined) {
      const current = await this.studentModel.findById(id).lean();
      if (!current) throw new BadRequestException('Student not found');

      const finalAcademicYearId = dto.academicYearId ?? current.academicYearId;
      const finalRollNumber = dto.rollNumber !== undefined ? this.normRoll(dto.rollNumber) : current.rollNumber;

      // Check if another student has this academicYearId + rollNumber combination
      const duplicate = await this.studentModel.findOne({
        academicYearId: finalAcademicYearId,
        rollNumber: finalRollNumber,
        _id: { $ne: id }, // exclude current student
      }).lean();

      if (duplicate) {
        throw new BadRequestException('Roll number already exists for this academic year');
      }
    }

    const toUpdate: any = {};

    // Basic fields
    if (dto.name !== undefined) toUpdate.name = (dto.name || '').trim();
    if (dto.email !== undefined) toUpdate.email = this.normEmail(dto.email);
    if (dto.rollNumber !== undefined) toUpdate.rollNumber = this.normRoll(dto.rollNumber);
    // Only update password if provided and not empty (min 8 chars enforced by DTO validation)
    if (dto.password !== undefined && dto.password.trim().length > 0) {
      toUpdate.password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    }
    if (dto.dateOfBirth !== undefined) toUpdate.dateOfBirth = this.toDateOrUndefined(dto.dateOfBirth as any);

    // Enrollment fields
    if (dto.classId !== undefined) toUpdate.classId = dto.classId;
    if (dto.sectionId !== undefined) toUpdate.sectionId = dto.sectionId;
    if (dto.academicYearId !== undefined) toUpdate.academicYearId = dto.academicYearId;
    if (dto.gender !== undefined) toUpdate.gender = dto.gender;

    // Student info fields
    if (dto.motherTongue !== undefined) toUpdate.motherTongue = dto.motherTongue;
    if (dto.bloodGroup !== undefined) toUpdate.bloodGroup = dto.bloodGroup;
    if (dto.heightCm !== undefined) toUpdate.heightCm = dto.heightCm;
    if (dto.weightKg !== undefined) toUpdate.weightKg = dto.weightKg;
    if (dto.guardianName !== undefined) toUpdate.guardianName = dto.guardianName;
    if (dto.guardianRelation !== undefined) toUpdate.guardianRelation = dto.guardianRelation;
    if (dto.phone !== undefined) toUpdate.phone = dto.phone;
    if (dto.whatsapp !== undefined) toUpdate.whatsapp = dto.whatsapp;
    if (dto.address !== undefined) toUpdate.address = dto.address;

    // Father info - use dot notation to update only specified fields without overwriting the entire object
    if (dto.fatherName !== undefined) toUpdate['father.name'] = dto.fatherName;
    if (dto.fatherOccupation !== undefined) toUpdate['father.occupation'] = dto.fatherOccupation;
    if (dto.fatherMonthlyIncome !== undefined) toUpdate['father.monthlyIncome'] = dto.fatherMonthlyIncome;
    if (dto.fatherPhone !== undefined) toUpdate['father.phone'] = dto.fatherPhone;
    if (dto.fatherWhatsapp !== undefined) toUpdate['father.whatsapp'] = dto.fatherWhatsapp;

    // Mother info - use dot notation to update only specified fields without overwriting the entire object
    if (dto.motherName !== undefined) toUpdate['mother.name'] = dto.motherName;
    if (dto.motherOccupation !== undefined) toUpdate['mother.occupation'] = dto.motherOccupation;
    if (dto.motherMonthlyIncome !== undefined) toUpdate['mother.monthlyIncome'] = dto.motherMonthlyIncome;
    if (dto.motherPhone !== undefined) toUpdate['mother.phone'] = dto.motherPhone;
    if (dto.motherWhatsapp !== undefined) toUpdate['mother.whatsapp'] = dto.motherWhatsapp;

    // Document URLs (from Cloudinary uploads on frontend)
    const anyDto = dto as any;
    if (anyDto.photoUrl !== undefined) toUpdate['documents.photoUrl'] = anyDto.photoUrl;
    if (anyDto.fatherPhotoUrl !== undefined) toUpdate['documents.fatherPhotoUrl'] = anyDto.fatherPhotoUrl;
    if (anyDto.motherPhotoUrl !== undefined) toUpdate['documents.motherPhotoUrl'] = anyDto.motherPhotoUrl;
    if (anyDto.birthCertificateUrl !== undefined) toUpdate['documents.birthCertificateUrl'] = anyDto.birthCertificateUrl;
    if (anyDto.scstCertificateUrl !== undefined) toUpdate['documents.scstCertificateUrl'] = anyDto.scstCertificateUrl;
    if (anyDto.leavingCertificateUrl !== undefined) toUpdate['documents.leavingCertificateUrl'] = anyDto.leavingCertificateUrl;
    if (anyDto.vaccineCardUrl !== undefined) toUpdate['documents.vaccineCardUrl'] = anyDto.vaccineCardUrl;

    // Dynamic arrays
    if (dto.customDocuments !== undefined) toUpdate.customDocuments = dto.customDocuments;
    if (dto.customImages !== undefined) toUpdate.customImages = dto.customImages;
    if (dto.education !== undefined) toUpdate.education = dto.education;

    try {
      // Check if class or section is being updated
      const isClassOrSectionUpdated = dto.classId !== undefined || dto.sectionId !== undefined;

      if (isClassOrSectionUpdated) {
        // Get current student data to check current values
        const currentStudent = await this.studentModel.findById(id).lean();
        if (!currentStudent) throw new BadRequestException('Student not found');

        const finalClassId = dto.classId ?? currentStudent.classId;
        const finalSectionId = dto.sectionId ?? currentStudent.sectionId;
        const academicYearId = currentStudent.academicYearId;

        // Update the enrollment record for the current academic year
        await this.enrollmentModel.findOneAndUpdate(
          {
            studentId: id,
            academicYearId: academicYearId
          },
          {
            $set: {
              classId: finalClassId,
              sectionId: finalSectionId
            }
          },
          { upsert: false } // Don't create if doesn't exist
        );
      }

      // Update student document
      const updated = await this.studentModel.findByIdAndUpdate(
        id,
        { $set: toUpdate },
        { new: true, projection: { password: 0 } },
      ).lean();

      return updated;
    } catch (err) {
      await this.handleDupKey(err);
    }
  }

  async updateDocuments(id: string, docs: DocumentsInput) {
    const set: any = {};
    if (docs.photoUrl !== undefined) set['documents.photoUrl'] = docs.photoUrl;
    if (docs.fatherPhotoUrl !== undefined) set['documents.fatherPhotoUrl'] = docs.fatherPhotoUrl;
    if (docs.motherPhotoUrl !== undefined) set['documents.motherPhotoUrl'] = docs.motherPhotoUrl;

    const updated = await this.studentModel.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true, projection: { password: 0 } },
    );
    if (!updated) throw new NotFoundException('Student not found');
    return updated;
  }

  delete(id: string) {
    return this.studentModel.findByIdAndDelete(id);
  }

  // ---------------- promotions ----------------
  async promote(studentId: string, classId: string, sectionId: string, academicYearId: string) {
    const student = await this.studentModel.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');

    // AY rule: student's current year must be the current academic year
    await this.assertIsCurrentAcademicYear(String(student.academicYearId));

    // AY rule: must be next AY
    await this.assertNextAcademicYear(String(student.academicYearId), academicYearId);

    const rollNumber = student.rollNumber;

    const exists = await this.enrollmentModel.findOne({ studentId, academicYearId }).lean();
    if (exists) throw new BadRequestException('Student already has an enrollment for this academic year');

    const session = await (this.studentModel as any).db.startSession();
    try {
      await session.withTransaction(async () => {
        // keep history (new enrollment)
        await this.enrollmentModel.create([{
          studentId, academicYearId, classId, sectionId, rollNumber,
        }], { session });

        // update snapshot to new AY + class/section
        student.classId = classId;
        student.sectionId = sectionId;
        student.academicYearId = academicYearId;
        await student.save({ session });
      });

      const obj = student.toJSON(); delete (obj as any).password;
      return obj;
    } finally {
      await session.endSession();
    }
  }

  async promoteBulk(dto: PromoteBulkDto, headerAY?: string) {
    const fromAY = dto.fromAcademicYearId || headerAY;
    if (!fromAY) throw new BadRequestException('fromAcademicYearId (or x-academic-year-id) is required');

    // AY rule: fromAY must be the current academic year
    await this.assertIsCurrentAcademicYear(fromAY);

    const filter: any = { classId: dto.fromClassId, academicYearId: fromAY };
    if (dto.fromSectionId) filter.sectionId = dto.fromSectionId;

    // If specific studentIds are provided, only promote those students
    if (dto.studentIds && dto.studentIds.length > 0) {
      filter._id = { $in: dto.studentIds };
    }

    const students = await this.studentModel
      .find(filter)
      .select({ _id: 1, rollNumber: 1, sectionId: 1, academicYearId: 1 })
      .lean();

    if (!students.length) return { selected: dto.studentIds?.length || 0, matched: 0, modified: 0 };

    // AY rule: target must be next AY
    await this.assertNextAcademicYear(fromAY, dto.toAcademicYearId);

    // Target class: infer next if not provided
    let targetClassId = dto.targetClassId;
    if (!targetClassId) {
      const currentClass = await this.classModel.findById(dto.fromClassId).lean();
      if (!currentClass || (currentClass as any).order === undefined) {
        throw new BadRequestException('Cannot infer next class: current class not found or has no order');
      }
      const next = await this.classModel
        .findOne({ order: { $gt: (currentClass as any).order } })
        .sort({ order: 1 })
        .lean();
      if (!next) throw new BadRequestException('No next class configured after current class');
      targetClassId = String((next as any)._id);
    }

    // If target section not specified, map students to equivalent sections in target class by name
    let sectionMapping: Map<string, string> | null = null;
    if (!dto.targetSectionId) {
      // Get unique section IDs from students
      const uniqueSectionIds = [...new Set(students.map(s => s.sectionId).filter(Boolean))];

      if (uniqueSectionIds.length > 0) {
        // Fetch source sections
        const sourceSections = await this.sectionModel
          .find({ _id: { $in: uniqueSectionIds } })
          .select({ _id: 1, name: 1 })
          .lean();

        // Fetch target sections for the target class
        const targetSections = await this.sectionModel
          .find({ classId: targetClassId })
          .select({ _id: 1, name: 1 })
          .lean();

        // Create mapping: old section ID → new section ID (by matching names)
        sectionMapping = new Map();
        for (const srcSection of sourceSections) {
          const matchingTarget = targetSections.find(
            t => t.name.toLowerCase() === srcSection.name.toLowerCase()
          );
          if (matchingTarget) {
            sectionMapping.set(String(srcSection._id), String(matchingTarget._id));
          }
        }
      }
    }

    const session = await (this.studentModel as any).db.startSession();
    try {
      let modified = 0;

      await session.withTransaction(async () => {
        // Helper to get the target section ID for a student
        const getTargetSectionId = (currentSectionId: string): string => {
          if (dto.targetSectionId) {
            // Explicit target section specified
            return dto.targetSectionId;
          }
          if (sectionMapping && currentSectionId) {
            // Use mapped section or throw error if no match found
            const mapped = sectionMapping.get(currentSectionId);
            if (!mapped) {
              throw new BadRequestException(
                `No matching section found in target class for section ID: ${currentSectionId}. Please specify a target section.`
              );
            }
            return mapped;
          }
          // Fallback: keep same section ID (might be invalid, but maintains backward compatibility for edge cases)
          return currentSectionId;
        };

        const docs = students.map(s => ({
          studentId: String(s._id),
          academicYearId: dto.toAcademicYearId,
          classId: targetClassId!,
          sectionId: getTargetSectionId(s.sectionId),
          rollNumber: s.rollNumber,
        }));

        // keep history; ignore dup enrollments gracefully
        try {
          await this.enrollmentModel.insertMany(docs, { session, ordered: false });
        } catch { /* ignore duplicate enrollments */ }

        // Use bulkWrite to update each student individually with their correct section
        const bulkOps = students.map(s => ({
          updateOne: {
            filter: { _id: s._id },
            update: {
              $set: {
                classId: targetClassId!,
                academicYearId: dto.toAcademicYearId,
                sectionId: getTargetSectionId(s.sectionId),
              },
            },
          },
        }));

        const result = await this.studentModel.bulkWrite(bulkOps, { session });
        modified = result.modifiedCount ?? 0;
      });

      return {
        selected: students.length,
        matched: students.length,
        modified,
        toAcademicYearId: dto.toAcademicYearId,
        targetClassId,
        targetSectionId: dto.targetSectionId ?? null,
      };
    } finally {
      await session.endSession();
    }
  }

  // ---------------- filtering ----------------
  async filterStudents(filters: { classId?: string; sectionId?: string; academicYearId?: string }) {
    let students: any[];
    if (filters.academicYearId) {
      const matchEnrollment: any = { academicYearId: filters.academicYearId };
      if (filters.classId) matchEnrollment.classId = filters.classId;
      if (filters.sectionId) matchEnrollment.sectionId = filters.sectionId;

      const pipeline: PipelineStage[] = [
        {
          $lookup: {
            from: 'enrollments',
            let: { sid: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$studentId', { $toString: '$$sid' }] },
                  ...matchEnrollment,
                },
              },
            ],
            as: 'enr',
          },
        },
        { $unwind: { path: '$enr' } },
        {
          // Include-only projection (no mixing include/exclude)
          $project: {
            _id: 1,
            name: 1,
            uniqueId: 1,
            email: 1,
            role: 1,
            gender: 1,
            dateOfBirth: 1,
            motherTongue: 1,
            bloodGroup: 1,
            heightCm: 1,
            weightKg: 1,
            guardianName: 1,
            guardianRelation: 1,
            phone: 1,
            father: 1,
            mother: 1,
            documents: 1,
            createdAt: 1,
            updatedAt: 1,

            // values from enrollment for the selected AY
            rollNumber: '$enr.rollNumber',
            classId: '$enr.classId',
            sectionId: '$enr.sectionId',
            academicYearId: '$enr.academicYearId',

            // status for selected AY (active if student's current snapshot matches this AY)
            isActiveForSelectedYear: { $eq: ['$academicYearId', '$enr.academicYearId'] },
            statusForSelectedYear: {
              $cond: [
                { $eq: ['$academicYearId', '$enr.academicYearId'] },
                'active',
                'deactivated',
              ],
            },
          },
        },
        { $sort: { createdAt: -1 } },
      ];
      students = await this.studentModel.aggregate(pipeline).exec();
    } else {
      // Non-AY path: simple query on current snapshot
      const q: any = {};
      if (filters.classId) q.classId = filters.classId;
      if (filters.sectionId) q.sectionId = filters.sectionId;

      students = await this.studentModel.find(q, { password: 0 }).sort({ createdAt: -1 }).lean();
    }

    // Convert document URLs to full URLs
    return students.map(s => this.convertDocumentUrls(s));
  }

  // ---------------- misc ----------------
  /**
   * Updates password for a student.
   * IMPORTANT: newPassword is expected to be ALREADY HASHED by the caller (AuthService).
   * Do NOT hash it again here to avoid double hashing.
   */
  async updatePassword(id: string, newPasswordHash: string) {
    const updated = await this.studentModel.findByIdAndUpdate(
      id,
      { password: newPasswordHash },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Student not found');
    return { message: 'Password updated successfully' };
  }

  async getMonthlyEnrollmentStats(academicYearId?: string) {
    const match: any = {};
    if (academicYearId) {
      match.academicYearId = academicYearId;
    }

    const pipeline: any[] = [];
    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }
    pipeline.push(
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    );

    const result = await this.studentModel.aggregate(pipeline);

    return result.map((d) => ({
      month: new Date(d._id.year, d._id.month - 1).toLocaleString('default', {
        month: 'short',
        year: 'numeric',
      }),
      students: d.count,
    }));
  }

  async getRecentEnrollments(limit = 5, academicYearId?: string) {
    const n = Math.max(1, Math.min(Number(limit) || 5, 25));
    const filter: any = {};
    if (academicYearId) {
      filter.academicYearId = academicYearId;
    }

    const recent = await this.studentModel
      .find(filter, { name: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(n)
      .lean();

    return recent.map((s) => ({ name: s.name, createdAt: s.createdAt }));
  }

  async findBySection(sectionId: string) {
    const students = await this.studentModel
      .find({ sectionId }, { password: 0 })
      .sort({ name: 1 })
      .lean();
    return students.map(s => this.convertDocumentUrls(s));
  }

  async findBySectionIds(sectionIds: string[]) {
    if (!sectionIds?.length) return [];
    const students = await this.studentModel
      .find({ sectionId: { $in: sectionIds } }, { password: 0 })
      .sort({ sectionId: 1, name: 1 })
      .lean();
    return students.map(s => this.convertDocumentUrls(s));
  }

  // ---------------- re-admission ----------------
  /**
   * Re-admit a student for a new academic year (no restrictions on year sequence)
   * Unlike promotion, this allows re-enrolling for any academic year
   */
  async reAdmit(studentId: string, classId: string, sectionId: string, academicYearId: string) {
    const student = await this.studentModel.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');

    // Check if student already has enrollment for this academic year
    const exists = await this.enrollmentModel.findOne({ studentId, academicYearId }).lean();
    if (exists) {
      throw new BadRequestException('Student already has an enrollment for this academic year');
    }

    // Fetch class and section to generate new roll number for the target year
    const [classDoc, sectionDoc] = await Promise.all([
      this.classModel.findById(classId).select('name').lean(),
      this.sectionModel.findById(sectionId).select('name').lean(),
    ]);

    if (!classDoc) throw new BadRequestException('Class not found');
    if (!sectionDoc) throw new BadRequestException('Section not found');

    // Generate new roll number for this academic year
    const { generateRollNumber } = await import('../common/utils/id-generator');
    const rollNumber = await generateRollNumber(
      this.enrollmentModel,
      classDoc.name,
      sectionDoc.name,
      academicYearId,
    );

    const session = await (this.studentModel as any).db.startSession();
    try {
      await session.withTransaction(async () => {
        // Create enrollment record for new academic year
        await this.enrollmentModel.create([{
          studentId,
          academicYearId,
          classId,
          sectionId,
          rollNumber,
        }], { session });

        // Update student snapshot to new academic year + class/section
        student.classId = classId;
        student.sectionId = sectionId;
        student.academicYearId = academicYearId;
        student.rollNumber = rollNumber;
        await student.save({ session });
      });

      const obj = student.toJSON();
      delete (obj as any).password;
      return obj;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Re-admit multiple students for a new academic year
   * Useful for batch re-admissions
   */
  async reAdmitBulk(studentIds: string[], classId: string, sectionId: string, academicYearId: string) {
    if (!studentIds?.length) {
      throw new BadRequestException('Student IDs are required');
    }

    // Validate class and section
    const [classDoc, sectionDoc] = await Promise.all([
      this.classModel.findById(classId).select('name').lean(),
      this.sectionModel.findById(sectionId).select('name').lean(),
    ]);

    if (!classDoc) throw new BadRequestException('Class not found');
    if (!sectionDoc) throw new BadRequestException('Section not found');

    // Fetch all students
    const students = await this.studentModel
      .find({ _id: { $in: studentIds } })
      .select({ _id: 1, name: 1 })
      .lean();

    if (!students.length) {
      throw new BadRequestException('No valid students found');
    }

    const session = await (this.studentModel as any).db.startSession();
    try {
      let successCount = 0;
      const errors: any[] = [];

      await session.withTransaction(async () => {
        const { generateRollNumber } = await import('../common/utils/id-generator');

        for (const student of students) {
          const studentId = String(student._id);

          // Check if already enrolled
          const exists = await this.enrollmentModel.findOne({ studentId, academicYearId }).lean();
          if (exists) {
            errors.push({ studentId, name: student.name, error: 'Already enrolled for this year' });
            continue;
          }

          try {
            // Generate roll number
            const rollNumber = await generateRollNumber(
              this.enrollmentModel,
              classDoc.name,
              sectionDoc.name,
              academicYearId,
            );

            // Create enrollment
            await this.enrollmentModel.create([{
              studentId,
              academicYearId,
              classId,
              sectionId,
              rollNumber,
            }], { session });

            // Update student snapshot
            await this.studentModel.findByIdAndUpdate(
              studentId,
              {
                $set: {
                  classId,
                  sectionId,
                  academicYearId,
                  rollNumber,
                },
              },
              { session },
            );

            successCount++;
          } catch (err) {
            errors.push({ studentId, name: student.name, error: err.message });
          }
        }
      });

      return {
        total: studentIds.length,
        successful: successCount,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } finally {
      await session.endSession();
    }
  }
}
