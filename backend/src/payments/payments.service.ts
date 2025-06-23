import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { RedisService } from '../libs/redis.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 새로운 결제를 생성합니다.
   * @param createPaymentDto 결제 생성 정보
   * @returns 생성된 결제 정보
   */
  async createPayment(createPaymentDto: CreatePaymentDto): Promise<Payment> {
    // 비즈니스 로직 검증
    if (createPaymentDto.amount <= 0) {
      throw new BadRequestException('결제 금액은 0보다 커야 합니다');
    }

    const payment = this.paymentRepository.create({
      ...createPaymentDto,
      status: PaymentStatus.PENDING,
    });

    return this.paymentRepository.save(payment);
  }

  /**
   * 모든 결제 내역을 조회합니다.
   * @returns 결제 내역 목록
   */
  async findAllPayments(): Promise<Payment[]> {
    return this.paymentRepository.find({
      relations: ['fromWallet', 'toWallet'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * ID로 특정 결제를 조회합니다. (캐시 적용)
   * @param id 결제 ID
   * @returns 결제 정보
   */
  async findPaymentById(id: string): Promise<Payment> {
    // 먼저 캐시에서 조회
    const cachedPayment = await this.redisService.getPaymentCache(id);
    if (cachedPayment) {
      return cachedPayment as Payment;
    }

    // 캐시에 없으면 데이터베이스에서 조회
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['fromWallet', 'toWallet'],
    });

    if (!payment) {
      throw new NotFoundException(`ID ${id}에 해당하는 결제를 찾을 수 없습니다`);
    }

    // 결제가 완료되지 않은 경우에만 캐시에 저장 (5분 TTL)
    if (payment.status !== PaymentStatus.COMPLETED && payment.status !== PaymentStatus.FAILED) {
      await this.redisService.setPaymentCache(id, payment, 300);
    }

    return payment;
  }

  /**
   * 지갑 ID로 관련된 모든 결제를 조회합니다.
   * @param walletId 지갑 ID
   * @returns 결제 내역 목록
   */
  async findPaymentsByWallet(walletId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: [
        { fromWalletId: walletId },
        { toWalletId: walletId },
      ],
      relations: ['fromWallet', 'toWallet'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 결제 상태를 업데이트합니다. (캐시 무효화 포함)
   * @param id 결제 ID
   * @param status 새로운 상태
   * @returns 업데이트된 결제 정보
   */
  async updatePaymentStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const payment = await this.findPaymentById(id);
    
    payment.status = status;
    
    const updatedPayment = await this.paymentRepository.save(payment);
    
    // 캐시 무효화
    await this.redisService.deletePaymentCache(id);
    
    // 완료되지 않은 상태라면 새로운 데이터로 캐시 업데이트
    if (status !== PaymentStatus.COMPLETED && status !== PaymentStatus.FAILED) {
      await this.redisService.setPaymentCache(id, updatedPayment, 300);
    }
    
    return updatedPayment;
  }

  /**
   * 결제 정보를 업데이트합니다.
   * @param id 결제 ID
   * @param updatePaymentDto 업데이트할 정보
   * @returns 업데이트된 결제 정보
   */
  async updatePayment(id: string, updatePaymentDto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findPaymentById(id);
    
    Object.assign(payment, updatePaymentDto);
    
    return this.paymentRepository.save(payment);
  }

  /**
   * 결제를 삭제합니다.
   * @param id 결제 ID
   */
  async deletePayment(id: string): Promise<void> {
    const payment = await this.findPaymentById(id);
    
    await this.paymentRepository.remove(payment);
  }
} 