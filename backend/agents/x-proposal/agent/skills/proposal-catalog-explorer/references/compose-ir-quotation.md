# quotation.json — compact row example

Full session model (truth layers, layout vs compact, catalog → row mapping): **`compose-session.md`**.

**Chat:** service titles from `displayName` / `title` / scope bullets — not SKU codes in tables.

```json
{
  "currency": "SGD",
  "layout": "one_off_recurring",
  "rows": [
    {
      "sku": "…",
      "displayName": "…",
      "oneOff": 1200,
      "recurringAnnual": 800,
      "billingFrequency": "annual",
      "source": "catalog",
      "isCustom": false
    }
  ]
}
```

Default SG SME layout family **`simplified_billing_frequency`** uses layout rows (`fees.amount`, `billing_frequency`) — see layout spec + **`compose-session.md`**.

Custom / KB gap: `"source": "kb_candidate"` or `"isCustom": true` with `"priceStatus": "unverified"`.
