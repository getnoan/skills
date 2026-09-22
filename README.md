# NOAN Agent Skills

Open [Agent Skills](https://agentskills.io) for building on [NOAN](https://getnoan.com) — the fact layer for agentic business. A skill is a single `SKILL.md` your agent reads to learn how to ground itself in your company's verified facts and work your NOAN task board. The format is an open standard supported by Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Gemini CLI, and 20+ other agents — one file, any model.

The NOAN API itself is plain REST with a bearer key. Full spec: <https://api.getnoan.com/openapi.json>

## Skills

| Skill | What it does |
| --- | --- |
| [`noan-fact-layer`](skills/noan-fact-layer/SKILL.md) | Read and write verified company facts, contacts, notes, and tasks through the NOAN API. Grounding-first: agents answer from facts, not guesses. On first connect to an empty workspace it runs a guided setup — seeding the fact layer from your website, repo, and docs, then handing it back for review ([references/](skills/noan-fact-layer/references)). |

## Install

**One command, everything (recommended):** the NOAN wizard takes your API key, points your
coding assistants at the NOAN MCP server, installs these skills, and checks whether your fact
layer has anything in it yet.

```bash
npx -y @getnoan/wizard@latest
```

A coding assistant can run it too, without prompts: `NOAN_API_KEY=… npx -y @getnoan/wizard@latest --yes --json`.
Source and options: [getnoan/wizard](https://github.com/getnoan/wizard).

**Just the skills, any agent:**

```bash
npx skills add getnoan/skills
```

**Claude Code** — as a plugin:

```text
/plugin marketplace add getnoan/skills
/plugin install noan@noan-skills
```

or copy the skill in directly:

```bash
git clone https://github.com/getnoan/skills /tmp/noan-skills && mkdir -p ~/.claude/skills && cp -r /tmp/noan-skills/skills/noan-fact-layer ~/.claude/skills/
```

**OpenAI Codex:** copy `skills/noan-fact-layer/` into `~/.codex/skills/`.

**Everything else:** the skill is plain markdown. Fetch it from `https://getnoan.com/skill.md` (or the [raw file](https://raw.githubusercontent.com/getnoan/skills/main/skills/noan-fact-layer/SKILL.md)) and put it wherever your agent reads instructions — an `AGENTS.md`, a system prompt, a rules folder.

## Setup

The skill authenticates with an API key from your NOAN workspace ([app.getnoan.com](https://app.getnoan.com) → create an API key; every plan includes unlimited keys):

```bash
export NOAN_API_KEY=...
```

Never paste the key into a chat — set it in the environment your agent's tools run in.

**Running headless?** The skill's write-confirmation guardrail assumes a human in the loop. For unattended agents (cron, CI, autonomous fleets), issue a **read-only** key so the API enforces the boundary itself.

## License

MIT
