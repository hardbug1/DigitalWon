import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LoggerService } from '../libs/logger.service';

// nodemailer mock
jest.mock('nodemailer');
const nodemailer = require('nodemailer');

// twilio mock
jest.mock('twilio');
const twilio = require('twilio');

// AWS SDK mocks
jest.mock('@aws-sdk/client-ses');
jest.mock('@aws-sdk/client-sns');

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockTransporter = {
    sendMail: jest.fn(),
  };

  const mockTwilioClient = {
    messages: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Mock 설정
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: '587',
        SMTP_USER: 'test@example.com',
        SMTP_PASS: 'password',
        TWILIO_ACCOUNT_SID: 'test-account-sid',
        TWILIO_AUTH_TOKEN: 'test-auth-token',
        TWILIO_PHONE_NUMBER: '+1234567890',
        AWS_REGION: 'us-east-1',
        FROM_EMAIL: 'noreply@krwx.com',
        FROM_NAME: 'KRWX Stablecoin',
      };
      return config[key];
    });

    nodemailer.createTransport.mockReturnValue(mockTransporter);
    twilio.mockReturnValue(mockTwilioClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    const mockEmailData = {
      to: 'test@example.com',
      subject: 'Test Email',
      template: 'welcome',
      data: { name: 'Test User' },
    };

    it('이메일을 성공적으로 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendEmail(mockEmailData);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'KRWX Stablecoin <noreply@krwx.com>',
        to: mockEmailData.to,
        subject: mockEmailData.subject,
        html: expect.any(String),
      });
      expect(result).toBe(true);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Email sent successfully'),
        'NotificationService',
      );
    });

    it('이메일 발송 실패 시 에러를 처리해야 함', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const result = await service.sendEmail(mockEmailData);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        error.stack,
        'NotificationService',
      );
    });

    it('잘못된 이메일 주소로 실패해야 함', async () => {
      const invalidEmailData = {
        ...mockEmailData,
        to: 'invalid-email',
      };

      const result = await service.sendEmail(invalidEmailData);

      expect(result).toBe(false);
    });
  });

  describe('sendSMS', () => {
    const mockSmsData = {
      to: '+821012345678',
      message: 'Your verification code is: 123456',
    };

    it('SMS를 성공적으로 발송해야 함', async () => {
      mockTwilioClient.messages.create.mockResolvedValue({ sid: 'test-message-sid' });

      const result = await service.sendSMS(mockSmsData);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: mockSmsData.message,
        from: '+1234567890',
        to: mockSmsData.to,
      });
      expect(result).toBe(true);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('SMS sent successfully'),
        'NotificationService',
      );
    });

    it('SMS 발송 실패 시 에러를 처리해야 함', async () => {
      const error = new Error('Twilio API error');
      mockTwilioClient.messages.create.mockRejectedValue(error);

      const result = await service.sendSMS(mockSmsData);

      expect(result).toBe(false);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send SMS'),
        error.stack,
        'NotificationService',
      );
    });

    it('잘못된 전화번호로 실패해야 함', async () => {
      const invalidSmsData = {
        ...mockSmsData,
        to: 'invalid-phone',
      };

      const result = await service.sendSMS(invalidSmsData);

      expect(result).toBe(false);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('환영 이메일을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendWelcomeEmail('test@example.com', 'Test User');

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('환영합니다'),
        }),
      );
    });
  });

  describe('sendVerificationEmail', () => {
    it('이메일 인증 메일을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendVerificationEmail(
        'test@example.com',
        'Test User',
        'verification-token',
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('이메일 인증'),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('비밀번호 재설정 이메일을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendPasswordResetEmail(
        'test@example.com',
        'Test User',
        'reset-token',
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('비밀번호 재설정'),
        }),
      );
    });
  });

  describe('sendTwoFactorSMS', () => {
    it('2FA 인증 코드 SMS를 발송해야 함', async () => {
      mockTwilioClient.messages.create.mockResolvedValue({ sid: 'test-message-sid' });

      const result = await service.sendTwoFactorSMS('+821012345678', '123456');

      expect(result).toBe(true);
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+821012345678',
          body: expect.stringContaining('123456'),
        }),
      );
    });
  });

  describe('sendTransactionNotification', () => {
    const mockTransaction = {
      id: 'tx-123',
      type: 'SEND',
      amount: '100.00',
      currency: 'KRWX',
      status: 'COMPLETED',
      toAddress: '0x1234567890abcdef',
    };

    it('거래 알림 이메일을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendTransactionNotification(
        'test@example.com',
        'Test User',
        mockTransaction,
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('거래'),
        }),
      );
    });
  });

  describe('sendKycStatusNotification', () => {
    it('KYC 상태 변경 알림을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendKycStatusNotification(
        'test@example.com',
        'Test User',
        'APPROVED',
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('KYC'),
        }),
      );
    });
  });

  describe('sendSecurityAlert', () => {
    it('보안 알림을 발송해야 함', async () => {
      mockTransporter.sendMail.mockResolvedValue({ messageId: 'test-message-id' });

      const result = await service.sendSecurityAlert(
        'test@example.com',
        'Test User',
        'SUSPICIOUS_LOGIN',
        { ip: '192.168.1.1', location: 'Seoul, Korea' },
      );

      expect(result).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('보안'),
        }),
      );
    });
  });

  describe('템플릿 시스템', () => {
    it('이메일 템플릿을 올바르게 렌더링해야 함', () => {
      const template = service.renderTemplate('welcome', {
        name: 'Test User',
        verificationUrl: 'https://example.com/verify',
      });

      expect(template).toContain('Test User');
      expect(template).toContain('https://example.com/verify');
    });

    it('존재하지 않는 템플릿에 대해 기본 템플릿을 사용해야 함', () => {
      const template = service.renderTemplate('nonexistent', { message: 'Test message' });

      expect(template).toContain('Test message');
    });
  });

  describe('유효성 검사', () => {
    it('이메일 주소 형식을 검증해야 함', () => {
      expect(service.isValidEmail('test@example.com')).toBe(true);
      expect(service.isValidEmail('invalid-email')).toBe(false);
      expect(service.isValidEmail('')).toBe(false);
    });

    it('전화번호 형식을 검증해야 함', () => {
      expect(service.isValidPhoneNumber('+821012345678')).toBe(true);
      expect(service.isValidPhoneNumber('+1234567890')).toBe(true);
      expect(service.isValidPhoneNumber('01012345678')).toBe(false);
      expect(service.isValidPhoneNumber('invalid-phone')).toBe(false);
    });
  });
}); 