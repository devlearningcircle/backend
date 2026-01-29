import { Body, Controller, Put, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/roles/role.enum';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import * as bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 10);

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @Put('me/password')
    @Roles(Role.ADMIN)
    async updateOwnPassword(
        @CurrentUser('id') userId: string,
        @Body('currentPassword') currentPassword: string,
        @Body('password') newPassword: string,
    ) {
        if (!currentPassword) {
            throw new BadRequestException('Current password is required');
        }
        if (!newPassword || String(newPassword).length < 8) {
            throw new BadRequestException('Password must be at least 8 characters');
        }

        // Verify current password
        const admin = await this.adminService.findByIdForAuth(userId);
        if (!admin) {
            throw new BadRequestException('Admin not found');
        }
        const isPasswordValid = await bcrypt.compare(currentPassword, admin.password);
        if (!isPasswordValid) {
            throw new BadRequestException('Current password is incorrect');
        }

        // Hash the new password before passing to service
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        return this.adminService.updatePassword(userId, hashedPassword);
    }
}
