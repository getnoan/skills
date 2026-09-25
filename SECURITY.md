# Security

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue:
use **Report a vulnerability** on this repository's Security tab, or email
**<security@getnoan.com>** with enough detail to reproduce. We will acknowledge
receipt and keep you updated while we work on a fix.

## What this repository contains

Instructions, not code that runs on its own. Each skill is a `SKILL.md` that
your coding agent reads and then acts on with its own tools. The one
executable piece is the optional ambient-capture hook in `hooks/`: on session
start it prints `hooks/capture-instruction.md` into the session, and does
nothing else.

Because a skill steers what an agent does, treat a change to one like a change
to code: read it before you install it, and pin a version you have read.

## How the skills handle your NOAN key

- The skills read the key from the `NOAN_API_KEY` environment variable. They
  tell the agent to keep it in a gitignored `.env`, and never to write it into
  a file that is committed or into an assistant's config.
- The key carries your permissions in your NOAN workspace, and the agent acts
  with it. Mint one per machine or agent, so a leaked key can be revoked
  without touching the others.
- CI runs a secret scan over every push and pull request, and GitHub secret
  scanning with push protection is on for this repository.
