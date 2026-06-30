# backend/reports/render_cli.py
# Subprocess entry point: render an HTML file → a PDF file with sync Playwright.
#
# Run as a FRESH process (python -m reports.render_cli <in.html> <out.pdf>) so
# Playwright gets its own main-thread Proactor loop and can launch Chromium. This is
# how the FastAPI route renders without hitting the uvicorn-loop NotImplementedError
# (see reports/render.py).

import sys

from reports.render import html_to_pdf


def main() -> int:
    if len(sys.argv) != 3:
        sys.stderr.write("usage: python -m reports.render_cli <in.html> <out.pdf>\n")
        return 2
    in_path, out_path = sys.argv[1], sys.argv[2]
    with open(in_path, "r", encoding="utf-8") as f:
        html = f.read()
    pdf = html_to_pdf(html)
    with open(out_path, "wb") as f:
        f.write(pdf)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
