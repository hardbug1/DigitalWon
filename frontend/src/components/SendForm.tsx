import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

// 송금 폼 입력 데이터 타입
interface SendFormInputs {
  to: string;
  amount: number;
  memo?: string;
}

// 송금 폼 Props 타입
interface SendFormProps {
  onSubmit?: (data: SendFormInputs) => void;
}

// yup 검증 스키마
const sendFormSchema = yup.object({
  to: yup.string().required('지갑 주소를 입력하세요'),
  amount: yup
    .number()
    .typeError('금액을 입력하세요')
    .required('금액을 입력하세요')
    .min(1, '1원 이상 입력하세요'),
  memo: yup.string().optional(),
});

const SendForm: React.FC<SendFormProps> = ({ onSubmit }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<SendFormInputs>({
    resolver: yupResolver(sendFormSchema),
  });

  const handleFormSubmit = async (data: SendFormInputs) => {
    try {
      // 외부 콜백 호출 (테스트용)
      if (onSubmit) {
        onSubmit(data);
      }
      
      // Mock 송금 처리 (실제 로직은 추후 연동)
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      setIsSuccess(true);
      reset();
      
      // 성공 메시지 3초 후 자동 숨김
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('송금 처리 중 오류:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
      {isSuccess && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          송금 요청 완료
        </div>
      )}
      
      <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <label htmlFor="to" className="mb-1 text-sm font-medium">
            받는 지갑 주소
          </label>
          <input
            id="to"
            type="text"
            {...register('to')}
            className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0x..."
          />
          {errors.to && (
            <span className="text-red-500 text-xs mt-1">{errors.to.message}</span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="amount" className="mb-1 text-sm font-medium">
            송금 금액 (KRWX)
          </label>
          <input
            id="amount"
            type="number"
            {...register('amount')}
            className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="1000"
            min="1"
          />
          {errors.amount && (
            <span className="text-red-500 text-xs mt-1">{errors.amount.message}</span>
          )}
        </div>

        <div className="flex flex-col">
          <label htmlFor="memo" className="mb-1 text-sm font-medium">
            메모 (선택사항)
          </label>
          <input
            id="memo"
            type="text"
            {...register('memo')}
            className="border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="송금 메모를 입력하세요"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white rounded p-3 mt-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? '처리 중...' : '송금'}
        </button>
      </form>
    </div>
  );
};

export default SendForm; 