import { IsOptional, IsString, Matches } from 'class-validator';

export class StudentMonthQueryDto {
    @IsOptional()
    @IsString()
    academicYearId?: string;

    // 'YYYY-MM'
    @IsString()
    @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
    month: string;
}
