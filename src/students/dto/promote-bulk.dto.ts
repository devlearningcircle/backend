import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PromoteBulkDto {
    @IsString() @IsNotEmpty()
    fromClassId: string;

    @IsOptional() @IsString()
    fromSectionId?: string;

    @IsOptional() @IsString()
    fromAcademicYearId?: string;

    @IsString() @IsNotEmpty()
    toAcademicYearId: string;

    @IsOptional() @IsString()
    targetClassId?: string;

    @IsOptional() @IsString()
    targetSectionId?: string;

    @IsOptional() @IsArray() @IsString({ each: true })
    studentIds?: string[]; // Optional: if provided, only promote these specific students
}
