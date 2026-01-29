import { IsIn, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
    @IsIn(['email', 'phone'])
    channel!: 'email' | 'phone';

    @IsString()
    @IsNotEmpty()
    to!: string;

    @IsString()
    @Length(6, 6)
    otp!: string;
}
