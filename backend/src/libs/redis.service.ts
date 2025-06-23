import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Redis 서버에 연결합니다.
   */
  private async connect(): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');

      this.client = createClient({
        socket: {
          host,
          port,
        },
        password: password || undefined,
      });

      this.client.on('error', (err) => {
        this.logger.error('Redis 클라이언트 에러:', err);
      });

      this.client.on('connect', () => {
        this.logger.log('Redis에 연결되었습니다');
      });

      this.client.on('disconnect', () => {
        this.logger.log('Redis 연결이 끊어졌습니다');
      });

      await this.client.connect();
    } catch (error) {
      this.logger.error('Redis 연결 실패:', error);
      // 개발 환경에서는 Redis 연결 실패시에도 애플리케이션이 계속 실행될 수 있도록 함
      if (this.configService.get('NODE_ENV') === 'development') {
        this.logger.warn('개발 환경에서 Redis 연결 실패를 무시합니다');
      } else {
        throw error;
      }
    }
  }

  /**
   * Redis 서버와의 연결을 끊습니다.
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.logger.log('Redis 연결이 종료되었습니다');
    }
  }

  /**
   * 기본 캐시 작업: 키-값 저장
   * @param key 키
   * @param value 값 (문자열 또는 객체)
   * @param ttl TTL (초 단위, 선택사항)
   */
  async set(key: string, value: string | object, ttl?: number): Promise<void> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return;
    }

    try {
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttl) {
        await this.client.set(key, serializedValue, 'EX', ttl);
      } else {
        await this.client.set(key, serializedValue);
      }
      
      this.logger.debug(`Redis SET: ${key} (TTL: ${ttl || 'none'})`);
    } catch (error) {
      this.logger.error(`Redis SET 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 기본 캐시 작업: 키로 값 조회
   * @param key 키
   * @returns 값 (문자열이면 그대로, JSON이면 파싱된 객체)
   */
  async get<T = any>(key: string): Promise<T | null> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return null;
    }

    try {
      const value = await this.client.get(key);
      
      if (value === null) {
        return null;
      }

      // JSON 파싱 시도
      try {
        return JSON.parse(value);
      } catch {
        // JSON이 아니면 문자열 그대로 반환
        return value as T;
      }
    } catch (error) {
      this.logger.error(`Redis GET 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 기본 캐시 작업: 키 삭제
   * @param keys 삭제할 키들
   * @returns 삭제된 키의 개수
   */
  async del(...keys: string[]): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return 0;
    }

    try {
      const result = await this.client.del(keys);
      this.logger.debug(`Redis DEL: ${keys.join(', ')} (${result}개 삭제됨)`);
      return result;
    } catch (error) {
      this.logger.error(`Redis DEL 실패 (${keys.join(', ')}):`, error);
      throw error;
    }
  }

  /**
   * 키 존재 여부 확인
   * @param key 키
   * @returns 존재하면 true, 없으면 false
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXISTS 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * TTL 설정
   * @param key 키
   * @param ttl TTL (초 단위)
   * @returns 성공하면 true
   */
  async setTtl(key: string, ttl: number): Promise<boolean> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return false;
    }

    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Redis EXPIRE 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * TTL 조회
   * @param key 키
   * @returns 남은 TTL (초 단위)
   */
  async getTtl(key: string): Promise<number> {
    if (!this.client) {
      this.logger.warn('Redis 클라이언트가 연결되지 않았습니다');
      return -1;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Redis TTL 실패 (${key}):`, error);
      throw error;
    }
  }

  /**
   * 세션 저장
   * @param sessionId 세션 ID
   * @param sessionData 세션 데이터
   * @param ttl TTL (초 단위, 기본값: 30분)
   */
  async setSession(sessionId: string, sessionData: object, ttl: number = 1800): Promise<void> {
    const key = `session:${sessionId}`;
    await this.set(key, sessionData, ttl);
  }

  /**
   * 세션 조회
   * @param sessionId 세션 ID
   * @returns 세션 데이터
   */
  async getSession<T = any>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return this.get<T>(key);
  }

  /**
   * 세션 삭제
   * @param sessionId 세션 ID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.del(key);
  }

  /**
   * 결제 임시 데이터 저장
   * @param paymentId 결제 ID
   * @param paymentData 결제 데이터
   * @param ttl TTL (초 단위, 기본값: 10분)
   */
  async setPaymentCache(paymentId: string, paymentData: object, ttl: number = 600): Promise<void> {
    const key = `payment:${paymentId}`;
    await this.set(key, paymentData, ttl);
  }

  /**
   * 결제 임시 데이터 조회
   * @param paymentId 결제 ID
   * @returns 결제 데이터
   */
  async getPaymentCache<T = any>(paymentId: string): Promise<T | null> {
    const key = `payment:${paymentId}`;
    return this.get<T>(key);
  }

  /**
   * 결제 임시 데이터 삭제
   * @param paymentId 결제 ID
   */
  async deletePaymentCache(paymentId: string): Promise<void> {
    const key = `payment:${paymentId}`;
    await this.del(key);
  }
} 