import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '../common/jwt-strategy/jwt.strategy';

import { AdminModule } from '../admin/admin.module';
import { StudentsModule } from '../students/students.module';
import { TeachersModule } from '../teachers/teachers.module';

import { OtpService } from './otp.service';
import { NotificationService } from './notification.service';

import {
  OtpManagement,
  OtpManagementSchema,
} from './schemas/otp-management.schema';

@Module({
  imports: [
    ConfigModule,
    // Register the otp_management collection for OtpService
    MongooseModule.forFeature([
      { name: OtpManagement.name, schema: OtpManagementSchema },
    ]),

    AdminModule,
    TeachersModule,
    StudentsModule,
    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || '1d',
        },
      }),
    }),
  ],
  providers: [AuthService, OtpService, NotificationService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule { }
