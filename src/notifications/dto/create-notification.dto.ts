import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
    @IsString()
    @IsNotEmpty()
    subject: string;

    @IsString()
    @IsNotEmpty()
    message: string;

    @IsIn(['email', 'web'])
    type: 'email' | 'web';

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    recipients?: string[];

    @IsOptional()
    @IsString()
    academicYearId?: string;

    @IsOptional()
    @IsString()
    classId?: string;

    @IsOptional()
    @IsString()
    sectionId?: string;

    // File metadata from Cloudinary uploads
    @IsOptional()
    @IsString()
    fileUrl?: string;

    @IsOptional()
    @IsString()
    fileName?: string;

    @IsOptional()
    @IsString()
    fileType?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    fileSize?: number;
}
