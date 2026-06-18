# backend/core/database.py
# Supabase connection for the whole backend. Exposes get_db() -> Client.
# Uses the SERVICE-ROLE key so the backend can read/write every client,
# bypassing RLS. NEVER expose the service key to the browser / owner app.
#
# Replace the mock-bridge router that is currently in this file with this.

import os
from functools import lru_cache
from supabase import create_client, Client

try:
    from core.config import settings  # type: ignore
    _URL = getattr(settings, "SUPABASE_URL", None) or os.environ.get("SUPABASE_URL")
    _KEY = (getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)
            or getattr(settings, "SUPABASE_SERVICE_KEY", None)
            or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_KEY"))
except Exception:
    _URL = os.environ.get("SUPABASE_URL")
    _KEY = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            or os.environ.get("SUPABASE_SERVICE_KEY"))


@lru_cache(maxsize=1)
def _client() -> Client:
    if not _URL or not _KEY:
        raise RuntimeError(
            "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "in backend/.env (service-role key, server-side only)."
        )
    return create_client(_URL, _KEY)


def get_db() -> Client:
    """FastAPI dependency: `db = Depends(get_db)`."""
    return _client()