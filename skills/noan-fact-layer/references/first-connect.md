# First connect — seeding a new NOAN workspace

Follow this sequence when auth succeeds but the workspace is empty or
near-empty (`GET /facts?per_page=1` → `meta.totalItems` < 10). Do **not** run
it against a populated workspace — there, ground normally per SKILL.md.

The goal: the first time the user opens the NOAN app, it is already full of
their own verified truth. Never leave them staring at an empty workspace.

## Step 0 — Preflight, then stop

Verify auth (`GET /me`). List existing stacks and blocks
(`GET /stacks?in_use_only=true`, `GET /blocks?in_use_only=true`). Keep
`in_use_only` on both: a bare `GET /blocks` also returns NOAN's managed
template catalogue, which is hundreds of blocks in every project including a
brand-new one, and makes an empty workspace look populated. Then **state the
plan and wait for a yes.**

Create nothing in steps 0–3. Every write is shared state the user's whole
team and every future agent will read as truth. Tell the user, in order:
what you found (empty workspace), what you propose (read their existing
material → propose a structure → seed it → hand back for review), roughly
how long, and what you need from them. Then ask for sources.

The single most common failure is writing before the shape is agreed.
Everything after this step is cheap to redo; facts are not.

## Step 1 — Gather sources, don't assume them

Ask which of these exist, and offer to find what you can yourself:

- **Website** — usually highest-yield: homepage, about, pricing, product,
  FAQ, case studies.
- **Repo** — README, docs/, architecture notes. If you are in a git repo,
  look before asking.
- **Existing dumps** — Notion export, Google Docs, pitch deck, investor
  update, brand guide. Ask the user to point at a folder.
- **Their head** — for whatever the above doesn't cover.

Read what they give you. Do not gather third-party commentary about the
company: a fact layer records what the company asserts about itself, not
what the internet says.

If they have no sources at all, do not seed — switch to the interview path
in `interview.md` (also at
https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/interview.md).

## Step 2 — Extract claims with provenance

Decompose the sources into individual claims. For each, hold:

```
{ claim, value, source (url or file path), quote, confidence }
```

Three confidence tiers with different treatment:

- **Verified** — the company asserts it directly in its own material.
  → becomes a fact.
- **Inferred** — you derived it by reasoning across sources.
  → goes to the review list in step 5, flagged. Never written silently.
- **Gap** — a slot a company of this shape should fill and no source
  addresses. → becomes a task, never a guess.

**Never invent a fact.** If pricing is published nowhere, the pricing block
does not get a plausible table — it gets a task: "pricing not found in
sources; needs input." A confidently wrong fact is worse than an absent one,
because every downstream agent grounds on it.

Watch for conflicts **between** sources — the website and the deck often
disagree, and the older one is usually the website. Surface these to the
user instead of silently picking a winner: that disagreement is exactly what
they bought the product to fix.

## Step 3 — Propose the architecture, get one approval

Draft the stack → block structure and show it before writing anything.
Follow the rules in `writing-facts.md` (granularity, descriptions, naming) —
they are load-bearing. Note what a description can't do: it is set on create,
no read endpoint returns it, and an agent grounding later sees only titles and
fact content. Anything a future reader must know belongs in the fact.

Start from "What a fact layer should cover" there — the seven areas most
businesses need answered — then shape the draft to *this* business. Managed
stacks are a map to check against, not a mould: create custom stacks and blocks
for whatever this company actually runs on, and expect to create several.

Present the proposal as: stacks → blocks → one-line description of what goes
in each, with counts. Get a single explicit yes. Then write.

## Step 4 — Write, block by block

Create stacks with their blocks via `POST /stacks` — on this endpoint every
nested block needs `title` **and** `description` (both required; titles are
3–512 characters). Then fill each block with `POST /facts`.

**Take the block slugs from the create response; never construct one.** The
`201` returns `{"stack": {id, slug, title, description, managed, blocks[]}}`,
and each entry in `blocks[]` carries the generated `slug` — which will be
prefixed and unlovely, e.g.
`c4e19a7b-clinical-services-5f2dd-orthopaedic-surgery`. That is the string
`POST /facts` wants as `blockSlug`. Guessing a tidy slug from the title is the
single easiest way to make this step fail, and it fails quietly: the fact posts
against nothing you can find, or the call 404s on a slug that was never real.

Remember: **`POST /facts` replaces the block's content wholesale.** Compose
the complete content for a block in memory and post it once. Never post a
partial addendum.

Order of writes: identity and positioning first (company, mission, ICP,
product), then commercial (pricing, sales), then operational — so if the run
is interrupted, the most load-bearing facts exist.

Write only **verified** claims. Hold inferred ones for the hand-off list.

## Step 5 — Record the gaps as work, not prose

For every gap, `POST /tasks`: what's missing, why an agent will need it, and
where the answer probably lives. Keep `details` under 2048 characters — it is
rejected, not truncated, above that; put a long rationale in `POST /notes`
(25,000) and reference it.

Set `externalId` (e.g. `seed-gap-<block-slug>`), but **do the dedupe yourself**.
Nothing enforces uniqueness on it, and the filter you would reach for does not
exist: `GET /tasks?externalId=…` is silently ignored and returns the **entire
board** at `200`, so a re-run that trusts it sees a long list of matches that
match nothing. `GET /tasks` does return `externalId` on each task, so page the
board (`per_page=100`) and compare client-side before creating.

This turns "your workspace is incomplete" from a criticism into a to-do list —
and it is what brings the user back on day two.

## Step 6 — Hand off with one link and three lines

End with, in this order:

1. **What you built** — one line of counts: "34 facts across 8 stacks,
   sourced from your site and README."
2. **What needs their eyes** — the inferred claims and source-to-source
   conflicts, listed explicitly. Short list; these are where being wrong
   costs them.
3. **The link** — https://app.getnoan.com, so the first thing they see is a
   full fact layer.
4. **The next action** — one concrete thing, not a menu. Usually: "verify
   the flagged facts, then tell me which agent to build first."

## Step 7 — Build the first agent

Only after the user has verified. The first agent should read facts and
produce something visible in a single run — not a fleet, not a scheduled
job. The point is to close the loop between "these facts are true" and "this
output is grounded in them" while the seeding is fresh.

## Rules that apply throughout

- Plan before writing, every time. If asked to skip it, compress the plan to
  one paragraph — don't skip it.
- Never fabricate. Missing is a finding; report it.
- Never write an unlabelled inference.
- Never post a partial block.
- Be idempotent: before creating a stack or block, check for a near-twin by
  **title** — `GET /stacks?title=…`, `GET /blocks?title=…`, a case-insensitive
  substring match. Don't check by slug: `?slug=` is exact-match, and for a
  block you haven't created yet you cannot know the generated slug, so it
  answers 0 for things that exist. The API backstops you here — a duplicate
  stack title, or a duplicate block title within a stack, is a `409` conflict
  rather than a second copy — but a `409` mid-run is a stall, not a plan.
  Re-running this sequence must not double the workspace.
