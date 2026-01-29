import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        if (data?.updatedAt) {
          response.setHeader('ETag', String(new Date(data.updatedAt).getTime()));
          return data;
        }
        if (Array.isArray(data) && data.length) {
          const ts = data
            .map((d) => (d?.updatedAt ? new Date(d.updatedAt).getTime() : null))
            .filter((n) => Number.isFinite(n)) as number[];
          if (ts.length) response.setHeader('ETag', `W/"${Math.max(...ts)}"`);
        }
        return data;
      }),
    );
  }
}
