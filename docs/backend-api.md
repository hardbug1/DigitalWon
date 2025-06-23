# 백엔드 API 문서

## 개요

원화 기반 스테이블 코인 결제 웹앱의 백엔드 API는 NestJS 프레임워크를 기반으로 구현되었습니다. RESTful API 방식을 채택하여 프론트엔드와 통신하며, TypeORM을 통해 PostgreSQL 데이터베이스와 연동됩니다.

## 아키텍처

### 주요 구성 요소

- **NestJS**: 메인 웹 프레임워크
- **TypeORM**: ORM 및 데이터베이스 연동
- **PostgreSQL**: 메인 데이터베이스
- **Web3/Ethers.js**: 블록체인 연동 (계획)
- **Class Validator**: 입력값 검증

### 디렉토리 구조

```
src/
├── app.module.ts          # 메인 애플리케이션 모듈
├── main.ts               # 애플리케이션 진입점
├── payments/             # 결제 도메인
│   ├── dto/
│   ├── entities/
│   ├── payments.controller.ts
│   └── payments.service.ts
├── transfer/             # 송금 도메인
│   ├── dto/
│   ├── transfer.controller.ts
│   └── transfer.service.ts
├── wallet/              # 지갑 도메인
│   ├── dto/
│   ├── wallet.controller.ts
│   └── wallet.service.ts
└── libs/               # 공통 라이브러리
    └── web3.service.ts  # 블록체인 연동 서비스
```

## API 엔드포인트

### 1. 결제 API (`/payments`)

#### POST /payments

새로운 결제를 생성합니다.

**요청 본문:**

```json
{
  "type": "send" | "receive" | "deposit" | "withdrawal",
  "amount": 100.00,
  "currency": "KRWX",
  "fromWalletId": "uuid",
  "toWalletId": "uuid",
  "toAddress": "0x...",
  "description": "결제 설명",
  "externalId": "외부_시스템_ID"
}
```

**응답:**

```json
{
  "id": "uuid",
  "type": "send",
  "amount": 100.0,
  "currency": "KRWX",
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

#### GET /payments

모든 결제 내역을 조회합니다.

**쿼리 파라미터:**

- `walletId` (선택): 특정 지갑의 결제 내역만 조회

#### GET /payments/:id

특정 결제를 조회합니다.

#### PATCH /payments/:id

결제 정보를 업데이트합니다.

#### PATCH /payments/:id/status

결제 상태를 업데이트합니다.

**요청 본문:**

```json
{
  "status": "completed" | "failed" | "cancelled"
}
```

#### DELETE /payments/:id

결제를 삭제합니다.

### 2. 송금 API (`/transfers`)

#### POST /transfers

새로운 송금을 생성합니다.

**요청 본문:**

```json
{
  "fromAddress": "0x...",
  "toAddress": "0x...",
  "amount": 1000.0,
  "memo": "송금 메모"
}
```

#### GET /transfers

모든 송금 내역을 조회합니다.

**쿼리 파라미터:**

- `address` (선택): 특정 주소의 송금 내역만 조회

#### GET /transfers/:id

특정 송금을 조회합니다.

#### PATCH /transfers/:id/status

송금 상태를 업데이트합니다.

#### PATCH /transfers/:id/transaction-hash

송금에 트랜잭션 해시를 설정합니다.

### 3. 지갑 API (`/wallets`)

#### POST /wallets

새로운 지갑을 생성합니다.

#### GET /wallets

지갑 목록을 조회합니다.

#### GET /wallets/:id

특정 지갑을 조회합니다.

#### PATCH /wallets/:id/balance

지갑 잔액을 업데이트합니다.

## 데이터 모델

### Payment 엔터티

```typescript
{
  id: string;                    // UUID
  type: PaymentType;            // 결제 유형
  amount: number;               // 금액
  currency: string;             // 통화
  status: PaymentStatus;        // 상태
  description?: string;         // 설명
  transactionHash?: string;     // 트랜잭션 해시
  externalId?: string;          // 외부 ID
  fromWalletId?: string;        // 송금 지갑 ID
  toWalletId?: string;          // 수신 지갑 ID
  toAddress?: string;           // 수신 주소
  createdAt: Date;             // 생성일
  updatedAt: Date;             // 수정일
}
```

### Transfer 엔터티

```typescript
{
  id: string;                   // UUID
  fromAddress: string;          // 송금 주소
  toAddress: string;            // 수신 주소
  amount: number;               // 금액
  memo?: string;                // 메모
  status: TransferStatus;       // 상태
  transactionHash?: string;     // 트랜잭션 해시
  blockNumber?: number;         // 블록 번호
  gasUsed?: number;            // 사용된 가스
  errorMessage?: string;        // 에러 메시지
  createdAt: Date;             // 생성일
  updatedAt: Date;             // 수정일
}
```

### Wallet 엔터티

```typescript
{
  id: string; // UUID
  userId: string; // 사용자 ID
  address: string; // 지갑 주소
  balance: number; // 잔액
  currency: string; // 통화
  isActive: boolean; // 활성 상태
  createdAt: Date; // 생성일
  updatedAt: Date; // 수정일
}
```

## 블록체인 연동

### Web3Service

블록체인과의 상호작용을 담당하는 서비스입니다.

**주요 기능:**

- 지갑 잔액 조회
- 트랜잭션 전송
- 트랜잭션 영수증 조회
- 가스 사용량 추정

**사용 예시:**

```typescript
// 잔액 조회
const balance = await web3Service.getBalance("0x...");

// 트랜잭션 전송
const tx = await web3Service.sendTransaction({
  to: "0x...",
  value: "1000000000000000000", // 1 ETH in wei
  gasLimit: "21000",
  gasPrice: "20000000000",
});
```

## 에러 처리

API는 표준 HTTP 상태 코드를 사용하며, 에러 응답은 다음과 같은 형식을 따릅니다:

```json
{
  "statusCode": 400,
  "message": "결제 금액은 0보다 커야 합니다",
  "error": "Bad Request"
}
```

### 주요 에러 코드

- `400 Bad Request`: 잘못된 요청 데이터
- `404 Not Found`: 리소스를 찾을 수 없음
- `409 Conflict`: 중복된 리소스
- `500 Internal Server Error`: 서버 내부 오류

## 보안

- **Validation Pipe**: 모든 입력 데이터 검증
- **UUID 파싱**: URL 파라미터의 UUID 형식 검증
- **Environment Variables**: 민감한 설정값은 환경변수로 관리

## 테스트

각 서비스는 TDD 방식으로 구현되었으며, 단위 테스트가 포함되어 있습니다.

**테스트 실행:**

```bash
npm test                    # 모든 테스트 실행
npm test -- --watch        # 감시 모드로 테스트 실행
npm test -- --coverage     # 커버리지 리포트 생성
```

## 향후 계획

1. **실제 Ethers.js 연동**: Mock 구현을 실제 블록체인 연동으로 교체
2. **인증/인가**: JWT 기반 사용자 인증 시스템 구현
3. **API 문서화**: Swagger/OpenAPI 문서 자동 생성
4. **로깅 시스템**: 구조화된 로그 및 모니터링 구현
5. **캐싱**: Redis를 활용한 성능 최적화
6. **외부 결제 연동**: PG사 및 기타 결제 시스템 연동
