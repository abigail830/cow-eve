import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeFirstTotalInvoice,
  lineItemsFromQuotationRow,
} from "./compute-first-total-invoice.js";

describe("compute-first-total-invoice", () => {
  it("sums compact rows and applies SG GST", () => {
    const result = computeFirstTotalInvoice({
      jurisdiction: "SG",
      currency: "SGD",
      rows: [
        { rowId: "a", title: "Acorp", oneOff: 1000, billingFrequency: "once-off" },
        {
          rowId: "b",
          title: "Corp sec",
          recurringAnnual: 1200,
          billingFrequency: "annual",
        },
      ],
    });
    assert.equal(result.subtotalExGst, 2200);
    assert.equal(result.gstAmount, 198);
    assert.equal(result.totalInclGst, 2398);
    assert.equal(result.lineItems.length, 2);
  });

  it("uses first month for monthly recurring (compact)", () => {
    const result = computeFirstTotalInvoice({
      jurisdiction: "SG",
      currency: "SGD",
      rows: [
        {
          rowId: "b",
          title: "Bookkeeping",
          recurringAnnual: 1200,
          billingFrequency: "monthly",
        },
      ],
    });
    assert.equal(result.subtotalExGst, 100);
  });

  it("parses simplified_billing_frequency layout rows", () => {
    const { items } = lineItemsFromQuotationRow(
      {
        row_id: "r-1",
        title: "Acorp",
        fees: { amount: 3000, currency: "SGD" },
        billing_frequency: "once-off",
      },
      0,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0]?.amountExGst, 3000);
  });
});
