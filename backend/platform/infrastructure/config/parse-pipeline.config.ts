import { loadLocalBackendEnvOnce } from "./load-local-env.js";

loadLocalBackendEnvOnce();

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function asHttpsOrigin(raw: string): string {
  const trimmed = stripTrailingSlash(raw.trim());
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return stripTrailingSlash(trimmed);
  }
  return `https://${trimmed}`;
}

/** Vercel-injected host for this deployment (backend must expose /internal/parse). */
function vercelDeploymentOrigin(): string {
  const production = trimEnv("VERCEL_PROJECT_PRODUCTION_URL");
  if (production) return asHttpsOrigin(production);
  const url = trimEnv("VERCEL_URL");
  if (url) return asHttpsOrigin(url);
  return "";
}

export function isVercelRuntime(): boolean {
  return Boolean(trimEnv("VERCEL"));
}

export function getParsePipelineDispatchMode(): "auto" | "service" | "gha" | "inline" {
  const raw = trimEnv("PARSE_PIPELINE_DISPATCH").toLowerCase() || "auto";
  if (raw === "service" || raw === "gha" || raw === "inline") return raw;
  if (trimEnv("GITHUB_TOKEN") && trimEnv("GITHUB_REPO")) return "gha";
  if (trimEnv("PARSE_PIPELINE_SERVICE_API_KEY")) return "service";
  // Serverless: avoid defaulting to unreachable localhost parse service.
  if (isVercelRuntime()) return "gha";
  return "service";
}

export function getParsePipelinePublicBaseUrl(): string {
  const explicit = trimEnv("PARSE_PIPELINE_PUBLIC_BASE_URL");
  if (explicit) return asHttpsOrigin(explicit);

  const vercelOrigin = vercelDeploymentOrigin();
  if (vercelOrigin) return vercelOrigin;

  const mode = getParsePipelineDispatchMode();
  if (mode === "service" || mode === "inline") {
    const port = trimEnv("OMNI_PORT") || trimEnv("PORT") || "2000";
    return `http://127.0.0.1:${port}`;
  }
  return "";
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

/** Safe snapshot for ops (no secrets). */
export function getParsePipelineDiagnostics(): {
  dispatchMode: "auto" | "service" | "gha" | "inline";
  publicBaseUrlConfigured: boolean;
  publicBaseUrlHost: string | null;
  vercelHostInjected: boolean;
  github: {
    repo: string | null;
    tokenConfigured: boolean;
    workflowFile: string;
    ref: string;
  };
} {
  const publicBase = getParsePipelinePublicBaseUrl();
  let publicBaseUrlHost: string | null = null;
  if (publicBase) {
    try {
      publicBaseUrlHost = new URL(publicBase).host;
    } catch {
      publicBaseUrlHost = null;
    }
  }
  return {
    dispatchMode: getParsePipelineDispatchMode(),
    publicBaseUrlConfigured: Boolean(publicBase),
    publicBaseUrlHost,
    vercelHostInjected: Boolean(vercelDeploymentOrigin()),
    github: {
      repo: getGithubRepo() || null,
      tokenConfigured: Boolean(getGithubToken()),
      workflowFile: getGithubWorkflowFile(),
      ref: getGithubRef(),
    },
  };
}
