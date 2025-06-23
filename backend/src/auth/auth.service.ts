import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { LoggerService } from '../libs/logger.service';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
}

export interface LoginDto {
  email: string;
  password: string;
  twoFactorToken?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    name: string;
    isTwoFactorEnabled: boolean;
  };
  requiresTwoFactor?: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeUrl: string;
}

@Injectable()
export class AuthService {
  private readonly maxLoginAttempts: number;
  private readonly lockoutTime: number; // 분 단위

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.maxLoginAttempts = parseInt(this.configService.get('MAX_LOGIN_ATTEMPTS', '5'));
    this.lockoutTime = parseInt(this.configService.get('LOCKOUT_TIME', '15'));
  }

  /**
   * 사용자 등록
   * @param registerDto 등록 정보
   * @returns 등록된 사용자 정보
   */
  async register(registerDto: RegisterDto): Promise<any> {
    const { email, password, name } = registerDto;

    // 비밀번호 길이 검증
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // 이메일 중복 검사
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      this.loggerService.logSecurityEvent('registration_attempt_duplicate_email', {
        email,
        timestamp: new Date().toISOString(),
      });
      throw new BadRequestException('Email already exists');
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = await this.usersService.create({
      email,
      password: hashedPassword,
      name,
      isEmailVerified: false,
      isTwoFactorEnabled: false,
    });

    this.loggerService.log(
      `User registered: ${email} (ID: ${user.id})`,
      'AuthService',
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * 사용자 로그인
   * @param loginDto 로그인 정보
   * @returns JWT 토큰과 사용자 정보
   */
  async login(loginDto: LoginDto): Promise<LoginResponse> {
    const { email, password, twoFactorToken } = loginDto;

    // 사용자 조회
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.loggerService.logSecurityEvent('login_failed_user_not_found', {
        email,
        timestamp: new Date().toISOString(),
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 계정 잠금 상태 확인
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      this.loggerService.logSecurityEvent('login_attempt_locked_account', {
        userId: user.id,
        email,
        lockoutUntil: user.lockoutUntil.toISOString(),
      });
      throw new UnauthorizedException('Account is temporarily locked');
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.usersService.updateLoginAttempts(user.id);
      this.loggerService.logSecurityEvent('login_failed', {
        userId: user.id,
        email,
        attempts: user.loginAttempts + 1,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2FA 검증 (활성화된 경우)
    if (user.isTwoFactorEnabled) {
      if (!twoFactorToken) {
        return {
          accessToken: '',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isTwoFactorEnabled: true,
          },
          requiresTwoFactor: true,
        };
      }

      const isTwoFactorValid = await this.verifyTwoFactorToken(user.id, twoFactorToken);
      if (!isTwoFactorValid) {
        this.loggerService.logSecurityEvent('login_failed_2fa', {
          userId: user.id,
          email,
        });
        throw new UnauthorizedException('Invalid two-factor authentication code');
      }
    }

    // 로그인 성공: 로그인 시도 횟수 리셋
    await this.usersService.resetLoginAttempts(user.id);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.refreshToken(user.id);

    this.loggerService.log(
      `User logged in: ${email} (ID: ${user.id})`,
      'AuthService',
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  /**
   * 2FA 비밀키 생성
   * @param userId 사용자 ID
   * @param email 사용자 이메일
   * @returns 2FA 설정 정보
   */
  async generateTwoFactorSecret(userId: string, email: string): Promise<TwoFactorSetup> {
    const secret = speakeasy.generateSecret({
      name: email,
      service_name: 'KRWX Stablecoin',
      length: 32,
    });

    // 임시로 비밀키 저장 (아직 활성화되지 않음)
    await this.usersService.updateTwoFactorSecret(userId, secret.base32);

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
    };
  }

  /**
   * 2FA 토큰 검증
   * @param userId 사용자 ID
   * @param token 6자리 토큰
   * @returns 검증 결과
   */
  async verifyTwoFactorToken(userId: string, token: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.twoFactorSecret) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2, // 30초 전후 허용
    });

    if (!verified) {
      this.loggerService.logSecurityEvent('two_factor_verification_failed', {
        userId,
        timestamp: new Date().toISOString(),
      });
    }

    return verified;
  }

  /**
   * 2FA 활성화
   * @param userId 사용자 ID
   * @param token 검증 토큰
   * @returns 활성화 결과
   */
  async enableTwoFactor(userId: string, token: string): Promise<boolean> {
    const isValid = await this.verifyTwoFactorToken(userId, token);
    if (!isValid) {
      return false;
    }

    await this.usersService.enableTwoFactor(userId, true);

    this.loggerService.log(
      `Two-factor authentication enabled for user: ${userId}`,
      'AuthService',
    );

    return true;
  }

  /**
   * 2FA 비활성화
   * @param userId 사용자 ID
   * @param token 검증 토큰
   * @returns 비활성화 결과
   */
  async disableTwoFactor(userId: string, token: string): Promise<boolean> {
    const isValid = await this.verifyTwoFactorToken(userId, token);
    if (!isValid) {
      return false;
    }

    await this.usersService.enableTwoFactor(userId, false);
    await this.usersService.updateTwoFactorSecret(userId, null);

    this.loggerService.log(
      `Two-factor authentication disabled for user: ${userId}`,
      'AuthService',
    );

    return true;
  }

  /**
   * JWT 페이로드로 사용자 검증
   * @param payload JWT 페이로드
   * @returns 사용자 정보 또는 null
   */
  async validateUser(payload: JwtPayload): Promise<any> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  /**
   * 리프레시 토큰 생성
   * @param userId 사용자 ID
   * @returns 리프레시 토큰
   */
  refreshToken(userId: string): string {
    const payload: JwtPayload = { sub: userId, type: 'refresh' };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  /**
   * 리프레시 토큰 검증
   * @param token 리프레시 토큰
   * @returns 페이로드 또는 null
   */
  validateRefreshToken(token: string): JwtPayload | null {
    try {
      const payload = this.jwtService.verify(token) as JwtPayload;
      if (payload.type !== 'refresh') {
        return null;
      }
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 액세스 토큰 갱신
   * @param refreshToken 리프레시 토큰
   * @returns 새로운 액세스 토큰
   */
  async refreshAccessToken(refreshToken: string): Promise<LoginResponse | null> {
    const payload = this.validateRefreshToken(refreshToken);
    if (!payload) {
      return null;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return null;
    }

    const newPayload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(newPayload);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isTwoFactorEnabled: user.isTwoFactorEnabled,
      },
    };
  }

  /**
   * 로그아웃 (토큰 블랙리스트 처리)
   * @param userId 사용자 ID
   * @param token JWT 토큰
   */
  async logout(userId: string, token: string): Promise<void> {
    // TODO: Redis에 토큰 블랙리스트 추가
    // await this.redisService.set(`blacklist:${token}`, '1', 'EX', 3600);

    this.loggerService.log(
      `User logged out: ${userId}`,
      'AuthService',
    );
  }

  /**
   * 비밀번호 재설정 토큰 생성
   * @param email 사용자 이메일
   * @returns 재설정 토큰
   */
  async generatePasswordResetToken(email: string): Promise<string | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const payload = { sub: user.id, type: 'password_reset' };
    const token = this.jwtService.sign(payload, { expiresIn: '1h' });

    this.loggerService.log(
      `Password reset token generated for: ${email}`,
      'AuthService',
    );

    return token;
  }

  /**
   * 비밀번호 재설정
   * @param token 재설정 토큰
   * @param newPassword 새 비밀번호
   * @returns 재설정 결과
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const payload = this.jwtService.verify(token) as JwtPayload;
      if (payload.type !== 'password_reset') {
        return false;
      }

      if (newPassword.length < 8) {
        throw new BadRequestException('Password must be at least 8 characters long');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await this.usersService.updatePassword(payload.sub, hashedPassword);

      this.loggerService.log(
        `Password reset completed for user: ${payload.sub}`,
        'AuthService',
      );

      return true;
    } catch (error) {
      this.loggerService.error(
        `Password reset failed: ${error.message}`,
        error.stack,
        'AuthService',
      );
      return false;
    }
  }
} 