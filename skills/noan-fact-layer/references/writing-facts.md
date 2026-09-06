# Writing facts well

Read this before any write to stacks, blocks, or facts — not just during
first connect. These rules are what keep a fact layer retrievable a year in;
workspaces don't fail on day one, they degrade from day two.

## Granularity

One block = one coherent truth that is independently useful to an agent.

- Don't paste a whole About page into one block — that's a document, and
  documents are what the fact layer replaces.
- Don't shatter truth into one-line fragments across many blocks either. A
  block's content should stand alone without its neighbours.
- If two truths always change together (e.g. a plan's price and its seat
  count), they belong in one block. If they change independently (pricing
  vs. ICP), they belong in separate blocks.

## Descriptions are routing instructions, not summaries

Every stack and block gets a description written for a **retrieving agent**,
not a human browsing a sidebar. Agents read descriptions first and only open
a block they judge relevant — a block with a vague description is
effectively invisible no matter how good its content.

A description must say what's inside *and when to reach for it*:

- Bad: `Info about our customers`
- Good: `Who we sell to: segment definitions, qualifying criteria, and
  disqualifiers. Read before writing any outbound, sales, or positioning
  copy.`

## Naming — you choose titles, the API chooses slugs

**There is no slug field on any write.** `POST /stacks` and
`POST /stacks/{stackId}/blocks` accept `title` and `description` only; the slug
is generated from the title and returned in the create response. Use the slug
that comes back — don't construct one and don't expect it to be tidy. A block
you create lands on something like
`fed75daf-agent-config-a28bc-agent-ideas-catalog`
(`<stack-id-prefix>-<stack-title>-<random>-<block-title>`). Short, clean slugs
like `customer-profile` belong to NOAN's managed template blocks and are not
what your writes produce.

So the title is the whole lever: it's what the slug derives from and what
`GET /blocks?title=` searches. Write it plain and hyphenatable.

Before creating a block, check for near-twins with **`GET /blocks?title=…`**,
which is a case-insensitive substring match. Do **not** use `?slug=` for this —
it is exact-match, so it returns 0 for anything but the full generated slug and
reads as "no such block" for a block that exists. `product-strategy` and
`productstrategy` will both get retrieved and will drift apart within a month.
If a near-twin exists, add to it — don't create a sibling. The API agrees:
creating a stack whose title already exists, or a block whose title already
exists in that stack, is a `409` conflict, not a second copy.

One consequence worth internalising: because you can't predict a slug, an empty
`GET /facts?block_slug=<the-name-you-guessed>` means **you guessed the wrong
slug**, not that the block has no fact. Resolve through `GET /blocks` first,
every time.

Blocks can only be added to **custom** stacks. Managed stacks cannot be created
or modified through the API.

## One truth, one home

A claim should have exactly one owning block. Other blocks may *mention* it
but should defer to the owner, not restate it — restated claims are the ones
that silently diverge when the owner is updated. If you find the same claim
asserted in two blocks with different values, surface it to the user as a
conflict; don't pick a winner silently.

## The replace rule

**`POST /facts` replaces the block's fact wholesale.** For any block that
already has content, the mandatory pattern is:

1. `GET /facts?block_slug=…` and take the current content **verbatim**
2. Splice your change into it
3. `POST` the complete amended content
4. Re-read and diff: every prior entry must still be present, and the new
   content should be no shorter than the old minus what you deliberately removed

Posting only your new entry wipes the rest. There is no partial write.

Step 4 has to be a real content diff. Counting facts proves nothing —
`GET /facts?block_slug=…` returns the single latest fact per block by
construction, so it reads `1` whether your splice preserved everything or
destroyed it. If you kept the fact `id` from before the write, walk
`GET /facts/{factId}/versions` to compare against the prior version directly;
any version id in a chain resolves the whole chain, so an id captured earlier
still works after the write.

Don't guard the amended content against a length limit. Facts have no enforced
ceiling in practice — a live production fact currently runs past 38,000
characters — and since this pattern re-posts the whole block every time, content
grows monotonically by design. A guard set to a documented-looking number would
start silently refusing writes to exactly the blocks that matter most.

## Provenance and honesty

- Write only what the company asserts or the user confirmed. If you
  reasoned your way to a claim, flag it to the user before writing.
- Missing information becomes a task (`POST /tasks`), never a
  plausible-looking fact. A confidently wrong fact is worse than an absent
  one — every downstream agent grounds on it. Task `details` caps at 2048
  characters and is rejected, not truncated, above it: for a longer handoff
  `POST /notes` (25,000) and reference the note from `details`.
- Convert relative dates ("last quarter", "next month") to absolute ones at
  write time; facts outlive the conversation that produced them.
