import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSectionDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    classId: string;

    @IsOptional()
    @IsString()
    assignedTeacherId?: string;

    // For stable ordering within a class
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number;
}
