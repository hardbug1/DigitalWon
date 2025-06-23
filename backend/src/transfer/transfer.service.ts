import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transfer, TransferStatus } from './transfer.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly walletService: WalletService,
  ) {}

  /**
   * 새로운 송금을 생성합니다.
   * @param createTransferDto 송금 생성 정보
   * @returns 생성된 송금 정보
   */
  async createTransfer(createTransferDto: CreateTransferDto): Promise<Transfer> {
    const { fromAddress, toAddress, amount } = createTransferDto;

    // 동일한 주소로 송금하는 경우 체크
    if (fromAddress === toAddress) {
      throw new BadRequestException('송금 주소와 수신 주소가 동일할 수 없습니다');
    }

    // 송금 지갑 확인
    const fromWallet = await this.walletService.getWalletByAddress(fromAddress);
    if (!fromWallet) {
      throw new NotFoundException('송금 지갑을 찾을 수 없습니다');
    }

    // 수신 지갑 확인
    const toWallet = await this.walletService.getWalletByAddress(toAddress);
    if (!toWallet) {
      throw new NotFoundException('수신 지갑을 찾을 수 없습니다');
    }

    // 잔액 확인
    if (fromWallet.balance < amount) {
      throw new BadRequestException('잠액이 부족합니다');
    }

    // 송금 생성
    const transfer = this.transferRepository.create({
      ...createTransferDto,
      status: TransferStatus.PENDING,
    });

    return this.transferRepository.save(transfer);
  }

  /**
   * ID로 송금을 조회합니다.
   * @param id 송금 ID
   * @returns 송금 정보
   */
  async getTransferById(id: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
    });

    if (!transfer) {
      throw new NotFoundException(`ID ${id}에 해당하는 송금을 찾을 수 없습니다`);
    }

    return transfer;
  }

  /**
   * 지갑 주소로 관련된 모든 송금을 조회합니다.
   * @param address 지갑 주소
   * @returns 송금 내역 목록
   */
  async getTransfersByAddress(address: string): Promise<Transfer[]> {
    return this.transferRepository.find({
      where: [
        { fromAddress: address },
        { toAddress: address },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 모든 송금 내역을 조회합니다.
   * @returns 송금 내역 목록
   */
  async getAllTransfers(): Promise<Transfer[]> {
    return this.transferRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 송금 상태를 업데이트합니다.
   * @param id 송금 ID
   * @param status 새로운 상태
   * @returns 업데이트된 송금 정보
   */
  async updateTransferStatus(id: string, status: TransferStatus): Promise<Transfer> {
    const transfer = await this.getTransferById(id);
    
    transfer.status = status;
    
    return this.transferRepository.save(transfer);
  }

  /**
   * 송금에 트랜잭션 해시를 설정합니다.
   * @param id 송금 ID
   * @param transactionHash 트랜잭션 해시
   * @returns 업데이트된 송금 정보
   */
  async setTransactionHash(id: string, transactionHash: string): Promise<Transfer> {
    const transfer = await this.getTransferById(id);
    
    transfer.transactionHash = transactionHash;
    
    return this.transferRepository.save(transfer);
  }
} 