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

/** Validates GITHUB_TOKEN can read the configured workflow (does not dispatch). */
export async function probeGithubWorkflowAccess(): Promise<{
  ok: boolean;
  httpStatus: number;
  workflowState: string | null;
  oauthScopes: string | null;
  /** Classic PAT: inferred from X-OAuth-Scopes. Fine-grained: null (need Actions Read and write). */
  actionsWriteLikely: boolean | null;
  recentWorkflowDispatchRuns: number | null;
  hint: string | null;
}> {
  const token = getGithubToken();
  const repo = getGithubRepo();
  const workflow = getGithubWorkflowFile();
  if (!token || !repo) {
    return {
      ok: false,
      httpStatus: 0,
      workflowState: null,
      oauthScopes: null,
      actionsWriteLikely: null,
      recentWorkflowDispatchRuns: null,
      hint: "GITHUB_TOKEN or GITHUB_REPO missing",
    };
  }
  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  let oauthScopes: string | null = null;
  let actionsWriteLikely: boolean | null = null;
  try {
    const userRes = await fetch("https://api.github.com/user", {
      headers: ghHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    oauthScopes = userRes.headers.get("x-oauth-scopes");
    if (oauthScopes) {
      const parts = oauthScopes.split(",").map((s) => s.trim());
      actionsWriteLikely =
        parts.includes("workflow") || parts.includes("repo");
    }
  } catch {
    // optional
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}`;
  try {
    const response = await fetch(url, {
      headers: ghHeaders,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      let hint = `GitHub API returned ${response.status}`;
      if (response.status === 401) {
        hint = "GITHUB_TOKEN rejected (401). Regenerate the PAT on Vercel.";
      } else if (response.status === 403) {
        hint =
          "GITHUB_TOKEN lacks Actions access on this repo (403). Grant Actions: Read and write.";
      } else if (response.status === 404) {
        hint =
          "Workflow or repo not visible to this token (404). Check GITHUB_REPO and workflow filename.";
      }
      return {
        ok: false,
        httpStatus: response.status,
        workflowState: null,
        oauthScopes,
        actionsWriteLikely,
        recentWorkflowDispatchRuns: null,
        hint,
      };
    }
    const data = (await response.json()) as { state?: string };
    const workflowState = data.state ?? null;

    let recentWorkflowDispatchRuns: number | null = null;
    try {
      const runsRes = await fetch(
        `${url}/runs?event=workflow_dispatch&per_page=1`,
        { headers: ghHeaders, signal: AbortSignal.timeout(10_000) },
      );
      if (runsRes.ok) {
        const runsData = (await runsRes.json()) as { total_count?: number };
        recentWorkflowDispatchRuns =
          typeof runsData.total_count === "number"
            ? runsData.total_count
            : null;
      }
    } catch {
      // optional
    }

    let hint: string | null =
      workflowState && workflowState !== "active"
        ? `Workflow state is ${workflowState}`
        : null;
    if (actionsWriteLikely === false) {
      hint =
        "Classic PAT is missing the workflow or repo scope — workflow_dispatch will fail. Regenerate with repo or workflow scope.";
    } else if (actionsWriteLikely === null && workflowState === "active") {
      hint =
        "Fine-grained PAT: GET succeeded but workflow_dispatch needs Actions Read and write on this repo.";
    }

    return {
      ok: workflowState === "active" && actionsWriteLikely !== false,
      httpStatus: response.status,
      workflowState,
      oauthScopes,
      actionsWriteLikely,
      recentWorkflowDispatchRuns,
      hint,
    };
  } catch (err) {
    return {
      ok: false,
      httpStatus: 0,
      workflowState: null,
      oauthScopes,
      actionsWriteLikely,
      recentWorkflowDispatchRuns: null,
      hint: err instanceof Error ? err.message : "GitHub API request failed",
    };
  }
}
