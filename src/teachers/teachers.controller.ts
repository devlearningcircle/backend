import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
    UseGuards,
} from '@nestjs/common';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { TeachersService } from './teachers.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

// NEW: for listing a teacher's assigned sections
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Section, SectionDocument } from '../sections/schemas/section.schema';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teachers')
export class TeachersController {
    constructor(
        private readonly teachersService: TeachersService,
        @InjectModel(Section.name) private readonly sectionModel: Model<SectionDocument>,
    ) { }

    /* ===== Admin-only CRUD ===== */

    @Post()
    @Roles(Role.ADMIN)
    create(@Body() dto: CreateTeacherDto) {
        return this.teachersService.create(dto);
    }

    @Get()
    @Roles(Role.ADMIN)
    findAll() {
        return this.teachersService.findAll();
    }

    @Get('search')
    @Roles(Role.ADMIN)
    search(
        @Query('q') query?: string,
        @Query('limit') limit?: string,
    ) {
        if (!query || query.trim().length === 0) {
            throw new BadRequestException('Search query is required');
        }
        const limitNum = Math.max(1, Math.min(Number(limit ?? 50) || 50, 100));
        return this.teachersService.searchTeachers(query, limitNum);
    }

    /* ===== Authenticated helper (for assignments) ===== */

    // Minimal list for selecting teachers when assigning sections
    @Get('public/min')
    @Roles(Role.ADMIN, Role.TEACHER) // allow teachers to see peers' names/subjects if needed
    getMinimal() {
        return this.teachersService.findMinimal();
    }

    /* ===== Teacher self endpoints (place BEFORE :id) ===== */

    @Get('me')
    @Roles(Role.TEACHER)
    me(@CurrentUser('id') userId: string) {
        return this.teachersService.findOne(userId);
    }

    // See sections assigned to me
    @Get('me/sections')
    @Roles(Role.TEACHER)
    async mySections(@CurrentUser('id') teacherId: string) {
        return this.sectionModel
            .find({ assignedTeacherId: teacherId })
            .select({ _id: 1, name: 1, classId: 1, assignedTeacherId: 1 })
            .sort({ name: 1 })
            .lean({ virtuals: true });
    }

    @Put('me/password')
    @Roles(Role.TEACHER)
    async updateOwnPassword(
        @CurrentUser('id') userId: string,
        @Body('currentPassword') currentPassword: string,
        @Body('password') newPassword: string,
    ) {
        if (!currentPassword) {
            throw new BadRequestException('Current password is required');
        }
        if (!newPassword || String(newPassword).length < 8) {
            throw new BadRequestException('Password must be at least 8 characters');
        }

        // Verify current password
        const teacher = await this.teachersService.findByIdForAuth(userId);
        if (!teacher) {
            throw new BadRequestException('Teacher not found');
        }
        const isPasswordValid = await bcrypt.compare(currentPassword, teacher.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Hash the new password before passing to service
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        return this.teachersService.updatePassword(userId, hashedPassword);
    }

    /* ===== Admin-only by-id (keep LAST) ===== */

    @Get(':id')
    @Roles(Role.ADMIN)
    findOne(@Param('id', new MongoIdPipe()) id: string) {
        return this.teachersService.findOne(id);
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    update(
        @Param('id', new MongoIdPipe()) id: string,
        @Body() dto: UpdateTeacherDto,
    ) {
        return this.teachersService.update(id, dto);
    }

    @Put(':id/reset-password')
    @Roles(Role.ADMIN)
    async resetPassword(
        @Param('id', new MongoIdPipe()) id: string,
        @Body('password') newPassword: string,
    ) {
        if (!newPassword || String(newPassword).length < 8) {
            throw new BadRequestException('Password must be at least 8 characters');
        }
        // Hash the password here before passing to service
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        return this.teachersService.updatePassword(id, hashedPassword);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    remove(@Param('id', new MongoIdPipe()) id: string) {
        return this.teachersService.delete(id);
    }
}
