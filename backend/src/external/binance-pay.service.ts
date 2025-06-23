import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../libs/logger.service';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface BinancePayOrderData {
  merchantId: string;
  merchantTradeNo: string;
  totalFee: string;
  currency: string;
  productName: string;
  productDetail?: string;
  goodsType?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface BinancePayOrderResponse {
  prepayId: string;
  terminalType: string;
  expireTime: number;
  qrcodeLink: string;
  qrContent: string;
  checkoutUrl: string;
  deeplink: string;
  universalUrl: string;
}

export interface BinancePayOrderStatus {
  merchantId: string;
  merchantTradeNo: string;
  tradeType: string;
  totalFee: string;
  currency: string;
  openUserId?: string;
  paymentInfo: Array<{
    currency: string;
    amount: string;
    networkFee?: string;
  }>;
  transactionId?: string;
  status: 'INITIAL' | 'PENDING' | 'PAID' | 'CANCELED' | 'ERROR' | 'EXPIRED';
  createTime: number;
  paymentTime?: number;
}

@Injectable()
export class BinancePayService {
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {
    this.apiKey = this.configService.get<string>('BINANCE_PAY_API_KEY');
    this.secretKey = this.configService.get<string>('BINANCE_PAY_SECRET_KEY');
    this.baseUrl = this.configService.get<string>('BINANCE_PAY_BASE_URL', 'https://bpay.binanceapi.com');

    this.validateConfig();

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'BinancePay-Certificate-SN': this.apiKey,
      },
    });

    // 요청 인터셉터: 서명 추가
    this.httpClient.interceptors.request.use((config) => {
      const timestamp = Date.now().toString();
      const nonce = this.generateNonce();
      const body = config.data ? JSON.stringify(config.data) : '';
      const signature = this.generateSignature(timestamp, nonce, body);

      config.headers['BinancePay-Timestamp'] = timestamp;
      config.headers['BinancePay-Nonce'] = nonce;
      config.headers['BinancePay-Signature'] = signature;

      return config;
    });

    // 응답 인터셉터: 에러 처리
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.loggerService.error(
          `Binance Pay API error: ${error.message}`,
          error.stack,
          'BinancePayService',
        );
        throw error;
      },
    );
  }

  /**
   * 환경 설정 검증
   */
  validateConfig(): void {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Binance Pay configuration is missing');
    }
  }

  /**
   * 결제 주문 생성
   * @param orderData 주문 데이터
   * @returns 결제 응답 데이터
   */
  async createOrder(orderData: BinancePayOrderData): Promise<BinancePayOrderResponse> {
    this.validateOrderData(orderData);

    try {
      const response = await this.makeRequest('/binancepay/openapi/v2/order', 'POST', {
        env: {
          terminalType: 'WEB',
        },
        merchantTradeNo: orderData.merchantTradeNo,
        orderAmount: orderData.totalFee,
        currency: orderData.currency,
        goods: {
          goodsType: orderData.goodsType || '02', // 02: Virtual goods
          goodsCategory: 'Z000', // 기타
          referenceGoodsId: orderData.merchantTradeNo,
          goodsName: orderData.productName,
          goodsDetail: orderData.productDetail || orderData.productName,
        },
        buyerInfo: {
          buyerName: 'KRWX Buyer',
        },
        returnUrl: orderData.returnUrl,
        cancelUrl: orderData.cancelUrl,
      });

      if (response.status === 'SUCCESS') {
        this.loggerService.log(
          `Binance Pay order created: ${orderData.merchantTradeNo}`,
          'BinancePayService',
        );
        return response.data;
      } else {
        throw new BadRequestException(response.errorMessage || 'Failed to create order');
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to create Binance Pay order: ${error.message}`,
        error.stack,
        'BinancePayService',
      );
      throw error;
    }
  }

  /**
   * 주문 상태 조회
   * @param merchantTradeNo 상점 주문 번호
   * @returns 주문 상태 정보
   */
  async queryOrder(merchantTradeNo: string): Promise<BinancePayOrderStatus> {
    try {
      const response = await this.makeRequest('/binancepay/openapi/v2/order/query', 'POST', {
        merchantTradeNo,
      });

      if (response.status === 'SUCCESS') {
        this.loggerService.log(
          `Binance Pay order queried: ${merchantTradeNo}`,
          'BinancePayService',
        );
        return response.data;
      } else {
        throw new BadRequestException(response.errorMessage || 'Failed to query order');
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to query Binance Pay order: ${error.message}`,
        error.stack,
        'BinancePayService',
      );
      throw error;
    }
  }

  /**
   * 주문 취소
   * @param merchantTradeNo 상점 주문 번호
   * @returns 취소 결과
   */
  async closeOrder(merchantTradeNo: string): Promise<any> {
    try {
      const response = await this.makeRequest('/binancepay/openapi/v2/order/close', 'POST', {
        merchantTradeNo,
      });

      if (response.status === 'SUCCESS') {
        this.loggerService.log(
          `Binance Pay order closed: ${merchantTradeNo}`,
          'BinancePayService',
        );
        return response.data;
      } else {
        throw new BadRequestException(response.errorMessage || 'Failed to close order');
      }
    } catch (error) {
      this.loggerService.error(
        `Failed to close Binance Pay order: ${error.message}`,
        error.stack,
        'BinancePayService',
      );
      throw error;
    }
  }

  /**
   * 웹훅 서명 검증
   * @param payload 웹훅 페이로드
   * @param timestamp 타임스탬프
   * @param nonce 논스
   * @param signature 서명
   * @returns 검증 결과
   */
  verifyWebhook(payload: string, timestamp: string, nonce: string, signature: string): boolean {
    try {
      const expectedSignature = this.generateSignature(timestamp, nonce, payload);
      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.loggerService.logSecurityEvent('webhook_verification_failed', {
          timestamp,
          nonce,
          signature,
          expectedSignature,
        });
      }

      return isValid;
    } catch (error) {
      this.loggerService.logSecurityEvent('webhook_verification_error', {
        error: error.message,
        timestamp,
        nonce,
      });
      return false;
    }
  }

  /**
   * API 서명 생성
   * @param timestamp 타임스탬프
   * @param nonce 논스
   * @param body 요청 본문
   * @returns 서명
   */
  generateSignature(timestamp: string, nonce: string, body: string): string {
    const payload = timestamp + '\n' + nonce + '\n' + body + '\n';
    return crypto.createHmac('sha512', this.secretKey).update(payload).digest('hex').toUpperCase();
  }

  /**
   * HTTP 요청 실행
   * @param endpoint API 엔드포인트
   * @param method HTTP 메서드
   * @param data 요청 데이터
   * @returns API 응답
   */
  private async makeRequest(endpoint: string, method: 'GET' | 'POST', data?: any): Promise<any> {
    const config = {
      method,
      url: endpoint,
      data,
    };

    const response = await this.httpClient.request(config);
    return response.data;
  }

  /**
   * 주문 데이터 검증
   * @param orderData 주문 데이터
   */
  private validateOrderData(orderData: BinancePayOrderData): void {
    if (!orderData.merchantTradeNo) {
      throw new BadRequestException('Merchant trade number is required');
    }

    if (!orderData.totalFee || parseFloat(orderData.totalFee) <= 0) {
      throw new BadRequestException('Valid total fee is required');
    }

    if (!orderData.currency) {
      throw new BadRequestException('Currency is required');
    }

    if (!orderData.productName) {
      throw new BadRequestException('Product name is required');
    }

    // 지원되는 통화 확인
    const supportedCurrencies = ['USDT', 'BUSD', 'BNB', 'BTC', 'ETH'];
    if (!supportedCurrencies.includes(orderData.currency)) {
      throw new BadRequestException(`Unsupported currency: ${orderData.currency}`);
    }
  }

  /**
   * 랜덤 논스 생성
   * @returns 논스 문자열
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 주문 번호 생성
   * @param prefix 접두사
   * @returns 고유 주문 번호
   */
  generateMerchantTradeNo(prefix: string = 'KRWX'): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 지원되는 통화 목록 조회
   * @returns 지원 통화 배열
   */
  getSupportedCurrencies(): string[] {
    return ['USDT', 'BUSD', 'BNB', 'BTC', 'ETH'];
  }

  /**
   * 최소 주문 금액 조회
   * @param currency 통화
   * @returns 최소 주문 금액
   */
  getMinOrderAmount(currency: string): number {
    const minAmounts = {
      USDT: 1,
      BUSD: 1,
      BNB: 0.01,
      BTC: 0.0001,
      ETH: 0.001,
    };

    return minAmounts[currency] || 1;
  }
} 