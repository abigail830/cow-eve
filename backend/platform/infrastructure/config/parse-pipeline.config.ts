function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function getParsePipelineDispatchMode(): "auto" | "service" | "gha" | "inline" {
  const raw = trimEnv("PARSE_PIPELINE_DISPATCH").toLowerCase() || "auto";
  if (raw === "service" || raw === "gha" || raw === "inline") return raw;
  if (trimEnv("GITHUB_TOKEN") && trimEnv("GITHUB_REPO")) return "gha";
  return "service";
}

export function getParsePipelinePublicBaseUrl(): string {
  return trimEnv("PARSE_PIPELINE_PUBLIC_BASE_URL");
}

export function getParsePipelineServiceUrl(): string {
  return trimEnv("PARSE_PIPELINE_SERVICE_URL") || "http://127.0.0.1:8091";
}

export function getParsePipelineServiceApiKey(): string {
  return trimEnv("PARSE_PIPELINE_SERVICE_API_KEY");
}

export function getParsePipelineServiceCallerId(): string {
  return trimEnv("PARSE_PIPELINE_SERVICE_CALLER_ID") || "cow-eve";
}

export function getParsePipelineWebhookPath(): string {
  return trimEnv("PARSE_PIPELINE_WEBHOOK_PATH") || "/internal/parse/v1/webhook";
}

export function getGithubToken(): string {
  return trimEnv("GITHUB_TOKEN");
}

export function getGithubRepo(): string {
  return trimEnv("GITHUB_REPO");
}

export function getGithubWorkflowFile(): string {
  return trimEnv("GITHUB_WORKFLOW_FILE") || "parse-pipeline-run-job.yml";
}

export function getGithubRef(): string {
  return trimEnv("GITHUB_REF") || "main";
}

export function getParsePipelineGhaWatchPollSec(): number {
  const raw = trimEnv("PARSE_PIPELINE_GHA_WATCH_POLL_SEC");
  const n = raw ? Number.parseFloat(raw) : 15;
  return Number.isFinite(n) ? n : 15;
}

export function getParsePipelineGhaWatchMaxSec(): number {
  const raw = trimEnv("PARSE_PIPELINE_GHA_WATCH_MAX_SEC");
  const n = raw ? Number.parseInt(raw, 10) : 3600;
  return Number.isFinite(n) ? n : 3600;
}

export function isAttachmentGistEnabled(): boolean {
  const raw = trimEnv("ATTACHMENT_GIST_ENABLED").toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

export function getAttachmentGistMaxInputChars(): number {
  const raw = trimEnv("ATTACHMENT_GIST_MAX_INPUT_CHARS");
  const n = raw ? Number.parseInt(raw, 10) : 120_000;
  return Number.isFinite(n) ? n : 120_000;
}

export function getAttachmentGistMaxOutputTokens(): number {
  const raw = trimEnv("ATTACHMENT_GIST_MAX_OUTPUT_TOKENS");
  const n = raw ? Number.parseInt(raw, 10) : 800;
  return Number.isFinite(n) ? n : 800;
}
