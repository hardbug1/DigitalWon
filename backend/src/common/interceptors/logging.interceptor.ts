import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../../libs/logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly loggerService: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const statusCode = response.statusCode;

        // API 요청 로깅
        this.loggerService.logApiRequest(
          method,
          url,
          statusCode,
          responseTime,
          userAgent,
        );

        // 느린 요청 경고 (5초 이상)
        if (responseTime > 5000) {
          this.loggerService.warn(
            `Slow API request detected: ${method} ${url} took ${responseTime}ms`,
            'SlowRequest',
          );
        }

        // 에러 상태 코드 로깅
        if (statusCode >= 400) {
          this.loggerService.logSecurityEvent('http_error', {
            method,
            url,
            statusCode,
            userAgent,
            ip: request.ip,
          });
        }
      }),
    );
  }
} 