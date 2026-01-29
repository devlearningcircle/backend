import {
    Body,
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Query,
    UseGuards,
    UnauthorizedException,
    Headers,
    Param,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '../common/roles/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { toFullUrl } from 'src/common/helpers/url.helper';

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = diskStorage({
    destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'notifications');
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const name = Date.now() + '-' + Math.random().toString(36).slice(2);
        cb(null, name + extname(file.originalname));
    },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
    const ok = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Only PDF/DOC/XLS/PPT or JPG/PNG files allowed'), false);
    cb(null, true);
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    /* ===== Admin create/send ===== */
    @Post()
    @Roles(Role.ADMIN)
    @UseInterceptors(
        FileInterceptor('file', {
            storage,
            fileFilter,
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
        }),
    )
    async send(
        @Body() dto: CreateNotificationDto,
        @CurrentUser('id') id: string,
        @Headers('x-academic-year-id') currentAyId?: string,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        if (!id) throw new UnauthorizedException('Missing user id');

        // Override academicYearId with current academic year from header
        if (currentAyId) {
            dto.academicYearId = currentAyId;
        }

        // Handle file metadata from either multipart upload or Cloudinary URL
        let fileMeta: { fileUrl: string; fileName?: string; fileType?: string; fileSize?: number } | undefined;
        if (file && file.filename) {
            // Multipart file upload
            fileMeta = {
                fileUrl: toFullUrl(`/uploads/notifications/${file.filename}`)!,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
            };
        } else if (dto.fileUrl) {
            // Cloudinary URL from frontend
            fileMeta = {
                fileUrl: dto.fileUrl,
                fileName: dto.fileName,
                fileType: dto.fileType,
                fileSize: dto.fileSize,
            };
        }

        return this.notificationsService.sendNotification(dto, id, fileMeta);
    }

    /* ===== Role-aware dashboard feed (PLACE BEFORE :id) ===== */
    @Get('me')
    @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
    async myFeed(
        @CurrentUser('id') id: string,
        @CurrentUser('role') role: Role,
        @Query('limit') limit?: string,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        const n = Number(limit) || 5;
        if (role === Role.STUDENT) {
            return this.notificationsService.getForStudent(id, n, ayHeader);
        }
        if (role === Role.TEACHER) {
            return this.notificationsService.getForTeacher(id, n, ayHeader);
        }
        return this.notificationsService.getRecent(n);
    }

    /* ===== Unread count endpoint ===== */
    @Get('unread-count')
    @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
    async getUnreadCount(
        @CurrentUser('id') id: string,
        @CurrentUser('role') role: Role,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        return this.notificationsService.getUnreadCount(id, role, ayHeader);
    }

    /* ===== Mark as read endpoints ===== */
    @Post('mark-all-read')
    @Roles(Role.TEACHER, Role.STUDENT)
    async markAllAsRead(
        @CurrentUser('id') id: string,
        @CurrentUser('role') role: Role,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        return this.notificationsService.markAllAsRead(id, role, ayHeader);
    }

    /* ===== Admin reads ===== */
    @Get()
    @Roles(Role.ADMIN)
    findAll() {
        return this.notificationsService.findAll();
    }

    @Get('filter')
    @Roles(Role.ADMIN)
    filter(
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('sentBy') sentBy?: string,
        @Query('academicYearId') academicYearId?: string,
        @Query('classId') classId?: string,
        @Query('sectionId') sectionId?: string,
        @Query('q') q?: string,
        @Query('hasFile') hasFile?: string,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        return this.notificationsService.filter({
            type,
            status,
            sentBy,
            academicYearId: academicYearId ?? ayHeader,
            classId,
            sectionId,
            q,
            hasFile,
        });
    }

    @Get('recent')
    @Roles(Role.ADMIN)
    getRecent(
        @Query('limit') limit?: string,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        return this.notificationsService.getRecent(Number(limit) || 5, ayHeader);
    }

    /* ===== Specific item reads (use MongoIdPipe) ===== */
    @Get(':id')
    @Roles(Role.ADMIN)
    findOne(@Param('id', new MongoIdPipe()) id: string) {
        return this.notificationsService.findOne(id);
    }

    @Get(':id/file')
    @Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)
    async getFile(
        @Param('id', new MongoIdPipe()) id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') role: Role,
        @Headers('x-academic-year-id') ayHeader?: string,
    ) {
        // Validate user has access to this notification
        const hasAccess = await this.notificationsService.canUserAccessNotification(id, userId, role, ayHeader);
        if (!hasAccess) {
            throw new UnauthorizedException('You do not have access to this notification');
        }

        const n = await this.notificationsService.findOne(id);
        if (!n?.fileUrl) return { hasFile: false };
        return {
            hasFile: true,
            fileUrl: n.fileUrl,
            fileName: n.fileName,
            fileType: n.fileType,
            fileSize: n.fileSize,
        };
    }

    @Post(':id/read')
    @Roles(Role.TEACHER, Role.STUDENT)
    async markAsRead(
        @Param('id', new MongoIdPipe()) id: string,
        @CurrentUser('id') userId: string,
    ) {
        return this.notificationsService.markAsRead(id, userId);
    }

    /* ===== Admin update/delete ===== */
    @Put(':id')
    @Roles(Role.ADMIN)
    @UseInterceptors(
        FileInterceptor('file', {
            storage,
            fileFilter,
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
        }),
    )
    async update(
        @Param('id', new MongoIdPipe()) id: string,
        @Body() dto: UpdateNotificationDto,
        @Headers('x-academic-year-id') currentAyId?: string,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        // Override academicYearId with current academic year from header
        if (currentAyId) {
            dto.academicYearId = currentAyId;
        }

        // Handle file metadata from either multipart upload or Cloudinary URL
        let fileMeta: { fileUrl: string; fileName?: string; fileType?: string; fileSize?: number } | undefined;
        if (file && file.filename) {
            // Multipart file upload
            fileMeta = {
                fileUrl: toFullUrl(`/uploads/notifications/${file.filename}`)!,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
            };
        } else if (dto.fileUrl) {
            // Cloudinary URL from frontend
            fileMeta = {
                fileUrl: dto.fileUrl,
                fileName: dto.fileName,
                fileType: dto.fileType,
                fileSize: dto.fileSize,
            };
        }

        return this.notificationsService.update(id, dto, fileMeta);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    remove(@Param('id', new MongoIdPipe()) id: string) {
        return this.notificationsService.delete(id);
    }
}
