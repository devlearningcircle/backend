import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Settings, SettingsDocument } from './schemas/settings.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { toFullUrl } from '../common/helpers/url.helper';

@Injectable()
export class SettingsService {
    constructor(
        @InjectModel(Settings.name) private settingsModel: Model<SettingsDocument>,
    ) { }

    private readonly DEFAULTS: Partial<Settings> = {
        schoolName: 'School Management System',
        theme: 'light',
        primaryColor: '#4c3cc9',
        secondaryColor: '#3f2fb1',
        showWhatsapp: false,
        sidebarCollapsed: false,
    };

    async getSettings(): Promise<Settings> {
        const settings = await this.settingsModel
            .findOneAndUpdate(
                { _singleton: 'singleton' },
                {
                    $setOnInsert: {
                        _singleton: 'singleton',
                        ...this.DEFAULTS,
                    },
                },
                { new: true, upsert: true, runValidators: true },
            )
            .lean<Settings>();

        // Create a new object with converted URLs to avoid mutation issues
        return {
            ...settings,
            logoUrl: settings.logoUrl ? toFullUrl(settings.logoUrl) : settings.logoUrl,
            loginLogoUrl: settings.loginLogoUrl ? toFullUrl(settings.loginLogoUrl) : settings.loginLogoUrl,
            loginIllustrationUrl: settings.loginIllustrationUrl ? toFullUrl(settings.loginIllustrationUrl) : settings.loginIllustrationUrl,
        };
    }

    async getPublicSettings() {
        const s = await this.getSettings();
        return {
            schoolName: s.schoolName,
            logoUrl: s.logoUrl,
            loginLogoUrl: s.loginLogoUrl,
            loginIllustrationUrl: s.loginIllustrationUrl,
            loginMainHeading: s.loginMainHeading,
            loginWelcomeText: s.loginWelcomeText,
            loginPortalName: s.loginPortalName,
            loginTagline: s.loginTagline,
            loginIllustrationAlt: s.loginIllustrationAlt,
            theme: s.theme,
            primaryColor: s.primaryColor,
            secondaryColor: s.secondaryColor,
            primaryTextColor: s.primaryTextColor,
            secondaryTextColor: s.secondaryTextColor,
            // Theme-specific colors
            lightPrimaryColor: s.lightPrimaryColor,
            lightSecondaryColor: s.lightSecondaryColor,
            lightPrimaryTextColor: s.lightPrimaryTextColor,
            lightSecondaryTextColor: s.lightSecondaryTextColor,
            darkPrimaryColor: s.darkPrimaryColor,
            darkSecondaryColor: s.darkSecondaryColor,
            darkPrimaryTextColor: s.darkPrimaryTextColor,
            darkSecondaryTextColor: s.darkSecondaryTextColor,
            showWhatsapp: s.showWhatsapp,
            whatsappNumber: s.showWhatsapp ? s.whatsappNumber : undefined,
        };
    }

    async updateSettings(dto: UpdateSettingsDto) {
        const updated = await this.settingsModel
            .findOneAndUpdate(
                { _singleton: 'singleton' },
                { $set: dto },
                { new: true, upsert: true, runValidators: true },
            )
            .lean<Settings>();

        if (!updated) {
            throw new NotFoundException('Failed to update settings');
        }

        return updated;
    }

    async uploadLogo(file: Express.Multer.File) {
        if (!file) throw new NotFoundException('No file uploaded');

        const uploadsDir = path.join(process.cwd(), 'uploads', 'settings');
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `logo-${Date.now()}${path.extname(file.originalname)}`;
        const filepath = path.join(uploadsDir, filename);

        await fs.writeFile(filepath, file.buffer);

        const relativePath = `/uploads/settings/${filename}`;

        // Get existing settings to delete old file
        const existingSettings = await this.settingsModel.findOne({ _singleton: 'singleton' }).lean();
        if (existingSettings?.logoUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let oldRelativePath: string;
            try {
                const urlObj = new URL(existingSettings.logoUrl);
                oldRelativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                oldRelativePath = existingSettings.logoUrl;
            }
            const oldPath = path.join(process.cwd(), oldRelativePath.replace(/^\//, ''));
            await fs.unlink(oldPath).catch(() => { });
        }

        // Update with relative path
        const updated = await this.settingsModel
            .findOneAndUpdate(
                { _singleton: 'singleton' },
                { $set: { logoUrl: relativePath } },
                { new: true, upsert: true },
            )
            .lean<Settings>();

        if (!updated) {
            throw new NotFoundException('Failed to update logo');
        }

        // Return full URL
        const fullUrl = toFullUrl(relativePath);
        return { logoUrl: fullUrl };
    }

    async deleteLogo() {
        const settings = await this.getSettings();

        if (settings.logoUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let relativePath: string;
            try {
                const urlObj = new URL(settings.logoUrl);
                relativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                relativePath = settings.logoUrl;
            }
            const filepath = path.join(process.cwd(), relativePath.replace(/^\//, ''));
            await fs.unlink(filepath).catch(() => { });
        }

        await this.settingsModel.findOneAndUpdate(
            { _singleton: 'singleton' },
            { $unset: { logoUrl: 1 } },
            { new: true, upsert: true },
        );

        return { message: 'Logo deleted successfully' };
    }

    async uploadLoginLogo(file: Express.Multer.File) {
        if (!file) throw new NotFoundException('No file uploaded');

        const uploadsDir = path.join(process.cwd(), 'uploads', 'settings');
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `login-logo-${Date.now()}${path.extname(file.originalname)}`;
        const filepath = path.join(uploadsDir, filename);

        await fs.writeFile(filepath, file.buffer);

        const relativePath = `/uploads/settings/${filename}`;

        // Get existing settings to delete old file
        const existingSettings = await this.settingsModel.findOne({ _singleton: 'singleton' }).lean();
        if (existingSettings?.loginLogoUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let oldRelativePath: string;
            try {
                const urlObj = new URL(existingSettings.loginLogoUrl);
                oldRelativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                oldRelativePath = existingSettings.loginLogoUrl;
            }
            const oldPath = path.join(process.cwd(), oldRelativePath.replace(/^\//, ''));
            await fs.unlink(oldPath).catch(() => { });
        }

        // Update with relative path
        const updated = await this.settingsModel
            .findOneAndUpdate(
                { _singleton: 'singleton' },
                { $set: { loginLogoUrl: relativePath } },
                { new: true, upsert: true },
            )
            .lean<Settings>();

        if (!updated) {
            throw new NotFoundException('Failed to update login logo');
        }

        // Return full URL
        const fullUrl = toFullUrl(relativePath);
        return { loginLogoUrl: fullUrl };
    }

    async deleteLoginLogo() {
        const settings = await this.getSettings();

        if (settings.loginLogoUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let relativePath: string;
            try {
                const urlObj = new URL(settings.loginLogoUrl);
                relativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                relativePath = settings.loginLogoUrl;
            }
            const filepath = path.join(process.cwd(), relativePath.replace(/^\//, ''));
            await fs.unlink(filepath).catch(() => { });
        }

        await this.settingsModel.findOneAndUpdate(
            { _singleton: 'singleton' },
            { $unset: { loginLogoUrl: 1 } },
            { new: true, upsert: true },
        );

        return { message: 'Login logo deleted successfully' };
    }

    async uploadLoginIllustration(file: Express.Multer.File) {
        if (!file) throw new NotFoundException('No file uploaded');

        const uploadsDir = path.join(process.cwd(), 'uploads', 'settings');
        await fs.mkdir(uploadsDir, { recursive: true });

        const filename = `login-illustration-${Date.now()}${path.extname(file.originalname)}`;
        const filepath = path.join(uploadsDir, filename);

        await fs.writeFile(filepath, file.buffer);

        const relativePath = `/uploads/settings/${filename}`;

        // Get existing settings to delete old file
        const existingSettings = await this.settingsModel.findOne({ _singleton: 'singleton' }).lean();
        if (existingSettings?.loginIllustrationUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let oldRelativePath: string;
            try {
                const urlObj = new URL(existingSettings.loginIllustrationUrl);
                oldRelativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                oldRelativePath = existingSettings.loginIllustrationUrl;
            }
            const oldPath = path.join(process.cwd(), oldRelativePath.replace(/^\//, ''));
            await fs.unlink(oldPath).catch(() => { });
        }

        // Update with relative path
        const updated = await this.settingsModel
            .findOneAndUpdate(
                { _singleton: 'singleton' },
                { $set: { loginIllustrationUrl: relativePath } },
                { new: true, upsert: true },
            )
            .lean<Settings>();

        if (!updated) {
            throw new NotFoundException('Failed to update login illustration');
        }

        // Return full URL
        const fullUrl = toFullUrl(relativePath);
        return { loginIllustrationUrl: fullUrl };
    }

    async deleteLoginIllustration() {
        const settings = await this.getSettings();

        if (settings.loginIllustrationUrl) {
            // Extract relative path from full URL or use as-is if already relative
            let relativePath: string;
            try {
                const urlObj = new URL(settings.loginIllustrationUrl);
                relativePath = urlObj.pathname.replace('/schoolcrmbackend', '');
            } catch {
                // Already a relative path
                relativePath = settings.loginIllustrationUrl;
            }
            const filepath = path.join(process.cwd(), relativePath.replace(/^\//, ''));
            await fs.unlink(filepath).catch(() => { });
        }

        await this.settingsModel.findOneAndUpdate(
            { _singleton: 'singleton' },
            { $unset: { loginIllustrationUrl: 1 } },
            { new: true, upsert: true },
        );

        return { message: 'Login illustration deleted successfully' };
    }
}
