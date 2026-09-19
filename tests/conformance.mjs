#!/usr/bin/env node
// Conformance checks for the NOAN fact-layer skill.
//
// Every check ties a factual claim made in the skill to either the published
// spec or the live API. A red build means the documentation is wrong — not the
// code, of which there is none here.
//
// Each check carries `anchors`: exact phrases from the skill that make the
// claim. If an anchor disappears the check fails too, so a rewrite cannot
// quietly orphan its own test.
//
//   node tests/conformance.mjs            spec checks only
//   NOAN_API_KEY=... node tests/conformance.mjs   spec + live read-only checks
//
// Live checks are read-only and deliberately cheap: one request per check, eight
// GETs for a full run. They never print fact content, contact details or any
// other workspace data — only shapes, slugs and counts.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = join(ROOT, "skills", "noan-fact-layer");
const BASE = process.env.NOAN_API_BASE ?? "https://api.getnoan.com/v1";
const SPEC_URL = process.env.NOAN_OPENAPI_URL ?? "https://api.getnoan.com/openapi.json";
const KEY = process.env.NOAN_API_KEY ?? process.env.NOAN_PERSONAL_API_KEY ?? "";
// Set by CI on every event that is meant to reach the API. Without it, a
// rotated or revoked secret would leave the weekly backstop reporting success
// while checking nothing live.
const REQUIRE_LIVE = process.env.REQUIRE_LIVE === "true";

const FILES = {
  skill: join(SKILL_DIR, "SKILL.md"),
  writing: join(SKILL_DIR, "references", "writing-facts.md"),
  first: join(SKILL_DIR, "references", "first-connect.md"),
  interview: join(SKILL_DIR, "references", "interview.md"),
};

const text = Object.fromEntries(
  Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, "utf8")]),
);
// Anchors are matched against whitespace-collapsed text, so a claim that wraps
// across lines still matches the phrase a human would quote.
const flat = Object.fromEntries(
  Object.entries(text).map(([k, v]) => [k, v.replace(/\s+/g, " ")]),
);

let spec;
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail });

function anchorsPresent(name, anchors) {
  const missing = anchors.filter(
    ([file, quote]) => !flat[file].includes(quote.replace(/\s+/g, " ")),
  );
  if (missing.length) {
    record(
      name,
      false,
      `anchor text no longer in the skill: ${missing
        .map(([f, q]) => `${f}: "${q.slice(0, 60)}…"`)
        .join("; ")}\n     The claim was edited or removed — update this check, or restore the claim.`,
    );
    return false;
  }
  return true;
}

async function check(name, anchors, fn) {
  if (!anchorsPresent(name, anchors)) return;
  try {
    const detail = await fn();
    record(name, true, detail);
  } catch (err) {
    record(name, false, err.message);
  }
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
// Distinguishes "the key points at a workspace with nothing in it" from "the
// skill is wrong", which are the same red build otherwise.
const assertPopulated = (item, what) =>
  assert(
    item,
    `GET ${what} returned no items: this key's workspace is empty or re-scoped, so the shape checks could not run. That is a configuration problem, not a documentation one.`,
  );
const sameSet = (got, want) => {
  const g = [...new Set(got)].sort();
  const w = [...want].sort();
  return g.length === w.length && g.every((v, i) => v === w[i]);
};

// ---------------------------------------------------------------- spec checks

async function loadSpec() {
  if (!/^https?:/.test(SPEC_URL)) {
    // A local path is allowed so the spec checks can run offline, and so this
    // suite's own failure modes can be exercised against a doctored copy.
    spec = JSON.parse(readFileSync(SPEC_URL, "utf8"));
    return;
  }
  const res = await fetch(SPEC_URL);
  assert(res.ok, `GET ${SPEC_URL} -> ${res.status}`);
  spec = await res.json();
}

const methodsOf = (p) =>
  Object.keys(spec.paths[p] ?? {}).filter((m) =>
    ["get", "post", "put", "patch", "delete"].includes(m),
  );

async function specChecks() {
  await check(
    "no DELETE anywhere, and no PATCH/PUT on stacks, blocks or facts",
    [
      ["writing", "There is no move, and no delete."],
      ["writing", "the original block still answers `GET /facts`"],
    ],
    () => {
      const deletes = Object.keys(spec.paths).filter((p) =>
        methodsOf(p).includes("delete"),
      );
      assert(
        deletes.length === 0,
        `DELETE now exists on: ${deletes.join(", ")} — the merge/split guidance in writing-facts.md is out of date`,
      );
      for (const p of ["/stacks", "/stacks/{stackId}/blocks", "/facts"]) {
        const mutating = methodsOf(p).filter((m) => m === "patch" || m === "put");
        assert(
          mutating.length === 0,
          `${p} now accepts ${mutating.join("/")} — "no move, no delete" no longer holds`,
        );
      }
      return "no DELETE; no PATCH/PUT on stacks, blocks, facts";
    },
  );

  await check(
    "descriptions are absent from every read schema",
    [
      ["writing", "No read endpoint returns one"],
      ["skill", "descriptions (required on create, and returned by no read endpoint)"],
    ],
    () => {
      const s = spec.components.schemas;
      const has = (n) => Object.keys(s[n]?.properties ?? {}).includes("description");
      assert(
        !has("BlockListItem"),
        "BlockListItem now carries `description` — GET /blocks returns it, so the Descriptions section is out of date (this is the good outcome; see getnoan/noan#1555)",
      );
      assert(
        !has("Stack"),
        "Stack now carries `description` — GET /stacks returns it; update the Descriptions section",
      );
      assert(
        has("BlockDetailed"),
        "BlockDetailed no longer carries `description` — the create-response claim is wrong",
      );
      return "BlockListItem/Stack without it, BlockDetailed with it";
    },
  );

  await check(
    "a block created via POST /stacks echoes its description",
    [["writing", "`POST /stacks` returns it on the stack and on each nested block"]],
    () => {
      const blocks =
        spec.paths["/stacks"].post.responses["201"].content["application/json"].schema
          .properties.stack.properties.blocks;
      const ref = blocks?.items?.$ref ?? "";
      assert(
        ref.endsWith("/BlockDetailed"),
        `POST /stacks 201 nests blocks as ${ref || "an inline schema"}, not BlockDetailed — nested descriptions are not echoed after all`,
      );
      return "201 nests blocks as BlockDetailed";
    },
  );

  await check(
    "managed stacks reject added blocks",
    [
      ["writing", "`POST /stacks/{stackId}/blocks` on a managed stack is refused"],
      ["skill", "You cannot add a block to a managed stack"],
    ],
    () => {
      const op = spec.paths["/stacks/{stackId}/blocks"].post;
      assert(op.responses["403"], "POST /stacks/{stackId}/blocks no longer documents 403");
      const prose = `${op.description ?? ""} ${spec.paths["/stacks"].post.description ?? ""}`;
      assert(
        /managed stacks? cannot be (created or )?modified/i.test(prose),
        "the spec no longer says managed stacks cannot be modified — re-check before the skill keeps saying it",
      );
      return "403 documented; spec still says managed stacks cannot be modified";
    },
  );

  await check(
    "no single-task read, but a single-contact read",
    [["skill", "There is no `GET /tasks/{taskId}`"]],
    () => {
      assert(
        !spec.paths["/tasks/{taskId}"] || !methodsOf("/tasks/{taskId}").includes("get"),
        "GET /tasks/{taskId} now exists — SKILL.md says it does not",
      );
      assert(
        methodsOf("/contacts/{contactId}").includes("get"),
        "GET /contacts/{contactId} has gone — SKILL.md leans on it for memos",
      );
      return "tasks single-read absent, contacts single-read present";
    },
  );

  await check(
    "fact version history is readable",
    [["writing", "`GET /facts/{factId}/versions`"]],
    () => {
      assert(
        methodsOf("/facts/{factId}/versions").includes("get"),
        "GET /facts/{factId}/versions has gone — the replace-rule verification step depends on it",
      );
      return "present";
    },
  );

  await check(
    "creates still require what the write table says they require",
    [["skill", "`title`, `description`, `blocks[]` (each block needs `title` **and** `description`)"]],
    () => {
      const req = (n) => spec.components.schemas[n]?.required ?? [];
      for (const f of ["title", "description", "blocks"]) {
        assert(
          req("CreateStackRequest").includes(f),
          `CreateStackRequest no longer requires ${f}`,
        );
      }
      assert(
        req("CreateBlockRequest").includes("title"),
        "CreateBlockRequest no longer requires title",
      );
      return "CreateStackRequest: title, description, blocks";
    },
  );

  await check(
    "documented length limits still match the spec",
    [["skill", "task `details` 2048 · task comment `content` 25,000 · note `content` 25,000"]],
    () => {
      const max = (schema, field) =>
        spec.components.schemas[schema]?.properties?.[field]?.maxLength;
      const pairs = [
        ["CreateTaskRequest", "details", 2048],
        ["CreateTaskCommentRequest", "content", 25000],
        ["CreateNoteRequest", "content", 25000],
      ];
      const seen = [];
      for (const [schema, field, want] of pairs) {
        const got = max(schema, field);
        // A missing maxLength is a finding, not a skip: the skill states these
        // as hard numbers an unattended agent sizes its writes against.
        assert(
          got !== undefined,
          `${schema}.${field} no longer declares maxLength, so the skill's "${want}" is now unverifiable — check it against a live write before trusting it`,
        );
        assert(
          got === want,
          `${schema}.${field} maxLength is ${got}, the skill says ${want}`,
        );
        seen.push(`${field}=${got}`);
      }
      return seen.join(", ");
    },
  );

  await check(
    "first connect can still filter the template catalogue out",
    [
      ["first", "Keep `in_use_only` on both"],
      ["first", "a bare `GET /blocks` also returns NOAN's managed"],
    ],
    () => {
      const names = (path) =>
        (spec.paths[path].get.parameters ?? [])
          .map((x) => x.name)
          .filter(Boolean);
      for (const path of ["/blocks", "/stacks"]) {
        assert(
          names(path).includes("in_use_only"),
          `${path} no longer takes in_use_only — step 0 of first-connect.md would pull the whole managed catalogue and make an empty workspace look populated`,
        );
      }
      return "in_use_only present on /blocks and /stacks";
    },
  );

  await check(
    "GET /tasks still cannot filter on externalId",
    [["first", "`GET /tasks?externalId=…` is silently ignored and returns the **entire"]],
    () => {
      const names = (spec.paths["/tasks"].get.parameters ?? [])
        .map((x) => x.name)
        .filter(Boolean);
      assert(
        !names.includes("externalId"),
        "GET /tasks now documents an externalId filter — first-connect.md tells agents to page the whole board and dedupe client-side, which is now wrong and wasteful",
      );
      return `filters: ${names.join(", ")}`;
    },
  );

  await check(
    "block titles are still 3–512 characters",
    [["first", "titles are\n3–512 characters"]],
    () => {
      const t =
        spec.components.schemas.CreateStackRequest.properties.blocks.items
          .properties.title;
      assert(
        t.minLength === 3 && t.maxLength === 512,
        `nested block title is now ${t.minLength}–${t.maxLength}, the skill says 3–512`,
      );
      return "3–512";
    },
  );

  await check(
    "the API surface has not grown a route the skill does not mention",
    [["skill", "Base URL `https://api.getnoan.com/v1`"]],
    () => {
      // Operations, not paths: a new mutating method on an existing path is
      // exactly what would falsify "facts are append-only, nothing is edited or
      // deleted", and a path-level set cannot see it.
      const known = new Set([
        "GET /me",
        "GET /stacks", "POST /stacks", "POST /stacks/{stackId}/blocks",
        "GET /blocks",
        "GET /facts", "POST /facts", "GET /facts/{factId}/versions",
        "GET /contacts", "POST /contacts",
        "GET /contacts/{contactId}", "PATCH /contacts/{contactId}",
        "POST /contacts/{contactId}/memos", "POST /contacts/{contactId}/notes",
        "GET /notes", "POST /notes",
        "GET /tags", "POST /tags", "PATCH /tags/{tagId}",
        "GET /tasks", "POST /tasks", "PATCH /tasks/{taskId}",
        "PUT /tasks/{taskId}/assignees", "PUT /tasks/{taskId}/contacts",
        "PUT /tasks/{taskId}/tags",
        "POST /tasks/{taskId}/comments",   // shipped 2026-09-18; the skill's Writes table and conventions cover it
        "GET /assets", "POST /assets", "POST /assets/{assetId}/versions",
      ]);
      const live = new Set(
        Object.keys(spec.paths).flatMap((p) =>
          methodsOf(p).map((m) => `${m.toUpperCase()} ${p}`),
        ),
      );
      const added = [...live].filter((op) => !known.has(op));
      const gone = [...known].filter((op) => !live.has(op));
      assert(
        !added.length && !gone.length,
        [
          added.length ? `new operations: ${added.join(", ")}` : "",
          gone.length ? `operations removed: ${gone.join(", ")}` : "",
          "the skill documents this surface operation by operation — reconcile it, then update this list",
        ]
          .filter(Boolean)
          .join(" | "),
      );
      return `${live.size} operations across ${Object.keys(spec.paths).length} paths, unchanged`;
    },
  );
}

// The one claim in this repository that is about this repository: SKILL.md tells
// the reader how often these checks run. Review caught it saying "nightly" while
// the cron said Mondays, in a PR arguing that unverifiable claims rot — so the
// claim now has a check like any other.
async function cadenceCheck() {
  await check(
    "the cadence SKILL.md claims matches the cron that runs",
    [["skill", "against the live spec and a read-only call"]],
    () => {
      const wf = readFileSync(
        join(ROOT, ".github", "workflows", "conformance.yml"),
        "utf8",
      );
      const cron = wf.match(/cron:\s*"([^"]+)"/)?.[1];
      assert(cron, "no cron found in .github/workflows/conformance.yml");
      const dow = cron.trim().split(/\s+/)[4];
      const actual = dow === "*" ? "daily" : "weekly";
      const claimed = /read-only call (weekly|daily|nightly)/.exec(flat.skill)?.[1];
      assert(
        claimed,
        'SKILL.md no longer states a cadence after "read-only call" — either restate it or drop this check',
      );
      const claimedNorm = claimed === "nightly" ? "daily" : claimed;
      assert(
        claimedNorm === actual,
        `SKILL.md says the checks run ${claimed}, the cron "${cron}" runs ${actual}`,
      );
      return `${claimed}, matching cron "${cron}"`;
    },
  );
}

// ---------------------------------------------------------------- live checks

async function api(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  assert(res.ok, `GET ${path} -> ${res.status}`);
  return res.json();
}

// Slugs the skill names in its tables, pulled from the tables themselves so the
// check follows an edit instead of going stale beside one.
const SLUG = /^[a-z][A-Za-z0-9]*(-[A-Za-z0-9]+)+$/;

function slugsNamedInDoc() {
  const slugs = new Set();
  // Table rows: only the "managed blocks" column, so a hyphenated word in prose
  // inside some other cell can never be mistaken for a slug.
  for (const row of text.writing.split("\n").filter((l) => l.startsWith("|"))) {
    const cell = row.split("|")[3] ?? "";
    for (const [, token] of cell.matchAll(/`([^`]+)`/g)) {
      if (SLUG.test(token)) slugs.add(token);
    }
  }
  // The industry-stack paragraph names slugs in prose — review found those were
  // the only cited slugs nothing verified.
  const prose = text.writing.match(/it carries\s+industry ones[\s\S]*?\n\n/);
  if (prose) {
    for (const [, token] of prose[0].matchAll(/`([^`]+)`/g)) {
      if (SLUG.test(token)) slugs.add(token);
    }
  }
  // The Naming section names a managed slug as its example of a short, clean
  // one. Review caught that example being an OpenAPI placeholder matching
  // nothing live, so it gets checked like any other.
  const example = text.writing.match(/Short, clean slugs\s+like `([^`]+)`/);
  if (example) slugs.add(example[1]);
  return [...slugs];
}

function industryStacksNamedInDoc() {
  const m = text.writing.match(/it carries\s+industry ones[^.]*\./s);
  if (!m) return [];
  return [...m[0].matchAll(/`([A-Z][A-Za-z-]*(?: [A-Z][A-Za-z-]*)?)`/g)].map((x) => x[1]);
}

async function liveChecks() {
  await check(
    "auth and project scope",
    [["skill", "Verify auth before real work"]],
    async () => {
      const me = await api("/me");
      assert(me.project?.id && me.identity?.id, "GET /me no longer returns project and identity");
      return "GET /me returns project and identity";
    },
  );

  await check(
    "GET /blocks item shape",
    [["writing", "`GET /blocks` gives `{id, slug, title, managed, stack}`"]],
    async () => {
      const body = await api("/blocks?per_page=1");
      const item = body.items?.[0];
      assertPopulated(item, "/blocks");
      assert(
        sameSet(Object.keys(item), ["id", "slug", "title", "managed", "stack"]),
        `GET /blocks item keys are now {${Object.keys(item).sort().join(", ")}}`,
      );
      return "unchanged";
    },
  );

  await check(
    "GET /stacks item shape, including nested blocks",
    [["writing", "`GET /stacks` gives `{id, slug, title, managed, blocks}`"]],
    async () => {
      const body = await api("/stacks?per_page=1");
      const item = body.items?.[0];
      assertPopulated(item, "/stacks");
      assert(
        sameSet(Object.keys(item), ["id", "slug", "title", "managed", "blocks"]),
        `GET /stacks item keys are now {${Object.keys(item).sort().join(", ")}}`,
      );
      const nested = item.blocks?.[0];
      if (nested) {
        assert(
          sameSet(Object.keys(nested), ["id", "slug"]),
          `nested block keys are now {${Object.keys(nested).sort().join(", ")}} — if that includes description, the Descriptions section can be rewritten`,
        );
      }
      return "unchanged";
    },
  );

  await check(
    "GET /facts item shape",
    [["skill", "Fact item shape: `{ id, blockSlug, content, createdAt }`"]],
    async () => {
      const body = await api("/facts?per_page=1");
      const item = body.items?.[0];
      assertPopulated(item, "/facts");
      for (const f of ["id", "blockSlug", "content", "createdAt"]) {
        assert(f in item, `GET /facts items no longer carry ${f}`);
      }
      return "carries id, blockSlug, content, createdAt";
    },
  );

  await check(
    "every managed slug the skill names still exists and is managed",
    [["writing", "Those slugs cover the seven generic stacks only"]],
    async () => {
      const named = slugsNamedInDoc();
      assert(named.length >= 30, `only ${named.length} slugs parsed from the tables — the parser or the tables changed shape`);
      // `slug` is exact and repeatable, and an unknown slug is simply absent
      // from the response rather than an error — so the whole table costs one
      // request, and "named but missing" is the answer we want.
      const query = named.map((s) => `slug=${encodeURIComponent(s)}`).join("&");
      const body = await api(`/blocks?${query}&per_page=100`);
      const managed = new Map(
        (body.items ?? []).filter((b) => b.managed).map((b) => [b.slug, b]),
      );
      const missing = named.filter((s) => !managed.has(s));
      assert(
        !missing.length,
        `named in writing-facts.md but not a managed block any more: ${missing.join(", ")}`,
      );
      return `${named.length} slugs, all present and managed`;
    },
  );

  await check(
    "every industry stack the skill names still exists and is managed",
    [["writing", "Scan `GET /stacks` for one that matches the business"]],
    async () => {
      const named = industryStacksNamedInDoc();
      assert(named.length >= 4, `parsed only ${named.length} industry stack names — check the parser against the paragraph`);
      const stacks = await api("/stacks?per_page=100");
      const titles = new Set(
        (stacks.items ?? []).filter((s) => s.managed).map((s) => s.title),
      );
      const missing = named.filter((t) => !titles.has(t));
      assert(!missing.length, `named as managed industry stacks but absent: ${missing.join(", ")}`);
      return `${named.join(", ")} all present`;
    },
  );

  await check(
    "task comments still come back on GET /tasks, in the documented shape",
    [
      ["skill", "Comments come back on each task"],
      ["skill", "`{id, content, createdAt, creator}`"],
    ],
    async () => {
      // The read payload was narrowed when the write route shipped, so this is
      // the claim most likely to be falsified by the next narrowing.
      let sample = null;
      let scanned = 0;
      for (let page = 1; page <= 3 && !sample; page++) {
        const body = await api(`/tasks?page=${page}&per_page=100`);
        const items = body.items ?? [];
        assertPopulated(items[0], "/tasks");
        for (const t of items) {
          scanned++;
          assert(
            Array.isArray(t.comments),
            `a task came back without a comments array (id ${t.id}) — the skill says every task from GET /tasks carries one`,
          );
          if (!sample && t.comments.length) sample = t.comments[0];
        }
        if (!body.meta?.hasNext) break;
      }
      assert(
        sample,
        `no comment found on ${scanned} tasks, so the documented shape could not be inspected. That is a configuration problem — point the key at a workspace whose board has comments — not a documentation one.`,
      );
      assert(
        sameSet(Object.keys(sample), ["id", "content", "createdAt", "creator"]),
        `a comment's keys are now {${Object.keys(sample).sort().join(", ")}}, the skill says {id, content, createdAt, creator}`,
      );
      assert(
        typeof sample.content === "string",
        `comment content is ${typeof sample.content}, the skill says a plain string`,
      );
      return `${scanned} tasks carry the array; sampled comment matches`;
    },
  );

  await check(
    "contact list and single-contact shapes still differ as documented",
    [["skill", "The `memos`, `notes`, `companyRoles` and `tasks` fields exist **only** on"]],
    async () => {
      const body = await api("/contacts?per_page=1");
      const item = body.items?.[0];
      assertPopulated(item, "/contacts");
      for (const f of ["memos", "companyRoles", "tasks"]) {
        assert(!(f in item), `GET /contacts summary now carries ${f} — the two-shapes warning is out of date`);
      }
      return "summary still omits memos, companyRoles, tasks";
    },
  );
}

// ---------------------------------------------------------------------- main

await loadSpec();
await specChecks();
await cadenceCheck();

if (KEY) {
  await liveChecks();
} else if (REQUIRE_LIVE) {
  record(
    "live checks ran",
    false,
    "REQUIRE_LIVE is set but no key reached the job. On a push or a scheduled run that is a broken secret,\n     not a reason to pass: the live half of this suite checked nothing. Re-add NOAN_API_KEY (read-only).",
  );
} else {
  console.log("NOAN_API_KEY not set — spec checks only, live checks skipped.\n");
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  if (r.detail) console.log(`      ${r.detail}`);
}
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed${KEY ? "" : " (spec only)"}.`,
);
if (failed.length) {
  console.log(
    "\nA failure here means the skill tells agents something the API no longer does.\nFix the documentation, not the check — unless the claim itself was restated, in which case update its anchor.",
  );
  process.exit(1);
}
