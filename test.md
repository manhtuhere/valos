# Val OS — Manual Test Guide

## Test Prompt (Manus-targeted)

Paste this into the intake panel:

```
Build a Layer 3 semantic correction pipeline for Malay/English code-switched
sales calls. The pipeline must take raw MERaLiON transcripts, identify intent
and sentiment per speaker turn, and output structured JSON deal updates for
HubSpot. Research the top semantic correction approaches, compare existing
NLP libraries for code-switching, and identify the best data sources for
Malay/English training data.
```

This prompt is research-heavy — the router should assign multiple tasks to
**manus** (competitive analysis, NLP library comparison, training data sources).
Check the Workers tab for real Manus responses when `WORKER_MODE=http`.

**Prerequisites for live Manus test:**
- `WORKER_MODE=http` in `.env.local`
- Manus running at `MANUS_BASE_URL` (default `http://localhost:8081`)
- Watch uvicorn logs for: `valos.workers INFO manus · http · url=... work_item=...`

---

## Checklist

### Pipeline (center panel)

- [ ] All 11 stage dots turn green in sequence
- [ ] Each stage shows elapsed ms after completing
- [ ] Click **intake** → raw JSON pre expands below the row
- [ ] Click **intent** → raw JSON pre
- [ ] Click **architect** → ArchFlow renders: scrollable module chain, responsibilities table, failure chips
- [ ] Click **research** → ResearchCards grid (≥3 cards, each with source badge + deliverable footer)
- [ ] Click **execution** → ExecutionBoard list; click a task row to expand acceptance criteria
- [ ] Execution tasks with `mockable: true` show a grey `mock` chip

### Critic (bottom of center panel)

- [ ] Badge reads **approve** in green
- [ ] Score bar fills to ~83% in green
- [ ] Strongest-part line appears below

### Output panel — PRD tab

- [ ] Hero block shows product definition
- [ ] Green left-bordered wedge callout
- [ ] Numbered success criteria list
- [ ] MVP feature chips grid
- [ ] Mocked vs Real two-column table
- [ ] Non-goals bullet list

### Output panel — Scope tab

- [ ] 5-zone MoSCoW grid renders (must-have / should-have / defer top row, mock-ok / must-be-real bottom row)
- [ ] Each zone has colored title and chip pills

### Output panel — System tab

- [ ] ArchFlow renders same chain as architect stage expand
- [ ] Responsibilities two-column table
- [ ] Failure chips at bottom

### Output panel — Routing tab

- [ ] Table rows for every route
- [ ] Worker badges colored correctly (sky=manus, emerald=code_builder, amber=openclaw, violet=val_clone_internal, rose=critic, slate=memory_manager)
- [ ] Confidence bars fill proportionally

### Output panel — Workers tab

- [ ] Shows "No worker feedback" message in demo/inline mode (expected)

### Output panel — QA / Deploy tabs

- [ ] Bulleted checklist items render

---

## Edge-case prompts

**Short prompt — should score below 0.60 (reject):**
```
app
```

**Medium prompt — should score in 0.60–0.82 range (revise):**
```
Build a dashboard for tracking sales metrics
```

**Revise flow:**
1. Submit the medium prompt above
2. Critic shows **revise** badge + yellow bar
3. Click "Revise & re-run" — pipeline re-runs with critic fixes injected
4. Counter shows `(1/2)`
