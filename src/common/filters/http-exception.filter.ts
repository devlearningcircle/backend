import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();

        const status = exception instanceof HttpException ? exception.getStatus() : 500;
        const payload = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal error' };

        const message = typeof payload === 'string'
            ? payload
            : (payload as { message?: string })?.message ?? 'Internal error';

        // Log the error for debugging
        if (status === 500) {
            this.logger.error(`Internal Server Error on ${req.method} ${req.url}`, exception.stack || exception);
        }

        res.status(status).json({
            ok: false,
            error: { code: status, message, path: req.url, ts: new Date().toISOString() },
        });
    }
}