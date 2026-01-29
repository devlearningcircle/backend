import { IsOptional, IsString } from 'class-validator';

export class FilterAttendanceDto {
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
