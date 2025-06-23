import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty({ message: '지갑 주소를 입력하세요' })
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: '올바른 지갑 주소 형식이 아닙니다' })
  address: string;

  @IsString()
  @IsOptional()
  userId?: string;
} 