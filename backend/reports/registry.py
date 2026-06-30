# backend/reports/registry.py
# The document catalog. Maps a doc key (URL slug) to how to build it: a context builder
# (which reads the shared services.read_model), a Jinja template, and the download
# filename. The GET /msme/{id}/documents/{key} route and the console's tile wall both
# read this — so adding a document is: write a template + a context builder, then add one
# DocSpec here. No route or wiring changes per document.

from dataclasses import dataclass
from typing import Callable, Dict

from reports.context import build_health_report_context
from reports.wc_context import build_wc_renewal_context
from reports.migration_context import build_migration_context
from reports.annual_context import build_annual_review_context
from reports.bank_proposal_context import build_bank_proposal_context


@dataclass(frozen=True)
class DocSpec:
    key: str                      # URL slug, e.g. "health"
    title: str                    # console tile label
    subtitle: str                 # console tile sub-label
    template: str                 # Jinja template in reports/templates/
    context_builder: Callable     # (db, msme_id) -> dict  (must include "client_name")
    filename_prefix: str          # download filename prefix


REGISTRY: Dict[str, DocSpec] = {
    "health": DocSpec(
        key="health",
        title="MSME Health Report",
        subtitle="4–9 pp · for the owner",
        template="health_report.html",
        context_builder=build_health_report_context,
        filename_prefix="MFOS_Health_Report",
    ),
    "wc_renewal": DocSpec(
        key="wc_renewal",
        title="WC Limit Renewal",
        subtitle="5–8 pp · CC/OD renewal",
        template="wc_limit_renewal.html",
        context_builder=build_wc_renewal_context,
        filename_prefix="MFOS_WC_Limit_Assessment",
    ),
    "migration": DocSpec(
        key="migration",
        title="Migration Pathway Plan",
        subtitle="6–8 pp · NBFC → PSU",
        template="migration_pathway.html",
        context_builder=build_migration_context,
        filename_prefix="MFOS_Migration_Pathway",
    ),
    "annual_review": DocSpec(
        key="annual_review",
        title="Annual Business Review",
        subtitle="10–15 pp · year-end",
        template="annual_review.html",
        context_builder=build_annual_review_context,
        filename_prefix="MFOS_Annual_Review",
    ),
    "bank_proposal": DocSpec(
        key="bank_proposal",
        title="Bank Proposal Pack",
        subtitle="25–30 pp · credit committee",
        template="bank_proposal.html",
        context_builder=build_bank_proposal_context,
        filename_prefix="MFOS_Bank_Proposal",
    ),
}


def get_spec(key: str):
    return REGISTRY.get(key)
