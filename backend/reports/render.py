# backend/reports/render.py
# HTML→PDF via Jinja2 + Playwright/Chromium. We deliberately use Chromium (not
# WeasyPrint) so the approved print-CSS template — flexbox/grid/gradients/box-shadow
# — renders pixel-faithfully.
#
# WHY A SUBPROCESS (and not async/sync in-process):
#   Playwright launches Chromium via an asyncio subprocess. On Windows that needs a
#   main-thread ProactorEventLoop. Under uvicorn (esp. --reload) the request runs on
#   a loop that can't spawn it — BOTH the sync API in a worker thread AND the async
#   API on the request loop raise `NotImplementedError`, with or without forcing the
#   Proactor policy (verified). Rendering in a separate OS process via subprocess.run
#   sidesteps the whole problem: the child gets a fresh main-thread Proactor loop, and
#   subprocess.run itself uses no asyncio, so it's immune to the server's loop.
#   render_health_report_pdf_subprocess() is what the FastAPI route calls.
#
#   html_to_pdf() (sync) is the actual renderer; it runs in the child process (and is
#   reusable by offline scripts on the main thread). It is NOT safe to call from the
#   server process.

import os
import sys
import subprocess
import tempfile
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATES_DIR = Path(__file__).parent / "templates"
_BACKEND_DIR = Path(__file__).parent.parent      # .../backend (so `-m reports.*` resolves)

_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATES_DIR)),
    autoescape=select_autoescape(["html", "xml"]),
)

_PDF_OPTS = {"print_background": True, "prefer_css_page_size": True}


def render_html(template_name: str, context: dict) -> str:
    """Render a Jinja template in reports/templates/ to an HTML string."""
    return _env.get_template(template_name).render(**context)


def html_to_pdf(html: str) -> bytes:
    """Sync Chromium render. Runs in the render subprocess (or offline, main thread).
    Do NOT call from the uvicorn server process — see module docstring."""
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
    """Offline/main-thread convenience: render the report directly (no subprocess)."""
    return html_to_pdf(render_html("health_report.html", context))


def render_health_report_pdf_subprocess(context: dict) -> bytes:
    """Render the report in a fresh process — the server-safe path. Blocking; call via
    run_in_threadpool from the async route. Child stdout/stderr go to a FILE, not a
    PIPE: Chromium's helper processes can hold an inherited pipe open and deadlock
    subprocess.run, whereas a file handle never blocks."""
    html = render_html("health_report.html", context)
    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, "report.html")
        out_path = os.path.join(td, "report.pdf")
        log_path = os.path.join(td, "render.log")
        with open(in_path, "w", encoding="utf-8") as f:
            f.write(html)
        with open(log_path, "w+", encoding="utf-8", errors="replace") as logf:
            proc = subprocess.run(
                [sys.executable, "-m", "reports.render_cli", in_path, out_path],
                cwd=str(_BACKEND_DIR), stdout=logf, stderr=subprocess.STDOUT, timeout=120,
            )
            logf.seek(0)
            output = logf.read().strip()
        if proc.returncode != 0 or not os.path.exists(out_path):
            raise RuntimeError(
                f"render subprocess exited {proc.returncode}: {output[-1000:] or '(no output)'}"
            )
        with open(out_path, "rb") as f:
            return f.read()
