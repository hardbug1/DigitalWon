import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from './wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('WalletService', () => {
  let service: WalletService;
  let repository: Repository<Wallet>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    repository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('지갑 생성 (createWallet)', () => {
    const createWalletDto: CreateWalletDto = {
      address: '0x1234567890123456789012345678901234567890',
      userId: 'user-123',
    };

    it('새로운 지갑을 성공적으로 생성해야 한다', async () => {
      const expectedWallet = {
        id: 'wallet-123',
        ...createWalletDto,
        balance: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(expectedWallet);
      mockRepository.save.mockResolvedValue(expectedWallet);

      const result = await service.createWallet(createWalletDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { address: createWalletDto.address },
      });
      expect(mockRepository.create).toHaveBeenCalledWith(createWalletDto);
      expect(mockRepository.save).toHaveBeenCalledWith(expectedWallet);
      expect(result).toEqual(expectedWallet);
    });

    it('이미 존재하는 지갑 주소로 생성 시 ConflictException을 발생시켜야 한다', async () => {
      const existingWallet = { id: 'existing-wallet', address: createWalletDto.address };
      mockRepository.findOne.mockResolvedValue(existingWallet);

      await expect(service.createWallet(createWalletDto)).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { address: createWalletDto.address },
      });
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('지갑 조회 (getWalletById)', () => {
    it('존재하는 지갑 ID로 조회 시 지갑 정보를 반환해야 한다', async () => {
      const walletId = 'wallet-123';
      const expectedWallet = {
        id: walletId,
        address: '0x1234567890123456789012345678901234567890',
        balance: 1000,
        userId: 'user-123',
      };

      mockRepository.findOne.mockResolvedValue(expectedWallet);

      const result = await service.getWalletById(walletId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
      expect(result).toEqual(expectedWallet);
    });

    it('존재하지 않는 지갑 ID로 조회 시 NotFoundException을 발생시켜야 한다', async () => {
      const walletId = 'non-existent-wallet';
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getWalletById(walletId)).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
    });
  });

  describe('사용자 지갑 목록 조회 (getWalletsByUserId)', () => {
    it('사용자 ID로 지갑 목록을 조회해야 한다', async () => {
      const userId = 'user-123';
      const expectedWallets = [
        {
          id: 'wallet-1',
          address: '0x1234567890123456789012345678901234567890',
          balance: 1000,
          userId,
        },
        {
          id: 'wallet-2',
          address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          balance: 2000,
          userId,
        },
      ];

      mockRepository.find.mockResolvedValue(expectedWallets);

      const result = await service.getWalletsByUserId(userId);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId, isActive: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(expectedWallets);
    });
  });

  describe('지갑 잔액 업데이트 (updateBalance)', () => {
    it('지갑 잔액을 성공적으로 업데이트해야 한다', async () => {
      const walletId = 'wallet-123';
      const newBalance = 5000;
      const existingWallet = {
        id: walletId,
        address: '0x1234567890123456789012345678901234567890',
        balance: 1000,
      };
      const updatedWallet = { ...existingWallet, balance: newBalance };

      mockRepository.findOne.mockResolvedValue(existingWallet);
      mockRepository.save.mockResolvedValue(updatedWallet);

      const result = await service.updateBalance(walletId, newBalance);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
      expect(mockRepository.save).toHaveBeenCalledWith({
        ...existingWallet,
        balance: newBalance,
      });
      expect(result).toEqual(updatedWallet);
    });

    it('존재하지 않는 지갑 ID로 잔액 업데이트 시 NotFoundException을 발생시켜야 한다', async () => {
      const walletId = 'non-existent-wallet';
      const newBalance = 5000;
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.updateBalance(walletId, newBalance)).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: walletId },
      });
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
}); 