# This is the Vercel entrypoint
import sys
import os

# Add backend to Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from backend.main import app

# Vercel expects a WSGI/ASGI callable named 'app'
# FastAPI's app is already ASGI-compatible