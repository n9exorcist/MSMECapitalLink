import os
from supabase import create_client, Client
from core.config import settings

# Grab the credentials from your .env file
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials not found in environment variables.")

# Create the global Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_db():
    """
    Dependency injection function to get the Supabase client in routers.
    Usage: db: Client = Depends(get_db)
    """
    return supabase