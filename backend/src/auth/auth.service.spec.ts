import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import { LoggerService } from '../libs/logger.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';

// bcrypt mock
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// speakeasy mock
jest.mock('speakeasy');
const mockedSpeakeasy = speakeasy as jest.Mocked<typeof speakeasy>;

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let loggerService: LoggerService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updateTwoFactorSecret: jest.fn(),
    enableTwoFactor: jest.fn(),
    updateLoginAttempts: jest.fn(),
    resetLoginAttempts: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

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
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
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

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    loggerService = module.get<LoggerService>(LoggerService);

    // 기본 설정 mock
    mockConfigService.get.mockImplementation((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '1h',
        MAX_LOGIN_ATTEMPTS: 5,
        LOCKOUT_TIME: 15,
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

  describe('register', () => {
    const mockRegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('성공적으로 사용자를 등록해야 함', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockedBcrypt.hash.mockResolvedValue('hashed-password');
      mockUsersService.create.mockResolvedValue({
        id: '1',
        email: mockRegisterDto.email,
        name: mockRegisterDto.name,
        isEmailVerified: false,
        isTwoFactorEnabled: false,
      });

      const result = await service.register(mockRegisterDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockRegisterDto.email);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(mockRegisterDto.password, 10);
      expect(mockUsersService.create).toHaveBeenCalled();
      expect(result).toEqual({
        id: '1',
        email: mockRegisterDto.email,
        name: mockRegisterDto.name,
      });
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('User registered'),
        'AuthService',
      );
    });

    it('이미 존재하는 이메일로 등록 시 에러를 발생시켜야 함', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ id: '1', email: mockRegisterDto.email });

      await expect(service.register(mockRegisterDto)).rejects.toThrow(BadRequestException);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'registration_attempt_duplicate_email',
        expect.any(Object),
      );
    });

    it('비밀번호가 너무 짧으면 에러를 발생시켜야 함', async () => {
      const invalidDto = { ...mockRegisterDto, password: '123' };

      await expect(service.register(invalidDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    const mockLoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: '1',
      email: mockLoginDto.email,
      password: 'hashed-password',
      name: 'Test User',
      isEmailVerified: true,
      isTwoFactorEnabled: false,
      loginAttempts: 0,
      lockoutUntil: null,
    };

    it('성공적으로 로그인해야 함', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(mockLoginDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockLoginDto.email);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(mockLoginDto.password, mockUser.password);
      expect(mockJwtService.sign).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          isTwoFactorEnabled: false,
        },
      });
      expect(mockUsersService.resetLoginAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('User logged in'),
        'AuthService',
      );
    });

    it('잘못된 비밀번호로 로그인 시 에러를 발생시켜야 함', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockUsersService.updateLoginAttempts).toHaveBeenCalledWith(mockUser.id);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'login_failed',
        expect.any(Object),
      );
    });

    it('존재하지 않는 사용자로 로그인 시 에러를 발생시켜야 함', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'login_failed_user_not_found',
        expect.any(Object),
      );
    });

    it('계정이 잠긴 상태에서 로그인 시 에러를 발생시켜야 함', async () => {
      const lockedUser = {
        ...mockUser,
        loginAttempts: 5,
        lockoutUntil: new Date(Date.now() + 900000), // 15분 후
      };
      mockUsersService.findByEmail.mockResolvedValue(lockedUser);

      await expect(service.login(mockLoginDto)).rejects.toThrow(UnauthorizedException);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'login_attempt_locked_account',
        expect.any(Object),
      );
    });
  });

  describe('generateTwoFactorSecret', () => {
    it('2FA 비밀키를 생성해야 함', async () => {
      const userId = '1';
      const mockSecret = {
        base32: 'MOCK_SECRET_BASE32',
        otpauth_url: 'otpauth://totp/KRWX:test@example.com?secret=MOCK_SECRET_BASE32&issuer=KRWX',
      };

      mockedSpeakeasy.generateSecret.mockReturnValue(mockSecret as any);
      mockUsersService.updateTwoFactorSecret.mockResolvedValue(undefined);

      const result = await service.generateTwoFactorSecret(userId, 'test@example.com');

      expect(mockedSpeakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'test@example.com',
        service_name: 'KRWX Stablecoin',
        length: 32,
      });
      expect(mockUsersService.updateTwoFactorSecret).toHaveBeenCalledWith(userId, mockSecret.base32);
      expect(result).toEqual({
        secret: mockSecret.base32,
        qrCodeUrl: mockSecret.otpauth_url,
      });
    });
  });

  describe('verifyTwoFactorToken', () => {
    it('올바른 2FA 토큰을 검증해야 함', async () => {
      const userId = '1';
      const token = '123456';
      const secret = 'MOCK_SECRET';

      mockUsersService.findById.mockResolvedValue({
        id: userId,
        twoFactorSecret: secret,
      });
      mockedSpeakeasy.totp.verify.mockReturnValue(true);

      const result = await service.verifyTwoFactorToken(userId, token);

      expect(mockedSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret,
        encoding: 'base32',
        token,
        window: 2,
      });
      expect(result).toBe(true);
    });

    it('잘못된 2FA 토큰에 대해 false를 반환해야 함', async () => {
      const userId = '1';
      const token = '000000';
      const secret = 'MOCK_SECRET';

      mockUsersService.findById.mockResolvedValue({
        id: userId,
        twoFactorSecret: secret,
      });
      mockedSpeakeasy.totp.verify.mockReturnValue(false);

      const result = await service.verifyTwoFactorToken(userId, token);

      expect(result).toBe(false);
      expect(mockLoggerService.logSecurityEvent).toHaveBeenCalledWith(
        'two_factor_verification_failed',
        expect.any(Object),
      );
    });
  });

  describe('enableTwoFactor', () => {
    it('2FA를 활성화해야 함', async () => {
      const userId = '1';
      const token = '123456';

      jest.spyOn(service, 'verifyTwoFactorToken').mockResolvedValue(true);
      mockUsersService.enableTwoFactor.mockResolvedValue(undefined);

      const result = await service.enableTwoFactor(userId, token);

      expect(service.verifyTwoFactorToken).toHaveBeenCalledWith(userId, token);
      expect(mockUsersService.enableTwoFactor).toHaveBeenCalledWith(userId, true);
      expect(result).toBe(true);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        expect.stringContaining('Two-factor authentication enabled'),
        'AuthService',
      );
    });

    it('잘못된 토큰으로 2FA 활성화 시 실패해야 함', async () => {
      const userId = '1';
      const token = '000000';

      jest.spyOn(service, 'verifyTwoFactorToken').mockResolvedValue(false);

      const result = await service.enableTwoFactor(userId, token);

      expect(result).toBe(false);
    });
  });

  describe('validateUser', () => {
    it('유효한 JWT 페이로드로 사용자를 검증해야 함', async () => {
      const payload = { sub: '1', email: 'test@example.com' };
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      };

      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.validateUser(payload);

      expect(mockUsersService.findById).toHaveBeenCalledWith(payload.sub);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('존재하지 않는 사용자에 대해 null을 반환해야 함', async () => {
      const payload = { sub: '999', email: 'nonexistent@example.com' };

      mockUsersService.findById.mockResolvedValue(null);

      const result = await service.validateUser(payload);

      expect(result).toBeNull();
    });
  });

  describe('refreshToken', () => {
    it('리프레시 토큰을 생성해야 함', () => {
      const userId = '1';
      mockJwtService.sign.mockReturnValue('refresh-token');

      const result = service.refreshToken(userId);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: userId, type: 'refresh' },
        { expiresIn: '7d' },
      );
      expect(result).toBe('refresh-token');
    });
  });

  describe('validateRefreshToken', () => {
    it('유효한 리프레시 토큰을 검증해야 함', () => {
      const token = 'valid-refresh-token';
      const payload = { sub: '1', type: 'refresh' };

      mockJwtService.verify.mockReturnValue(payload);

      const result = service.validateRefreshToken(token);

      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
      expect(result).toEqual(payload);
    });

    it('잘못된 리프레시 토큰에 대해 null을 반환해야 함', () => {
      const token = 'invalid-refresh-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = service.validateRefreshToken(token);

      expect(result).toBeNull();
    });
  });
}); 