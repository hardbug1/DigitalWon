# 스테이블 코인 결제 시스템 백엔드

원화 기반 스테이블 코인 결제 웹앱의 백엔드 API 서버입니다.

## 🚀 시작하기

### 필수 요구사항

- Node.js 18+
- Docker & Docker Compose
- Git

### 개발 환경 설정

1. **패키지 설치**

```bash
npm install
```

2. **데이터베이스 및 Redis 시작**

```bash
npm run db:start
```

3. **애플리케이션 시작**

```bash
npm run start:dev
```

또는 한 번에 실행:

```bash
npm run dev:full
```

### 환경변수 설정

`.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
# 데이터베이스 설정
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=stablecoin

# Redis 설정
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 블록체인 설정
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=YOUR_PRIVATE_KEY

# JWT 설정
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# 애플리케이션 설정
PORT=3000
NODE_ENV=development
```

## 🏗️ 아키텍처

### 기술 스택

- **프레임워크**: NestJS
- **데이터베이스**: PostgreSQL (TypeORM)
- **캐시**: Redis
- **블록체인**: Ethers.js
- **검증**: Class Validator
- **테스트**: Jest

### 디렉토리 구조

```
src/
├── app.module.ts          # 메인 애플리케이션 모듈
├── main.ts               # 엔트리 포인트
├── libs/                 # 공통 라이브러리
│   ├── redis.service.ts  # Redis 캐시 서비스
│   └── web3.service.ts   # 블록체인 연동 서비스
├── payments/             # 결제 도메인
│   ├── dto/
│   ├── entities/
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   └── payments.module.ts
├── transfer/             # 송금 도메인
│   ├── dto/
│   ├── transfer.controller.ts
│   ├── transfer.service.ts
│   └── transfer.module.ts
└── wallet/              # 지갑 도메인
    ├── dto/
    ├── wallet.controller.ts
    ├── wallet.service.ts
    └── wallet.module.ts
```

## 📊 데이터베이스

### 주요 엔터티

- **Wallet**: 사용자 지갑 정보
- **Payment**: 결제 거래 정보
- **Transfer**: 송금 거래 정보

### 데이터베이스 관리

```bash
# 데이터베이스 시작
npm run db:start

# 데이터베이스 중지
npm run db:stop

# 데이터베이스 재시작
npm run db:restart

# 로그 확인
npm run db:logs
```

## 🗂️ Redis 캐시

### 캐시 전략

- **결제 정보**: 처리 중인 결제는 5분간 캐시
- **세션 정보**: 30분 TTL
- **임시 데이터**: 10분 TTL

### 캐시 키 패턴

- `session:{sessionId}`: 사용자 세션
- `payment:{paymentId}`: 결제 임시 데이터
- `wallet:{walletId}`: 지갑 정보 (선택적)

## 🧪 테스트

### 단위 테스트 실행

```bash
# 모든 테스트 실행
npm test

# 감시 모드로 테스트
npm run test:watch

# 커버리지 리포트 생성
npm run test:cov
```

### E2E 테스트 실행

```bash
npm run test:e2e
```

## 📡 API 엔드포인트

### 결제 API

- `POST /payments` - 결제 생성
- `GET /payments` - 결제 목록 조회
- `GET /payments/:id` - 특정 결제 조회
- `PATCH /payments/:id` - 결제 정보 수정
- `PATCH /payments/:id/status` - 결제 상태 변경
- `DELETE /payments/:id` - 결제 삭제

### 송금 API

- `POST /transfers` - 송금 생성
- `GET /transfers` - 송금 내역 조회
- `GET /transfers/:id` - 특정 송금 조회
- `PATCH /transfers/:id/status` - 송금 상태 변경

### 지갑 API

- `POST /wallets` - 지갑 생성
- `GET /wallets` - 지갑 목록 조회
- `GET /wallets/:id` - 특정 지갑 조회
- `PATCH /wallets/:id/balance` - 잔액 업데이트

## 🔧 개발 도구

### 코드 품질

```bash
# ESLint 검사
npm run lint

# Prettier 포맷팅
npm run format
```

### 디버깅

```bash
# 디버그 모드로 시작
npm run start:debug
```

## 🚦 상태 코드

- `200 OK`: 성공
- `201 Created`: 생성 성공
- `400 Bad Request`: 잘못된 요청
- `404 Not Found`: 리소스 없음
- `409 Conflict`: 중복 리소스
- `500 Internal Server Error`: 서버 오류

## 🔒 보안

- **입력 검증**: Class Validator로 모든 입력 검증
- **환경 변수**: 민감한 정보는 환경 변수로 관리
- **UUID**: 모든 ID는 UUID 사용
- **에러 처리**: 표준화된 에러 응답

## 📈 모니터링

### 로그 레벨

- `error`: 오류 상황
- `warn`: 경고 상황
- `log`: 일반 정보
- `debug`: 디버그 정보

### 헬스 체크

애플리케이션이 시작되면 다음 URL에서 상태를 확인할 수 있습니다:

- API 서버: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## 🔄 배포

### Docker 빌드

```bash
docker build -t stablecoin-backend .
```

### 프로덕션 실행

```bash
npm run build
npm run start:prod
```

## 🤝 기여하기

1. Feature 브랜치 생성
2. 변경사항 커밋
3. 테스트 실행
4. Pull Request 생성

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.
