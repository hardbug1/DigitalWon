import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BinancePayService } from './binance-pay.service';
import { BinancePayController } from './binance-pay.controller';
import { LoggerService } from '../libs/logger.service';

@Module({
  imports: [ConfigModule],
  controllers: [BinancePayController],
  providers: [BinancePayService, LoggerService],
  exports: [BinancePayService],
})
export class ExternalModule {} 