import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class MarkAttendanceDto {
    @IsString()
    @IsNotEmpty()
    studentId: string;

    @IsString()
    @IsNotEmpty()
    date: string; // 'YYYY-MM-DD'

    @IsIn(['present', 'absent'])
    status: 'present' | 'absent';
}
