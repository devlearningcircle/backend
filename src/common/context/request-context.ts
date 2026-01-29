import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestContext {
    userId?: string;
    academicYearId?: string | null;
}

export const getReqContext = (ctx: ExecutionContext): RequestContext => {
    const req = ctx.switchToHttp().getRequest();
    return (req.__ctx ||= {}) as RequestContext;
};

export const ReqCtx = createParamDecorator((_data: unknown, ctx: ExecutionContext) => getReqContext(ctx));
