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
NOAN's opinionated starting map of a business, in every project's catalogue, with
blocks NOAN maintains; and *custom* stacks, created by you for anything beyond
that map. A stack from `GET /stacks` says which it is in its `managed` field,
and `custom_only=true` filters to the custom ones. You can add blocks to both.

**Block** — one topic inside a stack: one coherent truth that is independently
useful to an agent. A block holds at most one current fact and is addressed by
a slug the API generates (see Naming below).

**Fact** — the content of a block: plain text, versioned, self-contained.
`POST /facts` supersedes the block's current fact wholesale; prior versions stay
readable in history, but readers see only the latest.

One consequence of the managed/custom split is worth knowing before you plan
anything: **a topic that fits a managed stack goes in that stack.**
`POST /stacks/{stackId}/blocks` adds a block to a managed stack as well as a
custom one. The block belongs to this workspace only, and NOAN's own blocks in
that stack stay as they are. A custom stack is for a subject the managed map
doesn't carry at all, not for one extra topic next to a managed stack.

## What a fact layer should cover

The managed map is eleven stacks, one per area most businesses need answered.
Treat it as a checklist for coverage, not a schema to conform to: it tells you
what an agent will come looking for, and where to look first.

| Stack | An agent should be able to answer | Managed blocks that already hold it | Usually added as custom |
|---|---|---|---|
| **Company** | Who we are, where, who runs it, how to reach us | `startup-elevator-pitch`, `company-name`, `origin-story`, `mission-vision`, `operations-leadership-bios`, `person-team`, `contact-details`, `startup-locations`, `hr-process`, `person-open-roles` | a stack per site or region, once `startup-locations` stops being enough |
| **Products and Services** | What we sell, what it costs, how it works, how to buy it | `product-list`, `product-features`, `commercial-pricing`, `product-how-it-works`, `product-faq`, `product-manual`, `product-integrations`, `process-customer-journey`, `process-booking` | a block per plan, product line or service, in this stack |
| **Target Market** | Who we sell to, how the market segments, what they need, how they buy | `ideal-customer`, `audience-segments`, `startup-problem`, `customer-objections`, `customer-buying-process`, `commercial-discount-rules` | a block per segment, once one stops being enough |
| **Brand Guidelines** | How we sound and what we stand for: guidance for how to write, not facts to repeat to a customer | `brand-positioning`, `brand-tone`, `content-principles`, `key-messages`, `brand-look-and-feel` | rarely anything |
| **Customer Proof** | Who uses us and what they say about it | `product-case-studies`, `agency-testimonials`, `customer-named-customers`, `metric-customer-results`, `metric-reviews-and-ratings` | a block per flagship case study |
| **Customer Policies** | What customers are told about terms, refunds, shipping, privacy and security | `policy-terms-of-service`, `ecomm-returns`, `ecomm-shipping`, `privacy-policy`, `policy-security`, `risk-regulations` | a block per regulatory regime |
| **Strategy** | How we make money, what we're aiming for, how it's measured, who we compete with | `monetization-model`, `year-goals`, `growth-turnover`, `metric-metric-definitions`, `research-market`, `competitive-known` | a block per competitor, once one stops being enough |
| **Investors** | How we're funded, who backs us, what we tell them, the main risks | `startup-fundraising-status`, `startup-investor-update`, `organization-ownership-and-backers`, `risk-key-risks` | rarely anything |
| **People and HR** | How the team is organised and run, internally | `business-staffing`, `process-employee-onboarding`, `policy-hr` | a block per staff policy |
| **Operations and Tools** | How work gets done and the tools it runs on, internally | `experience-technology-platforms`, `sales-process`, `process-runbooks`, `organization-suppliers`, `agent-capabilities` | a block per recurring process |
| **Agent Rules** | What agents may and may not do, what needs approval, when they hand off | `agent-allowed-actions`, `process-approvals`, `process-hand-off-rules`, `agent-disclosure`, `content-compliance-regulations`, `risk-sensitive-topics` | rarely anything |

The third column is the main blocks, not all of them: `GET /blocks` lists the
rest. It is where to look first, not where the truth has to go — but look,
because writing a claim into a new block while a managed block already holds it
is exactly the duplicate "One truth, one home" below is about. **People is the
row that catches people out:** leadership, the team, open roles and hiring live
in `Company`, and only departments, staff onboarding and staff policies in
`People and HR`.

There are no industry stacks. A topic specific to the business (a menu, a fund
thesis, a service line) goes in a custom stack, or as a block in the managed
stack it fits.

**Two calls, two purposes — don't cross them.** Unfiltered, `GET /stacks` and
`GET /blocks` return the whole catalogue the key can reach, including stacks this
project has never adopted. That is what you scan for a home before creating
anything, and scanning it with `in_use_only=true` on is precisely how you miss the
one you were looking for. With the filter on you get this project's own map, which
is what you want when grounding an answer and during first connect, where the
unfiltered catalogue makes an empty workspace look populated. Both carry `managed`
and the parent stack on every item.

**A home named above may not be adopted here.** Being in the catalogue and being
in this project's map are different things: a new project starts with `Company`
only, so the other ten are absent from its map until someone adds them, and then
`GET /blocks?in_use_only=true` returns none of their blocks. Check with the
filter on before concluding anything — and when a home exists in the catalogue
but not in this project, **say so and propose adding that stack to the
project.** `POST /stacks/{stackId}/use` adds it, with no body, and `inUse` on
`GET /stacks` then reads true. It is a write like any other, so it waits for the
user's go. Writing a fact into one of its blocks adds the stack too, so that is
no way around asking. Creating a custom near-twin instead is the duplicate "One
truth, one home" is about. Neither is yours to choose silently.

Where a managed block already holds a fact, none of this is undoable: there is
no delete for a fact or a block, so you cannot empty one side to make room for
the other. Leave the managed block answering and have the custom block defer to
it by name in its own fact — the same pointer remedy as a merge (see Scale).

A gap in the checklist is a finding, not a failure. A two-person company with no
investors has nothing to write in that row, and an honest empty row beats a
block of plausible filler. Gaps become tasks (see Provenance and honesty).

### Set up first: an agentic startup

An agentic startup, one that runs support, sales or onboarding through AI
agents, gets the same questions first from its own agents and from its
customers' agents. Set up these six areas before anything else, in this order.
The stacks above still apply: this is the order to fill them in.

| Area | An agent should be able to answer | Managed blocks that already hold it | Usually added as custom |
|---|---|---|---|
| **Product** | How the product works, feature by feature, what it connects to, and what is coming | `product-list`, `product-features`, `product-how-it-works`, `product-integrations`, `product-manual`, `product-known-issues`, `product-roadmap` (stack `Products and Services`) | a block per area of the product, next to `product-manual` |
| **Delivery** | How a customer gets set up, how they get help, and when we escalate | `process-customer-journey`, `product-requirements`, `process-response-times` (stack `Products and Services`); `process-hand-off-rules` (stack `Agent Rules`) | a block per implementation step, once the journey stops being enough |
| **Pricing** | What it costs and how it is billed | `commercial-pricing`, `commercial-payment-terms`, `product-discount` (stack `Products and Services`); `monetization-model` (stack `Strategy`) | a block per plan |
| **Market and positioning** | Who it is for, why they choose us, how we talk to them | `ideal-customer`, `audience-segments` (stack `Target Market`); `brand-positioning`, `key-messages`, `brand-tone` (stack `Brand Guidelines`) | rarely anything |
| **Trust** | How customer data is handled, secured and kept compliant | `policy-security`, `privacy-policy`, `risk-regulations` (stack `Customer Policies`) | a block for subprocessors |
| **Company and numbers** | How to reach us, who runs it, what we are aiming for this year | `contact-details`, `operations-leadership-bios` (stack `Company`); `year-goals` (stack `Strategy`) | rarely anything |

Product and Delivery come first because they are what a support agent answers
from. An agent that replies to customers before those exist answers from
absence, and either escalates everything or guesses. Only `Company` is in a new
project: add `Products and Services`, `Agent Rules`, `Target Market`,
`Brand Guidelines`, `Customer Policies` and `Strategy` as described above.

## Custom is the normal path

Managed stacks are a starting map of what most businesses share. A real business
still has edges the map doesn't reach.
Create a custom stack or block whenever:

- a managed block's title nearly fits, but you would have to bend the content
  to land it there;
- the business has a topic the map has no slot for — a service line, a
  regulatory regime, a channel, a region, a franchise model;
- the team already has its own vocabulary for something, and a template name
  would make it harder to find rather than easier.

**Kettlewell Veterinary Group** — an invented example used throughout this file
— covers the managed stacks above, then adds what the map doesn't carry: a
custom
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
  right answer when the subject is genuinely small but genuinely separate. When
  the natural neighbour is a managed stack, add the blocks there instead. Past a
  dozen blocks, a stack has usually become two subjects.
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
  stack, the new half can go in that same stack:
  `POST /stacks/{stackId}/blocks` works on managed stacks too.
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

**Know what a description can and cannot do.** `GET /stacks` and `GET /blocks`
return it, enough to name a block without reading its fact.

But a description is written once, on create, and never afterwards: there is no
update route for a stack or a block. So it is a label on the container, fixed at
birth, while the fact inside it is versioned and rewritable. An agent grounding over the API still routes on
**titles** and on the **content of the facts themselves** — anything a later
reader must know belongs in the fact, not in the description around it, because
the description is the one part of the workspace nobody can correct.

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
like `ideal-customer` belong to NOAN's managed template blocks and are not what
your writes produce.

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
`GET /blocks?slug=<the-name-you-guessed>` means **you guessed the wrong
slug**, not that there is no such block or fact. Find the block through
`GET /blocks` by title first, every time, then read and write it by its `id`.

Blocks can be added to **managed and custom** stacks. Managed stacks cannot be
created through the API, and NOAN's own blocks in them cannot be changed.

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
plausibly belongs to either side. Owners below are managed stacks; a custom stack that
takes over part of one takes over its seams too.

| Seam | Owner | Managed home | Not the owner |
|---|---|---|---|
| Who we sell to | **Target Market**: segments, what they need, how they buy | `ideal-customer`, `audience-segments`, `customer-buying-process` | Operations and Tools, which owns how a deal runs, not who is out there |
| How a deal runs | **Operations and Tools**: the sales process | `sales-process` | Target Market (who buys and how they decide), Products and Services (how to book or get a quote) |
| Why we win | **Brand Guidelines**: positioning, key messages | `brand-positioning`, `key-messages` | Products and Services (what the feature does), Customer Proof (the evidence) |
| What it costs | **Products and Services**: one block per tier or service | `commercial-pricing`, `product-discount` | Strategy (`monetization-model` is how the company makes money, not a price list), Target Market (`commercial-discount-rules` is who may give a discount) |
| Numbers we chase | **Strategy**: company targets and how they're measured | `year-goals`, `growth-turnover`, `metric-metric-definitions` | Company (`metric-headline-figures` is the public figures), Products and Services (roadmap dates) |
| People | **Company**: leadership, team, open roles, hiring; **People and HR**: departments and staff policies | `operations-leadership-bios`, `person-team`, `hr-process`, `business-staffing` | Operations and Tools, which owns processes and tools, not people |
| What a customer is told | **Customer Policies**: terms, refunds, privacy, security | `policy-terms-of-service`, `privacy-policy`, `policy-security` | Agent Rules, which is internal and never quoted to a customer |

Customer Policies against Agent Rules is the seam that goes wrong most often,
because both read like rules. They are not duplicates if you keep the split
above (the first is what a customer is told, the second is what an agent may
do), but write an internal rule into a policy and agents quote it to customers.

An area the checklist doesn't name — a channel, a partner programme, a
franchise model — gets the same treatment: when you create it, decide what it
owns and what it defers to, and put that in the owning block's own fact, where a
later agent can actually read it. Not in the stack or block description: those
are set on create, never updated, and not what an agent reads when it grounds on
facts (see Descriptions above).

These apply to custom stacks too, and matter more there: a custom
`Enterprise Sales` stack must defer to `Operations and Tools` on the sales
process and to `Products and Services` on rates, or they drift apart within a
month.

## The replace rule

**`POST /facts` replaces the block's fact wholesale.** For any block that
already has content, the mandatory pattern is:

1. `GET /facts?block_id=…` and take the current content **verbatim**
2. Splice your change into it
3. `POST` the complete amended content
4. Re-read and diff: every prior entry must still be present, and the new
   content should be no shorter than the old minus what you deliberately removed

Posting only your new entry wipes the rest. There is no partial write.

Step 4 has to be a real content diff. Counting facts proves nothing —
`GET /facts?block_id=…` returns the single latest fact per block by
construction, so it reads `1` whether your splice preserved everything or
destroyed it. If you kept the fact `id` from before the write, walk
`GET /facts/{factId}/versions` to compare against the prior version directly;
any version id in a chain resolves the whole chain, so an id captured earlier
still works after the write.

## Provenance and honesty

- Write only what the company asserts or the user confirmed. If you
  reasoned your way to a claim, flag it to the user before writing.
- Missing information becomes a task (`POST /tasks`), never a
  plausible-looking fact. A confidently wrong fact is worse than an absent
  one — every downstream agent grounds on it. For a handoff longer than
  `details` takes, write a note (`POST /notes`) and reference it from `details`.
- Convert relative dates ("last quarter", "next month") to absolute ones at
  write time; facts outlive the conversation that produced them.
