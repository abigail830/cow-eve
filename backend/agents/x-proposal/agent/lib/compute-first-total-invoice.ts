import { getTaxRates } from "./blueprint-loader.js";

export type QuotationRowInput = Record<string, unknown>;

export type FirstInvoiceLineItem = {
  rowId: string | null;
  title: string;
  category: "one_off" | "recurring_first_period";
  amountExGst: number;
  billingFrequency: string | null;
  note: string | null;
};

export type FirstTotalInvoiceResult = {
  moduleId: "first_total_invoice";
  algorithmVersion: "1";
  jurisdiction: string;
  currency: string;
  lineItems: FirstInvoiceLineItem[];
  subtotalExGst: number;
  gstRatePercent: number;
  gstLabel: string;
  gstAmount: number;
  totalInclGst: number;
  warnings: string[];
  unpricedRowCount: number;
};

type TaxConfig = {
  gstRatePercent: number;
  label: string;
  feesExclusiveOfTax: boolean;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function loadTaxConfig(jurisdiction: string): TaxConfig {
  const all = getTaxRates();
  const cfg = all[jurisdiction];
  if (!cfg) {
    throw new Error(`No tax config for jurisdiction: ${jurisdiction}`);
  }
  return cfg;
}

function normalizeFrequency(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value).trim().toLowerCase();
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Map a quotation row to first-period ex-GST amounts (deterministic; no LLM).
 * Supports compose-ir compact rows and simplified_billing_frequency layout rows.
 */
export function lineItemsFromQuotationRow(
  row: QuotationRowInput,
  index: number,
): { items: FirstInvoiceLineItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const rowId =
    typeof row.row_id === "string"
      ? row.row_id
      : typeof row.rowId === "string"
        ? row.rowId
        : `row-${index + 1}`;
  const title =
    typeof row.title === "string"
      ? row.title
      : typeof row.displayName === "string"
        ? row.displayName
        : rowId;

  const fees = row.fees as Record<string, unknown> | undefined;
  const amountFromFees = fees ? parseAmount(fees.amount) : null;
  const freq = normalizeFrequency(
    row.billing_frequency ?? row.billingFrequency,
  );

  const oneOff = parseAmount(row.oneOff);
  const recurringAnnual = parseAmount(row.recurringAnnual);

  const items: FirstInvoiceLineItem[] = [];

  const useLayoutFees = fees != null && amountFromFees != null;

  if (!useLayoutFees && oneOff != null && oneOff !== 0) {
    items.push({
      rowId,
      title,
      category: "one_off",
      amountExGst: roundMoney(oneOff),
      billingFrequency: "once-off",
      note: null,
    });
  }

  if (!useLayoutFees && recurringAnnual != null && recurringAnnual !== 0) {
    let firstPeriod = recurringAnnual;
    let note: string | null = null;
    if (freq === "monthly") {
      firstPeriod = recurringAnnual / 12;
      note = "First month (annual fee / 12)";
    } else if (freq === "annual" || freq === "once-off" || freq == null) {
      firstPeriod = recurringAnnual;
      note =
        freq === "once-off"
          ? "Recurring field on once-off row (review)"
          : "First annual period";
    } else {
      warnings.push(
        `${rowId}: recurring amount with billing frequency "${freq}" — counted as full first period (review)`,
      );
      firstPeriod = recurringAnnual;
    }
    items.push({
      rowId,
      title,
      category: "recurring_first_period",
      amountExGst: roundMoney(firstPeriod),
      billingFrequency: freq,
      note,
    });
  }

  if (amountFromFees != null) {
    if (freq === "once-off" || freq === "one-off" || freq === "once off") {
      items.push({
        rowId,
        title,
        category: "one_off",
        amountExGst: roundMoney(amountFromFees),
        billingFrequency: freq,
        note: null,
      });
    } else if (freq === "monthly") {
      items.push({
        rowId,
        title,
        category: "recurring_first_period",
        amountExGst: roundMoney(amountFromFees),
        billingFrequency: freq,
        note: "First month (monthly fee)",
      });
    } else if (
      freq === "annual" ||
      freq === "yearly" ||
      freq === "annually"
    ) {
      items.push({
        rowId,
        title,
        category: "recurring_first_period",
        amountExGst: roundMoney(amountFromFees),
        billingFrequency: freq,
        note: "First annual period",
      });
    } else if (freq == null) {
      warnings.push(`${rowId}: fee amount without billing_frequency — skipped`);
    } else {
      warnings.push(
        `${rowId}: fee with frequency "${freq}" — treated as one-off for first invoice (review)`,
      );
      items.push({
        rowId,
        title,
        category: "one_off",
        amountExGst: roundMoney(amountFromFees),
        billingFrequency: freq,
        note: "Non-standard frequency; counted as one-off",
      });
    }
  }

  if (
    items.length === 0 &&
    (oneOff == null && recurringAnnual == null && amountFromFees == null)
  ) {
    warnings.push(`${rowId}: no priced fields — excluded from first invoice`);
  }

  return { items, warnings };
}

export function computeFirstTotalInvoice(input: {
  jurisdiction: string;
  currency: string;
  rows: QuotationRowInput[];
}): FirstTotalInvoiceResult {
  const tax = loadTaxConfig(input.jurisdiction);
  const lineItems: FirstInvoiceLineItem[] = [];
  const warnings: string[] = [];
  let unpricedRowCount = 0;

  input.rows.forEach((row, index) => {
    const parsed = lineItemsFromQuotationRow(row, index);
    if (parsed.items.length === 0) unpricedRowCount += 1;
    lineItems.push(...parsed.items);
    warnings.push(...parsed.warnings);
  });

  const subtotalExGst = roundMoney(
    lineItems.reduce((sum, li) => sum + li.amountExGst, 0),
  );

  let gstAmount = 0;
  if (tax.feesExclusiveOfTax) {
    gstAmount = roundMoney(subtotalExGst * (tax.gstRatePercent / 100));
  }

  const totalInclGst = roundMoney(subtotalExGst + gstAmount);

  return {
    moduleId: "first_total_invoice",
    algorithmVersion: "1",
    jurisdiction: input.jurisdiction,
    currency: input.currency,
    lineItems,
    subtotalExGst,
    gstRatePercent: tax.gstRatePercent,
    gstLabel: tax.label,
    gstAmount,
    totalInclGst,
    warnings,
    unpricedRowCount,
  };
}
