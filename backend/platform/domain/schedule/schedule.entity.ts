export type ScheduleStatus =
  | "pending"
  | "running"
  | "success"
  | "failed";

export type ScheduledTask = {
  id: string;
  userId: string;
  name: string | null;
  prompt: string;
  everyMinutes: number | null;
  nextRunAt: Date;
  timezone: string;
  enabled: boolean;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastRunAt: Date | null;
  lastStatus: ScheduleStatus | null;
  lastError: string | null;
  lastChatId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClaimedScheduleTask = ScheduledTask & {
  leaseToken: string;
};

export type CreateScheduleInput = {
  name?: string | null;
  prompt: string;
  firstRunAt: Date;
  everyMinutes?: number | null;
  timezone?: string;
};

export type UpdateScheduleInput = {
  name?: string | null;
  prompt?: string;
  nextRunAt?: Date;
  everyMinutes?: number | null;
  enabled?: boolean;
  timezone?: string;
};
