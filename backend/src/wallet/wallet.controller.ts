import { Controller, Get, Post, Body, Param, Patch, ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { Wallet } from './wallet.entity';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * 새로운 지갑을 생성합니다.
   */
  @Post()
  async createWallet(@Body(ValidationPipe) createWalletDto: CreateWalletDto): Promise<Wallet> {
    return await this.walletService.createWallet(createWalletDto);
  }

  /**
   * 모든 활성 지갑 목록을 조회합니다.
   */
  @Get()
  async getAllWallets(): Promise<Wallet[]> {
    return await this.walletService.getAllActiveWallets();
  }

  /**
   * 특정 지갑 정보를 조회합니다.
   */
  @Get(':id')
  async getWalletById(@Param('id', ParseUUIDPipe) id: string): Promise<Wallet> {
    return await this.walletService.getWalletById(id);
  }

  /**
   * 사용자의 지갑 목록을 조회합니다.
   */
  @Get('user/:userId')
  async getWalletsByUserId(@Param('userId') userId: string): Promise<Wallet[]> {
    return await this.walletService.getWalletsByUserId(userId);
  }

  /**
   * 지갑 잔액을 업데이트합니다.
   */
  @Patch(':id/balance')
  async updateBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('balance') balance: number,
  ): Promise<Wallet> {
    return await this.walletService.updateBalance(id, balance);
  }
} 