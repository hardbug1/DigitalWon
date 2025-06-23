import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Payment } from '../payments/entities/payment.entity';
import { Wallet } from '../wallet/wallet.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum KycStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ name: 'phone_number', nullable: true })
  phoneNumber?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'is_phone_verified', default: false })
  isPhoneVerified: boolean;

  @Column({ name: 'email_verification_token', nullable: true })
  emailVerificationToken?: string;

  @Column({ name: 'phone_verification_token', nullable: true })
  phoneVerificationToken?: string;

  // 2FA 관련
  @Column({ name: 'is_two_factor_enabled', default: false })
  isTwoFactorEnabled: boolean;

  @Column({ name: 'two_factor_secret', nullable: true })
  twoFactorSecret?: string;

  @Column({ name: 'two_factor_backup_codes', type: 'json', nullable: true })
  twoFactorBackupCodes?: string[];

  // KYC 관련
  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.NOT_STARTED,
  })
  kycStatus: KycStatus;

  @Column({ name: 'kyc_document_id', nullable: true })
  kycDocumentId?: string;

  @Column({ name: 'kyc_submitted_at', nullable: true })
  kycSubmittedAt?: Date;

  @Column({ name: 'kyc_approved_at', nullable: true })
  kycApprovedAt?: Date;

  @Column({ name: 'kyc_rejection_reason', nullable: true })
  kycRejectionReason?: string;

  // 로그인 보안
  @Column({ name: 'login_attempts', default: 0 })
  loginAttempts: number;

  @Column({ name: 'lockout_until', nullable: true })
  lockoutUntil?: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', nullable: true })
  lastLoginIp?: string;

  // 프로필 정보
  @Column({ name: 'profile_image_url', nullable: true })
  profileImageUrl?: string;

  @Column({ name: 'date_of_birth', nullable: true })
  dateOfBirth?: Date;

  @Column({ name: 'address', nullable: true })
  address?: string;

  @Column({ name: 'country', nullable: true })
  country?: string;

  @Column({ name: 'timezone', default: 'UTC' })
  timezone: string;

  @Column({ name: 'language', default: 'ko' })
  language: string;

  // 알림 설정
  @Column({ name: 'email_notifications', default: true })
  emailNotifications: boolean;

  @Column({ name: 'sms_notifications', default: false })
  smsNotifications: boolean;

  @Column({ name: 'push_notifications', default: true })
  pushNotifications: boolean;

  // 관계
  @OneToMany(() => Wallet, (wallet) => wallet.user, { cascade: true })
  wallets: Wallet[];

  @OneToMany(() => Payment, (payment) => payment.user, { cascade: true })
  payments: Payment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 가상 필드: 계정 잠금 여부
  get isLocked(): boolean {
    return this.lockoutUntil ? this.lockoutUntil > new Date() : false;
  }

  // 가상 필드: KYC 완료 여부
  get isKycCompleted(): boolean {
    return this.kycStatus === KycStatus.APPROVED;
  }

  // 가상 필드: 전체 검증 완료 여부
  get isFullyVerified(): boolean {
    return this.isEmailVerified && this.isPhoneVerified && this.isKycCompleted;
  }
} 