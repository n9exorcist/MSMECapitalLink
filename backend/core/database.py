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
    
    # Force HTTP/2 off globally before creating any httpx clients
    import httpx
    # Monkey-patch: disable HTTP/2 by default in httpx
    original_client_init = httpx.Client.__init__
    
    def patched_init(self, *args, **kwargs):
        kwargs['http2'] = False
        kwargs.setdefault('timeout', 30.0)
        original_client_init(self, *args, **kwargs)
    
    httpx.Client.__init__ = patched_init
    
    options = ClientOptions(
        schema="public",
        headers={"X-Client-Info": "supabase-py/2.0"},
        auto_refresh_token=False,
        persist_session=False,
    )
    
    return create_client(_URL, _KEY, options=options)


def get_db() -> Client:
    return _client()