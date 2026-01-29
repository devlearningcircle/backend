import {
    Controller,
    Get,
    Put,
    Body,
    UseGuards,
    Post,
    UseInterceptors,
    UploadedFile,
    Delete,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/roles/role.enum';

@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}

    // Public endpoint (no auth required)
    @Get('public')
    getPublicSettings() {
        return this.settingsService.getPublicSettings();
    }

    // Admin: Get full settings
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    getSettings() {
        return this.settingsService.getSettings();
    }

    // Admin: Update settings
    @Put()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    updateSettings(@Body() dto: UpdateSettingsDto) {
        return this.settingsService.updateSettings(dto);
    }

    // Admin: Upload logo
    @Post('logo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('logo'))
    uploadLogo(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No logo file provided');
        
        // Validate file type
        const allowedMimes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Only image files are allowed (JPEG, PNG, SVG, WebP)');
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            throw new BadRequestException('Logo file size must not exceed 2MB');
        }

        return this.settingsService.uploadLogo(file);
    }

    // Admin: Delete logo
    @Delete('logo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    deleteLogo() {
        return this.settingsService.deleteLogo();
    }

    // Admin: Upload login logo
    @Post('login-logo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('loginLogo'))
    uploadLoginLogo(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No login logo file provided');

        // Validate file type
        const allowedMimes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Only image files are allowed (JPEG, PNG, SVG, WebP)');
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            throw new BadRequestException('Login logo file size must not exceed 2MB');
        }

        return this.settingsService.uploadLoginLogo(file);
    }

    // Admin: Delete login logo
    @Delete('login-logo')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    deleteLoginLogo() {
        return this.settingsService.deleteLoginLogo();
    }

    // Admin: Upload login illustration
    @Post('login-illustration')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @UseInterceptors(FileInterceptor('loginIllustration'))
    uploadLoginIllustration(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No login illustration file provided');

        // Validate file type
        const allowedMimes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new BadRequestException('Only image files are allowed (JPEG, PNG, SVG, WebP)');
        }

        // Validate file size (max 3MB for illustrations)
        if (file.size > 3 * 1024 * 1024) {
            throw new BadRequestException('Login illustration file size must not exceed 3MB');
        }

        return this.settingsService.uploadLoginIllustration(file);
    }

    // Admin: Delete login illustration
    @Delete('login-illustration')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    deleteLoginIllustration() {
        return this.settingsService.deleteLoginIllustration();
    }
}