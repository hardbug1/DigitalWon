import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggerService } from './libs/logger.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // 커스텀 로거 설정
  const loggerService = app.get(LoggerService);
  app.useLogger(loggerService);

  // 보안 헤더 설정
  app.use(helmet());

  // CORS 설정
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // 글로벌 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 글로벌 인터셉터 설정
  app.useGlobalInterceptors(new LoggingInterceptor(loggerService));

  // 글로벌 예외 필터 설정
  app.useGlobalFilters(new HttpExceptionFilter(loggerService));

  // API 문서 설정 (개발 환경에서만)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('스테이블 코인 결제 API')
      .setDescription('원화 기반 스테이블 코인 결제 시스템 API')
      .setVersion('1.0')
      .addTag('payments', '결제 관련 API')
      .addTag('transfers', '송금 관련 API')
      .addTag('wallets', '지갑 관련 API')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  loggerService.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  
  if (process.env.NODE_ENV !== 'production') {
    loggerService.log(`API Documentation: http://localhost:${port}/api-docs`, 'Bootstrap');
  }
}

bootstrap().catch((error) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
