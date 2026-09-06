# Interview path — seeding with no sources

Use this when first connect (see `first-connect.md`) finds no website, repo,
or documents to extract from. Do not seed from imagination: interview the
user, write only their answers, and be explicit that the workspace is a
stub. A small verified fact layer beats a large invented one — the invented
one is slop with an API in front of it.

## How to run it

Ask in batches of 2–3, not all at once. Use the user's own words in the
facts — tidy grammar, but don't paraphrase their positioning into generic
copy. After each batch, reflect back what you'll record so they can correct
it before it becomes truth.

## The questions

**Identity**
1. What is the company called, and in one sentence, what does it do?
2. Who founded it, when, and why — what did you see that made you start it?

**Customer**
3. Who exactly buys this? Describe the last three customers or the ones you
   want most: company size, role of the buyer, what they were doing before.
4. Who is *not* a fit, even if they ask? (Disqualifiers are as load-bearing
   as qualifiers — agents use them to say no.)

**Problem and product**
5. What breaks in the customer's world without you? What does it cost them?
6. What does the product actually do about it — the mechanism, not the
   slogan?
7. What exists today: live product, beta, pilot customers, revenue? Be
   precise; agents will repeat whatever you claim here.

**Commercial**
8. How do you charge, and what are the current numbers? If pricing isn't
   settled, say so — that becomes a task, not a fact.

**Positioning**
9. Who else solves this, and what's your one-line answer to "why you over
   them"?
10. What tone should everything written in your name take? Any hard rules
    (words you never use, claims you never make)?

## Writing it up

Map answers to blocks per the structure rules in `writing-facts.md`, then
**propose that structure and get one explicit yes before writing** — the same
gate as step 3 of `first-connect.md`, and it applies here too. Reflecting back
each batch of answers confirms the content; it does not confirm the shape, and
the shape is the part that is expensive to redo. Present it as stacks → blocks
→ one line on what goes in each, then write.

Take the generated block slugs from the `POST /stacks` response; don't build
them from titles (see `writing-facts.md`).

Every question the user answered with "not settled yet" or "I don't know"
becomes a task (`POST /tasks`), not a fact. If you may run this path more than
once for a workspace, dedupe those tasks client-side on `externalId` — the API
neither enforces it nor lets you filter by it (see step 5 of
`first-connect.md`).

Close by telling the user exactly which blocks exist, which are stubs, and what
single action comes next.
