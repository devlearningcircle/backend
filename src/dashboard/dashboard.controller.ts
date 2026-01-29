import { BadRequestException, Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/roles/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    /** Admin-only, global (or AY-scoped via header) overview */
    @Get('admin')
    @Roles(Role.ADMIN)
    getAdminOverview(@Headers('x-academic-year-id') ay?: string) {
        return this.dashboardService.getAdminOverview(ay || null);
    }

    /** Admin-only: teacher’s overview (scoped by AY if header present).
     * Note: Uses current JWT id — suitable when "impersonating"/acting as a teacher.
     */
    @Get('teacher')
    @Roles(Role.ADMIN)
    getTeacherOverview(
        @CurrentUser('id') teacherId: string,
        @Headers('x-academic-year-id') ay?: string,
    ) {
        return this.dashboardService.getTeacherOverview(teacherId, ay || null);
    }

    /** Admin-only: student’s overview (by current JWT id when acting as a student) */
    @Get('student')
    @Roles(Role.ADMIN)
    getStudentOverview(
        @CurrentUser('id') studentId: string,
        @Headers('x-academic-year-id') ay?: string,
    ) {
        return this.dashboardService.getStudentOverview(studentId, ay || null);
    }

    /**
     * Role-aware self overview:
     * - admin   -> admin overview
     * - teacher -> teacher overview
     * - student -> student overview
     *
     * AY can be passed via `x-academic-year-id` to view historical snapshots.
     */
    @Get('me')
    getMyOverview(
        @CurrentUser('id') id: string,
        @CurrentUser('role') role: Role,
        @Headers('x-academic-year-id') ay?: string,
    ) {
        if (!id || !role) throw new BadRequestException('User context missing');
        const academicYearId = ay || null;

        switch (role) {
            case Role.ADMIN:
                return this.dashboardService.getAdminOverview(academicYearId);
            case Role.TEACHER:
                return this.dashboardService.getTeacherOverview(id, academicYearId);
            case Role.STUDENT:
            default:
                return this.dashboardService.getStudentOverview(id, academicYearId);
        }
    }
}
