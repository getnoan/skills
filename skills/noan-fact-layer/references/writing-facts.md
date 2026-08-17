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

## Naming

Slugs are semantic addresses agents resolve against.

- Plain, predictable, hyphenated: `customer-profile`, `pricing-starter`.
- Before creating a block, check for near-twins (`GET /blocks?slug=…`,
  `GET /blocks?title=…`). `product-strategy` and `productstrategy` will
  both get retrieved and will drift apart within a month. If a near-twin
  exists, update it — don't create a sibling.

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
4. Re-read and verify the block holds exactly 1 fact and every prior entry
   survived

Posting only your new entry wipes the rest. There is no partial write.

## Provenance and honesty

- Write only what the company asserts or the user confirmed. If you
  reasoned your way to a claim, flag it to the user before writing.
- Missing information becomes a task (`POST /tasks`), never a
  plausible-looking fact. A confidently wrong fact is worse than an absent
  one — every downstream agent grounds on it.
- Convert relative dates ("last quarter", "next month") to absolute ones at
  write time; facts outlive the conversation that produced them.
