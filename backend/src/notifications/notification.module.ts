import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { LoggerService } from '../libs/logger.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificationService, LoggerService],
  exports: [NotificationService],
})
export class NotificationModule {} 