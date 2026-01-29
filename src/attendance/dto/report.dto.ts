import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReportDto {
    @IsEnum(['weekly', 'monthly'])
    period: 'weekly' | 'monthly';

    @IsOptional()
    @IsString()
    classId?: string;

    @IsOptional()
    @IsString()
    sectionId?: string;

    @IsOptional()
    @IsString()
    date?: string; // 'YYYY-MM-DD'

    @IsOptional()
    @IsString()
    academicYearId?: string;
}
