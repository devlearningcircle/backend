import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('change-logs')
export class AuditController {
    constructor(private readonly audit: AuditService) { }

    @Get()
    async list(@Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('action') action?: string, @Query('ay') ay?: string) {
        const data = await this.audit.find({ entity, entityId, action, ay: typeof ay === 'undefined' ? undefined : ay || null });
        return { ok: true, data };
    }
}
