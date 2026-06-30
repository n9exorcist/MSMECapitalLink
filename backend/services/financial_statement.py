"""
financial_statement.py
======================
Parse-only module: Indian audited financial statements (Balance Sheet + P&L /
Income & Expenditure) -> the msme_financials field set.

Mirrors the gstr3b.py pattern: a pure parser that RETURNS a dict; the router
does the DB writes. Critically, this returns a REVIEW PAYLOAD with a confidence
flag and reconciliation results — it must NEVER silently overwrite
msme_financials, because a misread balance sheet poisons every ratio and the
health score. Treat as assisted entry: parser pre-fills, human confirms.

Why this is built the way it is (validated against Sri Sai FY24-25, 14/14 fields):
  1. EXTRACTION  - pdfplumber's flat text mangles this layout: leading digits of
     amounts get severed ("58,09,236" -> "5 8,09,236") and schedule numbers sit
     inline. So we read WORDS by (x, y) and rejoin number fragments that have a
     tiny x-gap. Schedule numbers (bare 1-2 digit, far from the amount column)
     are skipped.
  2. LABELS      - multi-word labels arrive as separate word-tokens; we
     accumulate them into a phrase up to each amount. T-format balance sheets
     (liabilities left, assets right on one visual row) fall out naturally.
     Labels that sit one row above their amount are carried forward.
  3. ALIASES     - one alias list per field, so "Sales" / "Revenue from
     Operations" / "Service Income" all map to turnover across different CAs.
  4. DERIVATION  - most engine fields are AGGREGATES, not raw reads
     (current_assets = stock+debtors+cash+other_CA; TOL = secured+unsecured+
     creditors+other_CL; ebit = net_profit+interest). This layer is the contract.
  5. RECONCILE   - balance-sheet identity (assets == liabilities) and the trading
     identity are computed as self-checks. A failed check => likely misread =>
     confidence "review".

Public API:
    parse_financial_statement(pdf_bytes: bytes) -> dict
        {
          "fields":          { <msme_financials column>: int, ... },   # ready to pre-fill
          "raw_line_items":  { <line item>: int, ... },                # what was read
          "checks":          { "balance_sheet_balances": bool, ... },
          "missing":         [ <required line items not found> ],
          "confidence":      "high" | "review",
        }
"""
import io
import re
import pdfplumber

NUM_FRAG = re.compile(r"^[\d,]+$")                          # a numeric fragment
AMOUNT   = re.compile(r"^\d{1,3}(,\d{2,3})+$|^\d{4,}$")     # Indian-formatted amount


def _to_int(tok: str) -> int:
    return int(tok.replace(",", ""))


def _rows(page, x_join_gap: float = 8.0):
    """Reconstruct visual rows; rejoin number fragments split by a tiny x-gap."""
    words = sorted(page.extract_words(), key=lambda w: (round(w["top"]), w["x0"]))
    buckets: dict = {}
    for w in words:
        buckets.setdefault(round(w["top"] / 3), []).append((w["x0"], w["x1"], w["text"]))
    rows = []
    for key in sorted(buckets):
        toks = sorted(buckets[key], key=lambda t: t[0])
        merged = []
        for x0, x1, txt in toks:
            if (merged and NUM_FRAG.match(txt) and NUM_FRAG.match(merged[-1][2])
                    and x0 - merged[-1][1] < x_join_gap):
                px0, _, ptxt = merged[-1]
                merged[-1] = (px0, x1, ptxt + txt)          # severed number -> rejoin
            else:
                merged.append((x0, x1, txt))
        rows.append([(x0, txt) for x0, _x1, txt in merged])
    return rows


# Engine line item  ->  label variants seen across CAs (extend as you onboard clients)
ALIASES = {
    "sales":               ["sales", "revenue from operations", "service income",
                            "gross receipts", "contract receipts"],
    "purchases":           ["purchases", "purchase interior", "cost of materials"],
    "opening_stock":       ["opening stock"],
    "closing_stock":       ["closing stock"],
    "direct_expenses":     ["direct expenses"],
    "gross_profit":        ["gross profit"],
    "net_profit":          ["net profit", "profit for the year", "surplus"],
    "depreciation":        ["depreciation"],
    "interest":            ["bank interest", "interest on", "finance cost", "interest expense"],
    "proprietors_capital": ["proprietor s capital", "proprietors capital",
                            "capital account", "partner s capital", "owner s capital"],
    "secured_loans":       ["secured loans"],
    "unsecured_loans":     ["unsecured loans"],
    "sundry_creditors":    ["sundry creditors", "trade payables"],
    "other_curr_liab":     ["other current liabilities", "advance received"],
    "fixed_assets":        ["fixed assets"],
    "investments":         ["investments", "investment", "mutual funds"],
    "sundry_debtors":      ["sundry debtors", "trade receivables"],
    "cash":                ["cash & cash equivalents", "cash and cash equivalents",
                            "cash in hand", "cash at bank", "cash @ bank"],
    "other_curr_assets":   ["other current assets"],
}

# Line items that must be present for a trustworthy result.
REQUIRED = ["sales", "purchases", "net_profit", "closing_stock",
            "sundry_debtors", "sundry_creditors", "proprietors_capital"]


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9& ]", " ", s.lower()).strip()


def _match(label: str):
    l = " " + _norm(label) + " "
    best = None
    for field, variants in ALIASES.items():
        for v in variants:
            if (" " + v + " ") in l or v in l:
                if best is None or len(v) > best[1]:
                    best = (field, len(v))
    return best[0] if best else None


def _extract_line_items(pdf_bytes: bytes) -> dict:
    raw: dict = {}
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            pending = []                                    # label carried from prior row
            for toks in _rows(page):
                words, emitted = [], False
                for _x0, txt in toks:
                    if AMOUNT.match(txt):
                        label = " ".join(words).strip() or " ".join(pending).strip()
                        field = _match(label) if label else None
                        if field and field not in raw:
                            raw[field] = _to_int(txt)
                        words, pending, emitted = [], [], True
                    elif NUM_FRAG.match(txt):
                        continue                            # schedule number -> skip
                    else:
                        words.append(txt)
                # a label with no amount on its row -> carry to the next row only
                pending = words if (words and not emitted) else ([] if emitted else pending)
    return raw


def _derive_and_check(r: dict) -> dict:
    g = r.get
    sales = g("sales", 0); pur = g("purchases", 0); npf = g("net_profit", 0)
    dep = g("depreciation", 0); intr = g("interest", 0); stock = g("closing_stock", 0)
    deb = g("sundry_debtors", 0); cash = g("cash", 0); oca = g("other_curr_assets", 0)
    cred = g("sundry_creditors", 0); ocl = g("other_curr_liab", 0)
    sec = g("secured_loans", 0); unsec = g("unsecured_loans", 0); cap = g("proprietors_capital", 0)

    fields = {
        "projected_annual_turnover":       sales,
        "annual_purchases":                pur,
        "net_profit_after_tax":            npf,
        "depreciation":                    dep,
        "interest_expense":                intr,
        "inventory":                       stock,
        "sundry_debtors":                  deb,
        "sundry_creditors":                cred,
        "ebit":                            npf + intr,
        "current_assets":                  stock + deb + cash + oca,
        "current_liabilities":             cred + ocl,
        "total_outside_liabilities":       sec + unsec + cred + ocl,
        "tangible_net_worth":              cap,
        "declared_bank_statement_credits": sales,
    }

    assets = g("fixed_assets", 0) + g("investments", 0) + stock + deb + cash + oca
    liabs = cap + sec + unsec + cred + ocl
    op = g("opening_stock", 0); gp = g("gross_profit", 0); dx = g("direct_expenses", 0)
    checks = {
        "balance_sheet_balances": abs(assets - liabs) <= 2 if (assets and liabs) else None,
        "trading_account_balances": (abs((op + pur + dx + gp) - (sales + stock)) <= 2)
                                    if (op and gp and dx) else None,
    }

    missing = [k for k in REQUIRED if k not in r]
    checks_ok = all(v for v in checks.values() if v is not None)
    confidence = "high" if (not missing and checks_ok) else "review"
    return {"fields": fields, "raw_line_items": r, "checks": checks,
            "missing": missing, "confidence": confidence}


def parse_financial_statement(pdf_bytes: bytes) -> dict:
    """Parse an audited financial statement PDF into the msme_financials field set.

    Returns a review payload (see module docstring). Never writes to the DB.
    """
    return _derive_and_check(_extract_line_items(pdf_bytes))


# ----------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    res = parse_financial_statement(open(sys.argv[1], "rb").read())
    print("confidence:", res["confidence"])
    print("checks:", res["checks"])
    print("missing:", res["missing"])
    for k, v in res["fields"].items():
        print(f"  {k:32} {v:>14,}")
