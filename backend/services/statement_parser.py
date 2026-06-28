"""services/statement_parser.py

Parse Indian bank-statement PDFs into cash-position figures.

Order of attack:
  1. Embedded text layer (pdfplumber) — fast and exact for net-banking PDFs.
  2. OCR fallback (tesseract + poppler) — for scanned / "Print to PDF" statements.

Targets ICICI 'Detailed Statement' (the trailing summary block:
Opening Bal / Withdrawls / Deposits / Closing Bal) and degrades gracefully:
if nothing parses (incl. OCR binaries missing), returns parsed=False so the
caller can store the file for manual entry instead of crashing.
"""
from __future__ import annotations
import io, os, re, glob, tempfile, subprocess
from datetime import datetime

NUM = r"-?[\d,]+\.\d{2}"


def _num(s: str) -> float:
    return float(s.replace(",", "").replace(" ", ""))


def _find(labels, text):
    """First number that follows any of the given labels."""
    for lab in labels:
        m = re.search(lab + r"[^\d\-]{0,20}(" + NUM + r")", text, re.I)
        if m:
            return _num(m.group(1))
    return None


def _period(text):
    m = re.search(
        r"From[:\s]*?(\d{2}[/-]\d{2}[/-]\d{4}).*?To[:\s]*?(\d{2}[/-]\d{2}[/-]\d{4})",
        text, re.I | re.S,
    )
    if not m:
        return None, None

    def pd(s):
        for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                pass
        return None

    return pd(m.group(1)), pd(m.group(2))


def _text_layer(pdf_bytes: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    except Exception:
        return ""


def _ocr_tail(pdf_bytes: bytes, last_n: int = 3) -> str:
    """OCR the last few pages (the summary lives at the end). Needs tesseract + poppler."""
    import pytesseract
    from PIL import Image
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "in.pdf")
        with open(p, "wb") as f:
            f.write(pdf_bytes)
        info = subprocess.run(["pdfinfo", p], capture_output=True, text=True)
        mm = re.search(r"Pages:\s*(\d+)", info.stdout)
        pages = int(mm.group(1)) if mm else 1
        first = max(1, pages - last_n + 1)
        subprocess.run(
            ["pdftoppm", "-r", "300", "-png", "-f", str(first), "-l", str(pages),
             p, os.path.join(d, "pg")],
            check=True,
        )
        return "\n".join(
            pytesseract.image_to_string(Image.open(img), config="--psm 6")
            for img in sorted(glob.glob(os.path.join(d, "pg-*.png")))
        )


def parse_bank_statement(pdf_bytes: bytes) -> dict:
    text = _text_layer(pdf_bytes)
    method = "text"
    if len(re.findall(NUM, text)) < 4:          # no usable text layer → OCR
        try:
            text = _ocr_tail(pdf_bytes)
            method = "ocr"
        except Exception:
            method = "ocr_unavailable"          # binaries missing → manual entry

    closing     = _find([r"Closing Bal", r"Closing Balance"], text)
    opening     = _find([r"Opening Bal", r"Opening Balance"], text)
    withdrawals = _find([r"Withdrawls", r"Withdrawals", r"Total Withdrawal", r"Total Debit"], text)
    deposits    = _find([r"Deposits", r"Total Deposit", r"Total Credit"], text)
    pf, pt      = _period(text)

    parsed = closing is not None and withdrawals is not None and deposits is not None

    # The running-balance identity is a free accuracy check on the OCR.
    confidence = "low"
    if parsed and opening is not None and abs((opening + deposits - withdrawals) - closing) <= 2.0:
        confidence = "high"
    elif parsed:
        confidence = "medium"

    days  = (pt - pf).days + 1 if (pf and pt) else None
    daily = round(withdrawals / days, 2) if (withdrawals is not None and days) else None

    return {
        "parsed": parsed,
        "method": method,
        "confidence": confidence,
        "closing_balance": closing,
        "opening_balance": opening,
        "total_inflow": deposits,
        "total_outflow": withdrawals,
        "avg_daily_outflow": daily,
        "account_type": "cc_od" if (closing is not None and closing < 0) else "current",
        "accounts_count": 1,
        "period_from": pf.isoformat() if pf else None,
        "period_to": pt.isoformat() if pt else None,
        "days": days,
    }