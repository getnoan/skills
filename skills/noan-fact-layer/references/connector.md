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
- The tool list is cut to what the sign-in may do. If the read tools are
  there but `create_fact`, `create_task` and the other writes are not, this is
  a read-only connection — tell the user writes need their NOAN access
  widened, instead of saying the feature doesn't exist.
- If the NOAN tools are missing or every call fails to authenticate, the
  connector is not connected or not switched on in this conversation. Say so
  and point the user to <https://www.getnoan.com> for the setup guide; don't
  fall back to asking for a key.

## Which tool does what

The tool descriptions are the reference for what each tool takes and returns,
its limits and its defaults. Read them there; this file covers what to do with
them.

## Where the connector differs

**Read the whole fact base before calling a fact missing.** `list_facts`
returns at most `limit` facts per call, and its `offset` parameter says how to
read the rest. SKILL.md's rule still applies: never call a
fact missing until you have read the full fact base.

**`search_knowledge` finds; it does not prove absence.** It is semantic and
permission-filtered, and very short facts are not indexed at all. Use it first
to find where something lives; when it comes back empty, read the blocks
before reporting a gap, and report it as "I could not find it", never "there
is none".

**`create_fact` still replaces the block wholesale**, exactly like
`POST /facts`: read the block with `list_facts`, splice your change into the
current content verbatim, write the full result, then re-read and diff. Two
things to watch:

- A block already longer than `create_fact` accepts cannot be rewritten through
  the connector. Say so rather than trimming someone's fact to fit.
- Depending on workspace settings, a fact written here may wait for human
  approval before it becomes ground truth. If a re-read doesn't show it yet,
  that is the likely reason — tell the user rather than writing it again.

**Stacks and blocks are writes, like facts.** Propose the exact structure per
`writing-facts.md` and wait for the user's yes before any of these:

- `use_stack` adds a managed stack to the project. `list_stacks` with
  `inUseOnly: false` shows the managed and industry stacks it can add. Check
  these before creating anything custom.
- `create_stack` creates a custom stack with its blocks, and returns their ids.
- `add_block` adds a block to a custom stack. Managed stacks accept no new
  blocks.

**Insights point at blocks and facts by id.** A suggestion from
`list_insights` is a proposal: acting on it is a write, so it waits for the
user's yes like any other.

**There are no delete tools.** Removing a stack, block or fact is done by a
person in the NOAN app. Don't write an empty or placeholder fact in place of a
delete.

**Fact history is not exposed.** There is no tool for a fact's versions. If
the user needs the lineage, it is in the app.

**Progress on a task goes in `add_task_comment`**, as it would in a task
comment on the REST route. Don't overwrite `details` with it, since `details`
is the brief.

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
  in-use stacks, then managed or industry stacks to add with `use_stack`.
  Custom stacks are still right when the business needs them. After the
  user's yes, create them with `create_stack` and `add_block`.
- **Step 4 — write.** Take block ids from `list_stacks` or from the create
  results, never construct one, and fill each block with `create_fact`.
- **Step 5 — gaps.** `create_task` with `column: "Backlog"`. There is no
  `externalId` on this route, so dedupe by reading `list_tasks` and comparing
  titles before creating.
