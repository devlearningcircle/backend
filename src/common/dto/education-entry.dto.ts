import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class EducationEntryDto {
  @IsString()
  @IsOptional()
  degree?: string;

  @IsString()
  @IsOptional()
  university?: string;

  @IsString()
  @IsOptional()
  institution?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  grade?: string;
}
