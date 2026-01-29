import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class SendOtpDto {
    @IsIn(['email', 'phone'])
    channel!: 'email' | 'phone';

    @IsString()
    @IsNotEmpty()
    value!: string;
}
