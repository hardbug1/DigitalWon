import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { 
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentStatus } from './entities/payment.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * 새로운 결제를 생성합니다.
   * POST /payments
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '새 결제 생성', description: '새로운 결제를 생성합니다.' })
  @ApiBody({ type: CreatePaymentDto })
  @ApiResponse({ status: 201, description: '결제가 성공적으로 생성됨' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPayment(createPaymentDto);
  }

  /**
   * 모든 결제 내역을 조회합니다.
   * GET /payments
   */
  @Get()
  @ApiOperation({ summary: '모든 결제 조회', description: '모든 결제 목록을 조회합니다.' })
  @ApiQuery({ name: 'walletId', required: false, description: '특정 지갑의 결제만 조회' })
  @ApiResponse({ status: 200, description: '결제 목록 조회 성공' })
  async findAllPayments(@Query('walletId') walletId?: string) {
    if (walletId) {
      return this.paymentsService.findPaymentsByWallet(walletId);
    }
    return this.paymentsService.findAllPayments();
  }

  /**
   * 특정 결제를 조회합니다.
   * GET /payments/:id
   */
  @Get(':id')
  @ApiOperation({ summary: '특정 결제 조회', description: 'ID로 특정 결제를 조회합니다.' })
  @ApiParam({ name: 'id', description: '결제 ID (UUID)' })
  @ApiResponse({ status: 200, description: '결제 조회 성공' })
  @ApiResponse({ status: 404, description: '결제를 찾을 수 없음' })
  async findPaymentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.findPaymentById(id);
  }

  /**
   * 결제 정보를 업데이트합니다.
   * PATCH /payments/:id
   */
  @Patch(':id')
  async updatePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
  ) {
    return this.paymentsService.updatePayment(id, updatePaymentDto);
  }

  /**
   * 결제 상태를 업데이트합니다.
   * PATCH /payments/:id/status
   */
  @Patch(':id/status')
  async updatePaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: PaymentStatus,
  ) {
    return this.paymentsService.updatePaymentStatus(id, status);
  }

  /**
   * 결제를 삭제합니다.
   * DELETE /payments/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePayment(@Param('id', ParseUUIDPipe) id: string) {
    await this.paymentsService.deletePayment(id);
  }
} 