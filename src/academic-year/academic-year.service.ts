import {
    BadRequestException, ConflictException, Injectable, PreconditionFailedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AcademicYearRepository } from './academic-year.repository';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AuditService } from 'src/audit/audit.service';
import { RequestContext } from 'src/common/context/request-context';
import { assertFound } from 'src/common/utils/assert-found';
import { Student, StudentDocument } from 'src/students/schemas/student.schema';

function toDate(d: string | Date) { return new Date(d); }
function nameFromDates(start: Date, end: Date) {
    const y1 = start.getUTCFullYear();
    const y2 = String(end.getUTCFullYear() % 100).padStart(2, '0');
    return `${y1}-${y2}`;
}

@Injectable()
export class AcademicYearService {
    constructor(
        private readonly repo: AcademicYearRepository,
        private readonly audit: AuditService,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    ) { }

    async create(dto: CreateAcademicYearDto, ctx: RequestContext) {
        const start = toDate(dto.startDate);
        const end = toDate(dto.endDate);
        if (end <= start) throw new BadRequestException('endDate must be greater than startDate');

        const computedName = nameFromDates(start, end);
        const useName = dto.name ?? computedName;

        const existing = await this.repo.findOne({ name: useName });
        if (existing) return existing; // idempotent by name

        if (await this.repo.hasOverlap(start, end)) throw new ConflictException('Date range overlaps');

        const created = await this.repo.create({
            name: useName, startDate: start, endDate: end, isActive: dto.isActive ?? true, isCurrent: false,
        });
        await this.audit.log({ entity: 'AcademicYear', entityId: String(created._id), action: 'create', after: created, ctx });
        return created;
    }

    findAll(includeInactive = true) {
        const filter = includeInactive ? {} : { isActive: true };
        return this.repo.findMany(filter);
    }

    async findOne(id: string) {
        const found = await this.repo.findById(id);
        assertFound(found, 'Academic year not found');
        return found;
    }

    async getCurrent() {
        // Try to get explicitly marked current year
        const current = await this.repo.findOne({ isCurrent: true });
        if (current) return current;

        // Fallback: get the most recent active academic year
        const activeYears = await this.repo.findMany({ isActive: true });
        if (activeYears.length === 0) return null;

        // Sort by startDate descending and return the most recent
        const sorted = activeYears.sort((a, b) => {
            const dateA = new Date(a.startDate).getTime();
            const dateB = new Date(b.startDate).getTime();
            return dateB - dateA;
        });

        return sorted[0];
    }

    // Lightweight method for topbar - returns only active years with minimal fields
    // For students: only their current academic year
    // For teachers/admins: all active years
    async findForTopbar(userId?: string, role?: string) {
        // For students, filter to only show their associated academic year
        if (role?.toLowerCase() === 'student' && userId) {
            try {
                const student = await this.studentModel.findById(userId, { academicYearId: 1 }).lean();

                if (student?.academicYearId) {
                    // Fetch student's academic year directly (even if inactive)
                    // Students need to see their year regardless of active status
                    const studentYear = await this.repo.findById(String(student.academicYearId));

                    if (studentYear) {
                        return [{
                            _id: studentYear._id,
                            name: studentYear.name,
                            label: studentYear.name,
                            isCurrent: studentYear.isCurrent,
                            isActive: studentYear.isActive,
                        }];
                    }
                }

                // Student has no academicYearId assigned - return empty array
                // This prevents showing all years to students without assignment
                return [];
            } catch (error) {
                // If there's an error fetching student data, return empty array
                // Do NOT fall back to showing all years for security
                console.error('Error fetching student academic year:', error);
                return [];
            }
        }

        // For admins and teachers, return all active years
        const activeYears = await this.repo.findMany({ isActive: true });
        return activeYears.map(year => ({
            _id: year._id,
            name: year.name,
            label: year.name, // Alias for backward compatibility
            isCurrent: year.isCurrent,
            isActive: year.isActive,
        })).sort((a, b) => {
            // Sort by name descending (most recent first, e.g., "2025-26" before "2024-25")
            return b.name.localeCompare(a.name);
        });
    }

    async setCurrent(id: string, ctx: RequestContext) {
        const before = await this.findOne(id);
        if (!before.isActive) throw new BadRequestException('Cannot set current on an inactive year');
        await this.repo.unsetAllCurrent();
        try {
            const after = await this.repo.updateById(id, { isCurrent: true });
            assertFound(after);
            await this.audit.log({ entity: 'AcademicYear', entityId: id, action: 'set-current', before, after, ctx });
            return after;
        } catch (e: any) {
            if (e?.code === 11000) throw new ConflictException('Another request set current year. Refresh and try again.');
            throw e;
        }
    }

    async setActive(id: string, active: boolean, ctx: RequestContext) {
        const before = await this.findOne(id);
        if (!active && before.isCurrent) throw new BadRequestException('Cannot deactivate the current year');
        const after = await this.repo.updateById(id, { isActive: active });
        assertFound(after);
        await this.audit.log({ entity: 'AcademicYear', entityId: id, action: 'activate', before, after, ctx });
        return after;
    }

    async update(id: string, dto: UpdateAcademicYearDto, ifMatch: string | undefined, ctx: RequestContext) {
        const current = await this.findOne(id);

        if (ifMatch) {
            const tag = String(new Date(current.updatedAt).getTime());
            if (tag !== ifMatch) throw new PreconditionFailedException('ETag mismatch');
        }

        const nextStart = dto.startDate ? toDate(dto.startDate) : current.startDate;
        const nextEnd = dto.endDate ? toDate(dto.endDate) : current.endDate;
        if (nextEnd <= nextStart) throw new BadRequestException('endDate must be greater than startDate');
        if (await this.repo.hasOverlap(nextStart as any, nextEnd as any, id)) throw new ConflictException('Date range overlaps');

        const computedName = nameFromDates(nextStart as Date, nextEnd as Date);
        const next = {
            name: dto.name ?? computedName,
            startDate: nextStart,
            endDate: nextEnd,
            isActive: dto.isActive ?? current.isActive,
        };

        const after = await this.repo.updateById(id, next);
        assertFound(after);
        await this.audit.log({ entity: 'AcademicYear', entityId: id, action: 'update', before: current, after, ctx });
        return after;
    }

    async remove(id: string, ctx: RequestContext) {
        const before = await this.findOne(id);
        if (before.isCurrent) throw new BadRequestException('Cannot delete the current year');
        const after = await this.repo.updateById(id, { isActive: false });
        assertFound(after);
        await this.audit.log({ entity: 'AcademicYear', entityId: id, action: 'delete', before, after, ctx });
        return after;
    }
}
