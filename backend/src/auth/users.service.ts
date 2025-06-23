import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus, KycStatus } from './user.entity';
import { LoggerService } from '../libs/logger.service';
import { ConfigService } from '@nestjs/config';

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  isTwoFactorEnabled?: boolean;
}

export interface UpdateUserDto {
  name?: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  dateOfBirth?: Date;
  address?: string;
  country?: string;
  timezone?: string;
  language?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface KycUpdateDto {
  kycStatus: KycStatus;
  kycDocumentId?: string;
  kycRejectionReason?: string;
}

@Injectable()
export class UsersService {
  private readonly maxLoginAttempts: number;
  private readonly lockoutTime: number; // 분 단위

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.maxLoginAttempts = parseInt(this.configService.get('MAX_LOGIN_ATTEMPTS', '5'));
    this.lockoutTime = parseInt(this.configService.get('LOCKOUT_TIME', '15'));
  }

  /**
   * 이메일로 사용자 조회
   * @param email 이메일
   * @returns 사용자 정보 또는 null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: ['wallets', 'payments'],
    });
  }

  /**
   * ID로 사용자 조회
   * @param id 사용자 ID
   * @returns 사용자 정보 또는 null
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: ['wallets', 'payments'],
    });
  }

  /**
   * 사용자 생성
   * @param createUserDto 사용자 생성 데이터
   * @returns 생성된 사용자
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create({
      ...createUserDto,
      role: createUserDto.role || UserRole.USER,
      status: UserStatus.PENDING_VERIFICATION,
      isEmailVerified: createUserDto.isEmailVerified || false,
      isTwoFactorEnabled: createUserDto.isTwoFactorEnabled || false,
    });

    const savedUser = await this.userRepository.save(user);

    this.loggerService.log(
      `User created: ${savedUser.email} (ID: ${savedUser.id})`,
      'UsersService',
    );

    return savedUser;
  }

  /**
   * 사용자 정보 업데이트
   * @param id 사용자 ID
   * @param updateUserDto 업데이트 데이터
   * @returns 업데이트된 사용자
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    this.loggerService.log(
      `User updated: ${updatedUser.email} (ID: ${updatedUser.id})`,
      'UsersService',
    );

    return updatedUser;
  }

  /**
   * 비밀번호 업데이트
   * @param id 사용자 ID
   * @param hashedPassword 해시된 새 비밀번호
   */
  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.update(id, { 
      password: hashedPassword,
      loginAttempts: 0,
      lockoutUntil: null,
    });

    this.loggerService.log(
      `Password updated for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 2FA 비밀키 업데이트
   * @param id 사용자 ID
   * @param secret 2FA 비밀키
   */
  async updateTwoFactorSecret(id: string, secret: string | null): Promise<void> {
    await this.userRepository.update(id, { 
      twoFactorSecret: secret,
    });

    this.loggerService.log(
      `Two-factor secret updated for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 2FA 활성화/비활성화
   * @param id 사용자 ID
   * @param enabled 활성화 여부
   */
  async enableTwoFactor(id: string, enabled: boolean): Promise<void> {
    const updateData: Partial<User> = { 
      isTwoFactorEnabled: enabled,
    };

    if (!enabled) {
      updateData.twoFactorSecret = null;
      updateData.twoFactorBackupCodes = null;
    }

    await this.userRepository.update(id, updateData);

    this.loggerService.log(
      `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 로그인 시도 횟수 증가
   * @param id 사용자 ID
   */
  async updateLoginAttempts(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) return;

    const attempts = user.loginAttempts + 1;
    const updateData: Partial<User> = { loginAttempts: attempts };

    // 최대 시도 횟수 초과 시 계정 잠금
    if (attempts >= this.maxLoginAttempts) {
      updateData.lockoutUntil = new Date(Date.now() + this.lockoutTime * 60 * 1000);
      
      this.loggerService.logSecurityEvent('account_locked', {
        userId: id,
        attempts,
        lockoutUntil: updateData.lockoutUntil.toISOString(),
      });
    }

    await this.userRepository.update(id, updateData);
  }

  /**
   * 로그인 시도 횟수 리셋
   * @param id 사용자 ID
   */
  async resetLoginAttempts(id: string): Promise<void> {
    await this.userRepository.update(id, {
      loginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: new Date(),
    });
  }

  /**
   * 마지막 로그인 정보 업데이트
   * @param id 사용자 ID
   * @param ip IP 주소
   */
  async updateLastLogin(id: string, ip?: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });
  }

  /**
   * 이메일 검증 토큰 설정
   * @param id 사용자 ID
   * @param token 검증 토큰
   */
  async setEmailVerificationToken(id: string, token: string): Promise<void> {
    await this.userRepository.update(id, {
      emailVerificationToken: token,
    });
  }

  /**
   * 이메일 검증 완료
   * @param id 사용자 ID
   */
  async verifyEmail(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isEmailVerified: true,
      emailVerificationToken: null,
      status: UserStatus.ACTIVE,
    });

    this.loggerService.log(
      `Email verified for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 전화번호 검증 토큰 설정
   * @param id 사용자 ID
   * @param token 검증 토큰
   */
  async setPhoneVerificationToken(id: string, token: string): Promise<void> {
    await this.userRepository.update(id, {
      phoneVerificationToken: token,
    });
  }

  /**
   * 전화번호 검증 완료
   * @param id 사용자 ID
   */
  async verifyPhone(id: string): Promise<void> {
    await this.userRepository.update(id, {
      isPhoneVerified: true,
      phoneVerificationToken: null,
    });

    this.loggerService.log(
      `Phone verified for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * KYC 상태 업데이트
   * @param id 사용자 ID
   * @param kycUpdate KYC 업데이트 데이터
   */
  async updateKycStatus(id: string, kycUpdate: KycUpdateDto): Promise<void> {
    const updateData: Partial<User> = {
      kycStatus: kycUpdate.kycStatus,
    };

    if (kycUpdate.kycDocumentId) {
      updateData.kycDocumentId = kycUpdate.kycDocumentId;
    }

    if (kycUpdate.kycStatus === KycStatus.PENDING) {
      updateData.kycSubmittedAt = new Date();
    } else if (kycUpdate.kycStatus === KycStatus.APPROVED) {
      updateData.kycApprovedAt = new Date();
      updateData.kycRejectionReason = null;
    } else if (kycUpdate.kycStatus === KycStatus.REJECTED) {
      updateData.kycRejectionReason = kycUpdate.kycRejectionReason;
    }

    await this.userRepository.update(id, updateData);

    this.loggerService.log(
      `KYC status updated to ${kycUpdate.kycStatus} for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 사용자 상태 업데이트
   * @param id 사용자 ID
   * @param status 새로운 상태
   */
  async updateStatus(id: string, status: UserStatus): Promise<void> {
    await this.userRepository.update(id, { status });

    this.loggerService.log(
      `User status updated to ${status} for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 사용자 역할 업데이트
   * @param id 사용자 ID
   * @param role 새로운 역할
   */
  async updateRole(id: string, role: UserRole): Promise<void> {
    await this.userRepository.update(id, { role });

    this.loggerService.log(
      `User role updated to ${role} for user: ${id}`,
      'UsersService',
    );
  }

  /**
   * 활성 사용자 목록 조회
   * @param limit 제한 수
   * @param offset 오프셋
   * @returns 사용자 목록
   */
  async findActiveUsers(limit: number = 10, offset: number = 0): Promise<User[]> {
    return this.userRepository.find({
      where: { status: UserStatus.ACTIVE },
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * KYC 대기 중인 사용자 목록 조회
   * @param limit 제한 수
   * @param offset 오프셋
   * @returns 사용자 목록
   */
  async findPendingKycUsers(limit: number = 10, offset: number = 0): Promise<User[]> {
    return this.userRepository.find({
      where: { kycStatus: KycStatus.PENDING },
      take: limit,
      skip: offset,
      order: { kycSubmittedAt: 'ASC' },
    });
  }

  /**
   * 사용자 통계 조회
   * @returns 사용자 통계
   */
  async getUserStats(): Promise<any> {
    const totalUsers = await this.userRepository.count();
    const activeUsers = await this.userRepository.count({ where: { status: UserStatus.ACTIVE } });
    const verifiedUsers = await this.userRepository.count({ where: { isEmailVerified: true } });
    const kycApprovedUsers = await this.userRepository.count({ where: { kycStatus: KycStatus.APPROVED } });
    const twoFactorEnabledUsers = await this.userRepository.count({ where: { isTwoFactorEnabled: true } });

    return {
      total: totalUsers,
      active: activeUsers,
      verified: verifiedUsers,
      kycApproved: kycApprovedUsers,
      twoFactorEnabled: twoFactorEnabledUsers,
      verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0,
      kycRate: totalUsers > 0 ? (kycApprovedUsers / totalUsers * 100).toFixed(2) : 0,
      twoFactorRate: totalUsers > 0 ? (twoFactorEnabledUsers / totalUsers * 100).toFixed(2) : 0,
    };
  }

  /**
   * 사용자 삭제 (소프트 삭제)
   * @param id 사용자 ID
   */
  async softDelete(id: string): Promise<void> {
    await this.userRepository.update(id, {
      status: UserStatus.INACTIVE,
      email: `deleted_${Date.now()}_${id}@deleted.com`,
    });

    this.loggerService.log(
      `User soft deleted: ${id}`,
      'UsersService',
    );
  }
} 