import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherDto } from './create-teacher.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {
    // Override password to make validation truly optional
    @IsOptional()
    @IsString()
    @MinLength(8)
    password?: string;
}
