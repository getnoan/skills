@AGENTS.md

# skills

NOAN's public Agent Skills, also shipped as a Claude Code plugin. Each skill is a `SKILL.md` that other people's agents read and follow, so the docs are the product.

## Public repo

- Anyone can read every file, commit and PR here. No keys, no customer or workspace data, no internal repo names, tickets or people in examples, tests or PR text.
- Examples use made-up companies and placeholder keys (`NOAN_API_KEY=…`).

## Skills

- **Every claim about the API matches the published spec** (`https://api.getnoan.com/openapi.json`). `tests/conformance.mjs` ties each claim to the spec or the live API by exact phrases (`anchors`). Changing a phrase means updating its check in the same PR.
- **Interactive writes wait for the user's go.** The only exceptions are the two exceptions `SKILL.md` documents: a headless job whose key can write, and the capture skill's note and backlog task. A new exception is a decision, not a skill edit.
- **`hooks/capture-instruction.md` runs in every session** of everyone who installs the plugin. Keep it to a few sentences and change it only on purpose.
- Reference files are linked by their raw URL on `main`, so a single-file install can fetch them.

## Commands

```bash
node tests/conformance.mjs                      # spec checks
NOAN_API_KEY=... node tests/conformance.mjs     # spec + live read-only checks
node tests/report-drift.selftest.mjs
npx markdownlint-cli2 "**/*.md"                 # CI also checks links (lychee) and secrets (gitleaks)
```
