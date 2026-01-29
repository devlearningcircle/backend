import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { StudentMonthQueryDto } from './dto/student-month.dto';
import { BulkMarkDto } from './dto/bulk-mark.dto';
import { ReportDto } from './dto/report.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
    constructor(private svc: AttendanceService) { }

    // Bulk mark
    @Post('bulk')
    @Roles(Role.ADMIN, Role.TEACHER)
    async bulkMark(
        @CurrentUser('id') teacherId: string,
        @Body() body: BulkMarkDto,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        return this.svc.bulkMarkAttendance(body, teacherId, ayId);
    }

    // Single mark
    @Post('mark')
    @Roles(Role.ADMIN, Role.TEACHER)
    async mark(
        @CurrentUser('id') teacherId: string,
        @Body() dto: MarkAttendanceDto,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        return this.svc.markAttendance(dto, teacherId, ayId);
    }

    // Admin list or summary
    @Get()
    @Roles(Role.ADMIN)
    async summary(
        @Query() query: FilterAttendanceDto & { summary?: string },
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        // Default academicYearId from header if not provided
        const filter = { ...query, academicYearId: query.academicYearId ?? ayId };
        if (String(query.summary) === 'true') return this.svc.getAdminSummary(filter);
        return this.svc.getAttendance(filter);
    }

    // Weekly/monthly report (admin)
    @Get('report')
    @Roles(Role.ADMIN)
    async report(
        @Query() query: ReportDto,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        const { period, ...filter } = query;
        const filterWithAy = { ...filter, academicYearId: query.academicYearId ?? ayId };
        return this.svc.getReport(filterWithAy, period);
    }

    // Teacher's own marking history
    @Get('history')
    @Roles(Role.TEACHER)
    async teacherHistory(@CurrentUser('id') teacherId: string) {
        return this.svc.getTeacherHistory(teacherId);
    }

    // Teacher/Admin section-day review
    @Get('section-day')
    @Roles(Role.ADMIN, Role.TEACHER)
    async sectionDay(
        @Query('sectionId') sectionId: string,
        @Query('date') date: string, // 'YYYY-MM-DD'
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        return this.svc.getSectionDay(sectionId, date, ayId);
    }

    // Student: full list (optional date range)
    @Get('me')
    @Roles(Role.STUDENT)
    async myAttendance(
        @CurrentUser('id') studentId: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        return this.svc.getStudentRange(studentId, { from, to }, ayId);
    }

    // Student: month (calendar dots)
    @Get('me/month')
    @Roles(Role.STUDENT)
    async myMonth(
        @CurrentUser('id') studentId: string,
        @Query() q: StudentMonthQueryDto,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        const month = q?.month || new Date().toISOString().slice(0, 7);
        const academicYearId = q.academicYearId ?? ayId;
        return this.svc.getStudentMonth(studentId, month, academicYearId);
    }

    // Admin/Teacher: student's month
    @Get('student/:studentId')
    @Roles(Role.ADMIN, Role.TEACHER)
    async studentMonth(
        @Param('studentId') studentId: string,
        @Query() q: StudentMonthQueryDto,
        @Headers('x-academic-year-id') ayId?: string,
    ) {
        const month = q?.month || new Date().toISOString().slice(0, 7);
        const academicYearId = q.academicYearId ?? ayId;
        return this.svc.getStudentMonth(studentId, month, academicYearId);
    }

    // Admin: last 30-day daily summary
    @Get('summary')
    @Roles(Role.ADMIN)
    getAttendanceStats(@Headers('x-academic-year-id') ayId?: string) {
        return this.svc.getDailySummary(ayId);
    }
}
