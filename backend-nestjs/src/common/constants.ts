/** Shared constants used across multiple modules. */

export enum JobType {
  QC_ANALYSIS = 'qc_analysis',
  CLASSIFICATION = 'classification',
}

export enum ResultType {
  QC_VIOLATION = 'qc_violation',
  CLASSIFICATION_TAG = 'classification_tag',
  CONVERSATION_EVALUATION = 'conversation_evaluation',
}

export enum Verdict {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
}

export enum RunStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  ERROR = 'error',
  CANCELLED = 'cancelled',
}

export enum SyncStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  SYNCING = 'syncing',
}

export enum TenantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

export enum ScheduleType {
  CRON = 'cron',
  AFTER_SYNC = 'after_sync',
  MANUAL = 'manual',
}

export enum OutputSchedule {
  INSTANT = 'instant',
  SCHEDULED = 'scheduled',
  CRON = 'cron',
  NONE = 'none',
}
