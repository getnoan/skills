---
name: noan-fact-layer
description: >-
  Read and write verified company facts through the NOAN API (the fact layer for
  agentic business). Use this whenever a task needs grounded company truth —
  strategy, positioning, ICP, product, pricing, metrics, team, contacts — instead
  of guessing or relying on general knowledge. Also use to record a new fact,
  contact, note, or task back into NOAN. Trigger on mentions of NOAN, "our facts",
  "our ICP/positioning/strategy", the fact layer, Stacks/Blocks/Facts, or
  getnoan.com — even when the user doesn't explicitly say "use the NOAN skill".
  Reads are safe and need no permission; writes mutate shared company state and
  require explicit user confirmation first.
license: MIT
metadata:
  source: https://github.com/getnoan/skills
  api-spec: https://api.getnoan.com/openapi.json
---

# NOAN — the fact layer

NOAN stores verified company facts as `Stack → Block → Fact`. A **Fact** is one
plain-text truth, versioned, belonging to a **Block** (addressed by `slug`, e.g.
`customer-profile`). When a task needs real company context, **read from NOAN
first** instead of inventing an answer. Absence of a fact is information — report
it, don't fill the gap with a guess.

## Auth

Base URL `https://api.getnoan.com/v1`. Every request sends:

```
Authorization: Bearer $NOAN_API_KEY
```

Read the key from the `NOAN_API_KEY` environment variable (some setups name it
`NOAN_PERSONAL_API_KEY` — use whichever is set). Keys are created in the NOAN
workspace at https://app.getnoan.com; every plan includes unlimited keys. Never
ask the user to paste the key into chat; never print, log, or echo it. The key's
scope (read vs. read+write) is the real boundary — a `403` on a write means it's
a read-only key; stop, don't work around it.

**Unattended agents:** the reads-free / writes-confirmed split below assumes a
human in the loop. If this skill runs headless (cron, CI, an autonomous fleet),
run with a read-only key so the API enforces the boundary — a `403` on write is
the guardrail working, not an error to route around.

Verify auth before real work:

```bash
curl -s https://api.getnoan.com/v1/me -H "Authorization: Bearer $NOAN_API_KEY"
# → { project:{id,name}, identity:{id,email,role} }
```

## Conventions

- Examples use `curl`, but the API is plain REST — any HTTP tool works. Each
  call is just method + URL + `Authorization` header (+ JSON body on writes).
- List endpoints return `{ meta, links, items }` — data is in `items`.
- Send `per_page` (snake_case, max 100) and `page` (1-based). Read back
  `meta.perPage` (camelCase). Don't reuse the response field name in requests.
- Paginate while `meta.hasNext` is true, or follow `links.next` (a full URL).
- Facts are addressed by block **slug**: `GET /facts?block_slug=<slug>` (repeat
  the param to fetch several blocks at once).
- Writes return `201` (create), `200` (update), or `204` (no body — the task
  `PUT` set-endpoints).
- `PUT /tasks/{id}/{tags,assignees,contacts}` **replace** the set, not append.
- Task status moves via `PATCH /tasks/{id}` with `{status}` (`backlog`→`in-progress`→`done`); set `completed:true` alongside `status:"done"` to keep the flag and board consistent.

## Reads — safe, no permission needed

| Goal | Call |
|---|---|
| Verify auth / project | `GET /me` |
| List stacks | `GET /stacks` (params: `slug`, `title`, `custom_only`, `in_use_only`) |
| List blocks | `GET /blocks` (params: `slug`, `title`, `custom_only`, `in_use_only`) |
| Facts for a block | `GET /facts?block_slug=<slug>` |
| All facts | `GET /facts` |
| Fact edit history | `GET /facts/{factId}/versions` (paginated, newest lineage of one fact) |
| Search contacts | `GET /contacts?q=<query>` |
| Get one contact | `GET /contacts/{contactId}` |
| List tags | `GET /tags` |
| List tasks | `GET /tasks` (params: `status`, `completed`; `status=null` → tasks with no board column) |
| List assets | `GET /assets` (params: `tag_id`, `sort` = `createdAt`\|`updatedAt`, `order`) |

`in_use_only=true` limits stacks/blocks to those actually added to this
project's knowledge base — usually what you want when grounding.

Tags carry their own `usageInstructions` field — read and follow it before
applying a tag. Asset content lives in `activeVersion`
(`{title, text, createPrompt}`); `text` is the content, `createPrompt` its
provenance.

Grounding pattern:

```bash
curl -s "https://api.getnoan.com/v1/facts?block_slug=customer-profile" \
  -H "Authorization: Bearer $NOAN_API_KEY"
# items[].content are the verified facts. Build the answer from these.
```

Fact item shape: `{ id, blockSlug, content, createdAt }`.

## Writes — confirm with the user first

Before any call below, state the exact endpoint and payload to the user and wait
for explicit approval. These change shared state other people and agents read as
truth.

**`POST /facts` REPLACES, it does not append.** Posting to an existing
`blockSlug` supersedes that block's current fact wholesale (prior versions are
kept in history, but readers only see the latest). For any fact other people or
agents depend on, never post just your update. Mandatory pattern:
(1) `GET /facts?block_slug=…` and take the current content **verbatim**,
(2) splice your new or changed entry into it, (3) `POST` the full amended
content, (4) re-read and verify the block still holds exactly 1 fact and every
prior entry survived. Posting only the new entry wipes the rest.

| Goal | Call | Required body |
|---|---|---|
| Add a fact | `POST /facts` | `blockSlug`, `content` — replaces the block's fact; see warning above |
| Create stack | `POST /stacks` | `title`, `description`, `blocks[]` (each block needs `title` **and** `description`) |
| Create block | `POST /stacks/{stackId}/blocks` | `title` (+ `description`) |
| Create contact | `POST /contacts` | `name` (+ alias, email, phoneNumber, website, notes[], companyRoles[], tagIds[]) |
| Update contact | `PATCH /contacts/{contactId}` | any subset above |
| Add contact notes | `POST /contacts/{contactId}/notes` | `notes[]` |
| Create note | `POST /notes` | `content` (+ title, externalId) |
| Create task | `POST /tasks` | `title` (+ details, dueDate `YYYY-MM-DD`, status, externalId) |
| Update task | `PATCH /tasks/{taskId}` | any subset of `title`, `details`, `dueDate`, `completed`, `status` (`backlog`/`in-progress`/`done`) — partial, omitted fields untouched |
| Set task tags | `PUT /tasks/{taskId}/tags` | `tagIds[]` |
| Set task assignees | `PUT /tasks/{taskId}/assignees` | `assigneeIds[]` |
| Set task contacts | `PUT /tasks/{taskId}/contacts` | `contactIds[]` |

```bash
curl -s -X POST https://api.getnoan.com/v1/facts \
  -H "Authorization: Bearer $NOAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"blockSlug":"customer-profile","content":"..."}'
```

`externalId` on notes/tasks is an idempotency handle — use it to avoid duplicates.

## Errors

`400` bad body (fix, don't retry) · `401` bad key (stop) · `403` key lacks
permission, e.g. read-only on write (stop) · `404` bad slug/id (re-resolve) ·
`409` conflict/duplicate (reconcile) · `429` rate limited (back off, retry) ·
`5xx` retry with backoff a few times, then surface.

## Guidelines

- Ground before generating; build company answers from `items[].content`.
- Never fabricate a fact. Missing → say so.
- Reads free; writes need explicit user confirmation.
- A `403` on write means read-only by design — stop.
- Never expose the API key.
