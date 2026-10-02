import type {
  ClaimedScheduleTask,
  CreateScheduleInput,
  ScheduledTask,
  UpdateScheduleInput,
} from "../../domain/schedule/schedule.entity";
import { drizzleScheduleRepository } from "../../infrastructure/persistence/schedule/drizzle-schedule.repository";

export type ScheduledTaskPublic = {
  id: string;
  agentId: string;
  name: string | null;
  prompt: string;
  everyMinutes: number | null;
  nextRunAt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastChatId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPublicSchedule(task: ScheduledTask): ScheduledTaskPublic {
  return {
    id: task.id,
    agentId: task.agentId,
    name: task.name,
    prompt: task.prompt,
    everyMinutes: task.everyMinutes,
    nextRunAt: task.nextRunAt.toISOString(),
    timezone: task.timezone,
    enabled: task.enabled,
    lastRunAt: task.lastRunAt?.toISOString() ?? null,
    lastStatus: task.lastStatus,
    lastError: task.lastError,
    lastChatId: task.lastChatId,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function createScheduleForUser(
  userId: string,
  input: CreateScheduleInput,
): Promise<ScheduledTask> {
  if (!input.prompt.trim()) {
    throw new Error("prompt is required");
  }
  if (Number.isNaN(input.firstRunAt.getTime())) {
    throw new Error("firstRunAt must be a valid datetime");
  }
  if (
    input.everyMinutes != null &&
    (input.everyMinutes < 1 || input.everyMinutes > 525_600)
  ) {
    throw new Error("everyMinutes must be between 1 and 525600");
  }
  return drizzleScheduleRepository.create(userId, input);
}

export async function listSchedulesForUser(
  userId: string,
  agentId?: string,
): Promise<ScheduledTask[]> {
  return drizzleScheduleRepository.list(userId, agentId);
}

/** Prefer tasks with a last run; otherwise newest by createdAt. */
export function pickScheduleSummaryTasks(
  tasks: ScheduledTask[],
  limit: number,
): ScheduledTask[] {
  const withRun = tasks
    .filter((t) => t.lastRunAt != null || t.lastStatus != null)
    .sort((a, b) => {
      const ta = a.lastRunAt?.getTime() ?? 0;
      const tb = b.lastRunAt?.getTime() ?? 0;
      return tb - ta;
    });
  if (withRun.length >= limit) return withRun.slice(0, limit);

  const rest = tasks
    .filter((t) => !withRun.includes(t))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return [...withRun, ...rest].slice(0, limit);
}

export async function listScheduleSummaryForUser(
  userId: string,
  agentId: string,
  limit: number,
): Promise<ScheduledTask[]> {
  const all = await drizzleScheduleRepository.list(userId, agentId);
  return pickScheduleSummaryTasks(all, limit);
}

export async function getScheduleForUser(
  userId: string,
  id: string,
): Promise<ScheduledTask | null> {
  return drizzleScheduleRepository.getById(userId, id);
}

export async function updateScheduleForUser(
  userId: string,
  id: string,
  patch: UpdateScheduleInput,
): Promise<ScheduledTask | null> {
  if (patch.prompt !== undefined && !patch.prompt.trim()) {
    throw new Error("prompt cannot be empty");
  }
  if (
    patch.everyMinutes != null &&
    (patch.everyMinutes < 1 || patch.everyMinutes > 525_600)
  ) {
    throw new Error("everyMinutes must be between 1 and 525600");
  }
  return drizzleScheduleRepository.update(userId, id, patch);
}

export async function deleteScheduleForUser(
  userId: string,
  id: string,
): Promise<boolean> {
  return drizzleScheduleRepository.softDelete(userId, id);
}

export async function claimDueSchedules(input: {
  limit?: number;
  leaseForMs?: number;
}): Promise<ClaimedScheduleTask[]> {
  return drizzleScheduleRepository.claimDue({
    now: new Date(),
    limit: input.limit ?? 25,
    leaseForMs: input.leaseForMs ?? 5 * 60_000,
  });
}

export async function completeSchedule(job: ClaimedScheduleTask): Promise<void> {
  await drizzleScheduleRepository.complete(job);
}

export async function releaseSchedule(
  job: ClaimedScheduleTask,
  failure: { error: unknown; retryAt?: Date },
): Promise<void> {
  const retryAt =
    failure.retryAt ?? new Date(Date.now() + 5 * 60_000);
  await drizzleScheduleRepository.release(job, { ...failure, retryAt });
}

export async function linkScheduleRunChat(input: {
  scheduleId: string;
  userId: string;
  eveSessionId: string;
}): Promise<void> {
  await drizzleScheduleRepository.linkRunChat(input);
}
