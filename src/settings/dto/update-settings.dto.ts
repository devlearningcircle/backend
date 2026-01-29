import { IsOptional, IsString, IsBoolean, IsIn, Matches, IsUrl } from 'class-validator';

export class UpdateSettingsDto {
    @IsOptional()
    @IsString()
    schoolName?: string;

    @IsOptional()
    @IsString()
    schoolAddress?: string;

    @IsOptional()
    @IsString()
    schoolPhone?: string;

    @IsOptional()
    @IsString()
    schoolEmail?: string;

    @IsOptional()
    @IsUrl()
    schoolWebsite?: string;

    @IsOptional()
    @IsString()
    logoUrl?: string;

    @IsOptional()
    @IsString()
    loginLogoUrl?: string;

    @IsOptional()
    @IsString()
    loginIllustrationUrl?: string;

    @IsOptional()
    @IsString()
    loginMainHeading?: string;

    @IsOptional()
    @IsString()
    loginWelcomeText?: string;

    @IsOptional()
    @IsString()
    loginPortalName?: string;

    @IsOptional()
    @IsString()
    loginTagline?: string;

    @IsOptional()
    @IsString()
    loginIllustrationAlt?: string;

    @IsOptional()
    @IsIn(['light', 'dark'])
    theme?: 'light' | 'dark';

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryColor must be a valid hex color' })
    primaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryColor must be a valid hex color' })
    secondaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'lightPrimaryColor must be a valid hex color' })
    lightPrimaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'lightSecondaryColor must be a valid hex color' })
    lightSecondaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'lightPrimaryTextColor must be a valid hex color' })
    lightPrimaryTextColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'lightSecondaryTextColor must be a valid hex color' })
    lightSecondaryTextColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'darkPrimaryColor must be a valid hex color' })
    darkPrimaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'darkSecondaryColor must be a valid hex color' })
    darkSecondaryColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'darkPrimaryTextColor must be a valid hex color' })
    darkPrimaryTextColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'darkSecondaryTextColor must be a valid hex color' })
    darkSecondaryTextColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'primaryTextColor must be a valid hex color' })
    primaryTextColor?: string;

    @IsOptional()
    @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'secondaryTextColor must be a valid hex color' })
    secondaryTextColor?: string;

    @IsOptional()
    @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid WhatsApp number format' })
    whatsappNumber?: string;

    @IsOptional()
    @IsBoolean()
    showWhatsapp?: boolean;

    @IsOptional()
    @IsBoolean()
    sidebarCollapsed?: boolean;

    @IsOptional()
    @IsString()
    academicYearFormat?: string;
}