import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { BinancePayService, BinancePayOrderData } from './binance-pay.service';
import { LoggerService } from '../libs/logger.service';

export class CreateBinancePayOrderDto {
  merchantTradeNo: string;
  totalFee: string;
  currency: string;
  productName: string;
  productDetail?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export class BinancePayWebhookDto {
  merchantTradeNo: string;
  status: string;
  transactionId?: string;
  paymentTime?: number;
  totalFee: string;
  currency: string;
}

@ApiTags('external')
@Controller('external/binance-pay')
export class BinancePayController {
  constructor(
    private readonly binancePayService: BinancePayService,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Binance Pay 결제 주문 생성
   * POST /external/binance-pay/orders
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Binance Pay 결제 주문 생성', 
    description: 'Binance Pay를 통한 결제 주문을 생성합니다.' 
  })
  @ApiBody({ type: CreateBinancePayOrderDto })
  @ApiResponse({ status: 201, description: '주문이 성공적으로 생성됨' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  async createOrder(@Body() createOrderDto: CreateBinancePayOrderDto) {
    // 고유한 상점 주문 번호 생성 (제공되지 않은 경우)
    if (!createOrderDto.merchantTradeNo) {
      createOrderDto.merchantTradeNo = this.binancePayService.generateMerchantTradeNo();
    }

    const orderData: BinancePayOrderData = {
      merchantId: 'KRWX-MERCHANT', // 설정에서 가져올 수 있음
      ...createOrderDto,
    };

    const result = await this.binancePayService.createOrder(orderData);

    this.loggerService.log(
      `Binance Pay order created via API: ${createOrderDto.merchantTradeNo}`,
      'BinancePayController',
    );

    return {
      success: true,
      data: result,
      merchantTradeNo: createOrderDto.merchantTradeNo,
    };
  }

  /**
   * Binance Pay 주문 상태 조회
   * GET /external/binance-pay/orders/:merchantTradeNo
   */
  @Get('orders/:merchantTradeNo')
  @ApiOperation({ 
    summary: 'Binance Pay 주문 상태 조회', 
    description: '상점 주문 번호로 결제 상태를 조회합니다.' 
  })
  @ApiParam({ name: 'merchantTradeNo', description: '상점 주문 번호' })
  @ApiResponse({ status: 200, description: '주문 상태 조회 성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async queryOrder(@Param('merchantTradeNo') merchantTradeNo: string) {
    const result = await this.binancePayService.queryOrder(merchantTradeNo);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Binance Pay 주문 취소
   * POST /external/binance-pay/orders/:merchantTradeNo/close
   */
  @Post('orders/:merchantTradeNo/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Binance Pay 주문 취소', 
    description: '진행 중인 결제 주문을 취소합니다.' 
  })
  @ApiParam({ name: 'merchantTradeNo', description: '상점 주문 번호' })
  @ApiResponse({ status: 200, description: '주문이 성공적으로 취소됨' })
  @ApiResponse({ status: 400, description: '주문 취소 실패' })
  async closeOrder(@Param('merchantTradeNo') merchantTradeNo: string) {
    const result = await this.binancePayService.closeOrder(merchantTradeNo);

    this.loggerService.log(
      `Binance Pay order closed via API: ${merchantTradeNo}`,
      'BinancePayController',
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Binance Pay 웹훅 수신
   * POST /external/binance-pay/webhook
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Binance Pay 웹훅 수신', 
    description: 'Binance Pay로부터 결제 상태 변경 알림을 받습니다.' 
  })
  @ApiHeader({ name: 'BinancePay-Timestamp', description: 'Binance Pay 타임스탬프' })
  @ApiHeader({ name: 'BinancePay-Nonce', description: 'Binance Pay 논스' })
  @ApiHeader({ name: 'BinancePay-Signature', description: 'Binance Pay 서명' })
  @ApiBody({ type: BinancePayWebhookDto })
  @ApiResponse({ status: 200, description: '웹훅 처리 성공' })
  @ApiResponse({ status: 400, description: '웹훅 검증 실패' })
  async handleWebhook(
    @Body() webhookData: BinancePayWebhookDto,
    @Headers('BinancePay-Timestamp') timestamp: string,
    @Headers('BinancePay-Nonce') nonce: string,
    @Headers('BinancePay-Signature') signature: string,
  ) {
    // 웹훅 서명 검증
    const payload = JSON.stringify(webhookData);
    const isValid = this.binancePayService.verifyWebhook(payload, timestamp, nonce, signature);

    if (!isValid) {
      this.loggerService.logSecurityEvent('binance_webhook_verification_failed', {
        merchantTradeNo: webhookData.merchantTradeNo,
        timestamp,
        nonce,
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    // 웹훅 데이터 처리
    this.loggerService.log(
      `Binance Pay webhook received: ${webhookData.merchantTradeNo} - ${webhookData.status}`,
      'BinancePayController',
    );

    // 여기서 결제 상태에 따른 비즈니스 로직 처리
    // 예: PaymentsService 업데이트, 사용자 알림 등
    await this.processWebhookData(webhookData);

    return {
      success: true,
      message: 'Webhook processed successfully',
    };
  }

  /**
   * 지원되는 통화 목록 조회
   * GET /external/binance-pay/currencies
   */
  @Get('currencies')
  @ApiOperation({ 
    summary: '지원 통화 목록 조회', 
    description: 'Binance Pay에서 지원하는 통화 목록을 조회합니다.' 
  })
  @ApiResponse({ status: 200, description: '지원 통화 목록 조회 성공' })
  getSupportedCurrencies() {
    const currencies = this.binancePayService.getSupportedCurrencies();

    return {
      success: true,
      data: {
        currencies,
        minAmounts: currencies.reduce((acc, currency) => {
          acc[currency] = this.binancePayService.getMinOrderAmount(currency);
          return acc;
        }, {}),
      },
    };
  }

  /**
   * 웹훅 데이터 처리 (내부 메서드)
   * @param webhookData 웹훅 데이터
   */
  private async processWebhookData(webhookData: BinancePayWebhookDto): Promise<void> {
    try {
      switch (webhookData.status) {
        case 'PAID':
          // 결제 완료 처리
          this.loggerService.log(
            `Payment completed: ${webhookData.merchantTradeNo}`,
            'BinancePayController',
          );
          // TODO: PaymentsService 업데이트, 사용자 알림 등
          break;

        case 'CANCELED':
          // 결제 취소 처리
          this.loggerService.log(
            `Payment canceled: ${webhookData.merchantTradeNo}`,
            'BinancePayController',
          );
          // TODO: 취소 처리 로직
          break;

        case 'EXPIRED':
          // 결제 만료 처리
          this.loggerService.log(
            `Payment expired: ${webhookData.merchantTradeNo}`,
            'BinancePayController',
          );
          // TODO: 만료 처리 로직
          break;

        default:
          this.loggerService.warn(
            `Unhandled payment status: ${webhookData.status} for ${webhookData.merchantTradeNo}`,
            'BinancePayController',
          );
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to process webhook data: ${error.message}`,
        error.stack,
        'BinancePayController',
      );
      throw error;
    }
  }
} 