# First connect — seeding a new NOAN workspace

Follow this sequence when auth succeeds but the workspace is empty or
near-empty (`GET /facts?per_page=1` → `meta.totalItems` < 10). Do **not** run
it against a populated workspace — there, ground normally per SKILL.md.

The goal: the first time the user opens the NOAN app, it is already full of
their own verified truth. Never leave them staring at an empty workspace.

**Connected through tools, not a key** (Claude, ChatGPT or another chat app)?
The sequence is the same, but it reads the user's documents through the chat
app's own connectors. Read the
"First connect, on this route" section of `connector.md` alongside this one.

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
  update, brand guide. Ask the user to point at a folder — or, in a chat app,
  at the Google Drive or Notion connector they already have switched on.
- **Their head** — for whatever the above doesn't cover.

Read what they give you. Do not gather third-party commentary about the
company: a fact layer records what the company asserts about itself, not
what the internet says.

If they have no sources at all, do not seed — switch to the interview path
in `interview.md` (also at
<https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/references/interview.md>).

## Step 2 — Extract claims with provenance

Decompose the sources into individual claims. For each, hold:

```text
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
they are load-bearing. Note what a description can't do: it is set on create
and never updated, and an agent grounding later reads the facts, not the
descriptions. Anything a future reader must know belongs in the fact.

Start from "What a fact layer should cover" there — the seven areas most
businesses need answered — then shape the draft to *this* business. For an
agentic startup, start from "Set up first: an agentic startup" in the same
file instead: six areas, in the order its agents will need them. Scan the
**unfiltered** `GET /stacks` for an industry stack that fits before drafting
anything custom; step 0's `in_use_only=true` deliberately hides every stack this
project has not adopted, which on a new workspace is nearly all of them. Managed
stacks are a map to check against, not a mould: create custom stacks and blocks
for whatever this company actually runs on, and expect to create several.

Present the proposal as: stacks → blocks → one-line description of what goes
in each, with counts. Get a single explicit yes. Then write.

## Step 4 — Write, block by block

Create stacks with their blocks via `POST /stacks`, then fill each block with
`POST /facts`.

**Take the block ids from the create response; never construct a slug.**
Guessing a tidy slug from the title is the single easiest way to make this step
fail, and it fails quietly: the fact posts against nothing you can find, or the
call 404s on a slug that was never real.

Remember: **`POST /facts` replaces the block's content wholesale.** Compose
the complete content for a block in memory and post it once. Never post a
partial addendum.

Order of writes: identity and positioning first (company, mission, ICP,
product), then commercial (pricing, sales), then operational — so if the run
is interrupted, the most load-bearing facts exist.

Write only **verified** claims. Hold inferred ones for the hand-off list.

## Step 5 — Record the gaps as work, not prose

For every gap, `POST /tasks`: what's missing, why an agent will need it, and
where the answer probably lives. Put a long rationale in a note
(`POST /notes`) and reference it from the task.

Set `externalId` (e.g. `seed-gap-<block-slug>`), and **check it before
creating**: nothing enforces uniqueness on it, so a re-run that skips the check
doubles the list.

This turns "your workspace is incomplete" from a criticism into a to-do list —
and it is what brings the user back on day two.

## Step 6 — Hand off with one link and three lines

End with, in this order:

1. **What you built** — one line of counts: "34 facts across 8 stacks,
   sourced from your site and README."
2. **What needs their eyes** — the inferred claims and source-to-source
   conflicts, listed explicitly. Short list; these are where being wrong
   costs them.
3. **The link** — <https://app.getnoan.com>, so the first thing they see is a
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
  **title** (`GET /stacks?title=…`, `GET /blocks?title=…`), not by slug: for a
  block you haven't created yet you cannot know the generated slug. The API
  answers a duplicate title with a `409` rather than a second copy, but a `409`
  mid-run is a stall, not a plan.
  Re-running this sequence must not double the workspace.
