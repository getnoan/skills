# Writing facts well

Read this before any write to stacks, blocks, or facts — not just during
first connect. These rules are what keep a fact layer retrievable a year in;
workspaces don't fail on day one, they degrade from day two.

The first half is shape — what the three layers are, what a fact layer should
cover, and what an individual fact should look like. The second half is the
discipline that keeps that shape from eroding.

## The three layers

**Stack** — a subject area of the business, and the unit an agent routes on. It
is a container of topics and is never empty. Two kinds exist: *managed* stacks,
NOAN's opinionated starting map of a business, present in every workspace and
fixed; and *custom* stacks, created by you for anything beyond that map. A
stack from `GET /stacks` says which it is in its `managed` field, and
`custom_only=true` filters to the ones you can add to.

**Block** — one topic inside a stack: one coherent truth that is independently
useful to an agent. A block holds at most one current fact and is addressed by
a slug the API generates (see Naming below).

**Fact** — the content of a block: plain text, versioned, self-contained.
`POST /facts` supersedes the block's current fact wholesale; prior versions stay
readable in history, but readers see only the latest.

One consequence of the managed/custom split is worth knowing before you plan
anything: **you cannot add a block to a managed stack.**
`POST /stacks/{stackId}/blocks` works on custom stacks only. So the moment the
business needs a topic the managed map doesn't already carry, it is a custom
stack — by construction, not as a workaround.

## What a fact layer should cover

Most businesses need these seven areas answered somewhere. Treat it as a
checklist for coverage, not a schema to conform to: it tells you what an agent
will come looking for, not what your stacks have to be called.

| Area | An agent should be able to answer | Managed blocks that already hold it | Usually added as custom |
|---|---|---|---|
| **Customer** | Who we sell to, how the market segments, what each segment cares about | `ideal-customer`, `audience-segments`, `audience-description`, `audience-interests` — stack `Customer` | a block per segment, once four stop being enough |
| **Product** | What we sell, what each part does, where it's going | `product-list`, `product-features`, `product-strategy`, `product-roadmap`, `product-FAQ`, `product-case-studies`, `product-discount` — stack `Product` | a `Pricing` stack: one block per tier or service |
| **Brand** | What we stand for, how we position, how we sound | `brand-positioning`, `value-proposition`, `mission-vision`, `business-impact`, `brand-tone`, `brand-identity`, `brand-experience-principles` — stack `Brand` | rarely anything |
| **Sales** | Who qualifies, who we turn away, how a deal runs | `sales-customer-profile`, `sales-ICP-triggers`, `sales-buyer-persona`, `sales-buyer-segments`, `sales-process`, `sales-principles`, `sales-objectives-metrics`, `sales-proposal-format` — stack `Sales` | an `Objection Handling` stack: one block per objection |
| **Team** | Who does what, who decides, how we hire | `operations-leadership-bios`, `business-staffing` — stack `Operations`; `hr-process`, `hr-jobdescription` — stack `Recruiting` | a `Team` stack only for what those four can't hold (decision rights, org shape) — and then leave them empty rather than filling both |
| **Goals** | What we're trying to hit, by when, and how it's measured | `year-goals`, `growth-okrs`, `growth-five-year`, `quarterly-planning`, `growth-metrics`, `growth-gtm-metrics` — stack `Growth` | a `Goals` stack when `Growth` is already being used for marketing only |
| **Operations** | How the company runs day to day | `contact-details`, `operations-social-handles`, `privacy-policy`, `cookie-policy` — stack `Operations` | tooling, sites, capacity, recurring processes — the managed four cover contact details and policies, nothing else |

The third column is where to look first, not where the truth has to go — but
look, because writing a claim into a new block while a managed block already
holds it is exactly the duplicate "One truth, one home" below is about. **Team is the row that catches
people out:** there is no managed `Team` stack, which does not mean there is no
managed home for the topic.

Those slugs are the managed catalogue as it stood on 2026-09-16. Managed stacks
ship in every workspace and their slugs are stable, but the catalogue does get
extended — confirm with `GET /blocks` (each item carries `managed` and its
parent stack) before relying on a name here, and use `in_use_only=true` to see
only what this project has actually added.

A gap in the checklist is a finding, not a failure. A two-person company with no
sales process has nothing to write in that row, and an honest empty row beats a
block of plausible filler. Gaps become tasks (see Provenance and honesty).

## Custom is the normal path

Managed stacks are a starting map. They are deliberately generic, and a real
business is not. Create a custom stack or block whenever:

- a managed block's title nearly fits, but you would have to bend the content
  to land it there;
- the business has a topic the map has no slot for — a service line, a
  regulatory regime, a channel, a region, a franchise model;
- the team already has its own vocabulary for something, and a template name
  would make it harder to find rather than easier.

**Kettlewell Veterinary Group** — an invented example used throughout this file
— covers the seven areas above, then adds what the map doesn't carry: a custom
`Clinical Services` stack with one block per service line (preventive care,
dentistry, orthopaedic surgery, diagnostic imaging), a custom `Practices` stack
with one block per site, and a custom `Referral Network` stack for the partner
hospitals it sends complex cases to. None of that is a deviation from good
structure. For that business, it *is* the structure.

What custom flexibility does not buy is a second home for a truth that already
has one. Before creating anything, check for near-twins by title (see Naming),
and read "One truth, one home" below: freedom is what creates duplicates, and
duplicates are what make a fact layer untrustworthy.

## Granularity

One block = one coherent truth that is independently useful to an agent.

- Don't paste a whole About page into one block — that's a document, and
  documents are what the fact layer replaces.
- Don't shatter truth into one-line fragments across many blocks either. A
  block's content should stand alone without its neighbours.
- If two truths always change together (e.g. a plan's price and its seat
  count), they belong in one block. If they change independently (pricing
  vs. ICP), they belong in separate blocks.

## The shape of a fact

A fact is read by an agent that has loaded it alongside dozens of others and
has no idea which block it came from. Write for that reader:

```markdown
# Wellness Plan — Adult Dog

Kettlewell's Adult Dog wellness plan is GBP 34/month and covers routine
preventive care for dogs aged 1–7.

## Included
- Two health examinations a year
- Core vaccinations and annual boosters
- Unlimited nurse consultations

## Not included
- Dentistry beyond the annual oral check
- Emergency and out-of-hours treatment

## Terms
Billed monthly, cancellable with 30 days' notice. Sold at all practices.

As of 2026-09-15.
```

Four things make that work:

1. **An H1 naming the truth**, matching the block title. Facts get concatenated
   with dozens of others; the heading is what tells a reader where this one
   starts.
2. **A lead assertion that stands alone.** Name the subject in the first
   sentence — "our plan is GBP 34/month" is useless the moment it is quoted
   anywhere else. This sentence is what gets retrieved and repeated.
3. **A short body in labelled sections.** Headings over prose, lists over
   paragraphs. Agents extract from structure; humans skim it.
4. **An ISO date** — `As of YYYY-MM-DD` — on anything that can go stale:
   prices, metrics, headcount, roadmaps, anything qualified by "currently".
   Undated facts age invisibly.

A thin fact is not a failure. The sizes below describe what a mature block
tends to look like, not a quota to fill: if all the company has asserted is one
sentence, the fact is that one sentence, dated, and the rest becomes tasks.
Padding a block to look substantial is how invented detail gets in, and every
downstream agent grounds on it.

Leave out: hedging and throat-clearing ("it's worth noting that we generally
try to…"), framing addressed to whoever asked, relative dates (convert "last
quarter" to the actual quarter at write time), instructions to the reader, and
any claim another block owns. Write a reference entry, not an answer.

## Scale — and when to split

Rough figures, deliberately so. These are the sizes that stay readable, not
limits the API enforces.

- **4–12 blocks per stack.** Below four, it often isn't a subject area — fold it
  into a neighbour while you are still planning, which is the only point at which
  folding is free. Where you can't, keep it: a three-block custom stack is the
  right answer when the natural neighbour is a managed stack you cannot add to,
  or when the subject is genuinely small but genuinely separate. Past a dozen
  blocks, a stack has usually become two subjects.
- **Most facts run 500–4,000 characters.** Under a couple of hundred, the block
  is a fragment that would sit better inside its neighbour. Past ~6,000, it is
  usually two blocks that have grown together. Nothing enforces this (see The
  replace rule), so drift is yours to notice.
- **One plan, persona, segment, site or service line per block** — never one
  omnibus block holding all of them. They change on different days, and because
  every write replaces the whole block, an edit to one rewrites all of them.

Split on the axis that changes independently: truths that always move together
belong in one block, truths that can move separately are two. That is the
Granularity test above, applied to a block that has outgrown itself.

**There is no move, and no delete.** The API has no `DELETE` on anything and no
`PATCH`/`PUT` on stacks, blocks or facts, so both splitting and merging are done
by hand and neither is free:

- **Splitting.** Create the new block, post the part that belongs there, then
  re-post the original block without it. The original keeps its slug and its
  whole version history; the new block starts with neither, so say in its first
  fact where the content came from. If the outgrown block sits in a *managed*
  stack, the new half goes in a custom stack —
  `POST /stacks/{stackId}/blocks` on a managed stack is refused
  (`403 ResourceNotAllowed`), and a split that assumes otherwise dies halfway
  with one block already rewritten.
- **Merging.** Copy the content into the neighbour and the original block still
  answers `GET /facts` with its old fact — you have made the duplicate the next
  section forbids. There is no way to remove it. Either leave a pointer fact in
  the source block ("Superseded: this content now lives in <block>"), or don't
  merge and let the small block stand.

Which is why the sizes above are worth applying while you are still drafting a
structure. After the blocks exist, every correction costs more than getting it
roughly right did.

## Descriptions — what they're for, and what they aren't

Every stack and block gets a description, written on create and never
afterwards — there is no update route for either.

**Know what a description can and cannot do.** No read endpoint returns one:
`GET /stacks` gives `{id, slug, title, managed, blocks}` and `GET /blocks` gives
`{id, slug, title, managed, stack}`. A description is echoed back once, on the
create response, and is otherwise for the humans curating the workspace in the
app. An agent grounding over the API routes on **titles** and on the **content
of the facts themselves** — so anything a later reader must know has to be in
the fact, not in the description around it.

Write them anyway, and write them well: they are how a human decides what
belongs in a block, which is what keeps two blocks from drifting into the same
subject. Write for a reader deciding *whether to open this block* — a
description that could sit above any block in the workspace is doing nothing.

A description must say what's inside *and when to reach for it*. A stack
description, bad and good:

- Bad: `Info about our customers`
- Good: `Who we sell to: segment definitions, qualifying criteria, and
  disqualifiers. Read before writing any outbound, sales, or positioning
  copy.`

A block description, same test — it is what tells the next person which of two
neighbouring blocks their new claim belongs in:

- Bad: `Dentistry`
- Good: `Dental service line: what the practice treats, what it refers out,
  and typical course of treatment. Read for clinical scope, not for what
  dentistry costs — that's the Pricing stack.`

## Naming — you choose titles, the API chooses slugs

**There is no slug field on any write.** `POST /stacks` and
`POST /stacks/{stackId}/blocks` accept `title` and `description` only; the slug
is generated from the title and returned in the create response. Use the slug
that comes back — don't construct one and don't expect it to be tidy. A block
you create lands on something like
`c4e19a7b-clinical-services-5f2dd-orthopaedic-surgery`
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

## One truth, one home — no overlap, no contradiction

Three rules, one per layer:

- **Stacks partition the business.** Two stacks should not compete to cover the
  same subject. "The map has no slot for this" is the right reason to create a
  custom stack; "the existing block's title isn't quite the word I'd use" is
  not.
- **Blocks state a claim once.** A claim has exactly one owning block. Others
  may *mention* it and defer to the owner, but must not restate it — restated
  claims are the ones that silently diverge when the owner is updated.
- **Facts must not contradict each other.** Two facts asserting different values
  for the same claim make the whole layer untrustworthy: an agent has no way to
  choose, so it picks one and sounds equally confident either way.

When you find a contradiction, surface it to the user as a conflict. Never pick
a winner silently — the disagreement is usually a real disagreement inside the
business, and resolving it is theirs to do, not yours.

Overlap is easiest to create at the seams between areas, where a claim
plausibly belongs to either side. Owners below are areas, not stack titles you
must adopt — read "Goals" as whichever stack holds your targets. `Pricing` is an
area most businesses split out even though the managed map has no block for it.

| Seam | Owner | Managed home | Not the owner |
|---|---|---|---|
| Who we sell to | **Customer** — the market: segments, audience, what they care about | `audience-segments`, `ideal-customer` | Sales, which owns the filter, not the market |
| Who we pursue | **Sales** — ICP, triggers, qualification *and* disqualification | `sales-customer-profile`, `sales-ICP-triggers`, `sales-buyer-persona` | Customer, which describes the market without qualifying it |
| Why we win | **Brand** — positioning, value proposition | `brand-positioning`, `value-proposition` | Product (what the feature does), Sales (how to argue it in a deal) |
| What it costs | **Pricing** — one block per tier or service | none: no managed pricing block exists | Product — except standing discount codes, which do have a managed home in `product-discount` — and Sales, which owns deal-level discretion and approval |
| Numbers we chase | **Goals** — company targets, OKRs, how they're measured | `year-goals`, `growth-okrs`, `growth-metrics` | Sales (`sales-objectives-metrics` is quota and pipeline, not company targets), Product (roadmap dates) |
| People | **Team** — roles, leadership, hiring | `operations-leadership-bios`, `business-staffing`, `hr-process` | Operations, which owns contact details and policies, not people |

The ICP is the seam that goes wrong most often, because the managed map itself
carries it twice: `ideal-customer` under Customer and `sales-customer-profile`
under Sales. They are not duplicates if you keep the split above — the first
describes who is out there, the second decides who you chase — but write them
without deciding that, and they diverge.

An area the checklist doesn't name — a channel, a partner programme, a
franchise model — gets the same treatment: when you create it, decide what it
owns and what it defers to, and put that in the owning block's own fact, where a
later agent can actually read it. Not in the stack or block description: those
are set on create and no read endpoint returns them (see Descriptions below).

These apply to custom stacks too, and matter more there: a custom
`Enterprise Sales` stack must defer to `Sales` on process and to `Pricing` on
rates, or the two drift apart within a month.

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
ceiling in practice — blocks well past 30,000 characters post fine — and since
this pattern re-posts the whole block every time, content grows monotonically
by design. A guard set to a documented-looking number would
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
