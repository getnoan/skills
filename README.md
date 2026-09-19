# NOAN Agent Skills

Open [Agent Skills](https://agentskills.io) for building on [NOAN](https://getnoan.com) — the fact layer for agentic business. A skill is a single `SKILL.md` your agent reads to learn how to ground itself in your company's verified facts and work your NOAN task board. The format is an open standard supported by Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Gemini CLI, and 20+ other agents — one file, any model.

The NOAN API itself is plain REST with a bearer key. Full spec: https://api.getnoan.com/openapi.json

## Skills

| Skill | What it does |
|---|---|
| [`noan-fact-layer`](skills/noan-fact-layer/SKILL.md) | Read and write verified company facts, contacts, notes, and tasks through the NOAN API. Grounding-first: agents answer from facts, not guesses. On first connect to an empty workspace it runs a guided setup — seeding the fact layer from your website, repo, and docs, then handing it back for review ([references/](skills/noan-fact-layer/references)). |
| [`noan-fact-candidate-capture`](skills/noan-fact-candidate-capture/SKILL.md) | Catch durable business truth at the moment it surfaces — a pricing change, a positioning shift, a customer insight — and queue it for review as a fact candidate. Writes a note and a backlog task; never writes a fact. Consumed by the fact-alignment agent in the [agent pack](https://github.com/getnoan/agent-pack). |

## Install

**Any agent (universal installer):**

```bash
npx skills add getnoan/skills
```

**Claude Code** — as a plugin:

```
/plugin marketplace add getnoan/skills
/plugin install noan@noan-skills
```

or copy the skills in directly:

```bash
git clone https://github.com/getnoan/skills /tmp/noan-skills && mkdir -p ~/.claude/skills && cp -r /tmp/noan-skills/skills/* ~/.claude/skills/
```

The plugin also installs one hook. Noticing that something worth recording just
went past is not a thing you can ask for after the fact, so the plugin adds a
short standing note — [`hooks/capture-instruction.md`](hooks/capture-instruction.md),
three sentences — to the start of each session, telling the agent to watch for
durable business facts and queue them. Read it before you install; it is the only thing
here that speaks unprompted. If you would rather not have it, copy the skills in
directly instead of installing the plugin, or disable the plugin with `/plugin`
— the skills work on their own, they just wait to be asked.

**OpenAI Codex:** copy the directories under `skills/` into `~/.codex/skills/`.

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
