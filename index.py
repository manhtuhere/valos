"""Vercel Python entrypoint.

Vercel's @vercel/python builder turns each .py file under /api into a
serverless function. This file is the single handler — it imports the
FastAPI app from orchestrator.main so all /api/* routes live on one
function (cheaper cold starts, shared settings cache).

The app already mounts its routes under /api via APIRouter(prefix="/api"),
so when Vercel routes /api/* to this file, the FastAPI routing matches.
"""
from orchestrator.main import app  # noqa: F401

# Vercel's python runtime looks for a top-level `app` (ASGI) or `handler`.
# Exporting `app` is enough — no need for Mangum or a custom handler.
