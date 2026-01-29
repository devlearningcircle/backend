import { PartialType } from '@nestjs/mapped-types';
import { CreateAcademicYearDto } from './create-academic-year.dto';
import { IsBoolean, IsDateString, IsOptional, Matches } from 'class-validator';

export class UpdateAcademicYearDto extends PartialType(CreateAcademicYearDto) {
    @IsOptional()
    @Matches(/^\d{4}-\d{2}$/, { message: 'name must be like 2025-26' })
    name?: string;

    @IsOptional() @IsDateString() startDate?: string;
    @IsOptional() @IsDateString() endDate?: string;
    @IsOptional() @IsBoolean() isActive?: boolean;
}
