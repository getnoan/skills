# The connector route — NOAN through MCP

Read this when NOAN reaches you as **tools** rather than as a key: `get_me`,
`search_knowledge`, `list_stacks`, `list_facts`, `create_fact` and the rest are
in your tool list. That is how Claude, ChatGPT and other chat apps connect: the
user adds NOAN as a connector (address `https://mcp.getnoan.com/mcp`) and signs
in with their NOAN account. Coding assistants set up by the wizard get the same
tools.

Everything in SKILL.md about **what** to do still holds — ground before
generating, never fabricate, one truth one home, confirm writes first, and the
rules in `writing-facts.md`. This file covers **how** it differs when the only
hands you have are the tools.

## Auth is already done

The sign-in was the auth. There is no key on this route and none is needed:

- Do not ask for an API key, do not tell the user to create one, and do not
  send them to the wizard or a terminal. A chat app has no terminal, and the
  SKILL.md setup section is for the REST route only.
- Call `get_me` once at the start. It returns the `project` you are working
  in, the `identity` your writes are attributed to, and `scopes` — what this
  sign-in may do. A write the scopes don't cover is a boundary, the same as a
  `403` on the REST route: stop, don't work around it.
- If the NOAN tools are missing or every call fails to authenticate, the
  connector is not connected or not switched on in this conversation. Say so
  and point the user to <https://www.getnoan.com> for the setup guide; don't
  fall back to asking for a key.

## Which tool does what

| Goal | Tool | REST equivalent in SKILL.md |
| --- | --- | --- |
| Who am I, which workspace | `get_me` | `GET /me` |
| Find what the business knows about a topic | `search_knowledge` | none — semantic, see below |
| Stacks and their blocks | `list_stacks` (`inUseOnly` defaults to `true`) | `GET /stacks`, `GET /blocks` |
| Facts in named blocks | `list_facts` with `blockSlugs` | `GET /facts?block_slug=…` |
| Write a fact | `create_fact` | `POST /facts` |
| Contacts | `find_contact`, `create_contact`, `update_contact`, `add_memos_to_contact`, `add_company_role` | `/contacts` routes |
| Tasks | `list_tasks`, `create_task`, `update_task`, `complete_tasks` | `/tasks` routes |
| Notes | `list_notes`, `create_note` | `/notes` |
| Tags | `list_tags`, `create_tags`, `update_tag`, `tag` | `/tags`, the `PUT …/tags` routes |
| Assets | `list_assets`, `read_asset`, `create_asset`, `update_asset` | `/assets` routes |
| Stuck on NOAN itself | `consult_verity`, then `report_outcome` | none |

Tool descriptions are the live contract. Where one disagrees with this table,
the tool wins — tell the user which line here is stale.

## Where the connector differs

**Reading the whole fact base takes batches.** `list_facts` with no
`blockSlugs` returns at most `limit` facts (default 50, max 200), and it has no
page or offset — a workspace with more blocks than that is cut off with nothing
in the response saying so. To read everything: take every block slug from
`list_stacks`, then call `list_facts` with those slugs in batches of up to 200.
SKILL.md's rule still applies — never call a fact missing until you have read
the full fact base.

**`search_knowledge` finds; it does not prove absence.** It is semantic and
permission-filtered, and very short facts are not indexed at all. Use it first
to find where something lives; when it comes back empty, read the blocks
before reporting a gap, and report it as "I could not find it", never "there
is none".

**`create_fact` still replaces the block wholesale**, exactly like
`POST /facts`: read the block with `list_facts`, splice your change into the
current content verbatim, write the full result, then re-read and diff. Two
things are different:

- `create_fact` caps `content` at 20,000 characters and the REST route does
  not. A block already longer than that cannot be rewritten through the
  connector — say so rather than trimming someone's fact to fit.
- Depending on workspace settings, a fact written here may wait for human
  approval before it becomes ground truth. If a re-read doesn't show it yet,
  that is the likely reason — tell the user rather than writing it again.

**No tool creates or adopts stacks and blocks.** The connector writes facts
into blocks that already exist; it cannot create a custom stack, add a block,
or turn on a managed stack. When the right home doesn't exist, give the user
the exact structure to create in the app at <https://app.getnoan.com> — stack
title and description, block titles and descriptions, per `writing-facts.md` —
and carry on once they say it is there. `list_stacks` with `inUseOnly: false`
still shows the managed and industry stacks they could turn on instead.

**Fact history is not exposed.** There is no tool for a fact's versions. If
the user needs the lineage, it is in the app.

**Tasks use `column`, not `status`**, by name (`Backlog`, `In Progress`,
`Done`). There is no comment tool, so progress the REST route would post as a
task comment has nowhere to go on the task itself. Don't overwrite `details`
with it — `details` is the brief. Put it in a note and tell the user where.

## First connect, on this route

Follow `first-connect.md` with these substitutions:

- **Step 0.** `get_me`, then `list_stacks`. There is no fact count: an empty
  or near-empty `list_facts` over the in-use blocks is the empty-workspace
  signal.
- **Step 1 — sources.** In a chat app the user's material usually lives in
  that app's own connectors — Google Drive, Notion and the like —
  or arrives as attachments. Ask which they have connected and read through
  those tools. Those are the chat app's connectors, not NOAN's; if the one
  they need isn't connected, they add it in the app, not in NOAN.
- **Step 3 — architecture.** Prefer homes that already exist: blocks in the
  in-use stacks, then managed or industry stacks the user can turn on. Custom
  stacks are still right when the business needs them, but on this route the
  user creates them in the app from your proposal, so keep that list short and
  exact.
- **Step 4 — write.** Once the blocks exist, take their slugs from
  `list_stacks` — never construct one — and fill each with `create_fact`.
- **Step 5 — gaps.** `create_task` with `column: "Backlog"`. There is no
  `externalId` on this route, so dedupe by reading `list_tasks` and comparing
  titles before creating.
