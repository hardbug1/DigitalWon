import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SendForm from './SendForm';

// SendForm 테스트: 입력값 검증, 에러 메시지, 제출 동작

describe('SendForm', () => {
  test('모든 필수 입력값이 없을 때 에러 메시지를 보여준다', async () => {
    render(<SendForm />);
    fireEvent.click(screen.getByRole('button', { name: /송금/i }));
    expect(await screen.findByText(/지갑 주소를 입력하세요/i)).toBeInTheDocument();
    expect(await screen.findByText(/금액을 입력하세요/i)).toBeInTheDocument();
  });

  test('지갑 주소, 금액 입력 시 에러 메시지가 사라진다', async () => {
    render(<SendForm />);
    fireEvent.click(screen.getByRole('button', { name: /송금/i }));
    const addressInput = screen.getByLabelText(/받는 지갑 주소/i);
    const amountInput = screen.getByLabelText(/송금 금액/i);
    fireEvent.change(addressInput, { target: { value: '0x1234abcd' } });
    fireEvent.change(amountInput, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /송금/i }));
    expect(screen.queryByText(/지갑 주소를 입력하세요/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/금액을 입력하세요/i)).not.toBeInTheDocument();
  });

  test('금액이 0 이하일 때 에러 메시지를 보여준다', async () => {
    render(<SendForm />);
    const addressInput = screen.getByLabelText(/받는 지갑 주소/i);
    const amountInput = screen.getByLabelText(/송금 금액/i);
    fireEvent.change(addressInput, { target: { value: '0x1234abcd' } });
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /송금/i }));
    expect(await screen.findByText(/1원 이상 입력하세요/i)).toBeInTheDocument();
  });

  test('정상 입력 시 제출 콜백이 호출된다', async () => {
    const handleSubmit = jest.fn();
    render(<SendForm onSubmit={handleSubmit} />);
    fireEvent.change(screen.getByLabelText(/받는 지갑 주소/i), { target: { value: '0x1234abcd' } });
    fireEvent.change(screen.getByLabelText(/송금 금액/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /송금/i }));
    // 1초 이내에 콜백이 호출되는지 확인
    await screen.findByText(/송금 요청 완료/i);
    expect(handleSubmit).toHaveBeenCalled();
  });
}); 