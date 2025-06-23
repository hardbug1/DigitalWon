import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransferService } from './transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferStatus } from './transfer.entity';

@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  /**
   * 새로운 송금을 생성합니다.
   * POST /transfers
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(@Body() createTransferDto: CreateTransferDto) {
    return this.transferService.createTransfer(createTransferDto);
  }

  /**
   * 모든 송금 내역을 조회합니다.
   * GET /transfers
   */
  @Get()
  async getAllTransfers(@Query('address') address?: string) {
    if (address) {
      return this.transferService.getTransfersByAddress(address);
    }
    return this.transferService.getAllTransfers();
  }

  /**
   * 특정 송금을 조회합니다.
   * GET /transfers/:id
   */
  @Get(':id')
  async getTransferById(@Param('id', ParseUUIDPipe) id: string) {
    return this.transferService.getTransferById(id);
  }

  /**
   * 송금 상태를 업데이트합니다.
   * PATCH /transfers/:id/status
   */
  @Patch(':id/status')
  async updateTransferStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: TransferStatus,
  ) {
    return this.transferService.updateTransferStatus(id, status);
  }

  /**
   * 송금에 트랜잭션 해시를 설정합니다.
   * PATCH /transfers/:id/transaction-hash
   */
  @Patch(':id/transaction-hash')
  async setTransactionHash(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('transactionHash') transactionHash: string,
  ) {
    return this.transferService.setTransactionHash(id, transactionHash);
  }
} 