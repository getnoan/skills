---
name: noan-fact-candidate-capture
description: >-
  Capture a durable business fact the moment it surfaces in a session, as a NOAN
  fact candidate for weekly review. Use when something is said that would still
  be true next quarter and that someone outside this conversation would need —
  a pricing or packaging change, a positioning shift, a repeatable customer
  insight, a competitor fact, a policy or process decision — and it is not
  already recorded in NOAN. Also use on an explicit "flag that", "capture that
  for the fact base", "that should be a fact", or "queue that for fact review".
  Writes a note plus a backlog task; never writes a business fact itself.
license: MIT
metadata:
  version: 1.0.0
  source: https://github.com/getnoan/skills
  consumer: https://github.com/getnoan/agent-pack
---

# Capturing a NOAN fact candidate

Durable business truth mostly surfaces in passing — in the middle of a
conversation about something else, at a moment when nobody wants to stop and
file it. Then it evaporates. This skill is the thirty-second version of filing
it: two writes that put the context in front of a human on a weekly cycle.

**A capture is a suggestion, never a correction.** Nothing here writes a fact.
It writes a note holding the rationale, and a backlog task that points at it.
A reviewer — usually the [fact-alignment
agent](https://github.com/getnoan/agent-pack) plus the person reading its
report — decides whether anything becomes a fact. Most captures are rejected.
That is the healthy outcome, not a failure.

## What qualifies

A **durable** business truth that would still be true next quarter, and that
someone outside this conversation would need:

- a pricing, packaging or plan change
- a positioning or ICP shift
- a customer insight that recurs rather than a single account's detail
- a competitor fact
- a policy or process decision the business now runs on

**Not:** operational escalations, one-off context about a single contact,
engineering and repo conventions, anything already recorded as a fact, or
passing conversational detail. **Be selective.** A rejected candidate still
costs a person the read, so a session that surfaces nothing durable should
capture nothing. Do not narrate the decision, and do not ask permission for
every near-miss — if it does not clearly qualify, let it go.

**Ask first, rather than capturing, when** the context is about a named
individual's performance or conduct, is legal or HR material, is embargoed or
unannounced, or was shared in confidence. Never put a credential, key or
personal identifier in a capture.

This is the one deliberate exception to the `noan-fact-layer` skill's
confirm-before-writing rule, and the reason it is safe: nothing a capture
writes is read as truth by anything. Both records are reversible, and a human
sees them before any fact changes. Tell the user in one line afterwards.

## Auth

If a NOAN MCP server is connected, use its `create_note` and `create_task`
tools and skip the curl entirely — the connection carries the credential and
the conventions below are enforced server-side.

Otherwise, the REST API with a key from your workspace
([app.getnoan.com](https://app.getnoan.com) → API keys):

```bash
export NOAN_API_KEY=...
```

Never paste a key into a chat; set it in the environment the tools run in. If
no key resolves, say so and stop — do not fall back to another key you happen
to find, because every write is attributed to whoever owns it.

## 1. The note — the rationale

```bash
curl -s -X POST https://api.getnoan.com/v1/notes \
  -H "Authorization: Bearer $NOAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{"title": "[Fact Candidate] Starter plan moved to $59/mo",
 "content": "**What came up**\n<the raw context, quoted where possible>\n\n**Why it is durable**\n<why this is still true next quarter>\n\n**Where it belongs**\n<the block slug it would update, or why a new block is needed>\n\n**Source**\n<conversation / meeting / document, and the date>\n\nCaptured by noan-fact-candidate-capture v1.0.0"}
JSON
```

Prefix the note title `[Fact Candidate]` too. A reviewing agent skips notes
with that prefix when scanning notes for candidates, so the same finding is not
counted twice — once from the note and once from the task.

`content` caps at 25,000 characters and is **rejected, not truncated**, above
it. Read the new id from either shape: `created?.note?.id || created?.id`.

## 2. The task — the queue entry

```bash
curl -s -X POST https://api.getnoan.com/v1/tasks \
  -H "Authorization: Bearer $NOAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "[Fact Candidate] Starter plan moved to $59/mo",
       "details": "<2-4 lines: what changed, why it is durable, which block it targets>\n\nFull rationale: NOAN note \"[Fact Candidate] Starter plan moved to $59/mo\" (id <noteId>).",
       "status": "backlog"}'
```

Three things are load-bearing:

- **The title starts with the literal `[Fact Candidate]`** — brackets included,
  nothing before it, not even a space. Matched anchored and case-insensitively.
  `Fact candidate: …` does not match.
- **`status` is `"backlog"`.** The review queries that status; anything else is
  invisible to it.
- **`details` is the only thing a reviewing agent reads.** It never opens the
  note — the note is for the human. "See the note" wastes the review. `details`
  caps at **2048 characters**, rejected outright rather than truncated, so
  check the length before posting; put anything longer in the note.

A well-formed reviewer reports a title that misses the prefix rather than
dropping it, but do not rely on that — get the prefix right.

## After capture

Tell the user in one line what you captured and where it went. Then stop; do
not offer to write the fact.

The task is closed out by the review **whether or not** the candidate was
accepted, so a capture task disappearing from the board is normal and does not
mean it was taken up. The outcome is in the review's report.

**If nothing consumes the queue, a capture is just a task on your board** — a
tidy one, and still better than losing the context, but the value is in the
review. The [NOAN agent pack](https://github.com/getnoan/agent-pack) runs the
fact-alignment agent that drains it weekly.
