import type {
  ClaimedScheduleTask,
  CreateScheduleInput,
  ScheduledTask,
  UpdateScheduleInput,
} from "./schedule.entity";

export interface ScheduleRepository {
  create(userId: string, input: CreateScheduleInput): Promise<ScheduledTask>;
  list(userId: string): Promise<ScheduledTask[]>;
  getById(userId: string, id: string): Promise<ScheduledTask | null>;
  update(
    userId: string,
    id: string,
    patch: UpdateScheduleInput,
  ): Promise<ScheduledTask | null>;
  softDelete(userId: string, id: string): Promise<boolean>;
  claimDue(input: {
    now: Date;
    limit: number;
    leaseForMs: number;
  }): Promise<ClaimedScheduleTask[]>;
  complete(job: ClaimedScheduleTask): Promise<void>;
  release(
    job: ClaimedScheduleTask,
    failure: { error: unknown; retryAt: Date },
  ): Promise<void>;
  linkRunChat(input: {
    scheduleId: string;
    userId: string;
    eveSessionId: string;
  }): Promise<void>;
}
