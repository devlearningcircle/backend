import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class ResendOtpDto {
    @IsIn(['email', 'phone'])
    channel!: 'email' | 'phone';

    @IsString()
    @IsNotEmpty()
    to!: string;
}
