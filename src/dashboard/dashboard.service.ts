import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { Section, SectionDocument } from '../sections/schemas/section.schema';
import {
    Attendance,
    AttendanceDocument,
} from '../attendance/schemas/attendance.schema';
import { Enrollment, EnrollmentDocument } from '../students/schemas/enrollment.schema';
import { AcademicYear, AcademicYearDocument } from 'src/academic-year/academic-year.schema';

@Injectable()
export class DashboardService {
    constructor(
        @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
        @InjectModel(Teacher.name) private teacherModel: Model<TeacherDocument>,
        @InjectModel(Class.name) private classModel: Model<ClassDocument>,
        @InjectModel(Section.name) private sectionModel: Model<SectionDocument>,
        @InjectModel(AcademicYear.name)
        private academicYearModel: Model<AcademicYearDocument>,
        @InjectModel(Attendance.name)
        private attendanceModel: Model<AttendanceDocument>,
        @InjectModel(Enrollment.name)
        private enrollmentModel: Model<EnrollmentDocument>,
    ) { }

    // -------- ADMIN --------
    async getAdminOverview(academicYearId: string | null) {
        // Counts that are AY-invariant
        const [teachers, classes, sections, activeAY] = await Promise.all([
            this.teacherModel.countDocuments(),
            this.classModel.countDocuments(),
            this.sectionModel.countDocuments(),
            this.academicYearModel.findOne({ isActive: true }).lean(),
        ]);

        // Students + gender breakdown — AY-aware using Enrollment if AY is provided
        if (academicYearId) {
            const totalStudents = await this.enrollmentModel
                .countDocuments({ academicYearId })
                .exec();

            const genderAgg = await this.enrollmentModel
                .aggregate([
                    { $match: { academicYearId } },
                    {
                        $lookup: {
                            from: 'students',
                            let: { sid: '$studentId' }, // string id
                            pipeline: [
                                {
                                    $match: {
                                        $expr: { $eq: ['$_id', { $toObjectId: '$$sid' }] },
                                    },
                                },
                                { $project: { gender: 1 } },
                            ],
                            as: 'stu',
                        },
                    },
                    { $unwind: '$stu' },
                    {
                        $group: {
                            _id: { $toLower: '$stu.gender' },
                            count: { $sum: 1 },
                        },
                    },
                ])
                .exec();

            const gender = { male: 0, female: 0 };
            for (const g of genderAgg) {
                if (g._id === 'male') gender.male = g.count;
                if (g._id === 'female') gender.female = g.count;
            }

            // Get the specific academic year for this ID
            const selectedAY = await this.academicYearModel.findById(academicYearId).lean();

            return {
                scope: { academicYearId },
                totalStudents,
                totalTeachers: teachers,
                totalClasses: classes,
                totalSections: sections,
                activeAcademicYear: selectedAY?.name || activeAY?.name || 'None',
                genderBreakdown: gender,
            };
        }

        // No AY filter → fallback to current snapshot on Student
        const [students, maleCount, femaleCount] = await Promise.all([
            this.studentModel.countDocuments(),
            this.studentModel.countDocuments({ gender: { $regex: /^male$/i } }),
            this.studentModel.countDocuments({ gender: { $regex: /^female$/i } }),
        ]);

        return {
            scope: { academicYearId: null },
            totalStudents: students,
            totalTeachers: teachers,
            totalClasses: classes,
            totalSections: sections,
            activeAcademicYear: activeAY?.name || 'None',
            genderBreakdown: { male: maleCount, female: femaleCount },
        };
    }

    // -------- TEACHER --------
    async getTeacherOverview(teacherId: string, academicYearId: string | null) {
        // Sections assigned to this teacher (sections themselves are not AY-scoped)
        const sections = await this.sectionModel.find({ assignedTeacherId: teacherId }).lean();
        const sectionIdsStr = sections.map((s) => String(s._id));

        // Optional: look up class names for convenience
        const classIdsStr = [...new Set(sections.map((s) => String(s.classId)))].filter(Boolean);
        const classMap = new Map<string, string>();
        if (classIdsStr.length) {
            const cls = await this.classModel
                .find({ _id: { $in: classIdsStr.map((id) => new Types.ObjectId(id)) } })
                .lean();
            for (const c of cls) classMap.set(String(c._id), c.name);
        }

        // AY-aware student counts using Enrollment if AY provided
        if (academicYearId) {
            const total = await this.enrollmentModel.countDocuments({
                academicYearId,
                sectionId: { $in: sectionIdsStr },
            });

            const genderAgg = await this.enrollmentModel
                .aggregate([
                    { $match: { academicYearId, sectionId: { $in: sectionIdsStr } } },
                    {
                        $lookup: {
                            from: 'students',
                            let: { sid: '$studentId' },
                            pipeline: [
                                { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$sid' }] } } },
                                { $project: { gender: 1 } },
                            ],
                            as: 'stu',
                        },
                    },
                    { $unwind: '$stu' },
                    { $group: { _id: { $toLower: '$stu.gender' }, count: { $sum: 1 } } },
                ])
                .exec();

            const gender = { male: 0, female: 0 };
            for (const g of genderAgg) {
                if (g._id === 'male') gender.male = g.count;
                if (g._id === 'female') gender.female = g.count;
            }

            return {
                scope: { academicYearId },
                totalAssignedSections: sections.length,
                assignedSections: sections.map((s) => ({
                    sectionId: String(s._id),
                    name: s.name,
                    classId: String(s.classId),
                    className: classMap.get(String(s.classId)) || null,
                })),
                totalStudentsInAssignedSections: total,
                genderBreakdown: gender,
            };
        }

        // No AY → use current snapshot on Student
        const [studentCount, maleCount, femaleCount] = await Promise.all([
            this.studentModel.countDocuments({ sectionId: { $in: sectionIdsStr } }),
            this.studentModel.countDocuments({
                sectionId: { $in: sectionIdsStr },
                gender: { $regex: /^male$/i },
            }),
            this.studentModel.countDocuments({
                sectionId: { $in: sectionIdsStr },
                gender: { $regex: /^female$/i },
            }),
        ]);

        return {
            scope: { academicYearId: null },
            totalAssignedSections: sections.length,
            assignedSections: sections.map((s) => ({
                sectionId: String(s._id),
                name: s.name,
                classId: String(s.classId),
                className: classMap.get(String(s.classId)) || null,
            })),
            totalStudentsInAssignedSections: studentCount,
            genderBreakdown: { male: maleCount, female: femaleCount },
        };
    }

    // -------- STUDENT --------
    async getStudentOverview(studentId: string, academicYearId: string | null) {
        // Never fetch the password
        const student = await this.studentModel.findById(studentId, { password: 0 }).lean();
        if (!student) throw new NotFoundException('Student not found');

        // Determine placement for the requested AY (historical snapshot) or current
        let classId = student.classId;
        let sectionId = student.sectionId;
        let ayId = student.academicYearId;

        if (academicYearId) {
            ayId = academicYearId;
            const enr = await this.enrollmentModel.findOne({ studentId: String(studentId), academicYearId }).lean();
            if (enr) {
                classId = enr.classId;
                sectionId = enr.sectionId;
            }
        }

        const [classData, sectionData, academicYearData] = await Promise.all([
            classId ? this.classModel.findById(classId).lean() : null,
            sectionId ? this.sectionModel.findById(sectionId).lean() : null,
            ayId ? this.academicYearModel.findById(ayId).lean() : null,
        ]);

        // Attendance summary — AY-aware if provided
        const match: any = { studentId: String(studentId) };
        if (academicYearId) match.academicYearId = academicYearId;

        const summaryAgg = await this.attendanceModel
            .aggregate([
                { $match: match },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ])
            .exec();

        const summary = { present: 0, absent: 0, total: 0 };
        for (const row of summaryAgg) {
            if (row._id === 'present') summary.present = row.count;
            if (row._id === 'absent') summary.absent = row.count;
        }
        summary.total = summary.present + summary.absent;

        return {
            scope: { academicYearId: academicYearId || null },
            name: student.name,
            email: student.email,
            rollNumber: student.rollNumber,
            gender: student.gender,
            guardianName: student.guardianName,
            phone: student.phone,
            class: classData?.name || 'N/A',
            section: sectionData?.name || 'N/A',
            academicYear: academicYearData?.name || 'N/A',
            attendanceSummary: summary,
        };
    }
}
