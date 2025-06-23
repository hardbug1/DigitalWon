import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockWinstonLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock winston logger 주입
    service['logger'] = mockWinstonLogger as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('로그 레벨별 로깅', () => {
    it('에러 로그를 기록해야 함', () => {
      const message = 'Test error message';
      const trace = 'Error trace';
      const context = 'TestContext';

      service.error(message, trace, context);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith({
        message,
        trace,
        context,
        timestamp: expect.any(String),
      });
    });

    it('경고 로그를 기록해야 함', () => {
      const message = 'Test warning message';
      const context = 'TestContext';

      service.warn(message, context);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith({
        message,
        context,
        timestamp: expect.any(String),
      });
    });

    it('정보 로그를 기록해야 함', () => {
      const message = 'Test info message';
      const context = 'TestContext';

      service.log(message, context);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        message,
        context,
        timestamp: expect.any(String),
      });
    });

    it('디버그 로그를 기록해야 함', () => {
      const message = 'Test debug message';
      const context = 'TestContext';

      service.debug(message, context);

      expect(mockWinstonLogger.debug).toHaveBeenCalledWith({
        message,
        context,
        timestamp: expect.any(String),
      });
    });

    it('상세 로그를 기록해야 함', () => {
      const message = 'Test verbose message';
      const context = 'TestContext';

      service.verbose(message, context);

      expect(mockWinstonLogger.verbose).toHaveBeenCalledWith({
        message,
        context,
        timestamp: expect.any(String),
      });
    });
  });

  describe('구조화된 로깅', () => {
    it('사용자 액션을 로그해야 함', () => {
      const action = 'payment_created';
      const userId = 'user-123';
      const details = { amount: 1000, currency: 'KRWX' };

      service.logUserAction(action, userId, details);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        type: 'user_action',
        action,
        userId,
        details,
        timestamp: expect.any(String),
      });
    });

    it('API 요청을 로그해야 함', () => {
      const method = 'POST';
      const url = '/payments';
      const statusCode = 201;
      const responseTime = 150;
      const userAgent = 'Mozilla/5.0';

      service.logApiRequest(method, url, statusCode, responseTime, userAgent);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        type: 'api_request',
        method,
        url,
        statusCode,
        responseTime,
        userAgent,
        timestamp: expect.any(String),
      });
    });

    it('결제 이벤트를 로그해야 함', () => {
      const paymentId = 'payment-123';
      const event = 'status_changed';
      const oldStatus = 'pending';
      const newStatus = 'completed';

      service.logPaymentEvent(paymentId, event, { oldStatus, newStatus });

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        type: 'payment_event',
        paymentId,
        event,
        data: { oldStatus, newStatus },
        timestamp: expect.any(String),
      });
    });

    it('시스템 메트릭을 로그해야 함', () => {
      const metric = 'memory_usage';
      const value = 85.5;
      const unit = 'percent';

      service.logMetric(metric, value, unit);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith({
        type: 'metric',
        metric,
        value,
        unit,
        timestamp: expect.any(String),
      });
    });
  });

  describe('보안 이벤트 로깅', () => {
    it('인증 실패를 로그해야 함', () => {
      const ip = '192.168.1.1';
      const userAgent = 'Mozilla/5.0';
      const reason = 'invalid_credentials';

      service.logSecurityEvent('auth_failed', { ip, userAgent, reason });

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith({
        type: 'security_event',
        event: 'auth_failed',
        data: { ip, userAgent, reason },
        timestamp: expect.any(String),
      });
    });

    it('의심스러운 활동을 로그해야 함', () => {
      const ip = '192.168.1.1';
      const action = 'multiple_failed_payments';
      const count = 5;

      service.logSecurityEvent('suspicious_activity', { ip, action, count });

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith({
        type: 'security_event',
        event: 'suspicious_activity',
        data: { ip, action, count },
        timestamp: expect.any(String),
      });
    });
  });
}); 