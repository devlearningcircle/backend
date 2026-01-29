import { IsNotEmpty, IsString } from 'class-validator';

export class ReAdmitStudentDto {
  @IsString()
  @IsNotEmpty()
  newAcademicYearId: string;

  @IsString()
  @IsNotEmpty()
  newClassId: string;

  @IsString()
  @IsNotEmpty()
  newSectionId: string;
}

export class ReAdmitBulkDto {
  @IsString({ each: true })
  @IsNotEmpty()
  studentIds: string[];

  @IsString()
  @IsNotEmpty()
  newAcademicYearId: string;

  @IsString()
  @IsNotEmpty()
  newClassId: string;

  @IsString()
  @IsNotEmpty()
  newSectionId: string;
}
