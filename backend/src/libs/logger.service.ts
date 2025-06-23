import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor(private readonly configService: ConfigService) {
    this.createLogger();
  }

  /**
   * Winston 로거를 초기화합니다.
   */
  private createLogger(): void {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // 개발 환경과 프로덕션 환경에 따른 로그 형식 설정
    const logFormat = nodeEnv === 'production'
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      : winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, context, trace }) => {
            return `${timestamp} [${level}] ${context ? `[${context}] ` : ''}${message}${trace ? `\n${trace}` : ''}`;
          })
        );

    // 전송 방식 설정
    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: logLevel,
        format: logFormat,
      }),
    ];

    // 프로덕션 환경에서는 파일 로그도 추가
    if (nodeEnv === 'production') {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        }),
        new winston.transports.File({
          filename: 'logs/app.log',
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      // 핸들되지 않은 예외 처리
      exceptionHandlers: [
        new winston.transports.Console(),
        ...(nodeEnv === 'production' ? [new winston.transports.File({ filename: 'logs/exceptions.log' })] : []),
      ],
      // 핸들되지 않은 rejection 처리
      rejectionHandlers: [
        new winston.transports.Console(),
        ...(nodeEnv === 'production' ? [new winston.transports.File({ filename: 'logs/rejections.log' })] : []),
      ],
    });
  }

  /**
   * 에러 로그를 기록합니다.
   * @param message 메시지
   * @param trace 스택 트레이스
   * @param context 컨텍스트
   */
  error(message: any, trace?: string, context?: string): void {
    this.logger.error({
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      trace,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 경고 로그를 기록합니다.
   * @param message 메시지
   * @param context 컨텍스트
   */
  warn(message: any, context?: string): void {
    this.logger.warn({
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 정보 로그를 기록합니다.
   * @param message 메시지
   * @param context 컨텍스트
   */
  log(message: any, context?: string): void {
    this.logger.info({
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 디버그 로그를 기록합니다.
   * @param message 메시지
   * @param context 컨텍스트
   */
  debug(message: any, context?: string): void {
    this.logger.debug({
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 상세 로그를 기록합니다.
   * @param message 메시지
   * @param context 컨텍스트
   */
  verbose(message: any, context?: string): void {
    this.logger.verbose({
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 사용자 액션을 로그합니다.
   * @param action 액션명
   * @param userId 사용자 ID
   * @param details 상세 정보
   */
  logUserAction(action: string, userId: string, details?: any): void {
    this.logger.info({
      type: 'user_action',
      action,
      userId,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * API 요청을 로그합니다.
   * @param method HTTP 메서드
   * @param url 요청 URL
   * @param statusCode 응답 상태 코드
   * @param responseTime 응답 시간 (ms)
   * @param userAgent User-Agent
   */
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    userAgent?: string,
  ): void {
    this.logger.info({
      type: 'api_request',
      method,
      url,
      statusCode,
      responseTime,
      userAgent,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 결제 이벤트를 로그합니다.
   * @param paymentId 결제 ID
   * @param event 이벤트명
   * @param data 이벤트 데이터
   */
  logPaymentEvent(paymentId: string, event: string, data?: any): void {
    this.logger.info({
      type: 'payment_event',
      paymentId,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 시스템 메트릭을 로그합니다.
   * @param metric 메트릭명
   * @param value 값
   * @param unit 단위
   */
  logMetric(metric: string, value: number, unit?: string): void {
    this.logger.info({
      type: 'metric',
      metric,
      value,
      unit,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 보안 이벤트를 로그합니다.
   * @param event 이벤트명
   * @param data 이벤트 데이터
   */
  logSecurityEvent(event: string, data?: any): void {
    this.logger.warn({
      type: 'security_event',
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 블록체인 트랜잭션을 로그합니다.
   * @param txHash 트랜잭션 해시
   * @param event 이벤트명
   * @param data 트랜잭션 데이터
   */
  logBlockchainEvent(txHash: string, event: string, data?: any): void {
    this.logger.info({
      type: 'blockchain_event',
      txHash,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }
} 