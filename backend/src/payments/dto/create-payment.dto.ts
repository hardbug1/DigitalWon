import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentType } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsEnum(PaymentType)
  @IsNotEmpty()
  type: PaymentType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: '금액은 0.01 이상이어야 합니다' })
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsUUID()
  @IsOptional()
  fromWalletId?: string;

  @IsUUID()
  @IsOptional()
  toWalletId?: string;

  @IsString()
  @IsOptional()
  toAddress?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  externalId?: string;
} 