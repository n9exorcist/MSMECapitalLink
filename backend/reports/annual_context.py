# backend/reports/annual_context.py
# build_annual_review_context(db, msme_id) → Jinja vars for the Annual Business Review.
# Reuses the health-report context (financial snapshot, scorecard, ratios, GST trend,
# margins, score) and layers on year-ahead priorities from the migration plan, so it
# stays DRY — no re-formatting of figures already produced elsewhere.

from reports.context import build_health_report_context
from reports.migration_context import _detail
from services.read_model import build_read_model
from services.migration import build_plan


def build_annual_review_context(db, msme_id: str) -> dict:
    ctx = dict(build_health_report_context(db, msme_id))   # rich, pre-formatted base
    rm = build_read_model(db, msme_id)
    plan = build_plan(rm)

    priorities = [{
        "name": m.name,
        "detail": _detail(m.component, rm),
        "impact": f"+{m.impact:.1f}",
        "kind": "Unlock" if not m.evidenced else "Improve",
    } for m in plan.moves[:4]]

    delta = plan.projected_score - plan.current_score
    ctx.update({
        "priorities": priorities,
        "has_priorities": bool(priorities),
        "projected_score": plan.projected_score,
        "projected_delta": f"+{delta}" if delta > 0 else str(delta),
    })
    return ctx
