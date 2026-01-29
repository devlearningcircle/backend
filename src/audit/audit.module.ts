import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChangeLog, ChangeLogSchema } from './change-log.schema';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
    imports: [MongooseModule.forFeature([{ name: ChangeLog.name, schema: ChangeLogSchema }])],
    providers: [AuditService],
    controllers: [AuditController],
    exports: [AuditService],
})
export class AuditModule { }
