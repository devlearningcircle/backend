import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentProductDto {
    @IsString() @IsNotEmpty()
    name: string;

    @IsOptional() @IsString()
    description?: string;

    // optional bucket/type: tuition, exam, transport etc.
    @IsOptional() @IsString()
    @IsIn(['tuition', 'exam', 'transport', 'other'])
    type?: 'tuition' | 'exam' | 'transport' | 'other';

    // INR is default for Razorpay
    @IsString() @IsIn(['INR'])
    currency: 'INR' = 'INR';

    @IsNumber() @Min(1)
    amount: number; // in rupees; we will multiply by 100 for Razorpay

    // targeting
    @IsString()
    academicYearId: string;

    @IsString()
    classId: string;

    @IsOptional() @IsBoolean()
    isActive?: boolean = true;
}
