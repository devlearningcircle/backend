import { IsIn, IsOptional, IsString } from 'class-validator';

export class FilterPaymentsDto {
    @IsOptional() @IsString()
    academicYearId?: string;

    @IsOptional() @IsString()
    classId?: string;

    @IsOptional() @IsString()
    productId?: string;

    @IsOptional() @IsString()
    studentId?: string;

    @IsOptional() @IsString() @IsIn(['created', 'paid', 'failed', 'refunded'])
    status?: 'created' | 'paid' | 'failed' | 'refunded';
}
