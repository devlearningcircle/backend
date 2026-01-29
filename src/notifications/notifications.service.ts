import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Teacher, TeacherDocument } from '../teachers/schemas/teacher.schema';
import { Section, SectionDocument } from '../sections/schemas/section.schema';
import { escapeRegex } from '../common/utils/regex-sanitizer';

type FileMeta = {
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
};

@Injectable()
export class NotificationsService {
    private logger = new Logger(NotificationsService.name);

    constructor(
        @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
        @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
        @InjectModel(Teacher.name) private readonly teacherModel: Model<TeacherDocument>,
        @InjectModel(Section.name) private readonly sectionModel: Model<SectionDocument>,
    ) { }

    /**
     * Validate that all recipient IDs exist in the database
     */
    private async validateRecipients(recipientIds: string[]): Promise<void> {
        if (!recipientIds || recipientIds.length === 0) {
            return; // No recipients to validate
        }

        // Check which IDs exist in Students collection
        const existingStudents = await this.studentModel
            .find({ _id: { $in: recipientIds } }, { _id: 1 })
            .lean();
        const studentIds = existingStudents.map(s => s._id.toString());

        // Check which IDs exist in Teachers collection
        const existingTeachers = await this.teacherModel
            .find({ _id: { $in: recipientIds } }, { _id: 1 })
            .lean();
        const teacherIds = existingTeachers.map(t => t._id.toString());

        // Combine all valid IDs
        const validIds = new Set([...studentIds, ...teacherIds]);

        // Find invalid IDs
        const invalidIds = recipientIds.filter(id => !validIds.has(id));

        if (invalidIds.length > 0) {
            throw new BadRequestException(
                `Invalid recipient IDs: ${invalidIds.join(', ')}. These users do not exist.`
            );
        }
    }

    async sendNotification(dto: CreateNotificationDto, userId: string, file?: FileMeta) {
        const recipients = Array.isArray(dto.recipients) ? dto.recipients.filter(Boolean) : [];

        // Validate recipients if any are provided
        if (recipients.length > 0) {
            await this.validateRecipients(recipients);
        }

        const record = await this.notificationModel.create({
            subject: dto.subject,
            message: dto.message,
            type: dto.type,
            recipients,
            sentBy: userId,
            status: 'sent',
            academicYearId: dto.academicYearId || undefined,
            classId: dto.classId || undefined,
            sectionId: dto.sectionId || undefined,
            fileUrl: file?.fileUrl,
            fileName: file?.fileName,
            fileType: file?.fileType,
            fileSize: file?.fileSize,
        });

        return record.toObject();
    }

    async findAll() {
        return this.notificationModel.find().sort({ updatedAt: -1, createdAt: -1 }).lean({ virtuals: true });
    }

    async findOne(id: string) {
        return this.notificationModel.findById(id).lean({ virtuals: true });
    }

    async update(id: string, dto: UpdateNotificationDto, file?: FileMeta) {
        const updateData: any = {};

        if (dto.subject !== undefined) updateData.subject = dto.subject;
        if (dto.message !== undefined) updateData.message = dto.message;
        if (dto.type !== undefined) updateData.type = dto.type;

        // Handle recipients update with validation
        if (dto.recipients !== undefined) {
            const recipients = Array.isArray(dto.recipients) ? dto.recipients.filter(Boolean) : [];

            // Validate recipients if any are provided
            if (recipients.length > 0) {
                await this.validateRecipients(recipients);
            }

            updateData.recipients = recipients;
        }

        if (dto.academicYearId !== undefined) updateData.academicYearId = dto.academicYearId || undefined;
        if (dto.classId !== undefined) updateData.classId = dto.classId || undefined;
        if (dto.sectionId !== undefined) updateData.sectionId = dto.sectionId || undefined;

        // Update file info if new file is provided
        if (file) {
            updateData.fileUrl = file.fileUrl;
            updateData.fileName = file.fileName;
            updateData.fileType = file.fileType;
            updateData.fileSize = file.fileSize;
        }

        // Ensure updatedAt is set to current time
        updateData.updatedAt = new Date();

        const updated = await this.notificationModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, timestamps: true },
        ).lean({ virtuals: true });

        if (!updated) {
            throw new NotFoundException('Notification not found');
        }

        this.logger.log(`Notification ${id} updated successfully at ${updateData.updatedAt.toISOString()}`);

        return updated;
    }

    async delete(id: string) {
        const result = await this.notificationModel.findByIdAndDelete(id);
        if (!result) {
            throw new NotFoundException('Notification not found');
        }
        return { message: 'Notification deleted successfully' };
    }

    async filter(filters: {
        type?: string;
        status?: string;
        sentBy?: string;
        academicYearId?: string;
        classId?: string;
        sectionId?: string;
        q?: string;
        hasFile?: string;   // 'true' | 'false'
        dateFrom?: string;  // ISO 'YYYY-MM-DD' or ISO datetime
        dateTo?: string;    // ISO 'YYYY-MM-DD' or ISO datetime
    }) {
        const query: any = {};
        if (filters.type) query.type = filters.type;
        if (filters.status) query.status = filters.status;
        if (filters.sentBy) query.sentBy = filters.sentBy;
        if (filters.academicYearId) query.academicYearId = filters.academicYearId;
        if (filters.classId) query.classId = filters.classId;
        if (filters.sectionId) query.sectionId = filters.sectionId;

        // createdAt date range (inclusive)
        if (filters.dateFrom || filters.dateTo) {
            query.createdAt = {};
            if (filters.dateFrom) {
                const from = new Date(filters.dateFrom);
                if (!isNaN(+from)) query.createdAt.$gte = from;
            }
            if (filters.dateTo) {
                const to = new Date(filters.dateTo);
                if (!isNaN(+to)) {
                    // if only YYYY-MM-DD provided, bump to end of the day
                    if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo)) {
                        to.setHours(23, 59, 59, 999);
                    }
                    query.createdAt.$lte = to;
                }
            }
            if (Object.keys(query.createdAt).length === 0) delete query.createdAt;
        }

        // text search (sanitized to prevent NoSQL injection)
        if (filters.q) {
            const sanitizedQuery = escapeRegex(filters.q);
            query.$or = [
                { $text: { $search: filters.q } },
                { subject: { $regex: sanitizedQuery, $options: 'i' } },
                { message: { $regex: sanitizedQuery, $options: 'i' } },
            ];
        }

        // file existence
        if (filters.hasFile === 'true') {
            query.fileUrl = { $exists: true, $ne: null, $nin: ['', null] };
        } else if (filters.hasFile === 'false') {
            query.$and = [
                ...(query.$and || []),
                {
                    $or: [
                        { fileUrl: { $exists: false } },
                        { fileUrl: null },
                        { fileUrl: '' },
                    ],
                },
            ];
        }

        return this.notificationModel.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean({ virtuals: true });
    }

    async getRecent(limit = 5, academicYearId?: string) {
        const n = Math.max(1, Math.min(Number(limit) || 5, 25));
        const query: any = {};
        if (academicYearId) {
            query.academicYearId = academicYearId;
        }
        return this.notificationModel
            .find(query, { subject: 1, createdAt: 1, updatedAt: 1 })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(n)
            .lean({ virtuals: true });
    }

    /* ===== Role-aware feeds (AY-aware) ===== */

    async getForStudent(studentId: string, limit = 5, ayOverride?: string) {
        const n = Math.max(1, Math.min(Number(limit) || 5, 100));

        const student = await this.studentModel
            .findById(studentId, { classId: 1, sectionId: 1, academicYearId: 1 })
            .lean();

        const selectedAY = ayOverride || student?.academicYearId || null;
        const cls = student?.classId || null;
        const sec = student?.sectionId || null;

        const query = {
            type: 'web',
            status: 'sent',
            $or: [
                // Specific recipient targeting
                { recipients: studentId },
                // OR targeting by class/section/year (only if recipients array is empty or doesn't exist)
                {
                    $and: [
                        { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                        { $or: [{ academicYearId: { $exists: false } }, { academicYearId: selectedAY }] },
                        { $or: [{ classId: { $exists: false } }, { classId: cls }] },
                        { $or: [{ sectionId: { $exists: false } }, { sectionId: sec }] },
                    ],
                },
            ],
        };

        const notifications = await this.notificationModel
            .find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(n)
            .lean({ virtuals: true });

        // Add isRead field for each notification
        return notifications.map((notification: any) => ({
            ...notification,
            isRead: notification.readBy?.includes(studentId) || false,
        }));
    }

    async getForTeacher(teacherId: string, limit = 5, ayOverride?: string) {
        const n = Math.max(1, Math.min(Number(limit) || 5, 100));

        const sections = await this.sectionModel
            .find({ assignedTeacherId: teacherId }, { _id: 1, classId: 1 })
            .lean();

        const sectionIds = sections.map((s) => String(s._id));
        const classIds = sections.map((s) => String(s.classId)).filter(Boolean);

        const globalClause = {
            $and: [
                { academicYearId: { $exists: false } },
                { classId: { $exists: false } },
                { sectionId: { $exists: false } },
            ],
        };

        const orClauses =
            sectionIds.length === 0 && classIds.length === 0
                ? [globalClause]
                : [globalClause, { classId: { $in: classIds } }, { sectionId: { $in: sectionIds } }];

        const baseQuery: any = {
            $and: [{ $or: orClauses }],
        };

        if (ayOverride) {
            baseQuery.$and.push({ $or: [{ academicYearId: { $exists: false } }, { academicYearId: ayOverride }] });
        }

        const query: any = {
            type: 'web',
            status: 'sent',
            $or: [
                // Specific recipient targeting
                { recipients: teacherId },
                // OR targeting by class/section (only if recipients array is empty or doesn't exist)
                {
                    $and: [
                        { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                        ...baseQuery.$and,
                    ],
                },
            ],
        };

        const notifications = await this.notificationModel
            .find(query)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(n)
            .lean({ virtuals: true });

        // Add isRead field for each notification
        return notifications.map((notification: any) => ({
            ...notification,
            isRead: notification.readBy?.includes(teacherId) || false,
        }));
    }

    /**
     * Check if a user has access to a notification
     * @param notificationId - The notification ID to check
     * @param userId - The user ID to check access for
     * @param role - The user's role (admin, teacher, student)
     * @param ayOverride - Optional academic year override
     * @returns true if user can access the notification, false otherwise
     */
    async canUserAccessNotification(notificationId: string, userId: string, role: string, ayOverride?: string): Promise<boolean> {
        const notification = await this.notificationModel.findById(notificationId).lean();

        if (!notification) {
            return false;
        }

        // Admins can access all notifications
        if (role.toLowerCase() === 'admin') {
            return true;
        }

        // Check if notification is meant for web viewing and sent
        if (notification.type !== 'web' || notification.status !== 'sent') {
            return false;
        }

        // Check specific recipient targeting
        if (notification.recipients && notification.recipients.length > 0) {
            if (notification.recipients.includes(userId)) {
                return true;
            }
            // If recipients are specified but user is not in the list, deny access
            return false;
        }

        // If no specific recipients, check class/section/year targeting
        if (role.toLowerCase() === 'student') {
            const student = await this.studentModel
                .findById(userId, { classId: 1, sectionId: 1, academicYearId: 1 })
                .lean();

            if (!student) {
                return false;
            }

            const selectedAY = ayOverride || student.academicYearId || null;
            const cls = student.classId || null;
            const sec = student.sectionId || null;

            // Check if notification matches student's academic year, class, and section
            const ayMatch = !notification.academicYearId || notification.academicYearId === selectedAY;
            const classMatch = !notification.classId || notification.classId === cls;
            const sectionMatch = !notification.sectionId || notification.sectionId === sec;

            return ayMatch && classMatch && sectionMatch;
        } else if (role.toLowerCase() === 'teacher') {
            const sections = await this.sectionModel
                .find({ assignedTeacherId: userId }, { _id: 1, classId: 1 })
                .lean();

            const sectionIds = sections.map((s) => String(s._id));
            const classIds = sections.map((s) => String(s.classId)).filter(Boolean);

            // Check if notification is global (no targeting)
            const isGlobal = !notification.academicYearId && !notification.classId && !notification.sectionId;
            if (isGlobal) {
                return true;
            }

            // Check if notification matches teacher's assigned classes or sections
            if (notification.sectionId && sectionIds.includes(String(notification.sectionId))) {
                return true;
            }

            if (notification.classId && classIds.includes(String(notification.classId))) {
                return true;
            }

            // Check academic year if specified
            if (ayOverride && notification.academicYearId) {
                return notification.academicYearId === ayOverride;
            }

            return false;
        }

        return false;
    }

    /* ===== Read tracking ===== */

    async getUnreadCount(userId: string, role: string, ayOverride?: string) {
        // Admins don't receive notifications, they create them
        if (role.toLowerCase() === 'admin') {
            return { count: 0 };
        }

        let query: any;

        if (role.toLowerCase() === 'student') {
            const student = await this.studentModel
                .findById(userId, { classId: 1, sectionId: 1, academicYearId: 1 })
                .lean();

            const selectedAY = ayOverride || student?.academicYearId || null;
            const cls = student?.classId || null;
            const sec = student?.sectionId || null;

            query = {
                type: 'web',
                status: 'sent',
                readBy: { $ne: userId },
                $or: [
                    // Specific recipient targeting
                    { recipients: userId },
                    // OR targeting by class/section/year (only if recipients array is empty or doesn't exist)
                    {
                        $and: [
                            { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                            { $or: [{ academicYearId: { $exists: false } }, { academicYearId: selectedAY }] },
                            { $or: [{ classId: { $exists: false } }, { classId: cls }] },
                            { $or: [{ sectionId: { $exists: false } }, { sectionId: sec }] },
                        ],
                    },
                ],
            };
        } else if (role.toLowerCase() === 'teacher') {
            const sections = await this.sectionModel
                .find({ assignedTeacherId: userId }, { _id: 1, classId: 1 })
                .lean();

            const sectionIds = sections.map((s) => String(s._id));
            const classIds = sections.map((s) => String(s.classId)).filter(Boolean);

            const globalClause = {
                $and: [
                    { academicYearId: { $exists: false } },
                    { classId: { $exists: false } },
                    { sectionId: { $exists: false } },
                ],
            };

            const orClauses =
                sectionIds.length === 0 && classIds.length === 0
                    ? [globalClause]
                    : [globalClause, { classId: { $in: classIds } }, { sectionId: { $in: sectionIds } }];

            const baseQuery: any = {
                $and: [{ $or: orClauses }],
            };

            if (ayOverride) {
                baseQuery.$and.push({ $or: [{ academicYearId: { $exists: false } }, { academicYearId: ayOverride }] });
            }

            query = {
                type: 'web',
                status: 'sent',
                readBy: { $ne: userId },
                $or: [
                    // Specific recipient targeting
                    { recipients: userId },
                    // OR targeting by class/section (only if recipients array is empty or doesn't exist)
                    {
                        $and: [
                            { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                            ...baseQuery.$and,
                        ],
                    },
                ],
            };
        } else {
            return { count: 0 };
        }

        const count = await this.notificationModel.countDocuments(query);
        return { count };
    }

    async markAsRead(notificationId: string, userId: string) {
        // Use atomic $addToSet to prevent race conditions
        const result = await this.notificationModel.findByIdAndUpdate(
            notificationId,
            { $addToSet: { readBy: userId } },
            { new: true }
        );

        if (!result) {
            throw new NotFoundException('Notification not found');
        }

        return { message: 'Notification marked as read' };
    }

    async markAllAsRead(userId: string, role: string, ayOverride?: string) {
        let query: any;

        if (role.toLowerCase() === 'student') {
            const student = await this.studentModel
                .findById(userId, { classId: 1, sectionId: 1, academicYearId: 1 })
                .lean();

            const selectedAY = ayOverride || student?.academicYearId || null;
            const cls = student?.classId || null;
            const sec = student?.sectionId || null;

            query = {
                type: 'web',
                status: 'sent',
                readBy: { $ne: userId },
                $or: [
                    // Specific recipient targeting
                    { recipients: userId },
                    // OR targeting by class/section/year (only if recipients array is empty or doesn't exist)
                    {
                        $and: [
                            { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                            { $or: [{ academicYearId: { $exists: false } }, { academicYearId: selectedAY }] },
                            { $or: [{ classId: { $exists: false } }, { classId: cls }] },
                            { $or: [{ sectionId: { $exists: false } }, { sectionId: sec }] },
                        ],
                    },
                ],
            };
        } else if (role.toLowerCase() === 'teacher') {
            const sections = await this.sectionModel
                .find({ assignedTeacherId: userId }, { _id: 1, classId: 1 })
                .lean();

            const sectionIds = sections.map((s) => String(s._id));
            const classIds = sections.map((s) => String(s.classId)).filter(Boolean);

            const globalClause = {
                $and: [
                    { academicYearId: { $exists: false } },
                    { classId: { $exists: false } },
                    { sectionId: { $exists: false } },
                ],
            };

            const orClauses =
                sectionIds.length === 0 && classIds.length === 0
                    ? [globalClause]
                    : [globalClause, { classId: { $in: classIds } }, { sectionId: { $in: sectionIds } }];

            const baseQuery: any = {
                $and: [{ $or: orClauses }],
            };

            if (ayOverride) {
                baseQuery.$and.push({ $or: [{ academicYearId: { $exists: false } }, { academicYearId: ayOverride }] });
            }

            query = {
                type: 'web',
                status: 'sent',
                readBy: { $ne: userId },
                $or: [
                    // Specific recipient targeting
                    { recipients: userId },
                    // OR targeting by class/section (only if recipients array is empty or doesn't exist)
                    {
                        $and: [
                            { $or: [{ recipients: { $exists: false } }, { recipients: { $size: 0 } }] },
                            ...baseQuery.$and,
                        ],
                    },
                ],
            };
        } else {
            return { message: 'No notifications to mark as read' };
        }

        await this.notificationModel.updateMany(query, {
            $addToSet: { readBy: userId },
        });

        return { message: 'All notifications marked as read' };
    }
}
