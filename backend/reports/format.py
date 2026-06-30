# backend/reports/format.py
# Shared display formatters for generated documents: Indian-grouped rupees, ₹-crore,
# percentages, and dates. Every document's context builder uses these so figures read
# the same across the whole report set.

import re
from datetime import date, datetime


def inr(n) -> str:
    """Indian-grouped rupees, e.g. 24444909 -> '₹2,44,44,909'. None -> '—'."""
    if n is None:
        return "—"
    try:
        n = int(round(float(n)))
    except (TypeError, ValueError):
        return "—"
    neg = n < 0
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(?<=\d)(?=(\d\d)+$)", ",", head)
        s = f"{head},{tail}"
    return f"{'−' if neg else ''}₹{s}"


def cr(n) -> str:
    """Rupees -> ₹-crore value string, e.g. 24856947 -> '2.49'. None -> '—'."""
    if n is None:
        return "—"
    try:
        return f"{float(n) / 1e7:.2f}"
    except (TypeError, ValueError):
        return "—"


def pct1(x) -> str:
    return "—" if x is None else f"{x:.1f}%"


def fmt_long(d: date) -> str:
    return f"{d.day} {d.strftime('%B %Y')}"       # '30 June 2026'


def fmt_med(d: date) -> str:
    return f"{d.day} {d.strftime('%b %Y')}"        # '30 Jun 2026'


def fmt_med_str(s) -> str:
    try:
        return fmt_med(datetime.fromisoformat(str(s)[:10]).date())
    except Exception:
        return str(s or "")
