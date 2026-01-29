import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  ForbiddenException,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { PromoteStudentDto } from './dto/promote-student.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import * as bcrypt from 'bcryptjs';
import { toFullUrl } from 'src/common/helpers/url.helper';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Section, SectionDocument } from '../sections/schemas/section.schema';
import { PromoteBulkDto } from './dto/promote-bulk.dto';

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(process.cwd(), 'uploads', 'students');
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const name = Date.now() + '-' + Math.random().toString(36).slice(2);
    cb(null, name + extname(file.originalname));
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const ok = /(jpg|jpeg|png|pdf)$/i.test(extname(file.originalname));
  if (!ok) return cb(new BadRequestException('Only JPG, PNG, or PDF files allowed'), false);
  cb(null, true);
};

// normalize empty → undefined
const norm = (v?: string) => {
  const s = (v ?? '').trim();
  return s.length ? s : undefined;
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    @InjectModel(Section.name) private readonly sectionModel: Model<SectionDocument>,
  ) { }

  // Admin: create (supports Cloudinary URLs from frontend)
  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStudentDto) {
    // Extract document URLs from DTO (sent by frontend via Cloudinary)
    const documents = {
      photoUrl: (dto as any).photoUrl,
      fatherPhotoUrl: (dto as any).fatherPhotoUrl,
      motherPhotoUrl: (dto as any).motherPhotoUrl,
      birthCertificateUrl: (dto as any).birthCertificateUrl,
      scstCertificateUrl: (dto as any).scstCertificateUrl,
      leavingCertificateUrl: (dto as any).leavingCertificateUrl,
      vaccineCardUrl: (dto as any).vaccineCardUrl,
    };

    return this.studentsService.create(dto, documents);
  }

  // Admin: update photos only (student/father/mother)
  @Put(':id/photos')
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'photo', maxCount: 1 },
        { name: 'fatherPhoto', maxCount: 1 },
        { name: 'motherPhoto', maxCount: 1 },
      ],
      { storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } },
    ),
  )
  updatePhotos(
    @Param('id', new MongoIdPipe()) id: string,
    @UploadedFiles()
    files: {
      photo?: Express.Multer.File[];
      fatherPhoto?: Express.Multer.File[];
      motherPhoto?: Express.Multer.File[];
    },
  ) {
    const toUrl = (f?: Express.Multer.File[]) =>
      f?.[0] ? toFullUrl(`/uploads/students/${f[0].filename}`) : undefined;

    return this.studentsService.updateDocuments(id, {
      photoUrl: toUrl(files?.photo),
      fatherPhotoUrl: toUrl(files?.fatherPhoto),
      motherPhotoUrl: toUrl(files?.motherPhoto),
    });
  }

  // Admin: list/filter/stats
  @Get()
  @Roles(Role.ADMIN)
  findAll(@Headers('x-academic-year-id') ayId?: string) {
    const ay = norm(ayId);
    // If academic year is provided, filter by it; otherwise return all
    if (ay) {
      return this.studentsService.filterStudents({ academicYearId: ay });
    }
    return this.studentsService.findAll();
  }

  @Get('filter')
  @Roles(Role.ADMIN)
  filter(
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Headers('x-academic-year-id') ayId?: string,
  ) {
    const classIdN = norm(classId);
    const sectionIdN = norm(sectionId);
    const ayFromQuery = norm(academicYearId);
    const ayFromHeader = norm(ayId);
    const ay = ayFromQuery ?? ayFromHeader;

    return this.studentsService.filterStudents({
      classId: classIdN,
      sectionId: sectionIdN,
      academicYearId: ay,
    });
  }

  @Get('search')
  @Roles(Role.ADMIN)
  search(
    @Query('q') query?: string,
    @Query('limit') limit?: string,
  ) {
    const q = norm(query);
    if (!q) {
      throw new BadRequestException('Search query is required');
    }
    const limitNum = Math.max(1, Math.min(Number(limit ?? 50) || 50, 100));
    return this.studentsService.searchStudents(q, limitNum);
  }

  @Get('recent')
  @Roles(Role.ADMIN)
  getRecentEnrollments(
    @Query('limit') limit?: string,
    @Headers('x-academic-year-id') ayId?: string,
  ) {
    const n = Math.max(1, Math.min(Number(limit ?? 5) || 5, 25));
    const ay = norm(ayId);
    return this.studentsService.getRecentEnrollments(n, ay);
  }

  @Get('analytics/monthly')
  @Roles(Role.ADMIN)
  getMonthlyEnrollmentStats(@Headers('x-academic-year-id') ayId?: string) {
    const ay = norm(ayId);
    return this.studentsService.getMonthlyEnrollmentStats(ay);
  }

  // Promotions
  @Put('promote/:id')
  @Roles(Role.ADMIN)
  promote(
    @Param('id', new MongoIdPipe()) id: string,
    @Body() body: PromoteStudentDto,
  ) {
    return this.studentsService.promote(
      id,
      body.newClassId,
      body.newSectionId,
      body.newAcademicYearId,
    );
  }

  @Post('promote-bulk')
  @Roles(Role.ADMIN)
  promoteBulk(
    @Body() body: PromoteBulkDto,
    @Headers('x-academic-year-id') ayId?: string,
  ) {
    return this.studentsService.promoteBulk(body, norm(ayId));
  }

  // Student self
  @Get('me')
  @Roles(Role.STUDENT)
  me(@CurrentUser('id') userId: string) {
    return this.studentsService.findOne(userId);
  }

  @Put('me/password')
  @Roles(Role.STUDENT)
  async updateOwnPassword(
    @CurrentUser('id') userId: string,
    @Body('currentPassword') currentPassword: string,
    @Body('password') newPassword: string,
  ) {
    if (!currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    if (!newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // Verify current password
    const student = await this.studentsService.findByIdForAuth(userId);
    if (!student) {
      throw new BadRequestException('Student not found');
    }
    const isPasswordValid = await bcrypt.compare(currentPassword, student.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash the new password before passing to service
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.studentsService.updatePassword(userId, hashedPassword);
  }

  // Teacher helpers
  @Get('teacher/by-section')
  @Roles(Role.TEACHER, Role.ADMIN)
  async getStudentsBySectionForTeacher(
    @Query('sectionId', new MongoIdPipe()) sectionId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    if (!sectionId) throw new BadRequestException('sectionId is required');

    if (String(role).toLowerCase() === Role.TEACHER) {
      const sec = await this.sectionModel.findById(sectionId).lean();
      if (!sec) throw new BadRequestException('Section not found');
      if (String(sec.assignedTeacherId || '') !== String(userId)) {
        throw new ForbiddenException('You are not assigned to this section.');
      }
    }

    return this.studentsService.findBySection(sectionId);
  }

  @Get('teacher/my-sections')
  @Roles(Role.TEACHER)
  async getMySectionsStudents(@CurrentUser('id') teacherId: string) {
    const sections = await this.sectionModel
      .find({ assignedTeacherId: teacherId })
      .select({ _id: 1, name: 1, classId: 1 })
      .lean();

    if (!sections.length) return [];

    const sectionIds = sections.map((s) => String(s._id));
    const students = await this.studentsService.findBySectionIds(sectionIds);

    const bySection: Record<string, any[]> = {};
    for (const s of students) {
      const sid = String(s.sectionId);
      if (!bySection[sid]) bySection[sid] = [];
      bySection[sid].push(s);
    }

    return sections.map((s) => ({
      sectionId: String(s._id),
      name: s.name,
      classId: s.classId,
      students: bySection[String(s._id)] || [],
    }));
  }

  // Admin by-id
  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(
    @Param('id', new MongoIdPipe()) id: string,
    @Headers('x-academic-year-id') ayId?: string,
  ) {
    const ay = norm(ayId);
    return this.studentsService.findOne(id, ay);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id', new MongoIdPipe()) id: string,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', new MongoIdPipe()) id: string) {
    return this.studentsService.delete(id);
  }
}
