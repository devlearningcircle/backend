import { IsIn, IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @IsIn(['email', 'phone'])
    channel!: 'email' | 'phone';

    @IsString()
    @IsNotEmpty()
    value!: string;

    @IsString()
    @Length(6, 6)
    otp!: string;

    @IsString()
    @MinLength(8)
    newPassword!: string;
}
