# 원화 기반 스테이블 코인 결제 웹앱 기본 기능 정의서

## 1. 사용자 기능

- **회원가입/로그인**

  - 이메일, 휴대폰, 소셜 로그인 등 지원
  - 2FA(이중 인증) 지원

- **지갑 관리**

  - 원화 기반 스테이블 코인 지갑 생성 및 관리
  - 외부 지갑(메타마스크 등) 연동 지원

- **입금/출금**

  - 원화 스테이블 코인 입금(예: 은행 연동, 타 지갑 송금)
  - 출금(타 지갑, 은행 계좌 등)

- **결제/송금**

  - QR코드/주소를 통한 결제 및 송금
  - 결제 내역 및 거래 내역 조회

- **카드 발급 및 관리(선택)**

  - 가상/실물 카드 발급
  - 카드 사용 내역 조회

- **알림 및 보안**
  - 거래 알림(이메일, SMS, 앱 푸시)
  - 비밀번호/보안 설정 변경

## 2. 관리자/운영자 기능

- **사용자 관리**

  - 회원 정보, 인증 상태, KYC/AML 관리

- **거래 모니터링**

  - 실시간 거래 내역, 이상 거래 탐지

- **수수료 및 한도 관리**

  - 입출금/결제 한도 및 수수료 정책 설정

- **통계 및 리포트**
  - 거래 통계, 사용자 통계, 정산 리포트

## 3. 외부 연동

- **외부 결제 시스템 연동**

  - Binance Pay 등 외부 결제 시스템 연동(입금/출금)

- **API 제공**
  - 외부 서비스 연동을 위한 API 제공

---

> 본 기능 정의서는 RedotPay의 주요 기능([RedotPay 공식 도움말](https://helpcenter.redotpay.com/en/articles/10339285-how-to-use-binance-pay-to-deposit-into-your-redotpay-account), [RedotPay 대안 및 비교](https://medium.com/@Deeemoz/redotpay-musewallet-alternatives-best-digital-payment-solutions-24027d709b59), [Product Hunt - RedotPay](https://www.producthunt.com/products/redotpay/alternatives))을 참고하여 작성되었습니다.
