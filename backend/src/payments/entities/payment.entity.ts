import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Wallet } from '../../wallet/wallet.entity';
import { User } from '../../auth/user.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentType {
  SEND = 'send',
  RECEIVE = 'receive',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PaymentType })
  type: PaymentType;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  transactionHash: string;

  @Column({ nullable: true })
  externalId: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, (user) => user.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Wallet, wallet => wallet.id)
  @JoinColumn({ name: 'fromWalletId' })
  fromWallet: Wallet;

  @Column({ nullable: true })
  fromWalletId: string;

  @ManyToOne(() => Wallet, wallet => wallet.id)
  @JoinColumn({ name: 'toWalletId' })
  toWallet: Wallet;

  @Column({ nullable: true })
  toWalletId: string;

  @Column({ nullable: true })
  toAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 