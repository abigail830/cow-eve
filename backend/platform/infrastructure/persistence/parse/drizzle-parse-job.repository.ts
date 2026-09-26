import { and, desc, eq } from "drizzle-orm";
import { getDb, parseJobRuns } from "../database";

export type ParseJobRun = {
  jobId: string;
  attachmentId: string;
  chatId: string;
  runTokenHash: string;
  webhookSecret: string;
  expiresAt: Date;
  jobPayloadJson: Record<string, unknown>;
  status: string;
};

export async function createParseJobRun(input: {
  jobId: string;
  attachmentId: string;
  chatId: string;
  runTokenHash: string;
  webhookSecret: string;
  expiresAt: Date;
  jobPayloadJson: Record<string, unknown>;
}): Promise<void> {
  const db = requireDb();
  await db.insert(parseJobRuns).values({
    jobId: input.jobId,
    attachmentId: input.attachmentId,
    chatId: input.chatId,
    runTokenHash: input.runTokenHash,
    webhookSecret: input.webhookSecret,
    expiresAt: input.expiresAt,
    jobPayloadJson: input.jobPayloadJson,
    status: "queued",
  });
}

export async function getParseJobRunByToken(
  jobId: string,
  tokenHash: string,
): Promise<ParseJobRun | null> {
  const db = requireDb();
  const row = await db.query.parseJobRuns.findFirst({
    where: eq(parseJobRuns.jobId, jobId),
  });
  if (!row || row.runTokenHash !== tokenHash) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return {
    jobId: row.jobId,
    attachmentId: row.attachmentId,
    chatId: row.chatId,
    runTokenHash: row.runTokenHash,
    webhookSecret: row.webhookSecret,
    expiresAt: row.expiresAt,
    jobPayloadJson: row.jobPayloadJson as Record<string, unknown>,
    status: row.status,
  };
}

export async function updateParseJobRunStatus(
  jobId: string,
  status: string,
): Promise<void> {
  const db = requireDb();
  await db
    .update(parseJobRuns)
    .set({ status })
    .where(eq(parseJobRuns.jobId, jobId));
}

export async function getParseJobRunForAttachmentToken(
  attachmentId: string,
  tokenHash: string,
): Promise<ParseJobRun | null> {
  const db = requireDb();
  const rows = await db
    .select()
    .from(parseJobRuns)
    .where(
      and(
        eq(parseJobRuns.attachmentId, attachmentId),
        eq(parseJobRuns.runTokenHash, tokenHash),
      ),
    )
    .orderBy(desc(parseJobRuns.createdAt))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return {
    jobId: row.jobId,
    attachmentId: row.attachmentId,
    chatId: row.chatId,
    runTokenHash: row.runTokenHash,
    webhookSecret: row.webhookSecret,
    expiresAt: row.expiresAt,
    jobPayloadJson: row.jobPayloadJson as Record<string, unknown>,
    status: row.status,
  };
}

export async function getParseJobRunByJobId(
  jobId: string,
): Promise<ParseJobRun | null> {
  const db = requireDb();
  const row = await db.query.parseJobRuns.findFirst({
    where: eq(parseJobRuns.jobId, jobId),
  });
  if (!row) return null;
  return {
    jobId: row.jobId,
    attachmentId: row.attachmentId,
    chatId: row.chatId,
    runTokenHash: row.runTokenHash,
    webhookSecret: row.webhookSecret,
    expiresAt: row.expiresAt,
    jobPayloadJson: row.jobPayloadJson as Record<string, unknown>,
    status: row.status,
  };
}

function requireDb() {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}
