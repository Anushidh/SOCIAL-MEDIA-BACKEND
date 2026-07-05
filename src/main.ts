import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  
  const configService = app.get(ConfigService);

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Cookie parser (needed for HttpOnly refresh token cookie)
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global transform interceptor (class-transformer serialization)
  app.useGlobalInterceptors(new TransformInterceptor());

  // Serve static uploads
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  // CORS — support comma-separated origins for multiple environments
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  const allowedOrigins = corsOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger — only in non-production
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Social Media API')
      .setDescription('Social media application REST API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User profile management')
      .addTag('Posts', 'Post CRUD and feed')
      .addTag('Comments', 'Comment management')
      .addTag('Likes', 'Like/unlike posts')
      .addTag('Follows', 'Follow/unfollow users')
      .addTag('Messages', 'Real-time messaging')
      .addTag('Notifications', 'In-app notifications')
      .addTag('Media', 'File uploads')
      .addTag('Hashtags', 'Hashtag search and trending')
      .addTag('Stories', 'Ephemeral stories')
      .addTag('Reposts', 'Share/repost content')
      .addTag('Reports', 'Content reporting')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs available at /api/docs`);
  }

  const port = configService.get<number>('APP_PORT', 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Application running on port ${port}`);
}
bootstrap();
