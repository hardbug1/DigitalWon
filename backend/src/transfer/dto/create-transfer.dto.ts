import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferDto {
  @IsString()
  @IsNotEmpty({ message: '송금할 지갑 주소를 입력하세요' })
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: '올바른 지갑 주소 형식이 아닙니다' })
  fromAddress: string;

  @IsString()
  @IsNotEmpty({ message: '받을 지갑 주소를 입력하세요' })
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: '올바른 지갑 주소 형식이 아닙니다' })
  toAddress: string;

  @IsNumber({}, { message: '송금 금액은 숫자여야 합니다' })
  @Type(() => Number)
  @Min(1, { message: '송금 금액은 1원 이상이어야 합니다' })
  amount: number;

  @IsString()
  @IsOptional()
  memo?: string;
} 