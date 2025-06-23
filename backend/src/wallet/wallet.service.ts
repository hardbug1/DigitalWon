import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
  ) {}

  /**
   * 새로운 지갑을 생성합니다.
   * @param createWalletDto 지갑 생성 정보
   * @returns 생성된 지갑 정보
   * @throws ConflictException 이미 존재하는 지갑 주소인 경우
   */
  async createWallet(createWalletDto: CreateWalletDto): Promise<Wallet> {
    // 중복 지갑 주소 확인
    const existingWallet = await this.walletRepository.findOne({
      where: { address: createWalletDto.address },
    });

    if (existingWallet) {
      throw new ConflictException('이미 등록된 지갑 주소입니다');
    }

    // 새 지갑 생성 및 저장
    const newWallet = this.walletRepository.create(createWalletDto);
    return await this.walletRepository.save(newWallet);
  }

  /**
   * 지갑 ID로 지갑 정보를 조회합니다.
   * @param walletId 지갑 ID
   * @returns 지갑 정보
   * @throws NotFoundException 지갑을 찾을 수 없는 경우
   */
  async getWalletById(walletId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('지갑을 찾을 수 없습니다');
    }

    return wallet;
  }

  /**
   * 사용자 ID로 지갑 목록을 조회합니다.
   * @param userId 사용자 ID
   * @returns 사용자의 활성 지갑 목록 (최신순)
   */
  async getWalletsByUserId(userId: string): Promise<Wallet[]> {
    return await this.walletRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 지갑 잔액을 업데이트합니다.
   * @param walletId 지갑 ID
   * @param newBalance 새로운 잔액
   * @returns 업데이트된 지갑 정보
   * @throws NotFoundException 지갑을 찾을 수 없는 경우
   */
  async updateBalance(walletId: string, newBalance: number): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('지갑을 찾을 수 없습니다');
    }

    wallet.balance = newBalance;
    return await this.walletRepository.save(wallet);
  }

  /**
   * 지갑 주소로 지갑 정보를 조회합니다.
   * @param address 지갑 주소
   * @returns 지갑 정보 또는 null
   */
  async getWalletByAddress(address: string): Promise<Wallet | null> {
    return await this.walletRepository.findOne({
      where: { address },
    });
  }

  /**
   * 모든 활성 지갑 목록을 조회합니다.
   * @returns 활성 지갑 목록
   */
  async getAllActiveWallets(): Promise<Wallet[]> {
    return await this.walletRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
} 