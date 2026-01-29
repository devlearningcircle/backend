import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsDateString, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomDocumentDto } from '../../common/dto/custom-document.dto';
import { CustomImageDto } from '../../common/dto/custom-image.dto';
import { EducationEntryDto } from '../../common/dto/education-entry.dto';

export class CreateTeacherDto {
    // === Personal Details ===
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    // Match the min length used in the "me/password" update
    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    subject: string;

    @IsString()
    phone: string;

    @IsOptional()
    @IsDateString()
    dateOfBirth?: string;

    @IsOptional()
    @IsString()
    fatherName?: string;

    @IsOptional()
    @IsString()
    motherName?: string;

    @IsOptional()
    @IsString()
    mobileNumber?: string;

    @IsOptional()
    @IsString()
    adhaarNumber?: string;

    @IsOptional()
    @IsString()
    panNumber?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string;

    @IsOptional()
    @IsString()
    signature?: string;

    // === Custom Documents and Images ===
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomDocumentDto)
    customDocuments?: CustomDocumentDto[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CustomImageDto)
    customImages?: CustomImageDto[];

    // === Education (converted to array for multiple entries) ===
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EducationEntryDto)
    education?: EducationEntryDto[];

    // === Bank Details ===
    @IsOptional()
    @IsString()
    bankName?: string;

    @IsOptional()
    @IsString()
    accountNumber?: string;

    @IsOptional()
    @IsIn(['Savings', 'Current', 'Salary'])
    accountType?: string;

    @IsOptional()
    @IsString()
    ifscNumber?: string;

    // === PF Information ===
    @IsOptional()
    @IsString()
    pfMemberId?: string;

    @IsOptional()
    @IsString()
    pfAccountNumber?: string;

    @IsOptional()
    @IsString()
    employeeName?: string;

    @IsOptional()
    @IsIn(['Pending', 'Verified', 'Rejected'])
    kycStatus?: string;
}
