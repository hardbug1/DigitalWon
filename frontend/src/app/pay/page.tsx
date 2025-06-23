import SendForm from '@/components/SendForm';

// 송금 데이터 타입
interface SendFormInputs {
  to: string;
  amount: number;
  memo?: string;
}

export default function PayPage() {
  // 송금 처리 핸들러 (추후 백엔드 API 연동 예정)
  const handleSendSubmit = (data: SendFormInputs) => {
    console.log('송금 요청 데이터:', data);
    // TODO: 백엔드 API 호출 로직 추가
    // - 지갑 잔액 확인
    // - 블록체인 트랜잭션 생성
    // - 트랜잭션 브로드캐스트
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">KRWX 송금</h1>
          <p className="text-gray-600">안전하고 빠른 스테이블 코인 송금 서비스</p>
        </div>
        
        <SendForm onSubmit={handleSendSubmit} />
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>• 송금 수수료: 무료</p>
          <p>• 처리 시간: 약 1-3분</p>
          <p>• 최소 송금 금액: 1 KRWX</p>
        </div>
      </div>
    </main>
  );
} 