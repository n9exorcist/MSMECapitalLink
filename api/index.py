# api/index.py
import sys
import os

# Add parent directory to path so we can import backend
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app

# Vercel expects a handler for Serverless Functions, but for ASGI apps
# we need to export the app directly
# The variable name MUST be 'app' for Vercel's Python runtime to detect it