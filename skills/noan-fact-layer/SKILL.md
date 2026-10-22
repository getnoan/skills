---
name: noan-fact-layer
description: >-
  Read and write verified company facts through the NOAN API or the NOAN
  connector (MCP) in Claude, ChatGPT and other chat apps — the fact layer for
  agentic business. Use this whenever a task needs grounded company truth —
  strategy, positioning, ICP, product, pricing, metrics, team, contacts — instead
  of guessing or relying on general knowledge. Also use to record a new fact,
  contact, note, or task back into NOAN. Trigger on mentions of NOAN, "our facts",
  "our ICP/positioning/strategy", the fact layer, Stacks/Blocks/Facts, or
  getnoan.com — even when the user doesn't explicitly say "use the NOAN skill".
  Also use to set up NOAN for the first time: on connecting to a new or empty
  workspace it seeds the fact layer from the company's own sources (website,
  repo, docs) and hands back a populated workspace for review. Reads are safe
  and need no permission; writes mutate shared company state and require
  explicit user confirmation first.
license: MIT
metadata:
  source: https://github.com/getnoan/skills
  api-spec: https://api.getnoan.com/openapi.json
---

# NOAN — the fact layer

NOAN stores verified company facts as `Stack → Block → Fact`. A **Stack** is a
subject area of the business and the unit an agent routes on; a **Block** is one
topic inside it (with a stable `id` and a readable `slug`), holding at most one current fact; a
**Fact** is that block's content — one plain-text truth, versioned.
Always look a block up through the API rather than guessing it from a topic name,
and address it by its `id`.
When a task needs real company context, **read from NOAN first** instead of
inventing an answer. Absence of a fact is information — report it, don't fill the
gap with a guess. But an empty `GET /facts?block_id=…` usually means the wrong
block, not a missing fact; confirm the block exists before reporting absence.

**When this file and the API disagree, the API wins.** These notes are checked
against the live spec and a read-only call weekly
(<https://github.com/getnoan/skills/blob/main/tests/conformance.mjs>), but a copy
installed as a single file can be months old and nothing updates it.
If a response contradicts something here — a field that now exists, a limit that
has moved, an endpoint that answers differently — trust the response, carry on,
and tell the user which part of the skill is stale.

## Connector or key — check which route you are on

NOAN reaches an agent one of two ways, and the rest of this file assumes the
second:

- **NOAN tools are in your tool list** (`get_me`, `search_knowledge`,
  `list_facts`, `create_fact` …). You are on the **connector route** — Claude,
  ChatGPT and other chat apps, or any assistant with the NOAN MCP server
  connected. The user signed in when they connected it, so there is no key to
  find: skip Auth below, never ask for a key, never send the user to a
  terminal. Read `references/connector.md` (or fetch
  <https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/connector.md>
  if this skill was installed as a single file) for where the connector
  differs, then follow the rest of this file for what
  to do.
- **No NOAN tools, but you can make HTTP calls** — the **REST route** below.

## Auth

Base URL `https://api.getnoan.com/v1`, with the key sent as
`Authorization: Bearer $NOAN_API_KEY`. How each call works (routes, parameters,
request and response shapes, limits, errors) is in the spec at
<https://api.getnoan.com/openapi.json>; read it there. This file covers when
and why to make a call.

Read the key from the `NOAN_API_KEY` environment variable (some setups name it
`NOAN_PERSONAL_API_KEY` — use whichever is set). Keys are created in the NOAN
workspace at <https://app.getnoan.com>; every plan includes unlimited keys.

**Nothing set up yet?** Do not improvise the setup from this document. The NOAN
wizard does the deterministic part correctly and hands the rest back to you.
Two cases, and which one you are in is decided by whether a key is set:

- **A key is set, nothing else is.** Tell the user what the wizard writes —
  the key into `.env`, and an MCP entry into each coding assistant's config
  it detects in the project, not only this one (the
  `--no-skill` flag below skips the skill files and the `CLAUDE.md` /
  `AGENTS.md` pointer, since this skill is already installed) — and once they
  agree, run `npx -y @getnoan/wizard@latest --yes --json --no-skill` and read
  the JSON report's `next` list. It carries a `first-connect` entry when the
  workspace is empty; follow `references/first-connect.md` as below.
- **No key at all.** You cannot obtain one: the wizard takes the key at an
  interactive prompt, which an agent's shell does not have, and the key must
  never be pasted into chat. Ask the user to run `npx -y @getnoan/wizard@latest`
  in their own terminal (it tells them where to create the key, takes it
  without echoing it, and does the same setup), then carry on once they say it
  has finished.

Never ask the user to paste the key into chat; never print, log, or echo it. The key's
scope (read vs. read+write) is the real boundary — a `403` on a write means it's
a read-only key; stop, don't work around it.

**Unattended agents: the key's scope is the consent.** The reads-free /
writes-confirmed split below is for interactive use, where a human is present
to ask. Headless (cron, CI, an autonomous fleet), the human decision was made
when the key was provisioned: a **read+write key** given to an unattended job
means its owner chose to let that job write — write without asking, with the
same care as ever (idempotency, complete-document fact posts, memos over
fact edits when in doubt). Scope a headless job's key **read-only** when its
writes should stay human-gated — a `403` on write then means the key was
scoped that way on purpose; stop, don't route around it.

**Whose name goes on a write.** Everything written with a key — facts, tasks,
comments, memos — is attributed to the key's owner. An unattended agent should
run on a key of its own, not a person's: the user creates the agent under
**Settings → Team**, then its key under **Settings → API → Agent API Keys**.
`GET /me` tells you which you hold: an agent key returns `identity.role` `bot`
(and no email), so what you write is the agent's. On a person's key, your
comments read as that person speaking; say in the text that an agent wrote them.

Verify auth with `GET /me` before real work:

```bash
curl -s https://api.getnoan.com/v1/me -H "Authorization: Bearer $NOAN_API_KEY"
```

## Before grounding — check workspace state

After auth succeeds, check `GET /facts?per_page=1` and read `meta.totalItems`.
(On the connector route there is no count; `connector.md` says what to read
instead.)

- **Fewer than ~10 facts** → this is a new or empty workspace. Do not attempt
  to ground a task against an empty fact layer ("no facts found" is useless to
  a new user). Instead, read `references/first-connect.md` (or fetch
  <https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/first-connect.md>
  if this skill was installed as a single file) and follow it: offer to seed
  the workspace from the company's own sources, then hand it back for review.
- **Otherwise** → ground normally against `items[].content`.

## Reads — safe, no permission needed

`in_use_only=true` limits stacks/blocks to those actually added to this
project's knowledge base — what you want when grounding. Leave it **off** when
scanning for an industry stack: the catalogue holds stacks this project has not
adopted, and the filter hides exactly those. If the right home turns out to be
unadopted, say so and offer to add it with `POST /stacks/{stackId}/use` once
the user says yes.

Tags carry their own `usageInstructions` field: read and follow it before
applying a tag.

**Insights are NOAN's findings about the fact layer, not facts.** `GET /insights`
lists facts that overlap or should be connected, facts with no related facts,
and missing topics, each with a `suggestion` and the `factIds` and `blockIds` it
is about. `blockIds` match `id` on `GET /blocks`. A fact id can name a version
that has since been superseded, so resolve it with `GET /facts/{factId}/versions`
and re-read the current fact before repeating the insight. A suggestion is a
proposal: acting on it is a write, so it waits for the user's go. The route
needs the `insight:read` scope, which only project owners and executives can
grant, and returns only insights about blocks the key can read, so an empty list
is not proof the fact layer has no issues.

Grounding pattern — read the whole fact base unless you know the exact block:

```bash
curl -s "https://api.getnoan.com/v1/facts?per_page=100" \
  -H "Authorization: Bearer $NOAN_API_KEY"
# items[].content are the verified facts. Follow links.next while meta.hasNext
# is true, then build the answer from the facts. Only if you already know which
# block holds the answer, narrow with ?block_id=<id> instead.
```

Block titles and slugs don't always match a question's topic, so do not pick a
few likely-looking blocks and search them: fetching the wrong blocks and finding
nothing is not evidence of absence. **Never report a fact as missing until you
have read the full fact base.**

## Structure — what a good fact layer looks like

Managed stacks are NOAN's starting map of a business, present in every
workspace and not modifiable. Custom stacks and blocks are how a workspace
takes the shape of the business it belongs to — expected, not exceptional. You
cannot add a block to a managed stack, so a topic neither the generic stacks nor
an industry stack carries is a custom stack by construction.

**The map is wider than the generic stacks.** It also carries industry ones —
`Restaurant`, `Fund`, `Agency`, `Consulting`, `Education`, `Real Estate` and
many more — holding the topics you would otherwise invent a custom stack for.
Scan `GET /stacks` for one matching the business before deciding anything is
custom.

Most businesses need these seven areas covered somewhere. It is a checklist for
coverage, not a schema to conform to:

**Customer** (who we sell to, how the market segments) · **Product** (what we
sell, what it does, what it costs) · **Brand** (positioning, value proposition,
tone) · **Sales** (who qualifies, who we turn away, how a deal runs, objections)
· **Team** (who does what, who decides, hiring) · **Goals** (targets and how
they're measured) · **Operations** (tooling, policies, recurring processes). Add
whatever else the business actually runs on — service lines, sites, regions, a
regulatory regime. For an agentic startup, `references/writing-facts.md` gives
six areas to set up first, in order, starting with Product and Delivery.

Check where each already lives before creating anything: the managed map covers
most of these, and does not always name them the way you would. Team is the trap
— there is no managed `Team` stack, but leadership, staffing and hiring all have
managed blocks. `references/writing-facts.md` lists them per area, and names the
industry stacks worth scanning for.

Write each fact as a reference entry, not an answer: an H1 matching the block
title, a lead sentence that stands alone out of context, a short body in
labelled sections, and an `As of YYYY-MM-DD` line on anything that can go stale.
Roughly 4–12 blocks per stack; one plan, persona, segment or site per block; and
no claim asserted in two places — one truth, one home, and facts that contradict
each other are worse than a gap.

Long form — the seven areas in full, when to go custom, the fact template, and
the seam table for boundaries that blur (Customer vs Sales, Brand vs Product,
Goals vs Sales) — is in `references/writing-facts.md` (or
<https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/writing-facts.md>
if this skill was installed as a single file).

## Writes — confirm with the user first (interactive)

Interactively, before any write, state the exact endpoint and payload to
the user and wait for explicit approval — these change shared state other
people and agents read as truth. Headless, there is no one to ask: the key's
scope carries the decision (see Unattended agents above).

One documented exception: the `noan-fact-candidate-capture` skill writes a note
and a backlog task without asking, and says why it is safe to — nothing it
writes is read as truth by anything, and a human sees both before any fact
changes. It reports what it captured afterwards. If you are following that
skill, follow it; everything else on this page still asks first.

Before writing to stacks, blocks, or facts, read `references/writing-facts.md`
(or fetch
<https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/writing-facts.md>
if installed as a single file) — it covers granularity, descriptions (required
on create, returned on reads, and never updatable), slug hygiene, and the
one-truth-one-home rule. These rules apply to every write, not just first
setup.

**`POST /facts` REPLACES, it does not append.** Posting to an existing
block supersedes that block's current fact wholesale (prior versions are
kept in history, but readers only see the latest). For any fact other people or
agents depend on, never post just your update. Mandatory pattern:
(1) `GET /facts?block_id=…` and take the current content **verbatim**,
(2) splice your new or changed entry into it, (3) `POST` the full amended
content, (4) re-read and **diff the content** — every prior entry must still be
there. Don't verify by counting facts: `GET /facts?block_id=…` returns the
single latest fact per block by construction, so it reads `1` whether the splice
preserved the block or destroyed it. Posting only the new entry wipes the rest.

Log interactions with a contact as **memos**, not notes.

**Progress on a task is a comment, not an edit to `details`.** `details` is the
brief; a comment is what happened since.

Assets are the one write that appends: to update an asset's content,
`POST /assets/{assetId}/versions` — the new version becomes `activeVersion`,
history is kept. Never create a second asset to update an existing one.
`createPrompt` is provenance — when content comes from a generation flow, store
the prompt that produced it.

## Errors

`400` bad body (fix, don't retry) · `401` bad key (stop) · `403` key lacks
permission, e.g. read-only on write (stop) · `404` bad slug/id (re-resolve) ·
`409` conflict/duplicate (reconcile) · `429` rate limited (back off, retry) ·
`5xx` retry with backoff a few times, then surface.

## Guidelines

- Ground before generating; build company answers from `items[].content`.
- Never fabricate a fact. Missing → say so — but only call a fact missing after
  reading the full fact base, not a subset of blocks.
- Reads free; interactive writes need explicit user confirmation. Headless, the key's scope is the consent.
- A `403` on write means read-only by design — stop.
- Never expose the API key.
