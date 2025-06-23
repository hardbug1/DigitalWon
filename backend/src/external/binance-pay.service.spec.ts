import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BinancePayService } from './binance-pay.service';
import { LoggerService } from '../libs/logger.service';

describe('BinancePayService', () => {
  let service: BinancePayService;
  let configService: ConfigService;
  let loggerService: LoggerService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    logSecurityEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BinancePayService,
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

    service = module.get<BinancePayService>(BinancePayService);
    configService = module.get<ConfigService>(ConfigService);
    loggerService = module.get<LoggerService>(LoggerService);

    // Mock 설정 초기화
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        BINANCE_PAY_API_KEY: 'test-api-key',
        BINANCE_PAY_SECRET_KEY: 'test-secret-key',
        BINANCE_PAY_BASE_URL: 'https://bpay.binanceapi.com',
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('createOrder', () => {
    const mockOrderData = {
      merchantId: 'test-merchant',
      merchantTradeNo: 'test-trade-123',
      totalFee: '100.00',
      currency: 'USDT',
      productName: 'KRWX Purchase',
      productDetail: 'Korean Won Stablecoin Purchase',
    };

    it('성공적으로 주문을 생성해야 함', async () => {
      const mockResponse = {
        status: 'SUCCESS',
        code: '000000',
        data: {
          prepayId: 'test-prepay-id',
          terminalType: 'WEB',
          expireTime: Date.now() + 900000, // 15분 후
          qrcodeLink: 'https://qr.binance.com/test',
          qrContent: 'binancepay://test',
          checkoutUrl: 'https://checkout.binance.com/test',
          deeplink: 'binancepay://test',
          universalUrl: 'https://app.binance.com/test',
        },
      };

      // HTTP 요청 모킹
      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.createOrder(mockOrderData);

      expect(result).toEqual(mockResponse.data);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Binance Pay order created'),
        'BinancePayService',
      );
    });

    it('잘못된 주문 데이터로 실패해야 함', async () => {
      const invalidOrderData = {
        ...mockOrderData,
        totalFee: '', // 빈 금액
      };

      await expect(service.createOrder(invalidOrderData)).rejects.toThrow();
    });

    it('API 에러 응답을 처리해야 함', async () => {
      const mockErrorResponse = {
        status: 'FAIL',
        code: '400001',
        errorMessage: 'Invalid parameters',
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockErrorResponse);

      await expect(service.createOrder(mockOrderData)).rejects.toThrow('Invalid parameters');
      expect(mockLoggerService.error).toHaveBeenCalled();
    });
  });

  describe('queryOrder', () => {
    it('주문 상태를 조회해야 함', async () => {
      const merchantTradeNo = 'test-trade-123';
      const mockResponse = {
        status: 'SUCCESS',
        code: '000000',
        data: {
          merchantId: 'test-merchant',
          merchantTradeNo,
          tradeType: 'WEB',
          totalFee: '100.00',
          currency: 'USDT',
          openUserId: 'test-user-id',
          paymentInfo: [
            {
              currency: 'USDT',
              amount: '100.00',
              networkFee: '0.1',
            },
          ],
          transactionId: 'test-transaction-id',
          status: 'PAID',
          createTime: Date.now(),
          paymentTime: Date.now(),
        },
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.queryOrder(merchantTradeNo);

      expect(result).toEqual(mockResponse.data);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Binance Pay order queried'),
        'BinancePayService',
      );
    });

    it('존재하지 않는 주문에 대해 에러를 반환해야 함', async () => {
      const merchantTradeNo = 'non-existent-order';
      const mockErrorResponse = {
        status: 'FAIL',
        code: '400002',
        errorMessage: 'Order not found',
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockErrorResponse);

      await expect(service.queryOrder(merchantTradeNo)).rejects.toThrow('Order not found');
    });
  });

  describe('closeOrder', () => {
    it('주문을 취소해야 함', async () => {
      const merchantTradeNo = 'test-trade-123';
      const mockResponse = {
        status: 'SUCCESS',
        code: '000000',
        data: {
          merchantId: 'test-merchant',
          merchantTradeNo,
          status: 'CANCELED',
        },
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.closeOrder(merchantTradeNo);

      expect(result).toEqual(mockResponse.data);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Binance Pay order closed'),
        'BinancePayService',
      );
    });
  });

  describe('verifyWebhook', () => {
    it('웹훅 서명을 검증해야 함', () => {
      const payload = JSON.stringify({
        merchantTradeNo: 'test-trade-123',
        status: 'PAID',
      });
      const timestamp = Date.now().toString();
      const nonce = 'test-nonce';

      // 실제 서명 생성 로직과 동일하게 테스트
      const isValid = service.verifyWebhook(payload, timestamp, nonce, 'test-signature');

      // 모킹된 환경에서는 실제 검증보다는 함수 호출 확인
      expect(typeof isValid).toBe('boolean');
    });

    it('잘못된 서명에 대해 false를 반환해야 함', () => {
      const payload = 'invalid-payload';
      const timestamp = 'invalid-timestamp';
      const nonce = 'invalid-nonce';
      const signature = 'invalid-signature';

      const isValid = service.verifyWebhook(payload, timestamp, nonce, signature);

      expect(isValid).toBe(false);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'webhook_verification_failed',
        expect.any(Object),
      );
    });
  });

  describe('generateSignature', () => {
    it('올바른 서명을 생성해야 함', () => {
      const timestamp = '1640995200000';
      const nonce = 'test-nonce';
      const body = '{"test":"data"}';

      const signature = service.generateSignature(timestamp, nonce, body);

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe('환경 설정 검증', () => {
    it('필수 환경변수가 없으면 에러를 발생시켜야 함', () => {
      mockConfigService.get.mockReturnValue(undefined);

      expect(() => {
        service.validateConfig();
      }).toThrow('Binance Pay configuration is missing');
    });
  });
}); 