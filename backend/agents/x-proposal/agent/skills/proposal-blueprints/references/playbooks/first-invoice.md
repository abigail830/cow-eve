# First total invoice (SG)

**Derived layer:** totals come from current **`quotation.json`** rows (priced fields per **`proposal-catalog-explorer` → `compose-session.md`**) plus **`schemas/tax-rates.json`** for the jurisdiction.

Run deterministic extension compute when the blueprint graph includes this block — not sandbox scripts or mental math in chat.

If compute reports unpriced rows, fix rows via catalog mapping and **`proposal_write_compose_file`**, then recompute.

**User-facing:** *estimated first invoice (professional fees + GST)* with amounts only. Resolve warnings internally before quoting totals in chat.
