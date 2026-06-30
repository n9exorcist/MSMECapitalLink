# backend/reports/render_worker.py
# Long-lived render worker: keeps ONE Chromium instance warm and renders HTML→PDF
# jobs fed over stdin, returning PDF bytes over stdout. Launched and managed by
# reports/render_pool.py. Running as a separate process keeps Chromium off the
# uvicorn event loop (see render.py) AND amortizes the browser cold-start (slow on
# Windows) across every report instead of paying it per request.
#
# Wire protocol (binary, length-prefixed, big-endian):
#   request  (pool → worker):  [uint32 len][html utf-8]
#   response (worker → pool):  [uint8 status][uint32 len][payload]
#       status 0 = ok,  payload = PDF bytes
#       status 1 = err, payload = utf-8 error message  (worker stays alive)
# A short read on stdin (parent closed the pipe / died) ends the loop → clean exit,
# so the worker never orphans when the server stops.

import os
import sys
import struct

# keep in sync with reports.render._PDF_OPTS
_PDF_OPTS = {"print_background": True, "prefer_css_page_size": True}


def _set_binary(stream):
    # On Windows, stdio fds default to text mode and translate \n→\r\n, which would
    # corrupt the binary frames / PDF bytes. Force binary.
    if os.name == "nt":
        import msvcrt
        msvcrt.setmode(stream.fileno(), os.O_BINARY)


def _read_exact(f, n):
    buf = b""
    while len(buf) < n:
        chunk = f.read(n - len(buf))
        if not chunk:
            return None          # EOF — parent gone
        buf += chunk
    return buf


def main() -> int:
    from playwright.sync_api import sync_playwright
    stdin, stdout = sys.stdin.buffer, sys.stdout.buffer
    _set_binary(sys.stdin)
    _set_binary(sys.stdout)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            while True:
                hdr = _read_exact(stdin, 4)
                if hdr is None:
                    return 0
                (length,) = struct.unpack(">I", hdr)
                body = _read_exact(stdin, length)
                if body is None:
                    return 0
                try:
                    page = browser.new_page()
                    try:
                        page.set_content(body.decode("utf-8"), wait_until="load")
                        page.emulate_media(media="print")
                        pdf = page.pdf(**_PDF_OPTS)
                    finally:
                        page.close()
                    stdout.write(struct.pack(">BI", 0, len(pdf)))
                    stdout.write(pdf)
                except Exception as e:  # noqa: BLE001 — report, keep serving
                    msg = f"{type(e).__name__}: {e}".encode("utf-8", "replace")
                    stdout.write(struct.pack(">BI", 1, len(msg)))
                    stdout.write(msg)
                stdout.flush()
        finally:
            browser.close()


if __name__ == "__main__":
    raise SystemExit(main())
