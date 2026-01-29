import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

class BulkEntryDto {
    @IsString()
    @IsNotEmpty()
    studentId: string;

    @IsIn(['present', 'absent'])
    status: 'present' | 'absent';
}

export class BulkMarkDto {
    @IsString()
    @IsNotEmpty()
    date: string; // 'YYYY-MM-DD'

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BulkEntryDto)
    entries: BulkEntryDto[];
}
