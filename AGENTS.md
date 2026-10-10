# AGENTS.md

How we work in every NOAN repo, for engineers and their coding agents. This repo's own commands and stack rules live in `CLAUDE.md`; read both. The repo file wins on conflict, and both win over any skill or tool default. Sections run from most to least critical.

## Hard rules

- **Never run without an explicit go in the current turn:** changes to auth, permissions, secrets, keys, IAM, network, DNS or billing. Read-only checks are fine. Show the command and stop. Never `sudo`.
- **A statement is not a command.** "That's unused" or an answer to your question is not a go to delete, refactor or implement. Edit only on an explicit imperative.
- **Never push to `main`.** Push your branch right after every commit, PR open or not. Never merge or close PRs, create releases or change repo settings.
- **Stage explicit paths**, never `git add -A` or `.`. Read `git status --short` before committing. Script output goes to a gitignored directory.

## Security

- **Public repo:** anyone reads every file, commit and PR. No keys, customer or workspace data in code, examples or PR text.
- **Secrets:** keys come from env or a secret store, never from a file in the repo.
- **Writes need the user's go**, except where `SKILL.md` documents an exception. A skill never adds one on its own.

## Before calling it done

- **Lint and format the changed files.** No full-project rebuild, no full test suite unless asked.

## Architecture

- **Match the industry norm** on developer-facing features. Check what competitors actually do before citing them.
- **No speculative fixes:** add a guard or fallback when a real case needs it.

## Working with people

- **While a decision is open, give analysis, not edits:** trade-offs, `file:line`, what comparable products actually do.
- **Question scope** on tickets with no customer evidence or that pull the product into an adjacent category, before planning.
- **Don't rewrite LLM prompts** or other tuned text without asking what the goal is.
- **"Later", "not now", "park it" mean drop it.** No follow-up ticket or TODO unless asked.
- **Re-read a file right before editing it**, and the plan, ticket and `git log` before answering "what's left".

## Git

- `gh pr create --draft --head <branch> --base main`: a draft by default, always explicit.
- **Commit message: one imperative subject line.** No body, no trailers.
- Fixes to an earlier commit on an open branch are amended into it, not stacked.
- Branch `<initials>/<slug>` once work is agreed. Never delete or force-move someone else's branch.
- Don't watch CI; one status check is fine.

## Writing on GitHub

`gh` skips the web templates, so agents follow these by hand.

- **No em dashes**, anywhere (GitHub, code, UI copy, docs, chat). Factual, no commentary on difficulty, no selling. Cut lines that don't change what the reader does.
- **Linking:** leave the ticket alone while the PR is open. After merge, tick the item with the PR number only ("Done in #1821"), link it in Development, move the card to Done.
- **PRs:** exactly the sections of `.github/PULL_REQUEST_TEMPLATE.md`, 3 to 6 lines, nothing the ticket says.
- **Issue titles:** one sentence, under 80 characters, nothing after a dash or colon. Start with the type emoji: 🐞 bug, ✨ feature, 🔧 tech debt. Then tasks start with a verb, bugs state the observed behavior. Also set the matching label.
- **Issue bodies:** template sections, delete empty ones, never "N/A". One line per checklist item. Bugs paste the exact error.
- **Wrong-branch PR:** open the right one and say which to close; don't edit the wrong one.
- **Comments:** answer the question, link instead of re-explaining, no unasked status updates.

## Comments

Every comment gets reviewed. Default to none.

- **Only what the code can't show:** a constraint from another file, a non-local invariant, a line where a reader would ask "why?". Cut it if removing it wouldn't confuse anyone, doc blocks that summarize a short function included.
- **Keep existing comments** when refactoring, adapted to the new code. Drop one only when its code is gone.
- **One short, informal sentence**, the way you'd say it to a teammate. Not spec voice, not a label, never a question. Right: "A key's stacks only narrow, never widen. We re-check the creator's role every request, so demoting someone shrinks their keys right away."
- **The constraint, never the reasoning:** no rationale, no "like GitHub does", no pointer to a ticket or another function.
- **Current behavior only.** No "no longer", "instead of", "previously".
- **Plain verbs:** store, update, check, skip, create. Not park, stamp, mint, surface, leverage.
- **Format:** match the comment syntax the file already uses.

## Naming

- Concrete words already in the codebase ("key", "org", "limit"), not "principal", "ceiling", "budget". No jargon a non-native reader trips on ("old pricing", not "grandfathered").
- Use the product's terms as `skills/noan-fact-layer/SKILL.md` defines them (stack, block, fact). Never give one of them a second name.
- Name files and functions by what they do, not generic nouns (`services.ts`, `Manager`). Customer-facing copy is American English.

## Elsewhere

- Ground review findings in a `file:line`, a cited framework or a competitor's actual behavior. "Blocker" only if a live user path hits it.
- Lead with the answer. Two or three options max, each with a trade-off and a recommendation.
- Evidence and export files: `YYYYMMDD_snake_case.ext`.
