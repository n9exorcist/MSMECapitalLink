# backend/reports/render_pool.py
# Process-wide singleton that owns ONE persistent render worker (reports/render_worker.py)
# and serializes HTML→PDF jobs to it, keeping Chromium warm so each report renders in a
# few seconds instead of paying a cold browser launch every request.
#
# Thread-safe: the FastAPI route calls render_pdf() inside run_in_threadpool, possibly
# concurrently — a lock serializes access to the single worker. The worker is started
# lazily (or pre-warmed at app startup, see main.py) and auto-restarted if it dies, with
# a one-shot retry. A genuine render error (bad template/content) is NOT retried — the
# worker is healthy, the input isn't.

import os
import sys
import struct
import threading
import subprocess
import tempfile
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent.parent      # .../backend (so `-m reports.*` resolves)
_NO_WINDOW = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0


def _read_exact(f, n):
    buf = b""
    while len(buf) < n:
        chunk = f.read(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


class _RenderPool:
    def __init__(self):
        self._proc = None
        self._errlog_path = None
        self._lock = threading.Lock()

    def _alive(self):
        return self._proc is not None and self._proc.poll() is None

    def _start(self):
        # stderr → a temp file (a PIPE we don't drain could fill and block; a file can't)
        errlog = tempfile.NamedTemporaryFile(
            prefix="mfos_render_worker_", suffix=".log", delete=False)
        self._errlog_path = errlog.name
        self._proc = subprocess.Popen(
            [sys.executable, "-m", "reports.render_worker"],
            cwd=str(_BACKEND_DIR),
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errlog,
            creationflags=_NO_WINDOW,
        )
        errlog.close()   # the child process holds its own handle

    def _kill(self):
        if self._proc is not None:
            try:
                self._proc.kill()
            except Exception:
                pass
            self._proc = None

    def _errtail(self):
        try:
            with open(self._errlog_path, "r", encoding="utf-8", errors="replace") as f:
                t = f.read().strip()
            return f" | worker stderr: {t[-600:]}" if t else ""
        except Exception:
            return ""

    def render(self, html: str) -> bytes:
        data = html.encode("utf-8")
        with self._lock:
            io_err = None
            for attempt in (1, 2):
                if not self._alive():
                    self._start()
                try:
                    self._proc.stdin.write(struct.pack(">I", len(data)))
                    self._proc.stdin.write(data)
                    self._proc.stdin.flush()
                    hdr = _read_exact(self._proc.stdout, 5)
                    if hdr is None:
                        raise EOFError("worker closed the pipe")
                    status, length = struct.unpack(">BI", hdr)
                    payload = _read_exact(self._proc.stdout, length)
                    if payload is None:
                        raise EOFError("worker truncated response")
                except (OSError, EOFError) as e:    # worker died / pipe broke → restart + retry
                    io_err = e
                    self._kill()
                    continue
                if status != 0:                      # worker healthy, content failed → no retry
                    raise RuntimeError("render worker error: "
                                       + payload.decode("utf-8", "replace")[-600:])
                return payload
            raise RuntimeError(f"render worker unavailable: {io_err}{self._errtail()}")

    def shutdown(self):
        with self._lock:
            if self._proc is not None and self._proc.stdin:
                try:
                    self._proc.stdin.close()    # EOF → worker exits its loop cleanly
                except Exception:
                    pass
            self._kill()


_pool = _RenderPool()


def render_pdf(html: str) -> bytes:
    """Render HTML→PDF on the warm worker (thread-safe, serialized)."""
    return _pool.render(html)


def prewarm() -> None:
    """Start the worker + launch Chromium ahead of the first real request. Best-effort."""
    try:
        _pool.render("<!doctype html><html><body>warm</body></html>")
    except Exception:
        pass


def shutdown() -> None:
    """Stop the worker (called on app shutdown)."""
    _pool.shutdown()
