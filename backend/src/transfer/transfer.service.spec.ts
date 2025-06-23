import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransferService } from './transfer.service';
import { Transfer, TransferStatus } from './transfer.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { WalletService } from '../wallet/wallet.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TransferService', () => {
  let service: TransferService;
  let transferRepository: Repository<Transfer>;
  let walletService: WalletService;

  const mockTransferRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockWalletService = {
    getWalletByAddress: jest.fn(),
    updateBalance: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransferService,
        {
          provide: getRepositoryToken(Transfer),
          useValue: mockTransferRepository,
        },
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    service = module.get<TransferService>(TransferService);
    transferRepository = module.get<Repository<Transfer>>(getRepositoryToken(Transfer));
    walletService = module.get<WalletService>(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('송금 생성 (createTransfer)', () => {
    const createTransferDto: CreateTransferDto = {
      fromAddress: '0x1234567890123456789012345678901234567890',
      toAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      amount: 1000,
      memo: '테스트 송금',
    };

    it('송금을 성공적으로 생성해야 한다', async () => {
      const fromWallet = {
        id: 'from-wallet',
        address: createTransferDto.fromAddress,
        balance: 5000,
        userId: 'user-1',
      };
      const toWallet = {
        id: 'to-wallet',
        address: createTransferDto.toAddress,
        balance: 2000,
        userId: 'user-2',
      };
      const expectedTransfer = {
        id: 'transfer-123',
        ...createTransferDto,
        status: TransferStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWalletService.getWalletByAddress
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet);
      mockTransferRepository.create.mockReturnValue(expectedTransfer);
      mockTransferRepository.save.mockResolvedValue(expectedTransfer);

      const result = await service.createTransfer(createTransferDto);

      expect(mockWalletService.getWalletByAddress).toHaveBeenCalledWith(createTransferDto.fromAddress);
      expect(mockWalletService.getWalletByAddress).toHaveBeenCalledWith(createTransferDto.toAddress);
      expect(mockTransferRepository.create).toHaveBeenCalledWith(createTransferDto);
      expect(mockTransferRepository.save).toHaveBeenCalledWith(expectedTransfer);
      expect(result).toEqual(expectedTransfer);
    });

    it('송금 지갑이 존재하지 않으면 NotFoundException을 발생시켜야 한다', async () => {
      mockWalletService.getWalletByAddress.mockResolvedValue(null);

      await expect(service.createTransfer(createTransferDto)).rejects.toThrow(NotFoundException);
      expect(mockWalletService.getWalletByAddress).toHaveBeenCalledWith(createTransferDto.fromAddress);
    });

    it('수신 지갑이 존재하지 않으면 NotFoundException을 발생시켜야 한다', async () => {
      const fromWallet = {
        id: 'from-wallet',
        address: createTransferDto.fromAddress,
        balance: 5000,
      };

      mockWalletService.getWalletByAddress
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(null);

      await expect(service.createTransfer(createTransferDto)).rejects.toThrow(NotFoundException);
    });

    it('잔액이 부족하면 BadRequestException을 발생시켜야 한다', async () => {
      const fromWallet = {
        id: 'from-wallet',
        address: createTransferDto.fromAddress,
        balance: 500, // 송금 금액보다 적음
      };
      const toWallet = {
        id: 'to-wallet',
        address: createTransferDto.toAddress,
        balance: 2000,
      };

      mockWalletService.getWalletByAddress
        .mockResolvedValueOnce(fromWallet)
        .mockResolvedValueOnce(toWallet);

      await expect(service.createTransfer(createTransferDto)).rejects.toThrow(BadRequestException);
    });

    it('동일한 주소로 송금 시 BadRequestException을 발생시켜야 한다', async () => {
      const sameAddressDto = {
        ...createTransferDto,
        toAddress: createTransferDto.fromAddress,
      };

      await expect(service.createTransfer(sameAddressDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('송금 조회 (getTransferById)', () => {
    it('존재하는 송금 ID로 조회 시 송금 정보를 반환해야 한다', async () => {
      const transferId = 'transfer-123';
      const expectedTransfer = {
        id: transferId,
        fromAddress: '0x1234567890123456789012345678901234567890',
        toAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        amount: 1000,
        status: TransferStatus.COMPLETED,
      };

      mockTransferRepository.findOne.mockResolvedValue(expectedTransfer);

      const result = await service.getTransferById(transferId);

      expect(mockTransferRepository.findOne).toHaveBeenCalledWith({
        where: { id: transferId },
      });
      expect(result).toEqual(expectedTransfer);
    });

    it('존재하지 않는 송금 ID로 조회 시 NotFoundException을 발생시켜야 한다', async () => {
      const transferId = 'non-existent-transfer';
      mockTransferRepository.findOne.mockResolvedValue(null);

      await expect(service.getTransferById(transferId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('지갑별 송금 내역 조회 (getTransfersByAddress)', () => {
    it('지갑 주소로 송금 내역을 조회해야 한다', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const expectedTransfers = [
        {
          id: 'transfer-1',
          fromAddress: address,
          toAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          amount: 1000,
          status: TransferStatus.COMPLETED,
        },
        {
          id: 'transfer-2',
          fromAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          toAddress: address,
          amount: 500,
          status: TransferStatus.COMPLETED,
        },
      ];

      mockTransferRepository.find.mockResolvedValue(expectedTransfers);

      const result = await service.getTransfersByAddress(address);

      expect(mockTransferRepository.find).toHaveBeenCalledWith({
        where: [{ fromAddress: address }, { toAddress: address }],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(expectedTransfers);
    });
  });
}); 