import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { User } from '../src/auth/user.entity';
import { Payment, PaymentType, PaymentStatus } from '../src/payments/entities/payment.entity';
import { Wallet } from '../src/wallet/wallet.entity';
import { Transfer } from '../src/transfer/transfer.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('KRWX Stablecoin E2E Tests', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let paymentRepository: Repository<Payment>;
  let walletRepository: Repository<Wallet>;
  let transferRepository: Repository<Transfer>;
  
  let authToken: string;
  let testUser: User;
  let testWallet: Wallet;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST || 'localhost',
          port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
          username: process.env.TEST_DB_USER || 'test_user',
          password: process.env.TEST_DB_PASS || 'test_password',
          database: process.env.TEST_DB_NAME || 'test_stablecoin',
          entities: [User, Payment, Wallet, Transfer],
          synchronize: true,
          dropSchema: true, // 테스트 시작 시 스키마 초기화
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    
    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
    walletRepository = moduleFixture.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    transferRepository = moduleFixture.get<Repository<Transfer>>(getRepositoryToken(Transfer));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('App Health Check', () => {
    it('애플리케이션이 정상적으로 시작되어야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(200);
      
      expect(response.body.message).toBe('Hello World!');
    });
  });

  describe('사용자 인증 플로우', () => {
    it('사용자 등록이 가능해야 함', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(registerDto.email);
      expect(response.body.data.name).toBe(registerDto.name);

      // 데이터베이스에 사용자가 생성되었는지 확인
      const foundUser = await userRepository.findOne({ where: { email: registerDto.email } });
      expect(foundUser).toBeDefined();
      testUser = foundUser!;
      expect(testUser.email).toBe(registerDto.email);
    });

    it('사용자 로그인이 가능해야 함', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.user.email).toBe(loginDto.email);

      authToken = response.body.data.accessToken;
    });

    it('인증된 사용자 정보 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
    });

    it('잘못된 토큰으로 접근 시 401 에러가 발생해야 함', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('지갑 관리', () => {
    it('지갑 생성이 가능해야 함', async () => {
      const createWalletDto = {
        address: '0x1234567890123456789012345678901234567890',
      };

      const response = await request(app.getHttpServer())
        .post('/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createWalletDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe(createWalletDto.address);

      testWallet = response.body.data;
    });

    it('지갑 목록 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/wallet')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('특정 지갑 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get(`/wallet/${testWallet.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testWallet.id);
      expect(response.body.data.address).toBe(testWallet.address);
    });
  });

  describe('결제 시스템', () => {
    it('결제 생성이 가능해야 함', async () => {
      const createPaymentDto = {
        type: 'deposit',
        amount: 100.00,
        currency: 'KRWX',
        description: 'Test deposit',
        fromWalletId: testWallet.id,
      };

      const response = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPaymentDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe(createPaymentDto.type);
      expect(parseFloat(response.body.data.amount)).toBe(createPaymentDto.amount);
      expect(response.body.data.status).toBe('pending');
    });

    it('결제 목록 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('결제 상태 업데이트가 가능해야 함', async () => {
      // 먼저 결제를 생성
      const payment = await paymentRepository.save({
        type: PaymentType.DEPOSIT,
        amount: 50.00,
        currency: 'KRWX',
        status: PaymentStatus.PENDING,
        fromWalletId: testWallet.id,
      });

      const response = await request(app.getHttpServer())
        .patch(`/payments/${payment.id}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('completed');
    });
  });

  describe('송금 시스템', () => {
    it('송금 생성이 가능해야 함', async () => {
      const createTransferDto = {
        fromAddress: testWallet.address,
        toAddress: '0x742d35Cc6aF6B7C4A5e8b2E5bD3f8c4A5e8b2E5b',
        amount: '25.00',
        currency: 'KRWX',
        memo: 'Test transfer',
      };

      const response = await request(app.getHttpServer())
        .post('/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createTransferDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fromAddress).toBe(createTransferDto.fromAddress);
      expect(response.body.data.toAddress).toBe(createTransferDto.toAddress);
      expect(response.body.data.amount).toBe(createTransferDto.amount);
      expect(response.body.data.status).toBe('pending');
    });

    it('송금 목록 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/transfer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('외부 결제 시스템 (Binance Pay)', () => {
    it('지원 통화 목록 조회가 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .get('/external/binance-pay/currencies')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currencies).toBeDefined();
      expect(Array.isArray(response.body.data.currencies)).toBe(true);
    });
  });

  describe('2단계 인증 (2FA)', () => {
    it('2FA 비밀키 생성이 가능해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/2fa/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.secret).toBeDefined();
      expect(response.body.data.qrCodeUrl).toBeDefined();
    });

    it('잘못된 2FA 토큰으로 활성화 시도 시 실패해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: '000000' });

      // 2FA 토큰이 잘못되었으므로 실패해야 함
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(false);
      }
    });
  });

  describe('보안 및 에러 처리', () => {
    it('잘못된 데이터로 요청 시 validation 에러가 발생해야 함', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: '123', // 너무 짧은 비밀번호
          name: '',
        })
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBeDefined();
    });

    it('존재하지 않는 엔드포인트 접근 시 404 에러가 발생해야 함', async () => {
      await request(app.getHttpServer())
        .get('/nonexistent-endpoint')
        .expect(404);
    });
  });

  describe('통합 시나리오', () => {
    it('사용자 가입 → 로그인 → 지갑 생성 → 결제 → 송금 플로우가 정상 동작해야 함', async () => {
      // 새 사용자 등록
      const newUserDto = {
        email: 'integration@example.com',
        password: 'password123',
        name: 'Integration User',
      };

      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(newUserDto)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);

      // 로그인
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: newUserDto.email, password: newUserDto.password })
        .expect(200);

      const newAuthToken = loginResponse.body.data.accessToken;

      // 지갑 생성
      const walletResponse = await request(app.getHttpServer())
        .post('/wallet')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({ address: '0x9876543210987654321098765432109876543210' })
        .expect(201);

      const newWallet = walletResponse.body.data;

      // 결제 생성
      const paymentResponse = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          type: 'deposit',
          amount: 200.00,
          currency: 'KRWX',
          description: 'Integration test deposit',
          fromWalletId: newWallet.id,
        })
        .expect(201);

      expect(paymentResponse.body.success).toBe(true);

      // 송금 생성
      const transferResponse = await request(app.getHttpServer())
        .post('/transfer')
        .set('Authorization', `Bearer ${newAuthToken}`)
        .send({
          fromAddress: newWallet.address,
          toAddress: testWallet.address,
          amount: '50.00',
          currency: 'KRWX',
          memo: 'Integration test transfer',
        })
        .expect(201);

      expect(transferResponse.body.success).toBe(true);
    });
  });
}); 