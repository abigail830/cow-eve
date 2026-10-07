import { defineTool } from "eve/tools";
import { z } from "zod";
import { computeFirstTotalInvoice } from "../lib/compute-first-total-invoice.js";
import {
  quotationPricingGuidePayload,
  rowHasPricedFields,
} from "../lib/quotation-pricing-contract.js";
import {
  CLIENT_PATH,
  EXTENSIONS_DIR,
  META_PATH,
  QUOTATION_PATH,
} from "../lib/proposal-paths.js";
import { readSandboxTextFile } from "../lib/proposal-sandbox-read.js";
import { writeSandboxTextFile } from "../lib/proposal-sandbox-write.js";

const ExtensionIdSchema = z.enum(["first_total_invoice"]);

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function resolveJurisdiction(
  meta: Record<string, unknown>,
  client: Record<string, unknown> | null,
): string {
  const fromClient = client?.entity_jurisdiction;
  if (typeof fromClient === "string" && fromClient.trim()) {
    return fromClient.trim().toUpperCase();
  }
  const bu = meta.businessUnit;
  if (typeof bu === "string" && bu.includes("-SG")) return "SG";
  return "SG";
}

export default defineTool({
  description:
    "Deterministic GST / first-invoice math from quotation.json (reads sandbox Compose IR). Writes extensions/<module>.json. Rows must use compact fields (oneOff, recurringAnnual, billingFrequency) OR layout fields (fees.amount, billing_frequency) — see tool result pricingGuide when rows are unpriced.",
  inputSchema: z.object({
    extensionId: ExtensionIdSchema.describe(
      "Extension module id enabled on meta.enabledExtensions",
    ),
    jurisdictionOverride: z
      .string()
      .min(2)
      .max(8)
      .optional()
      .describe("Override tax jurisdiction (default from client or blueprint BU)"),
  }),
  async execute({ extensionId, jurisdictionOverride }, ctx) {
    const sandbox = await ctx.getSandbox();

    const metaRaw = await readSandboxTextFile(sandbox, META_PATH);
    if (!metaRaw) {
      throw new Error("Compose not initialized — call proposal_init_compose first");
    }
    const meta = parseJsonObject(metaRaw, "meta.json");

    const quotationRaw = await readSandboxTextFile(sandbox, QUOTATION_PATH);
    if (!quotationRaw) {
      throw new Error("Missing quotation.json");
    }
    const quotation = parseJsonObject(quotationRaw, "quotation.json");
    const rows = Array.isArray(quotation.rows)
      ? (quotation.rows as Record<string, unknown>[])
      : [];

    const clientRaw = await readSandboxTextFile(sandbox, CLIENT_PATH);
    const client = clientRaw ? parseJsonObject(clientRaw, "client.json") : null;

    const currency =
      typeof quotation.currency === "string" && quotation.currency.trim()
        ? quotation.currency.trim()
        : "SGD";

    if (extensionId === "first_total_invoice") {
      const jurisdiction = (
        jurisdictionOverride ?? resolveJurisdiction(meta, client)
      ).toUpperCase();

      const computed = computeFirstTotalInvoice({
        jurisdiction,
        currency,
        rows,
      });

      const payload = {
        ...computed,
        computedAt: new Date().toISOString(),
        inputs: {
          quotationRowCount: rows.length,
          taxRatesRef: "schemas/tax-rates.json",
        },
      };

      const outPath = `${EXTENSIONS_DIR}/first_total_invoice.json`;
      await writeSandboxTextFile(
        sandbox,
        outPath,
        `${JSON.stringify(payload, null, 2)}\n`,
      );

      const allUnpriced =
        rows.length > 0 && computed.unpricedRowCount === rows.length;
      const pricedSample = rows.find((row) => rowHasPricedFields(row));

      return {
        status: allUnpriced ? "needs_pricing" : "ok",
        extensionId,
        path: outPath,
        summary: {
          currency: computed.currency,
          subtotalExGst: computed.subtotalExGst,
          gstAmount: computed.gstAmount,
          totalInclGst: computed.totalInclGst,
          warningCount: computed.warnings.length,
          unpricedRowCount: computed.unpricedRowCount,
        },
        warnings: computed.warnings,
        ...(computed.unpricedRowCount > 0
          ? {
              pricingGuide: quotationPricingGuidePayload(),
              hint: allUnpriced
                ? "No row used a recognized priced field. Rewrite quotation.json using pricingGuide (compact or layout example), then call this tool again — do not guess alternate key names."
                : "Some rows lack priced fields. Map catalog price/recurring into oneOff/recurringAnnual or fees.amount per pricingGuide.",
            }
          : {}),
        ...(pricedSample ? { examplePricedRowKeys: Object.keys(pricedSample) } : {}),
      };
    }

    throw new Error(`Unsupported extensionId: ${extensionId}`);
  },
});
