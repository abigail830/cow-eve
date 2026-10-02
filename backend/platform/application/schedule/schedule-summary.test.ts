import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ScheduledTask } from "../../domain/schedule/schedule.entity.js";
import { pickScheduleSummaryTasks } from "./schedule.use-case.js";

function task(partial: Partial<ScheduledTask> & { id: string }): ScheduledTask {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: partial.id,
    userId: "u",
    agentId: "omni",
    name: null,
    prompt: "p",
    everyMinutes: null,
    nextRunAt: now,
    timezone: "UTC",
    enabled: true,
    leaseToken: null,
    leaseExpiresAt: null,
    lastRunAt: partial.lastRunAt ?? null,
    lastStatus: partial.lastStatus ?? null,
    lastError: null,
    lastChatId: null,
    deletedAt: null,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
  };
}

describe("pickScheduleSummaryTasks", () => {
  it("prefers tasks with last run, then fills with newest created", () => {
    const tasks = [
      task({
        id: "old-run",
        lastRunAt: new Date("2026-01-02T00:00:00Z"),
        lastStatus: "success",
      }),
      task({
        id: "new-no-run",
        createdAt: new Date("2026-01-05T00:00:00Z"),
      }),
      task({
        id: "recent-run",
        lastRunAt: new Date("2026-01-04T00:00:00Z"),
        lastStatus: "failed",
      }),
    ];
    const picked = pickScheduleSummaryTasks(tasks, 2);
    assert.deepEqual(
      picked.map((t) => t.id),
      ["recent-run", "old-run"],
    );
  });
});
