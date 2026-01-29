import { Body, Controller, Post, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout() {
    // Stateless JWT – nothing to revoke unless you maintain a denylist.
    return { message: 'Logout successful' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }

  @Post('forgot/send-otp')
  async sendOtp(@Body() dto: SendOtpDto) {
    // DTO uses { channel, value }
    return this.authService.sendOtp(dto.channel, dto.value);
  }

  @Post('forgot/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    // DTO uses { channel, to, otp }
    return this.authService.verifyOtp(dto.channel, dto.to, dto.otp);
  }

  @Post('forgot/resend-otp')
  async resendOtp(@Body() dto: ResendOtpDto) {
    // DTO uses { channel, to }
    return this.authService.resendOtp(dto.channel, dto.to);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    // DTO uses { channel, value, otp, newPassword }
    return this.authService.resetPassword(dto);
  }
}
