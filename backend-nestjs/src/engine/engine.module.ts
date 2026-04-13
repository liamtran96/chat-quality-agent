import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Job,
  JobRun,
  JobResult,
  Conversation,
  Message,
  AppSetting,
  AIUsageLog,
  ActivityLog,
  Channel,
} from '../entities';
import { CryptoService } from '../common/crypto/crypto.service';
import { AnalyzerService } from './analyzer.service';
import { SyncService } from './sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Job,
      JobRun,
      JobResult,
      Conversation,
      Message,
      AppSetting,
      AIUsageLog,
      ActivityLog,
      Channel,
    ]),
  ],
  providers: [CryptoService, AnalyzerService, SyncService],
  exports: [AnalyzerService, SyncService],
})
export class EngineModule {}
