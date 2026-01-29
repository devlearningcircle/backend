import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BaseEntity } from '../../common/entities/base.entity';

export type SettingsDocument = Settings & Document;

@Schema({ timestamps: true })
export class Settings extends BaseEntity {
    @Prop({ default: 'School Management System', trim: true })
    schoolName: string;

    @Prop({ trim: true })
    schoolAddress?: string;

    @Prop({ trim: true })
    schoolPhone?: string;

    @Prop({ trim: true, lowercase: true })
    schoolEmail?: string;

    @Prop({ trim: true })
    schoolWebsite?: string;

    @Prop({ trim: true })
    logoUrl?: string; // Path to uploaded logo

    @Prop({ trim: true })
    loginLogoUrl?: string; // Path to uploaded login page logo

    @Prop({ trim: true })
    loginIllustrationUrl?: string; // Path to uploaded login page illustration

    // Login Page Text Customization
    @Prop({ trim: true })
    loginMainHeading?: string; // Main heading on left panel (e.g., "Welcome to WebCircel Public School")

    @Prop({ trim: true })
    loginWelcomeText?: string; // e.g., "Welcome to" or "Sign in to"

    @Prop({ trim: true })
    loginPortalName?: string; // e.g., "School Portal" or custom name

    @Prop({ trim: true })
    loginTagline?: string; // Tagline shown on left side of login page

    @Prop({ trim: true })
    loginIllustrationAlt?: string; // Alt text for login illustration image (accessibility)

    @Prop({ default: 'light', enum: ['light', 'dark'] })
    theme: 'light' | 'dark';

    @Prop({ default: '#4c3cc9' }) // Default purple/blue
    primaryColor: string;

    @Prop({ default: '#3f2fb1' })
    secondaryColor: string;

    // Light Theme Colors
    @Prop({ trim: true })
    lightPrimaryColor?: string;

    @Prop({ trim: true })
    lightSecondaryColor?: string;

    @Prop({ trim: true })
    lightPrimaryTextColor?: string;

    @Prop({ trim: true })
    lightSecondaryTextColor?: string;

    // Dark Theme Colors
    @Prop({ trim: true })
    darkPrimaryColor?: string;

    @Prop({ trim: true })
    darkSecondaryColor?: string;

    @Prop({ trim: true })
    darkPrimaryTextColor?: string;

    @Prop({ trim: true })
    darkSecondaryTextColor?: string;

    // Legacy text colors (for backward compatibility)
    @Prop({ trim: true })
    primaryTextColor?: string;

    @Prop({ trim: true })
    secondaryTextColor?: string;

    @Prop({ trim: true })
    whatsappNumber?: string; // Format: +919876543210

    @Prop({ default: false })
    showWhatsapp: boolean;

    @Prop({ default: true })
    sidebarCollapsed: boolean; // User preference (can be per-user later)

    @Prop({ trim: true })
    academicYearFormat?: string; // e.g., "YYYY-YYYY" or "YYYY-YY"

    // Singleton pattern: only one settings document
    @Prop({ default: 'singleton' })
    _singleton: string; // Index defined below with schema.index()
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);

// Ensure only one settings document exists
SettingsSchema.index({ _singleton: 1 }, { unique: true });