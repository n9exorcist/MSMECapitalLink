# backend/reports/render.py
# HTML→PDF via Jinja2 + Playwright/Chromium. We deliberately use Chromium (not
# WeasyPrint) so the approved print-CSS template — flexbox/grid/gradients/box-shadow
# — renders pixel-faithfully.
#
# WHY A SEPARATE PROCESS (and not async/sync in-process):
#   Playwright launches Chromium via an asyncio subprocess that needs a main-thread
#   ProactorEventLoop. Under uvicorn (esp. --reload) the request runs on a loop that
#   can't spawn it — BOTH the sync API in a worker thread AND the async API on the
#   request loop raise NotImplementedError, even with the Proactor policy forced
#   (verified). So all server rendering happens in a separate process.
#
# The FastAPI route calls render_health_report_pdf_warm(), which renders the Jinja
# HTML here and ships it to a PERSISTENT warm worker (reports/render_pool.py +
# render_worker.py) — Chromium stays open across requests, so each report is a few
# seconds, not a cold launch.
#
# html_to_pdf()/render_health_report_pdf() are a sync, one-shot path for offline
# scripts/tests run on the main thread; they are NOT used by the server.

from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATES_DIR = Path(__file__).parent / "templates"

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

# pdf() options — honor the template's @page size and keep the gradients/pill fills.
# Mirrored in reports/render_worker.py (the warm path) — keep them in sync.
_PDF_OPTS = {"print_background": True, "prefer_css_page_size": True}


def render_html(template_name: str, context: dict) -> str:
    """Render a Jinja template in reports/templates/ to an HTML string."""
    return _env.get_template(template_name).render(**context)


# ── server path: render on the persistent warm worker ───────────────────────
def render_health_report_pdf_warm(context: dict) -> bytes:
    """Render the report via the warm worker pool. Blocking — call from the route via
    run_in_threadpool."""
    from reports.render_pool import render_pdf
    return render_pdf(render_html("health_report.html", context))


# ── offline path: one-shot sync render (main thread only) ───────────────────
def html_to_pdf(html: str) -> bytes:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            page = browser.new_page()
            page.set_content(html, wait_until="load")
            page.emulate_media(media="print")
            return page.pdf(**_PDF_OPTS)
        finally:
            browser.close()


def render_health_report_pdf(context: dict) -> bytes:
    return html_to_pdf(render_html("health_report.html", context))
