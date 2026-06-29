"""services/gstr3b.py

Parse Indian GSTR-3B PDFs into turnover + filing figures.

Mirrors statement_parser.py:
  * text-first via pdfplumber (no external binaries -> works on Windows + Railway)
  * graceful failure: returns parsed=False so the caller stores the file for
    manual entry instead of crashing
  * PURE parser, NO database writes — the router persists (as it does for cash_position)

Validated against Sri Sai's 12 real GSTR-3B returns.
"""
from __future__ import annotations
import io, re
from datetime import date

NUM = r"-?[\d,]+\.\d{2}"
MONTHS = ["April", "May", "June", "July", "August", "September",
          "October", "November", "December", "January", "February", "March"]
_CAL = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]
_MONTH_RE = "|".join(MONTHS)


def _num(s: str) -> float:
    try:
        return float(s.replace(",", "").replace(" ", ""))
    except Exception:
        return 0.0


def _text_layer(pdf_bytes: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    except Exception:
        return ""


def _date(s: str):
    m = re.match(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s.strip())
    if not m:
        return None
    d, mo, y = map(int, m.groups())
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def _due_date(period: str, fy_start: int, frequency: str):
    if period not in MONTHS:
        return None
    cal = _CAL[MONTHS.index(period)]
    yr = fy_start if cal >= 4 else fy_start + 1
    if frequency == "monthly":
        dm, dy = (1, yr + 1) if cal == 12 else (cal + 1, yr)
        return date(dy, dm, 20)
    if cal not in {6, 9, 12, 3}:
        return None
    dm, dy = (1, yr + 1) if cal == 12 else (cal + 1, yr)
    return date(dy, dm, 22)  # QRMP: 22nd or 24th by state group


def _parse_text(text: str, filing_frequency: str = "monthly") -> dict:
    out = {"parsed": False, "warnings": [], "period_from": None, "period_to": None}
    if "Outward taxable supplies" not in text:
        out["reason"] = "no readable GSTR-3B text layer"
        return out

    def g1(pat):
        m = re.search(pat, text, re.I)
        return m.group(1).strip() if m else ""

    gstin = g1(r"GSTIN of the supplier\s+(\w{15})")
    period = g1(rf"Period\s+({_MONTH_RE})")
    fy = g1(r"Year\s+(\d{4}-\d{2})")
    arn = g1(r"2\(c\)\.\s*ARN\s+(\S+)")
    filed = _date(g1(r"Date of ARN\s+(\d{1,2}[/-]\d{1,2}[/-]\d{4})"))

    # Table 3.1(a): pdfplumber may place the 5 numbers on the (a) line itself
    # (before "exempted)" wraps) OR on the next line. Read the (a) line first,
    # and stop before row (b) so we never grab (b)'s zeros.
    m = re.search(r"\(a\)\s*Outward taxable supplies.*?(?=\(b\))", text, re.S | re.I)
    nums = re.findall(NUM, m.group(0))[:5] if m else []
    if not nums:
        out["warnings"].append("3.1(a) numbers not found")
    revenue = _num(nums[0]) if nums else 0.0
    igst = _num(nums[1]) if len(nums) > 1 else 0.0
    cgst = _num(nums[2]) if len(nums) > 2 else 0.0
    sgst = _num(nums[3]) if len(nums) > 3 else 0.0
    cess = _num(nums[4]) if len(nums) > 4 else 0.0
    total_tax = round(igst + cgst + sgst + cess, 2)

    if period not in MONTHS or not re.match(r"\d{4}", fy):
        out["warnings"].append("period/FY not read; cannot date the row")
        out["gstin"] = gstin
        return out

    cal = _CAL[MONTHS.index(period)]
    fy_start = int(fy[:4])
    period_year = fy_start if cal >= 4 else fy_start + 1
    month = f"{period_year}-{cal:02d}-01"

    due = _due_date(period, fy_start, filing_frequency)
    status, days_late = "filed", 0
    if filed and due:
        days_late = max(0, (filed - due).days)
        status = "late" if days_late > 0 else "filed"

    out.update({
        "parsed": revenue is not None and len(nums) >= 1,
        "gstin": gstin,
        "period_label": f"{period} {period_year}",
        "month": month,
        "period_from": month,            # keeps documents.py update line happy
        "period_to": month,
        "revenue": revenue,
        "cgst": cgst, "sgst": sgst, "igst": igst,
        "total_tax": total_tax,
        "arn": arn,
        "filed_date": filed.isoformat() if filed else None,
        "due_date": due.isoformat() if due else None,
        "status": status,
        "days_late": days_late,
    })
    return out


def parse_gstr3b(pdf_bytes: bytes, filing_frequency: str = "monthly") -> dict:
    """Public entry — mirrors parse_bank_statement(raw)."""
    return _parse_text(_text_layer(pdf_bytes), filing_frequency)