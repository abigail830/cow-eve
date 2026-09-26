import { parsedArtifactInManifest } from "../../domain/docstore/parsed-manifest.js";
import { ParseStatus } from "../../domain/parse/parse-status.js";
import {
  getGithubRepo,
  getGithubToken,
  getGithubWorkflowFile,
  getParsePipelineGhaWatchMaxSec,
  getParsePipelineGhaWatchPollSec,
} from "../config/parse-pipeline.config.js";
import { drizzleChatAttachmentRepository } from "../persistence/attachment/drizzle-chat-attachment.repository.js";
import {
  getParseJobRunByJobId,
  updateParseJobRunStatus,
} from "../persistence/parse/drizzle-parse-job.repository.js";

const RECONCILE_ATTEMPTS = 3;
const RECONCILE_DELAY_MS = 10_000;

export function scheduleGhaRunWatch(jobId: string): void {
  void watchGhaRun(jobId).catch((err) => {
    console.error("[parse] GHA watch failed", jobId, err);
  });
}

async function watchGhaRun(jobId: string): Promise<void> {
  const token = getGithubToken();
  const repo = getGithubRepo();
  const workflow = getGithubWorkflowFile();
  if (!token || !repo) return;

  const pollIntervalMs = Math.max(5000, getParsePipelineGhaWatchPollSec() * 1000);
  const maxWaitMs = Math.max(300_000, getParsePipelineGhaWatchMaxSec() * 1000);
  const started = Date.now();
  await sleep(8000);

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs`;
  const runNamePrefix = `platform-parse-${jobId}`;

  while (Date.now() - started < maxWaitMs) {
    const runRow = await getParseJobRunByJobId(jobId);
    if (!runRow || runRow.status === "failed" || runRow.status === "succeeded") {
      return;
    }

    let runs: Array<Record<string, unknown>> = [];
    try {
      const response = await fetch(
        `${url}?per_page=15&event=workflow_dispatch`,
        { headers },
      );
      if (!response.ok) throw new Error(`GHA list runs ${response.status}`);
      const data = (await response.json()) as { workflow_runs?: unknown[] };
      runs = (data.workflow_runs ?? []).filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      );
    } catch (err) {
      console.error("[parse] GHA watch poll failed", jobId, err);
      await sleep(pollIntervalMs);
      continue;
    }

    const matched = runs.find((run) => {
      const name = String(run.name ?? "");
      const title = String(run.display_title ?? "");
      return name.startsWith(runNamePrefix) || title.startsWith(runNamePrefix);
    });

    if (!matched) {
      await sleep(pollIntervalMs);
      continue;
    }

    const status = String(matched.status ?? "");
    if (status !== "completed") {
      const htmlUrl = String(matched.html_url ?? "");
      const message = htmlUrl
        ? `GitHub Actions job in progress… (${htmlUrl})`
        : "GitHub Actions job in progress…";
      await markJobRunningIfPending(jobId, message);
      await sleep(pollIntervalMs);
      continue;
    }

    const conclusion = String(matched.conclusion ?? "");
    if (conclusion === "success") {
      await reconcileGhaSuccess(jobId, matched);
      return;
    }

    const htmlUrl = String(matched.html_url ?? "");
    const message = htmlUrl
      ? `GitHub Actions parse job failed (${htmlUrl})`
      : "GitHub Actions parse job failed";
    await markJobFailed(jobId, "GHA_FAILED", message);
    return;
  }

  await markJobFailed(
    jobId,
    "PARSE_TIMEOUT",
    "Timed out waiting for GitHub Actions parse job to finish",
  );
}

async function reconcileGhaSuccess(
  jobId: string,
  matched: Record<string, unknown>,
): Promise<void> {
  for (let attempt = 0; attempt < RECONCILE_ATTEMPTS; attempt += 1) {
    const runRow = await getParseJobRunByJobId(jobId);
    if (!runRow || runRow.status === "failed" || runRow.status === "succeeded") {
      return;
    }

    const attachment = await drizzleChatAttachmentRepository.getByIdOnly(
      runRow.attachmentId,
    );
    if (attachment?.parseStatus === ParseStatus.READY) {
      await updateParseJobRunStatus(jobId, "succeeded");
      return;
    }

    if (
      attachment &&
      parsedArtifactInManifest(attachment.parsedArtifactManifest, "meta_json")
    ) {
      await drizzleChatAttachmentRepository.applyParseWebhook(
        runRow.attachmentId,
        {
          status: ParseStatus.READY,
          stageSnapshot: {
            current_stage: "finalize",
            message: "Parse complete (reconciled after GHA success)",
            stages: [],
          },
        },
      );
      await updateParseJobRunStatus(jobId, "succeeded");
      return;
    }

    if (attempt + 1 < RECONCILE_ATTEMPTS) {
      await sleep(RECONCILE_DELAY_MS);
    }
  }

  const htmlUrl = String(matched.html_url ?? "");
  let message = "GitHub Actions succeeded but platform did not receive parse results";
  if (htmlUrl) message = `${message} (${htmlUrl})`;
  await markJobFailed(jobId, "WEBHOOK_DELIVERY_LOST", message);
}

async function markJobRunningIfPending(
  jobId: string,
  message: string,
): Promise<void> {
  const runRow = await getParseJobRunByJobId(jobId);
  if (!runRow || runRow.status === "failed" || runRow.status === "succeeded") {
    return;
  }
  const attachment = await drizzleChatAttachmentRepository.getByIdOnly(
    runRow.attachmentId,
  );
  if (!attachment || attachment.parseStatus !== ParseStatus.PENDING) return;

  await drizzleChatAttachmentRepository.applyParseWebhook(runRow.attachmentId, {
    status: ParseStatus.RUNNING,
    stageSnapshot: {
      current_stage: "fetch",
      message,
      stages: [],
    },
  });
}

async function markJobFailed(
  jobId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const runRow = await getParseJobRunByJobId(jobId);
  if (!runRow || runRow.status === "failed" || runRow.status === "succeeded") {
    return;
  }
  await drizzleChatAttachmentRepository.applyParseWebhook(runRow.attachmentId, {
    status: ParseStatus.FAILED,
    errorCode,
    errorMessage,
  });
  await updateParseJobRunStatus(jobId, "failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
