import sys
import os

# Vercel runs from repo root, but add it explicitly so relative imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app  # noqa: E402 — must be after sys.path patch
