# Deploy Val OS to Vercel

End-to-end walkthrough: GitHub → Neon → Vercel. Budget ~20 minutes start to finish. Everything on free tiers.

---

## Prereqs

- A GitHub account.
- A Vercel account ([vercel.com/signup](https://vercel.com/signup)).
- A Neon account ([neon.tech](https://neon.tech)). Free tier is plenty.
- Python 3.11+ and Node 18+ locally.

You do **not** need to install the Vercel CLI — this walkthrough is GitHub-auto-deploy.

---

## Local development

**Backend (FastAPI):**
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in DATABASE_URL if you have Postgres locally
uvicorn main:app --reload --port 8080
```

**Frontend (React + Vite):**
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173
```

The frontend dev server proxies nothing — flip the **backend** toggle in the UI header and point it at `http://localhost:8080` to hit your local FastAPI.

---

## 1. Push the repo to GitHub

```bash
git init
git add .
git commit -m "val os — initial commit"
gh repo create val-os --public --source=. --push
```

**Sanity check:**
```bash
ls
# main.py  brain.py  schemas.py  memory.py  workers.py  config.py
# index.py  schema.sql  seeds.sql  frontend/  index.html
# vercel.json  requirements.txt  .env.example  .gitignore
```

---

## 2. Stand up Postgres on Neon

1. [console.neon.tech](https://console.neon.tech) → **New Project**.
2. Name it `val-os`. Region: closest to your Vercel region (`us-east-2` or `eu-central-1`).
3. Database name: `valos`.
4. Grab the **pooled** connection string:
   ```
   postgresql://valos_owner:xxxxxxxx@ep-cool-name-12345.us-east-2.aws.neon.tech/valos?sslmode=require
   ```
   > Use the **pooler** URL, not the direct one — serverless cold starts reconnect on every invocation.

5. Load schema + seeds. From the Neon SQL editor or locally:
   ```bash
   psql "postgresql://valos_owner:xxxx@ep-xxx.neon.tech/valos?sslmode=require" -f schema.sql
   psql "postgresql://valos_owner:xxxx@ep-xxx.neon.tech/valos?sslmode=require" -f seeds.sql
   ```

6. Confirm:
   ```sql
   SELECT count(*) FROM founder_principles;  -- should be > 0
   ```

---

## 3. Build the frontend

The React app lives in `frontend/`. Build it before deploying:

```bash
cd frontend && npm install && npm run build
```

Output lands in `frontend/dist/`. Commit it:

```bash
git add frontend/dist
git commit -m "build: frontend dist"
```

> For CI/CD, add a Vercel build command: `cd frontend && npm install && npm run build`. Set **Root Directory** to the repo root and **Output Directory** to `frontend/dist` for the static output.

---

## 4. Import the repo into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `val-os`.
2. **Framework preset:** `Other`.
3. **Root Directory:** leave blank.
4. **Build & Output Settings:** leave defaults — `vercel.json` handles routing.

Do **not** click Deploy yet.

---

## 5. Set environment variables in Vercel

Project → **Settings** → **Environment Variables**. Add for `Production`, `Preview`, and `Development`:

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon pooled DSN from step 2 |
| `DATABASE_URL_REQUIRES_SSL` | `true` |
| `WORKER_MODE` | `inline` |
| `ROUTER_MIN_CONFIDENCE` | `0.75` |
| `MAX_REVISIONS` | `2` |
| `MEMWB_MIN_CONFIDENCE` | `0.75` |
| `ENABLE_PERSIST_RUNS` | `false` |

Optional (only needed once brain.py stubs are replaced with real Claude calls):

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` |

---

## 6. Deploy

Click **Deploy**. First build takes ~90s (installs `fastapi`, `asyncpg`, `httpx`). Subsequent deploys are faster with cached layers.

---

## 7. Smoke test

```bash
BASE="https://val-os-<hash>.vercel.app"

# Health
curl $BASE/api/healthz | jq
# → {"ok": true, "runtime": "vercel", "postgres": true, "worker_mode": "inline", ...}

# Plan
curl -X POST $BASE/api/plan \
  -H 'content-type: application/json' \
  -d '{"raw_prompt":"Build a typed memory layer that beats RAG","auto_revise":true,"dispatch_workers":true}' \
  | jq '.critic, .revisions'
# → {"status":"approve","score":0.83,...}

# Memory
curl "$BASE/api/memory?prompt=typed+memory" | jq '.rows | length'
# → >0 (if seeds loaded)
```

Open `$BASE/app` in a browser. Flip **backend** on in the header and hit **Run**.

---

## 8. Post-deploy

### GitHub auto-deploy
Every push to `main` deploys to Production. Every PR gets a Preview URL.

### Custom domain
Project → Settings → Domains → Add. Point a CNAME at `cname.vercel-dns.com`. The same-origin `/api` trick in the React app keeps working under any domain.

### Swap to real workers
When Manus / OpenClaw are deployed:
```
WORKER_MODE=http
MANUS_BASE_URL=https://manus.<your-domain>
OPENCLAW_BASE_URL=https://openclaw.<your-domain>
```
No code change needed.

### Turn on plan_runs audit
```
ENABLE_PERSIST_RUNS=true
```
Consumes the invocation's DB connection for an extra write — budget accordingly.

---

## Troubleshooting

**`/api/healthz` returns 500**
Missing `DATABASE_URL` or wrong SSL flag. Check Vercel Logs → Function. Add `DATABASE_URL_REQUIRES_SSL=true` and redeploy.

**`postgres: false` with `SSL: WRONG_VERSION_NUMBER`**
You're using the direct DSN instead of the pooled one. Grab the pooler URL from Neon; ensure `sslmode=require` is in it.

**`ImportError: attempted relative import with no known parent package`**
The Python modules use absolute imports — run from the repo root with `uvicorn main:app`, not `uvicorn orchestrator.main:app`.

**Cold starts feel slow**
Vercel Python cold-starts in ~1.5s then reuses the process for ~5 minutes. Keep `WORKER_MODE=inline` and `ENABLE_PERSIST_RUNS=false` to stay on the critical path.

**CORS errors in the browser console**
Shouldn't happen from `$BASE/app` — same origin. If hitting from a different domain, add it to `CORSMiddleware` `allow_origins` in `main.py`.

**`/app` 404s**
`vercel.json` maps `/app` to the frontend. If the `frontend/dist/` build wasn't committed or the route is misconfigured, redeploy after running `cd frontend && npm run build` and committing `frontend/dist/`.

---

## What's next

- **Swap brain.py stubs for real Claude calls.** Each stage function is pure Python today — replace `intent()`, `scope()`, `architect()`, etc. with prompts to the Anthropic API. Shapes stay the same.
- **Add auth.** Vercel password protection for Preview; Clerk / Auth.js / Cloudflare Access for Production.
- **Add eval.** With `ENABLE_PERSIST_RUNS=true` you build up `(raw_prompt, bundle, critic)` triples — a regression test set for every change to `brain.py`.
