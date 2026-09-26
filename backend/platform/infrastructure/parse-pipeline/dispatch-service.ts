import {
  getParsePipelineServiceApiKey,
  getParsePipelineServiceCallerId,
  getParsePipelineServiceUrl,
} from "../config/parse-pipeline.config.js";

function submitBody(payload: Record<string, unknown>): Record<string, unknown> {
  return {
    schema_version: payload.schema_version ?? "1.0",
    job_id: payload.job_id,
    idempotency_key: payload.idempotency_key,
    pipeline_id: payload.pipeline_id,
    storage: payload.storage,
    source: payload.source ?? {},
    options: payload.options ?? {},
    callbacks: payload.callbacks ?? {},
  };
}

export async function dispatchParseService(
  payload: Record<string, unknown>,
): Promise<string> {
  const apiKey = getParsePipelineServiceApiKey();
  if (!apiKey) {
    throw new Error(
      "PARSE_PIPELINE_SERVICE_API_KEY is required (must match parse-pipeline PARSE_PIPELINE_API_KEYS)",
    );
  }
  const callerId = getParsePipelineServiceCallerId();
  const url = `${getParsePipelineServiceUrl().replace(/\/+$/, "")}/v1/jobs`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "X-Parse-Caller-Id": callerId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(submitBody(payload)),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`parse service dispatch failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as { job_id?: string };
  const jobId = String(data.job_id ?? payload.job_id ?? "");
  if (!jobId) throw new Error("parse service returned no job_id");
  return jobId;
}
