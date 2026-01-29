import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Attendance, AttendanceStatus } from './schemas/attendance.schema';
import { Model } from 'mongoose';
import { FilterAttendanceDto } from './dto/filter-attendance.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkDto } from './dto/bulk-mark.dto';
import { Student } from '../students/schemas/student.schema';
import { validateMonth } from '../common/utils/regex-sanitizer';

type Range = { from?: string; to?: string };

@Injectable()
export class AttendanceService {
    constructor(
        @InjectModel(Attendance.name) private model: Model<Attendance>,
        @InjectModel(Student.name) private studentModel: Model<Student>,
    ) { }

    // ---- helpers ----
    private isDateYYYYMMDD(s: string) {
        return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);
    }

    private async getStudentMapByIds(ids: string[]) {
        if (!ids.length) return new Map<string, any>();
        const docs = await this.studentModel
            .find({ _id: { $in: ids } })
            .select({ _id: 1, classId: 1, sectionId: 1, academicYearId: 1 })
            .lean();
        const map = new Map<string, any>();
        docs.forEach((s: any) => map.set(String(s._id), s));
        return map;
    }

    private async resolveStudentSnap(studentId: string) {
        return this.studentModel
            .findById(studentId)
            .select({ classId: 1, sectionId: 1, academicYearId: 1 })
            .lean();
    }

    // ---- writes ----
    async markAttendance(dto: MarkAttendanceDto, teacherId: string, headerAcademicYearId?: string) {
        const { studentId, date, status } = dto;
        if (!this.isDateYYYYMMDD(date)) throw new BadRequestException('Invalid date format (YYYY-MM-DD)');

        const s = await this.resolveStudentSnap(studentId);

        const ayId = headerAcademicYearId || s?.academicYearId;
        if (!ayId) throw new BadRequestException('academicYearId is required (via header or student record)');

        const update: Partial<Attendance> = {
            studentId,
            date,
            status: status as AttendanceStatus,
            markedBy: teacherId,
            classId: s?.classId,
            sectionId: s?.sectionId,
            academicYearId: ayId,
        };

        return this.model.findOneAndUpdate(
            { studentId, date },
            update,
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();
    }

    async bulkMarkAttendance(body: BulkMarkDto, teacherId: string, headerAcademicYearId?: string) {
        const { date, entries } = body;
        if (!this.isDateYYYYMMDD(date)) throw new BadRequestException('Invalid date format (YYYY-MM-DD)');

        const ids = (entries || []).map(e => e.studentId);
        const studentMap = await this.getStudentMapByIds(ids);

        const ops = (entries || []).map((r) => {
            const s = studentMap.get(String(r.studentId));
            const ayId = headerAcademicYearId || s?.academicYearId;
            if (!ayId) {
                // Skip this record—no AY available; bulkWrite cannot handle per-op exception easily
                return null;
            }
            return {
                updateOne: {
                    filter: { studentId: r.studentId, date },
                    update: {
                        studentId: r.studentId,
                        date,
                        status: r.status as AttendanceStatus,
                        markedBy: teacherId,
                        classId: s?.classId,
                        sectionId: s?.sectionId,
                        academicYearId: ayId,
                    },
                    upsert: true,
                },
            };
        }).filter(Boolean) as any[];

        if (!ops.length) return { matched: 0, modified: 0, upserted: 0 };

        const result = await this.model.bulkWrite(ops);
        // @ts-ignore
        return {
            matched: (result as any).matchedCount || 0,
            modified: (result as any).modifiedCount || 0,
            upserted: (result as any).upsertedCount || 0,
        };
    }

    // ---- reads ----
    async getAttendance(filter: FilterAttendanceDto) {
        const q: any = {};
        if (filter.classId) q.classId = filter.classId;
        if (filter.sectionId) q.sectionId = filter.sectionId;
        if (filter.academicYearId) q.academicYearId = filter.academicYearId;
        if (filter.date) q.date = filter.date;
        return this.model.find(q).sort({ date: -1 }).lean();
    }

    async getAdminSummary(filter: FilterAttendanceDto) {
        const rec = await this.getAttendance(filter);
        const grouped = rec.reduce((acc, r: any) => {
            acc[r.date] = acc[r.date] || { date: r.date, present: 0, absent: 0, total: 0 };
            acc[r.date].total++;
            acc[r.date][r.status] = (acc[r.date][r.status] || 0) + 1;
            return acc;
        }, {} as Record<string, { date: string; present: number; absent: number; total: number }>);

        return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
    }

    async getReport(filter: FilterAttendanceDto, period: 'weekly' | 'monthly') {
        const rec = await this.getAttendance(filter);
        type Bucket = { label: string; present: number; absent: number; total: number; sortKey: string };
        const buckets: Record<string, Bucket> = {};

        const pad2 = (n: number) => String(n).padStart(2, '0');

        rec.forEach((r: any) => {
            const d = new Date(r.date);
            let key = '';
            let label = '';
            let sortKey = '';

            if (period === 'weekly') {
                const day = d.getDay(); // 0 Sun ... 6 Sat
                const mondayOffset = (day + 6) % 7;
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - mondayOffset);
                const y = weekStart.getFullYear();
                const m = pad2(weekStart.getMonth() + 1);
                const dd = pad2(weekStart.getDate());
                key = `${y}-${m}-${dd}`;
                label = `Week of ${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
                sortKey = key;
            } else {
                const y = d.getFullYear();
                const m = pad2(d.getMonth() + 1);
                key = `${y}-${m}`;
                label = `${d.toLocaleString(undefined, { month: 'long' })} ${y}`;
                sortKey = key;
            }

            if (!buckets[key]) buckets[key] = { label, present: 0, absent: 0, total: 0, sortKey };
            buckets[key].present += r.status === 'present' ? 1 : 0;
            buckets[key].absent += r.status === 'absent' ? 1 : 0;
            buckets[key].total++;
        });

        return Object.values(buckets)
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
            .map(({ sortKey, ...rest }) => rest);
    }

    async getTeacherHistory(teacherId: string) {
        return this.model.find({ markedBy: teacherId }).sort({ date: -1 }).lean();
    }

    async getSectionDay(sectionId: string, date: string, academicYearId?: string) {
        const q: any = { sectionId, date };
        if (academicYearId) q.academicYearId = academicYearId;
        return this.model.find(q).sort({ studentId: 1 }).lean();
    }

    async getStudentRange(studentId: string, range: Range, academicYearId?: string) {
        const q: any = { studentId };
        if (academicYearId) q.academicYearId = academicYearId;

        if (range?.from && range?.to) {
            q.date = { $gte: range.from, $lte: range.to };
        } else if (range?.from) {
            q.date = { $gte: range.from };
        } else if (range?.to) {
            q.date = { $lte: range.to };
        }
        return this.model.find(q).sort({ date: -1 }).lean();
    }

    // Calendar tiles: present-only dates
    async getStudentMonth(studentId: string, month: string, academicYearId?: string) {
        // Validate month format to prevent NoSQL injection
        const validatedMonth = validateMonth(month);
        const q: any = { studentId, date: { $regex: `^${validatedMonth}-` } };
        if (academicYearId) q.academicYearId = academicYearId;

        const rows = await this.model.find({ ...q, status: 'present' }).select({ date: 1 }).lean();
        const dates = rows.map((r: any) => r.date);
        return { dates };
    }

    // Last 30 daily summary (chronological)
    async getDailySummary(academicYearId?: string) {
        const pipeline: any[] = [];

        // Filter by academic year if provided
        if (academicYearId) {
            pipeline.push({ $match: { academicYearId } });
        }

        pipeline.push(
            {
                $group: {
                    _id: '$date',
                    present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
                    absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
                    total: { $sum: 1 },
                },
            },
            { $sort: { _id: -1 } },
            { $limit: 30 },
        );

        const result = await this.model.aggregate(pipeline);

        return result
            .map((e) => ({ date: e._id, present: e.present, absent: e.absent, total: e.total }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
}
