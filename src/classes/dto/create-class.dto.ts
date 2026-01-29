import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    // Used to order classes and compute "next class" for promotion
    @IsOptional()
    @IsInt()
    @Min(0)
    order?: number;
}
