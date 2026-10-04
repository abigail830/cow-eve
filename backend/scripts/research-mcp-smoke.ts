/**
 * Verify research retrieve MCP dependencies without running a full agent turn.
 *
 *   cd backend && npm run test:research-mcp
 *   cd backend && npm run test:research-mcp -- --user-id <uuid>
 *
 * Uses platform env (HYBRID_SEARCH_*, ZHIPU_API_KEY) or per-user Integrations when
 * DATABASE_URL and --user-id are set.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMCPClient } from "@ai-sdk/mcp";
import {
  getHybridSearchMcpUrl,
  getZhipuWebSearchMcpUrl,
} from "../platform/infrastructure/config/mcp.config.js";
import { listVisibleKnowledgeBasesViaMcp } from "../platform/infrastructure/integration/hybrid-search-kb-via-mcp.js";
import { zhipuMcpAuthorizationHeader } from "../platform/domain/integration/zhipu-mcp-auth.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const envPath = join(scriptDir, "../.env");
if (existsSync(envPath)) {
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

const RESEARCH_PORT = process.env.RESEARCH_PORT?.trim() || "2002";
const RESEARCH_HEALTH = `http://127.0.0.1:${RESEARCH_PORT}/eve/v1/health`;

function readArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx < 0 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1]?.trim() || null;
}

type StepResult = { ok: true; detail: string } | { ok: false; detail: string };

function logStep(label: string, result: StepResult): void {
  const mark = result.ok ? "OK" : "FAIL";
  console.log(`[research-mcp-smoke] ${mark}  ${label}`);
  console.log(`  ${result.detail}`);
}

async function checkResearchHealth(): Promise<StepResult> {
  try {
    const res = await fetch(RESEARCH_HEALTH, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        detail: `GET ${RESEARCH_HEALTH} → HTTP ${res.status}`,
      };
    }
    return { ok: true, detail: `Research Eve is up (${RESEARCH_HEALTH})` };
  } catch (err) {
    return {
      ok: false,
      detail: `Research not reachable at ${RESEARCH_HEALTH} — start with npm run dev:research or ./scripts/start.sh research. ${err instanceof Error ? err.message : err}`,
    };
  }
}

async function checkHybridSearchMcp(
  apiKey: string | null,
  mcpUrl: string | null,
): Promise<StepResult> {
  if (!apiKey) {
    return {
      ok: false,
      detail:
        "No Hybrid Search API key (set HYBRID_SEARCH_API_KEY in backend/.env or connect Integrations for --user-id).",
    };
  }
  if (!mcpUrl) {
    return {
      ok: false,
      detail: "Hybrid Search MCP URL is not configured.",
    };
  }
  try {
    const bases = await listVisibleKnowledgeBasesViaMcp({
      apiKey,
      mcpUrl,
    });
    return {
      ok: true,
      detail: `list_knowledge_bases @ ${mcpUrl} → ${bases.length} knowledge base(s) visible`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

function zhipuToolLooksLikeError(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  if (record.isError === true) {
    const content = record.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object" && "text" in part) {
          const text = String((part as { text: unknown }).text);
          return text.slice(0, 400);
        }
      }
    }
    return "MCP returned isError=true";
  }
  return null;
}

async function checkZhipuWebMcp(
  authorization: string | null,
  mcpUrl: string | null,
): Promise<StepResult> {
  if (!authorization) {
    return {
      ok: false,
      detail:
        "No Zhipu API key (set ZHIPU_API_KEY in backend/.env or connect Integrations for --user-id).",
    };
  }
  if (!mcpUrl) {
    return { ok: false, detail: "Zhipu MCP URL is not configured." };
  }

  let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  try {
    client = await createMCPClient({
      transport: {
        type: "http",
        url: mcpUrl,
        headers: { Authorization: authorization },
      },
    });
    const toolName = "web_search_prime";
    const started = Date.now();
    const result = await client.callTool({
      name: toolName,
      arguments: {
        search_query: "cow-eve research mcp smoke test",
      },
    });
    const ms = Date.now() - started;
    const mcpError = zhipuToolLooksLikeError(result);
    if (mcpError) {
      return {
        ok: false,
        detail: `${toolName} @ ${mcpUrl} → ${mcpError}`,
      };
    }
    const preview = JSON.stringify(result).slice(0, 120);
    return {
      ok: true,
      detail: `${toolName} @ ${mcpUrl} responded in ${ms}ms (preview: ${preview}…)`,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await client?.close().catch(() => undefined);
  }
}

async function run() {
  const userId = readArg("--user-id");
  console.log("[research-mcp-smoke] Research retrieve MCP probe");
  if (userId) {
    console.log(`  user-id: ${userId} (Integrations from DATABASE_URL)`);
  } else {
    console.log("  credentials: backend/.env only (pass --user-id for per-user keys)");
  }
  console.log("");

  const { resolveZhipuWebSearchApiKey, resolveHybridSearchCredentials } =
    await import("../platform/application/integration/user-integration.use-case.js");

  const zhipuKey = await resolveZhipuWebSearchApiKey(userId);
  const zhipuAuth = zhipuKey ? zhipuMcpAuthorizationHeader(zhipuKey) : "";
  const zhipuUrl = getZhipuWebSearchMcpUrl();

  const hybrid = await resolveHybridSearchCredentials(userId);
  const hybridUrl = hybrid.url ?? getHybridSearchMcpUrl();

  const results: StepResult[] = [];

  results.push(await checkResearchHealth());
  results.push(await checkHybridSearchMcp(hybrid.apiKey, hybridUrl));
  results.push(await checkZhipuWebMcp(zhipuAuth || null, zhipuUrl));

  logStep("Research agent health", results[0]!);
  logStep("Hybrid Search MCP (list_knowledge_bases)", results[1]!);
  logStep("Zhipu web search MCP", results[2]!);

  console.log("");
  console.log(
    "[research-mcp-smoke] HubSpot MCP is OAuth-only — connect in Settings → Integrations; not probed here.",
  );
  console.log(
    "[research-mcp-smoke] Tip: RESEARCH_FAIL_FAST=1 on research dev tightens retrieve budgets (≤2 per turn).",
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `\n[research-mcp-smoke] ${failed.length} check(s) failed — fix MCP before running deep research.`,
    );
    process.exit(1);
  }
  console.log("\n[research-mcp-smoke] All probes passed.");
}

await run();
