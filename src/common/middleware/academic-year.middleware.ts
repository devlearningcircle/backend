import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AcademicYearMiddleware implements NestMiddleware {
    use(req: Request & { __ctx?: any }, _res: Response, next: NextFunction) {
        const header = req.header('X-Academic-Year-ID');
        const query = (req.query?.ay as string) || undefined;
        const academicYearId = header || query || null;

        req.__ctx = req.__ctx || {};
        req.__ctx.academicYearId = academicYearId;

        if (!req.__ctx.userId && (req as any).user?.id) {
            req.__ctx.userId = (req as any).user.id;
        }
        next();
    }
}
