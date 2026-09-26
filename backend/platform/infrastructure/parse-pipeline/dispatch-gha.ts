import {
  getGithubRef,
  getGithubRepo,
  getGithubToken,
  getGithubWorkflowFile,
  getParsePipelinePublicBaseUrl,
} from "../config/parse-pipeline.config.js";

export async function dispatchParseGha(input: {
  jobId: string;
  runToken: string;
  pipelineId: string;
}): Promise<void> {
  const token = getGithubToken();
  const repo = getGithubRepo();
  const workflow = getGithubWorkflowFile();
  const ref = getGithubRef();
  const publicBase = getParsePipelinePublicBaseUrl();

  if (!token || !repo) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPO required for GHA dispatch");
  }
  if (!publicBase) {
    throw new Error("PARSE_PIPELINE_PUBLIC_BASE_URL is required for GHA dispatch");
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ref,
      inputs: {
        pipeline_id: input.pipelineId,
        platform_job_id: input.jobId,
        platform_run_token: input.runToken,
        platform_base_url: publicBase.replace(/\/+$/, ""),
        job_id: input.jobId,
      },
    }),
  });

  if (response.status !== 201 && response.status !== 204) {
    const detail = (await response.text()).trim() || response.statusText;
    throw new Error(`GitHub Actions dispatch failed (${response.status}): ${detail}`);
  }
}
