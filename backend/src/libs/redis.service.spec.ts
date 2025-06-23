import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockRedisClient = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    hExists: jest.fn(),
    hGetAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock Redis client 주입
    service['client'] = mockRedisClient as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('기본 캐시 작업', () => {
    describe('set', () => {
      it('키-값을 저장해야 함', async () => {
        const key = 'test-key';
        const value = 'test-value';

        mockRedisClient.set.mockResolvedValue('OK');

        await service.set(key, value);

        expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      });

      it('TTL과 함께 키-값을 저장해야 함', async () => {
        const key = 'test-key';
        const value = 'test-value';
        const ttl = 3600;

        mockRedisClient.set.mockResolvedValue('OK');

        await service.set(key, value, ttl);

        expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
      });

      it('객체를 JSON으로 저장해야 함', async () => {
        const key = 'test-object';
        const value = { id: 1, name: 'test' };

        mockRedisClient.set.mockResolvedValue('OK');

        await service.set(key, value);

        expect(mockRedisClient.set).toHaveBeenCalledWith(key, JSON.stringify(value));
      });
    });

    describe('get', () => {
      it('키로 값을 조회해야 함', async () => {
        const key = 'test-key';
        const expectedValue = 'test-value';

        mockRedisClient.get.mockResolvedValue(expectedValue);

        const result = await service.get(key);

        expect(mockRedisClient.get).toHaveBeenCalledWith(key);
        expect(result).toBe(expectedValue);
      });

      it('존재하지 않는 키로 조회 시 null을 반환해야 함', async () => {
        const key = 'non-existent-key';

        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.get(key);

        expect(result).toBeNull();
      });

      it('JSON 문자열을 객체로 파싱해야 함', async () => {
        const key = 'test-object';
        const originalObject = { id: 1, name: 'test' };
        const jsonString = JSON.stringify(originalObject);

        mockRedisClient.get.mockResolvedValue(jsonString);

        const result = await service.get(key);

        expect(result).toEqual(originalObject);
      });
    });

    describe('del', () => {
      it('키를 삭제해야 함', async () => {
        const key = 'test-key';

        mockRedisClient.del.mockResolvedValue(1);

        const result = await service.del(key);

        expect(mockRedisClient.del).toHaveBeenCalledWith(key);
        expect(result).toBe(1);
      });

      it('여러 키를 동시에 삭제해야 함', async () => {
        const keys = ['key1', 'key2', 'key3'];

        mockRedisClient.del.mockResolvedValue(3);

        const result = await service.del(...keys);

        expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
        expect(result).toBe(3);
      });
    });

    describe('exists', () => {
      it('키가 존재하는지 확인해야 함', async () => {
        const key = 'test-key';

        mockRedisClient.exists.mockResolvedValue(1);

        const result = await service.exists(key);

        expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
        expect(result).toBe(true);
      });

      it('키가 존재하지 않으면 false를 반환해야 함', async () => {
        const key = 'non-existent-key';

        mockRedisClient.exists.mockResolvedValue(0);

        const result = await service.exists(key);

        expect(result).toBe(false);
      });
    });
  });

  describe('세션 관리', () => {
    describe('setSession', () => {
      it('세션을 저장해야 함', async () => {
        const sessionId = 'session-123';
        const sessionData = { userId: 'user-1', role: 'user' };
        const ttl = 1800; // 30분

        mockRedisClient.set.mockResolvedValue('OK');

        await service.setSession(sessionId, sessionData, ttl);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          `session:${sessionId}`,
          JSON.stringify(sessionData),
          'EX',
          ttl
        );
      });
    });

    describe('getSession', () => {
      it('세션을 조회해야 함', async () => {
        const sessionId = 'session-123';
        const sessionData = { userId: 'user-1', role: 'user' };

        mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));

        const result = await service.getSession(sessionId);

        expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`);
        expect(result).toEqual(sessionData);
      });
    });

    describe('deleteSession', () => {
      it('세션을 삭제해야 함', async () => {
        const sessionId = 'session-123';

        mockRedisClient.del.mockResolvedValue(1);

        await service.deleteSession(sessionId);

        expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`);
      });
    });
  });

  describe('결제 임시 데이터 관리', () => {
    describe('setPaymentCache', () => {
      it('결제 임시 데이터를 저장해야 함', async () => {
        const paymentId = 'payment-123';
        const paymentData = { amount: 1000, status: 'processing' };
        const ttl = 600; // 10분

        mockRedisClient.set.mockResolvedValue('OK');

        await service.setPaymentCache(paymentId, paymentData, ttl);

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          `payment:${paymentId}`,
          JSON.stringify(paymentData),
          'EX',
          ttl
        );
      });
    });

    describe('getPaymentCache', () => {
      it('결제 임시 데이터를 조회해야 함', async () => {
        const paymentId = 'payment-123';
        const paymentData = { amount: 1000, status: 'processing' };

        mockRedisClient.get.mockResolvedValue(JSON.stringify(paymentData));

        const result = await service.getPaymentCache(paymentId);

        expect(mockRedisClient.get).toHaveBeenCalledWith(`payment:${paymentId}`);
        expect(result).toEqual(paymentData);
      });
    });
  });

  describe('TTL 관리', () => {
    describe('setTtl', () => {
      it('키의 TTL을 설정해야 함', async () => {
        const key = 'test-key';
        const ttl = 3600;

        mockRedisClient.expire.mockResolvedValue(1);

        const result = await service.setTtl(key, ttl);

        expect(mockRedisClient.expire).toHaveBeenCalledWith(key, ttl);
        expect(result).toBe(true);
      });
    });

    describe('getTtl', () => {
      it('키의 남은 TTL을 조회해야 함', async () => {
        const key = 'test-key';
        const expectedTtl = 1800;

        mockRedisClient.ttl.mockResolvedValue(expectedTtl);

        const result = await service.getTtl(key);

        expect(mockRedisClient.ttl).toHaveBeenCalledWith(key);
        expect(result).toBe(expectedTtl);
      });
    });
  });
}); 