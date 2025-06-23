import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RedisService } from '../libs/redis.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let redisService: RedisService;

  const mockPaymentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    setPaymentCache: jest.fn(),
    getPaymentCache: jest.fn(),
    deletePaymentCache: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    redisService = module.get<RedisService>(RedisService);
  });

  it('서비스가 정의되어야 함', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const createPaymentDto: CreatePaymentDto = {
      type: PaymentType.SEND,
      amount: 100.00,
      currency: 'KRWX',
      fromWalletId: 'wallet-1',
      toAddress: '0x123...',
      description: '테스트 결제',
    };

    it('유효한 결제를 생성해야 함', async () => {
      const mockPayment = {
        id: 'payment-1',
        ...createPaymentDto,
        status: PaymentStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPaymentRepository.create.mockReturnValue(mockPayment);
      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      const result = await service.createPayment(createPaymentDto);

      expect(mockPaymentRepository.create).toHaveBeenCalledWith(createPaymentDto);
      expect(mockPaymentRepository.save).toHaveBeenCalledWith(mockPayment);
      expect(result).toEqual(mockPayment);
    });

    it('음수 금액으로 결제 생성 시 예외를 발생시켜야 함', async () => {
      const invalidDto = { ...createPaymentDto, amount: -100 };

      await expect(service.createPayment(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('0 금액으로 결제 생성 시 예외를 발생시켜야 함', async () => {
      const invalidDto = { ...createPaymentDto, amount: 0 };

      await expect(service.createPayment(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAllPayments', () => {
    it('모든 결제를 반환해야 함', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          type: PaymentType.SEND,
          amount: 100,
          currency: 'KRWX',
          status: PaymentStatus.PENDING,
        },
        {
          id: 'payment-2',
          type: PaymentType.RECEIVE,
          amount: 200,
          currency: 'KRWX',
          status: PaymentStatus.COMPLETED,
        },
      ];

      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findAllPayments();

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        relations: ['fromWallet', 'toWallet'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPayments);
    });
  });

  describe('findPaymentById', () => {
    it('ID로 결제를 찾아 반환해야 함', async () => {
      const mockPayment = {
        id: 'payment-1',
        type: PaymentType.SEND,
        amount: 100,
        currency: 'KRWX',
        status: PaymentStatus.PENDING,
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);

      const result = await service.findPaymentById('payment-1');

      expect(mockPaymentRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'payment-1' },
        relations: ['fromWallet', 'toWallet'],
      });
      expect(result).toEqual(mockPayment);
    });

    it('존재하지 않는 ID로 조회 시 예외를 발생시켜야 함', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(service.findPaymentById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('결제 상태를 업데이트해야 함', async () => {
      const mockPayment = {
        id: 'payment-1',
        status: PaymentStatus.PENDING,
      };

      mockPaymentRepository.findOne.mockResolvedValue(mockPayment);
      mockPaymentRepository.save.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.updatePaymentStatus('payment-1', PaymentStatus.COMPLETED);

      expect(result.status).toEqual(PaymentStatus.COMPLETED);
    });

    it('존재하지 않는 결제 상태 업데이트 시 예외를 발생시켜야 함', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePaymentStatus('invalid-id', PaymentStatus.COMPLETED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPaymentsByWallet', () => {
    it('지갑 ID로 결제 내역을 조회해야 함', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          fromWalletId: 'wallet-1',
          type: PaymentType.SEND,
        },
        {
          id: 'payment-2',
          toWalletId: 'wallet-1',
          type: PaymentType.RECEIVE,
        },
      ];

      mockPaymentRepository.find.mockResolvedValue(mockPayments);

      const result = await service.findPaymentsByWallet('wallet-1');

      expect(mockPaymentRepository.find).toHaveBeenCalledWith({
        where: [
          { fromWalletId: 'wallet-1' },
          { toWalletId: 'wallet-1' },
        ],
        relations: ['fromWallet', 'toWallet'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockPayments);
    });
  });
}); 