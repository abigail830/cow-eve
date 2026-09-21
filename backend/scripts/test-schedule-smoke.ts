/**
 * Smoke test for scheduled_tasks CRUD + claim/complete/release.
 * Requires DATABASE_URL (loads backend/.env when present).
 *
 *   npm run test:schedule
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = join(scriptDir, "../.env");
if (existsSync(envPath) && !process.env.DATABASE_URL) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("test:schedule requires DATABASE_URL");
  process.exit(1);
}

const {
  createScheduleForUser,
  listSchedulesForUser,
  updateScheduleForUser,
  deleteScheduleForUser,
  claimDueSchedules,
  completeSchedule,
  releaseSchedule,
  toPublicSchedule,
} = await import("../platform/application/schedule/schedule.use-case.js");

const TEST_USER = `test-schedule-smoke-${Date.now()}@local`;

async function run() {
  console.log("[test:schedule] create one-time task");
  const past = new Date(Date.now() - 60_000);
  const created = await createScheduleForUser(TEST_USER, {
    name: "smoke",
    prompt: "Smoke test prompt",
    firstRunAt: past,
    everyMinutes: null,
    timezone: "UTC",
  });
  assert.equal(created.userId, TEST_USER);
  assert.equal(created.enabled, true);
  assert.ok(toPublicSchedule(created).nextRunAt);

  console.log("[test:schedule] list includes created task");
  const listed = await listSchedulesForUser(TEST_USER);
  assert.ok(listed.some((t) => t.id === created.id));

  console.log("[test:schedule] claim due");
  const claimed = await claimDueSchedules({ limit: 10, leaseForMs: 60_000 });
  const job = claimed.find((j) => j.id === created.id);
  assert.ok(job, "expected claimed job for created schedule");

  console.log("[test:schedule] release with retry");
  await releaseSchedule(job!, {
    error: new Error("simulated dispatch failure"),
    retryAt: new Date(Date.now() + 120_000),
  });
  const afterRelease = await listSchedulesForUser(TEST_USER);
  const released = afterRelease.find((t) => t.id === created.id);
  assert.equal(released?.lastStatus, "failed");
  assert.ok(released?.lastError?.includes("simulated"));

  console.log("[test:schedule] claim again and complete");
  const reclaimed = await claimDueSchedules({ limit: 10, leaseForMs: 60_000 });
  const job2 = reclaimed.find((j) => j.id === created.id);
  if (job2) {
    await completeSchedule(job2);
  } else {
    await updateScheduleForUser(TEST_USER, created.id, {
      nextRunAt: new Date(Date.now() - 1000),
    });
    const claimedAgain = await claimDueSchedules({ limit: 10, leaseForMs: 60_000 });
    const job3 = claimedAgain.find((j) => j.id === created.id);
    assert.ok(job3, "expected reclaim after nextRunAt bump");
    await completeSchedule(job3!);
  }

  const afterComplete = await listSchedulesForUser(TEST_USER);
  const done = afterComplete.find((t) => t.id === created.id);
  assert.equal(done?.lastStatus, "success");
  assert.equal(done?.enabled, false);

  console.log("[test:schedule] update + delete");
  const recurring = await createScheduleForUser(TEST_USER, {
    prompt: "Recurring smoke",
    firstRunAt: new Date(Date.now() + 3600_000),
    everyMinutes: 60,
  });
  const updated = await updateScheduleForUser(TEST_USER, recurring.id, {
    enabled: false,
    name: "paused",
  });
  assert.equal(updated?.enabled, false);
  assert.equal(updated?.name, "paused");

  assert.ok(await deleteScheduleForUser(TEST_USER, recurring.id));
  assert.ok(await deleteScheduleForUser(TEST_USER, created.id));

  const remaining = await listSchedulesForUser(TEST_USER);
  assert.equal(remaining.length, 0);

  console.log("[test:schedule] all assertions passed");
}

run().catch((err) => {
  console.error("[test:schedule] FAILED", err);
  process.exit(1);
});
