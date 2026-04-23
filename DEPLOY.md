# Deploy Val OS to Vercel

End-to-end walkthrough: GitHub → Neon → Vercel. Budget ~20 minutes start to finish. Everything on free tiers.

---

## Prereqs

- A GitHub account.
- A Vercel account ([vercel.com/signup](https://vercel.com/signup)).
- A Neon account ([neon.tech](https://neon.tech)). Free tier is plenty.
- Python 3.11+ locally (only if you want to run the orchestrator off-Vercel for debugging).

You do **not** need to install the Vercel CLI — this walkthrough is GitHub-auto-deploy.

---

## 1. Push the repo to GitHub

```bash
cd val-os-vercel
git init
git add .
git commit -m "val os — initial vercel-ready commit"
gh repo create val-os-vercel --public --source=. --push
```

Or create the repo in the GitHub UI and `git remote add origin` + `git push -u origin main` manually.

**Sanity check:**

```bash
ls
# api/  orchestrator/  sql/  index.html  val-os.html  val-os-hackathon.html
# vercel.json  requirements.txt  .env.example  .gitignore  README.md  DEPLOY.md
```

---

## 2. Stand up Postgres on Neon

1. [console.neon.tech](https://console.neon.tech) → **New Project**.
2. Name it `val-os`. Region: whatever is closest to your Vercel region (usually `us-east-2` or `eu-central-1`).
3. Database name: `valos`.
4. Grab the **pooled** connection string from the dashboard. It looks like:
   ```
   postgresql://valos_owner:xxxxxxxx@ep-cool-name-12345.us-east-2.aws.neon.tech/valos?sslmode=require
   ```
   > Use the **pooler** URL, not the direct one. Serverless functions reconnect on every cold start — the pooler fronts PgBouncer so you don't blow through connection limits.

5. Load the schema + seeds. From the Neon SQL editor, paste `sql/schema.sql` and run it. Then paste `sql/seeds.sql` and run it.

   Or from your machine:
   ```bash
   psql "postgresql://valos_owner:xxxx@ep-xxx.neon.tech/valos?sslmode=require" -f sql/schema.sql
   psql "postgresql://valos_owner:xxxx@ep-xxx.neon.tech/valos?sslmode=require" -f sql/seeds.sql
   ```

6. Confirm seed data loaded:
   ```sql
   SELECT count(*) FROM founder_principles;  -- should be > 0
   ```

---

## 3. Import the repo into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → pick `val-os-vercel`.
2. **Framework preset:** `Other` (Vercel auto-detects `vercel.json`).
3. **Root Directory:** leave blank — the repo root is the project root.
4. **Build & Output Settings:** leave defaults. `vercel.json` handles everything.

Do **not** click Deploy yet — set env vars first, or the first build will 500 on `/api/*`.

---

## 4. Set environment variables in Vercel

Project → **Settings** → **Environment Variables**. Add these for the `Production`, `Preview`, and `Development` environments:

| Key | Value |
|---|---|
| `DATABASE_URL` | the Neon pooled DSN from step 2 |
| `DATABASE_URL_REQUIRES_SSL` | `true` |
| `WORKER_MODE` | `inline` |
| `ROUTER_MIN_CONFIDENCE` | `0.75` |
| `MAX_REVISIONS` | `2` |
| `MEMWB_MIN_CONFIDENCE` | `0.75` |
| `ENABLE_PERSIST_RUNS` | `false` |

Optional — only if you wire real Claude calls into `brain.py`:

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5` |

---

## 5. Deploy

Click **Deploy**. First build takes ~90 seconds because Vercel installs `fastapi`, `asyncpg`, and `httpx` into the function bundle. Subsequent deploys are faster thanks to cached layers.

Once the build finishes, you'll get a `https://val-os-vercel-<hash>.vercel.app` URL.

---

## 6. Smoke test

```bash
BASE="https://val-os-vercel-<hash>.vercel.app"

# Health
curl $BASE/api/healthz | jq
# → {"ok": true, "runtime": "vercel", "postgres": true, "worker_mode": "inline", ...}

# A real plan
curl -X POST $BASE/api/plan \
  -H 'content-type: application/json' \
  -d '{"raw_prompt":"Build a typed memory layer that beats RAG","auto_revise":true,"dispatch_workers":true}' \
  | jq '.critic, .revisions'
# → {"status":"approve","score":0.83,...}
# → 0  (or 1 if revision kicked in)

# Memory
curl "$BASE/api/memory?prompt=typed+memory" | jq '.rows | length'
# → >0 (if seeds loaded)
```

Then open `$BASE/app` in a browser. The page auto-detects same-origin `/api`. Flip **backend** on in the header and hit **Run** — you should see real stage outputs stream in and the critic badge flip to `approve` or `revise`.

---

## 7. Post-deploy

### GitHub auto-deploy

Every push to `main` deploys to Production. Every push to any other branch / PR gets a Preview URL — great for iterating on `brain.py` or the HTML without breaking production.

### Custom domain

Project → Settings → Domains → Add. Point a CNAME at `cname.vercel-dns.com`. The same-origin `/api` trick in `val-os.html` keeps working under any domain because the JS uses `location.origin`.

### Swap to real workers

When Manus / OpenClaw are deployed somewhere reachable (Fly, Railway, a dedicated worker VM), set:

```
WORKER_MODE=http
MANUS_BASE_URL=https://manus.<your domain>
OPENCLAW_BASE_URL=https://openclaw.<your domain>
```

No orchestrator code change needed — the dispatch path checks `worker_mode` at request time.

### Turn on `plan_runs` audit

If you want every run persisted to Postgres for later replay / eval:

```
ENABLE_PERSIST_RUNS=true
```

Keep in mind: this consumes the invocation's single usable DB connection for an extra write. On a chatty endpoint, budget accordingly.

---

## Troubleshooting

**`/api/healthz` returns 500**
Usually missing `DATABASE_URL` or wrong SSL flag. Check Vercel Logs (Project → Logs → Function) — the error message will include `asyncpg.ConnectionFailureError` or similar. Add `DATABASE_URL_REQUIRES_SSL=true` and redeploy.

**`postgres: false` with `postgres_error: "OSError: [SSL: WRONG_VERSION_NUMBER]"`**
You pointed Vercel at the direct (non-pooled) DSN, or your Neon project's DSN is `sslmode=disable`. Grab the pooled DSN from Neon; make sure `sslmode=require` is in it.

**`ModuleNotFoundError: No module named 'orchestrator'`**
The `api/index.py` entrypoint expects `orchestrator/` at the project root. If you moved it, update the import: `from <newpath>.main import app`.

**Cold starts feel slow**
Vercel's Python runtime cold-starts in ~1.5s. After the first request, subsequent requests to the same region reuse the process for ~5 minutes. If it matters, bump `WORKER_MODE=inline` (no outbound calls) and keep `ENABLE_PERSIST_RUNS=false` — you'll trim the invocation down to the critical path.

**CORS errors in the browser console**
Shouldn't happen — `val-os.html` and `/api/*` share the same origin. If you're hitting the API from a different domain, add that origin to the `CORSMiddleware` allow-list in `orchestrator/main.py`.

**Built successfully but `/app` 404s**
`vercel.json` maps `/app` to `val-os.html`. If you renamed the HTML file, update both the `builds` and `routes` entries.

---

## What's next

- **Swap brain.py stubs for real Claude calls.** The 11 stage functions are pure Python today — replace `intent()`, `scope()`, `architect()`, etc. with prompts to the Anthropic API. The shapes stay the same so nothing else breaks.
- **Add auth.** Vercel has built-in password protection for Preview deploys; for Production, put Clerk / Auth.js / Cloudflare Access in front of `/app`.
- **Add eval.** With `ENABLE_PERSIST_RUNS=true` you build up a corpus of `(raw_prompt, bundle, critic)` triples. That's a regression test set for every change to `brain.py`.
