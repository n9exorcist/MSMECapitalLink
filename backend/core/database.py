# backend/core/database.py

import os
from functools import lru_cache
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions

try:
    from core.config import settings
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
            "Supabase not configured. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY in backend/.env"
        )
    # http2=False prevents "Server disconnected" on connection reuse
    options = ClientOptions(http2=False)
    return create_client(_URL, _KEY, options)


def get_db() -> Client:
    return _client()