import { Job } from '../entities/job.entity';
import { Channel } from '../entities/channel.entity';

export const ANALYZER_SERVICE = Symbol('ANALYZER_SERVICE');
export const SYNC_SERVICE = Symbol('SYNC_SERVICE');

export interface AnalyzerServiceInterface {
  runJob(job: Job, timeoutMs: number): Promise<void>;
}

export interface SyncServiceInterface {
  syncChannel(channel: Channel): Promise<void>;
}
