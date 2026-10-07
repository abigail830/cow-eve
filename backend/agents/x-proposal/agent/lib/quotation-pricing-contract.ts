import type { QuotationRowInput } from "./compute-first-total-invoice.js";
import { lineItemsFromQuotationRow } from "./compute-first-total-invoice.js";

/**
 * Single source for which quotation row fields drive first-invoice math.
 * Used by proposal_compute_extension (tool feedback) — keep in sync with
 * lineItemsFromQuotationRow in compute-first-total-invoice.ts.
 */

export type QuotationPricingGuide = {
  summary: string;
  compactRowExample: Record<string, unknown>;
  layoutRowExample: Record<string, unknown>;
  acceptedFields: {
    compact: string[];
    layout: string[];
  };
  billingFrequencyValues: string[];
};

export const QUOTATION_PRICING_GUIDE: QuotationPricingGuide = {
  summary:
    "Each row must use either compact pricing (oneOff / recurringAnnual) or layout pricing (fees.amount + billing_frequency). Other keys are ignored for totals.",
  compactRowExample: {
    displayName: "Company incorporation",
    oneOff: 1200,
    recurringAnnual: 0,
    billingFrequency: "once-off",
    source: "catalog",
  },
  layoutRowExample: {
    title: "Company incorporation",
    fees: { amount: 1200, currency: "SGD" },
    billing_frequency: "once-off",
    source_type: "sku",
  },
  acceptedFields: {
    compact: [
      "oneOff (number, ex-GST one-off fee)",
      "recurringAnnual (number, ex-GST recurring fee for the period)",
      "billingFrequency (once-off | monthly | annual | …)",
    ],
    layout: [
      "fees.amount (number, ex-GST)",
      "billing_frequency (once-off | monthly | annual | …)",
    ],
  },
  billingFrequencyValues: [
    "once-off",
    "one-off",
    "monthly",
    "annual",
    "yearly",
    "annually",
  ],
};

export function rowHasPricedFields(row: QuotationRowInput): boolean {
  return lineItemsFromQuotationRow(row, 0).items.length > 0;
}

export function quotationPricingGuidePayload(): QuotationPricingGuide {
  return QUOTATION_PRICING_GUIDE;
}
