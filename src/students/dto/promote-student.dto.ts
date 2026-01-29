import { IsString } from 'class-validator';

/**
 * DTO for promoting a single student
 * Note: studentId is passed as URL parameter (:id) in the controller, not in the body
 */
export class PromoteStudentDto {
    @IsString() newClassId: string;
    @IsString() newSectionId: string;
    @IsString() newAcademicYearId: string;
}
