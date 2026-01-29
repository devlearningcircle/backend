import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChangeLog, ChangeLogDocument } from './change-log.schema';
import { RequestContext } from 'src/common/context/request-context';

@Injectable()
export class AuditService {
    constructor(@InjectModel(ChangeLog.name) private readonly model: Model<ChangeLogDocument>) { }

    async log(params: {
        entity: string; entityId: string; action: ChangeLog['action'];
        before?: any; after?: any; ctx?: RequestContext;
    }) {
        return this.model.create({
            entity: params.entity,
            entityId: params.entityId,
            action: params.action,
            before: params.before,
            after: params.after,
            academicYearId: params.ctx?.academicYearId ?? null,
            actorUserId: params.ctx?.userId ?? null,
        });
    }

    find(filter: { entity?: string; entityId?: string; action?: string; ay?: string | null } = {}) {
        const q: any = {};
        if (filter.entity) q.entity = filter.entity;
        if (filter.entityId) q.entityId = filter.entityId;
        if (filter.action) q.action = filter.action;
        if (typeof filter.ay !== 'undefined') q.academicYearId = filter.ay;
        return this.model.find(q).sort({ createdAt: -1 }).lean();
    }
}
