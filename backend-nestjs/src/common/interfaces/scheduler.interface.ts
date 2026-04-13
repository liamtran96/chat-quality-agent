/**
 * Interface for the scheduler reload signal.
 * The actual scheduler implementation lives in another module.
 * This interface allows the jobs module to signal a reload
 * without depending on the scheduler module directly.
 */
export interface ISchedulerSignal {
  reloadJobs(): void;
}

export const SCHEDULER_SIGNAL = 'SCHEDULER_SIGNAL';
