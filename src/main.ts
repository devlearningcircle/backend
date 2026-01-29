import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // --- Security headers (plays nice with CORS)
  app.use(
    helmet({
      // allow cross-origin loading of static assets if needed
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 🔧 Strip Passenger BaseURI so Nest sees /api/... (not /schoolcrmbackend/api/...)
  const MOUNT = '/schoolcrmbackend';
  app.use((req, _res, next) => {
    if (req.url === MOUNT) req.url = '/';
    else if (req.url.startsWith(MOUNT + '/')) req.url = req.url.slice(MOUNT.length);
    next();
  });

  // --- Serve uploads (public static files)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // --- Global API prefix
  app.setGlobalPrefix('api');

  // --- CORS
  // Add 127.0.0.1 variant and allow configuring more via env
  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://dev.learningcircle.education/',
  ];

  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Merge and de-dup
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  // In production, drop localhost variants automatically
  const origins =
    process.env.NODE_ENV === 'production'
      ? allowedOrigins.filter(o => !o.includes('localhost') && !o.includes('127.0.0.1'))
      : allowedOrigins;

  app.enableCors({
    // Function form: lets us allow "no origin" (curl/Postman) and do exact allowlisting
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow non-browser clients (no Origin header)
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Add headers you actually use in requests
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'If-Match',
      'If-None-Match',
      'X-Requested-With',
      'x-academic-year-id',
      'idempotency-key',
    ],
    // Let the browser read ETag (needed for optimistic concurrency)
    exposedHeaders: ['ETag'],
    maxAge: 600, // cache preflight for 10 minutes
  });

  // --- Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // --- Serialization
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // --- MongoDB ObjectId serialization
  const { MongoSerializeInterceptor } = await import('./common/interceptors/mongo-serialize.interceptor');
  app.useGlobalInterceptors(new MongoSerializeInterceptor());

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🌐 CORS enabled for: ${origins.join(', ')}`);
}
bootstrap();
