import { IsBoolean, IsDateString, IsOptional, Matches } from 'class-validator';

export class CreateAcademicYearDto {
    // Optional: if provided, still must match pattern; otherwise server derives from dates
    @IsOptional()
    @Matches(/^\d{4}-\d{2}$/, { message: 'name must be like 2025-26' })
    name?: string;

    @IsDateString() startDate: string;
    @IsDateString() endDate: string;

    @IsOptional() @IsBoolean() isActive?: boolean;
}
