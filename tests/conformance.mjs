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
// Live checks are read-only and deliberately cheap: one request per check except
// the task-comments one, which pages until it finds a real comment, so a full run
// is 8-10 GETs. They never print fact content, contact details or any
// other workspace data — only shapes, slugs and counts.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = join(ROOT, "skills", "noan-fact-layer");
const CAPTURE_DIR = join(ROOT, "skills", "noan-fact-candidate-capture");
const BASE = process.env.NOAN_API_BASE ?? "https://api.getnoan.com/v1";
const SPEC_URL =
  process.env.NOAN_OPENAPI_URL ?? "https://api.getnoan.com/openapi.json";
// The capture skill documents the MCP tool surface as well as the REST one, and
// the two disagree in ways that decide whether a capture is ever found. The spec
// says nothing about MCP, so that half can only be checked live.
const MCP_URL = process.env.NOAN_MCP_URL ?? "https://mcp.getnoan.com/mcp";
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
  connector: join(SKILL_DIR, "references", "connector.md"),
  capture: join(CAPTURE_DIR, "SKILL.md"),
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
const record = (name, ok, detail, kind = "doc") =>
  results.push({ name, ok, detail, kind });

// A failure that says "this suite could not check" rather than "the skill is
// wrong". The two exit differently, because the report job files a drift issue
// for one and must not for the other: a bad key filed as documentation drift
// sends someone to edit a file that was never wrong.
class ConfigFault extends Error {}

// Neither pass nor fail: the claim is real, but THIS key is not allowed to see
// what it is about. The MCP server hides every tool a key's scope does not cover,
// and the suite's key is deliberately read-only — so to it, create_task is simply
// absent. Reporting that as drift filed getnoan/skills#18 against a skill that was
// right; reporting it as a configuration fault would file one every week for a
// key that is scoped exactly as intended. It is printed as SKIP and fails nothing.
class Unchecked extends Error {}

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
        .join(
          "; ",
        )}\n     The claim was edited or removed — update this check, or restore the claim.`,
    );
    return false;
  }
  return true;
}

// Registration, not execution. Anchors are validated for EVERY registered check,
// including ones whose body cannot run — a pull request run is spec-only by
// design, and that is exactly where SKILL.md gets edited, so a rewrite that
// orphans a live check's anchor has to fail there rather than on main after
// merge.
const registry = [];
function check(name, anchors, fn) {
  registry.push({ name, anchors, fn, live: false });
}
function liveCheck(name, anchors, fn) {
  registry.push({ name, anchors, fn, live: true });
}

async function runRegistry({ runLive }) {
  // Pass one: every anchor, regardless of what can run.
  const anchored = registry.filter((c) => anchorsPresent(c.name, c.anchors));
  // Pass two: the bodies whose prerequisites are met.
  for (const c of anchored) {
    if (c.live && !runLive) continue;
    try {
      record(c.name, true, await c.fn());
    } catch (err) {
      if (err instanceof Unchecked) {
        record(c.name, true, err.message, "unchecked");
        continue;
      }
      record(
        c.name,
        false,
        err.message,
        err instanceof ConfigFault ? "config" : "doc",
      );
    }
  }
  return anchored.filter((c) => c.live && !runLive).length;
}

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const assertConfig = (cond, msg) => {
  if (!cond) throw new ConfigFault(msg);
};

// ---------------------------------------------------------------- spec checks

async function loadSpec() {
  try {
    await fetchSpec();
  } catch (err) {
    // Uncaught, this exited before the summary was written: no outcome, so
    // neither report job fired and a red scheduled run told nobody. Silence is
    // the one failure this suite must not have.
    record(
      "the published spec is reachable",
      false,
      `${err.message}. Nothing could be checked against it, so this says nothing about the documentation.`,
      "config",
    );
    finish();
  }
}

async function fetchSpec() {
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

function specChecks() {
  check(
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
        const mutating = methodsOf(p).filter(
          (m) => m === "patch" || m === "put",
        );
        assert(
          mutating.length === 0,
          `${p} now accepts ${mutating.join("/")} — "no move, no delete" no longer holds`,
        );
      }
      return "no DELETE; no PATCH/PUT on stacks, blocks, facts";
    },
  );

  check(
    "managed stacks reject added blocks",
    [
      [
        "writing",
        "`POST /stacks/{stackId}/blocks` on a managed stack is refused",
      ],
      ["skill", "You cannot add a block to a managed stack"],
    ],
    () => {
      const op = spec.paths["/stacks/{stackId}/blocks"].post;
      assert(
        op.responses["403"],
        "POST /stacks/{stackId}/blocks no longer documents 403",
      );
      const prose = `${op.description ?? ""} ${spec.paths["/stacks"].post.description ?? ""}`;
      assert(
        /managed stacks? cannot be (created or )?modified/i.test(prose),
        "the spec no longer says managed stacks cannot be modified — re-check before the skill keeps saying it",
      );
      return "403 documented; spec still says managed stacks cannot be modified";
    },
  );

  check(
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

  check(
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

  check(
    "a managed stack is added to the project through the API",
    [
      ["writing", "`POST /stacks/{stackId}/use` adds it, with no body"],
      ["writing", "Writing a fact into one of its blocks adds the stack too"],
      ["skill", "offer to add it with `POST /stacks/{stackId}/use`"],
    ],
    () => {
      const op = spec.paths["/stacks/{stackId}/use"]?.post;
      assert(op, "POST /stacks/{stackId}/use is gone: the skill offers it as the way to add a managed stack");
      assert(
        !op.requestBody,
        "POST /stacks/{stackId}/use now takes a body: the skill says it takes none",
      );
      assert(
        /creating a fact on a block also adds/i.test(op.description ?? ""),
        "the spec no longer says writing a fact adds the block's stack: writing-facts.md relies on that",
      );
      return "present, no body; a fact write adds the stack";
    },
  );

  check(
    "GET /insights still takes and returns what the skill says",
    [
      ["skill", "each with a `suggestion` and the `factIds` and `blockIds` it is about"],
    ],
    () => {
      const op = spec.paths["/insights"]?.get;
      assert(op, "GET /insights is gone: the skill lists it as a read");
      const params = Object.fromEntries(
        (op.parameters ?? []).filter((x) => x.name).map((x) => [x.name, x.schema]),
      );
      assert(
        params.severity && params.status,
        `GET /insights now takes ${Object.keys(params).join(", ")}: the skill names severity and status`,
      );
      assert(
        params.status.default === "open",
        `GET /insights status defaults to ${params.status.default}, the skill says open`,
      );
      assert(
        /insight:read/.test(op.description ?? ""),
        "GET /insights no longer names the insight:read scope: the skill tells the reader a 403 there is the key",
      );
      const required = spec.components.schemas.Insight?.required ?? [];
      const missing = ["suggestion", "factIds", "blockIds"].filter((f) => !required.includes(f));
      assert(!missing.length, `Insight no longer requires ${missing.join(", ")}`);
      return `params: ${Object.keys(params).join(", ")}; status defaults to open; insight:read`;
    },
  );

}

// The one claim in this repository that is about this repository: SKILL.md tells
// the reader how often these checks run. Review caught it saying "nightly" while
// the cron said Mondays, in a PR arguing that unverifiable claims rot — so the
// claim now has a check like any other.
function cadenceCheck() {
  check(
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
      const claimed = /read-only call (weekly|daily|nightly)/.exec(
        flat.skill,
      )?.[1];
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

// The MCP server is a SECOND external service this suite depends on: the capture
// skill documents a tool surface the OpenAPI spec knows nothing about, so the
// only way to check those claims is to ask the server. Same classification rule
// as api() below — the key, the network and an outage say nothing about the
// documentation, and reporting them as drift would file an issue, and a task for
// a person, because a service was down.
async function mcpTools() {
  return (await mcpRpc("tools/list")).tools;
}

async function mcpRpc(method, params = {}) {
  let res;
  try {
    res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${KEY}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
  } catch (err) {
    throw new ConfigFault(
      `POST ${MCP_URL} ${method} could not be reached (${err.message}). That is the network or the MCP server being down, not the documentation being wrong.`,
    );
  }
  if (!res.ok) {
    if ([401, 403, 429].includes(res.status) || res.status >= 500) {
      const why =
        res.status === 401 || res.status === 403
          ? "Check the key — revoked, rotated, or not entitled to the MCP server."
          : res.status === 429
            ? "Rate limited; retry later."
            : "The MCP server is returning errors; retry later.";
      throw new ConfigFault(
        `POST ${MCP_URL} ${method} -> ${res.status}: the key or the server, not the documentation. ${why}`,
      );
    }
    // 404 and 400 are the drift shapes: the endpoint moved, or it no longer
    // accepts the call the skill's instructions rest on.
    throw new Error(`POST ${MCP_URL} ${method} -> ${res.status}`);
  }
  // The server answers as an SSE frame rather than a bare JSON body. A payload
  // this cannot read is the transport changing, not a claim being wrong.
  const body = await res.text();
  const frame = body.startsWith("{")
    ? body
    : (body.split("\n").find((l) => l.startsWith("data: ")) ?? "").slice(6);
  if (!frame) {
    throw new ConfigFault(
      `${method} returned no JSON payload from ${MCP_URL} — the transport changed shape, so the tool claims could not be checked at all.`,
    );
  }
  let result;
  try {
    result = JSON.parse(frame).result;
  } catch (err) {
    throw new ConfigFault(`${method} from ${MCP_URL} was not JSON (${err.message})`);
  }
  if (method === "tools/list" && !Array.isArray(result?.tools)) {
    throw new ConfigFault(
      `tools/list from ${MCP_URL} carried no tools array — an error response or a protocol change, either way not a documentation finding`,
    );
  }
  if (!result) {
    throw new ConfigFault(`${method} from ${MCP_URL} carried no result`);
  }
  return result;
}

// The tools this key can see, and whether it can see ALL of them. The server
// lists only what a key's scope covers, so a documented tool missing from the
// list is drift only when the scope is everything (`get_me` reports ["*"]).
// Under any narrower scope, missing means hidden, and the claim is unchecked.
async function mcpSurface() {
  const tools = await mcpTools();
  let scopes;
  try {
    const me = await mcpRpc("tools/call", { name: "get_me", arguments: {} });
    scopes =
      me.structuredContent?.scopes ??
      JSON.parse(me.content?.[0]?.text ?? "{}").scopes;
  } catch (err) {
    if (err instanceof ConfigFault) throw err;
    throw new ConfigFault(`get_me over MCP did not return scopes (${err.message})`);
  }
  if (!Array.isArray(scopes)) {
    throw new ConfigFault(
      "get_me over MCP returned no scopes array, so a missing tool cannot be told apart from a hidden one",
    );
  }
  const fullScope = scopes.includes("*");
  // Look a documented tool up. Missing under a full scope is drift (the Error
  // path); missing under a narrower one returns null for the caller to skip.
  const find = (name) => {
    const t = tools.find((x) => x.name === name);
    if (t || !fullScope) return t ?? null;
    throw new Error(`the MCP server no longer offers ${name}, and this key can see every tool`);
  };
  return { tools, scopes, fullScope, find };
}

async function api(path) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
  } catch (err) {
    throw new ConfigFault(
      `GET ${path} could not be reached (${err.message}). That is the network or the API being down, not the documentation being wrong.`,
    );
  }
  if (!res.ok) {
    // 401/403 is the key, 429 is rate limiting, 5xx is an outage: none of them
    // say anything about the skill. 404 and 400 do — a documented route that has
    // gone, or a contract that changed, is what drift looks like.
    if ([401, 403, 429].includes(res.status) || res.status >= 500) {
      const why =
        res.status === 401 || res.status === 403
          ? "Check NOAN_API_KEY — revoked, rotated, or scoped away from this endpoint."
          : res.status === 429
            ? "Rate limited; retry later."
            : "The API is returning errors; retry later.";
      throw new ConfigFault(
        `GET ${path} -> ${res.status}: the key or the API, not the documentation. ${why}`,
      );
    }
    throw new Error(`GET ${path} -> ${res.status}`);
  }
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
  return [...m[0].matchAll(/`([A-Z][A-Za-z-]*(?: [A-Z][A-Za-z-]*)?)`/g)].map(
    (x) => x[1],
  );
}

function liveChecks() {
  liveCheck(
    "auth and project scope",
    [["skill", "Verify auth with `GET /me` before real work"]],
    async () => {
      const me = await api("/me");
      assert(
        me.project?.id && me.identity?.id,
        "GET /me no longer returns project and identity",
      );
      return "GET /me returns project and identity";
    },
  );

  liveCheck(
    "every managed slug the skill names still exists and is managed",
    [["writing", "Those slugs cover the seven generic stacks only"]],
    async () => {
      const named = slugsNamedInDoc();
      assert(
        named.length >= 30,
        `only ${named.length} slugs parsed from the tables — the parser or the tables changed shape`,
      );
      // `slug` is exact and repeatable, and an unknown slug is simply absent
      // from the response rather than an error — so the whole table costs one
      // request, and "named but missing" is the answer we want.
      const query = named.map((s) => `slug=${encodeURIComponent(s)}`).join("&");
      const body = await api(`/blocks?${query}&per_page=100`);
      const managed = new Map(
        (body.items ?? []).filter((b) => b.managed).map((b) => [b.slug, b]),
      );
      // A managed slug can be renamed in the backend and reach workspaces at
      // different times: `product-FAQ` became `product-faq` on 2026-09-21, and
      // for a while one workspace answered to each. The slug filter is
      // case-sensitive, so during that window the other spelling simply does not
      // come back, which is indistinguishable from the block having gone. A
      // missing slug therefore gets a second lookup in lower case before it is
      // called a rename, and a case-only difference is reported rather than
      // failed. This is cover for a rollout, not a promise that casing never
      // matters — a rename that changes more than case still fails, loudly.
      let missing = named.filter((s) => !managed.has(s));
      const cased = [];
      if (missing.length) {
        const retry = missing
          .map((s) => s.toLowerCase())
          .filter((s) => !managed.has(s));
        if (retry.length) {
          const alt = await api(
            `/blocks?${retry.map((s) => `slug=${encodeURIComponent(s)}`).join("&")}&per_page=100`,
          );
          const found = new Set(
            (alt.items ?? []).filter((b) => b.managed).map((b) => b.slug),
          );
          missing = missing.filter((s) => {
            if (found.has(s.toLowerCase())) {
              cased.push(`${s} is ${s.toLowerCase()} here`);
              return false;
            }
            return true;
          });
        }
      }
      // None of them visible is a key that cannot see the managed catalogue —
      // 45 simultaneous renames is not a thing that happens. Some missing is a
      // rename, which is what this check exists to catch. Getting this wrong
      // sends someone to edit a file over a scope problem.
      assertConfig(
        !(missing.length === named.length && named.length > 1),
        `none of the ${named.length} managed slugs the skill names came back. That is a key that cannot see the managed catalogue — a stack-limited key, or the wrong project — not ${named.length} renames at once. Fix the key, not the skill.`,
      );
      assert(
        !missing.length,
        `named in writing-facts.md but not a managed block any more: ${missing.join(", ")}. If the key changed recently, check its scope before editing the tables — a partial view looks exactly like this.`,
      );
      return cased.length
        ? `${named.length} slugs present; case differs in this workspace for ${cased.join(", ")}`
        : `${named.length} slugs, all present and managed`;
    },
  );

  liveCheck(
    "every industry stack the skill names still exists and is managed",
    [["writing", "Scan `GET /stacks` for one that matches the business"]],
    async () => {
      const named = industryStacksNamedInDoc();
      assert(
        named.length >= 4,
        `parsed only ${named.length} industry stack names — check the parser against the paragraph`,
      );
      const stacks = await api("/stacks?per_page=100");
      const titles = new Set(
        (stacks.items ?? []).filter((s) => s.managed).map((s) => s.title),
      );
      const missing = named.filter((t) => !titles.has(t));
      assertConfig(
        !(missing.length === named.length && named.length > 1),
        `none of the ${named.length} industry stacks the skill names came back, which is a key that cannot see the managed catalogue rather than ${named.length} stacks disappearing. Fix the key, not the skill.`,
      );
      assert(
        !missing.length,
        `named as managed industry stacks but absent: ${missing.join(", ")}. If the key changed recently, check its scope first.`,
      );
      return `${named.join(", ")} all present`;
    },
  );

}


// ------------------------------------------------- capture skill (spec + MCP)
//
// The capture skill's claims fail differently from the fact-layer skill's. A
// wrong number there produces a rejected write and an error someone reads; a
// wrong number HERE produces a capture that is written, accepted, and then
// never found — the queue is read by title prefix and status, so a task that
// misses either is dropped with nothing in the weekly report to say so.
//
// Until these existed the four load-bearing claims were unchecked: the suite
// read only skills/noan-fact-layer, so setting the caps to 4096, 512 and
// 50,000 and the status to "todo" still passed 13/13 (@noanneal, 2026-09-21).
function captureChecks() {
  check(
    "backlog is still the status a capture is written to",
    [["capture", '**`status` is `"backlog"`.**']],
    () => {
      const values = spec.components.schemas.CreateTaskRequest?.properties?.status?.enum;
      assert(
        Array.isArray(values),
        "CreateTaskRequest.status no longer declares an enum — the capture queue is read with ?status=backlog, so a renamed column empties it silently",
      );
      assert(
        values.includes("backlog"),
        `CreateTaskRequest.status is now ${values.join("|")} — "backlog" is gone, and every capture written to it is invisible to the weekly review`,
      );
      return `status enum: ${values.join(" | ")}`;
    },
  );
}

// ------------------------------------------------ connector route (MCP only)
//
// connector.md is what an agent in Claude, ChatGPT or any other chat app reads
// instead of the REST half of SKILL.md. Every claim in it is about the MCP tool
// surface, which the OpenAPI spec knows nothing about, so all of it is live.
// The gaps it names (no fact history, no externalId, a 20,000 cap the REST
// route doesn't have) are the ones that change what the agent must work around;
// if the server closes one, the check fails so the workaround can come out of
// the skill.
function connectorChecks() {
  liveCheck(
    "the connector gaps connector.md works around are still gaps",
    [
      ["connector", "There is no tool for a fact's versions."],
      ["connector", "There is no\n  `externalId` on this route"],
      ["connector", "**There are no delete tools.**"],
    ],
    async () => {
      const { tools, fullScope, scopes } = await mcpSurface();
      // Every claim here is an ABSENCE, and a narrower key hides tools — so
      // "not in the list" proves nothing unless this key can see everything.
      if (!fullScope) {
        throw new Unchecked(
          `these are claims that tools do NOT exist, which only a full-scope key can check (this key: ${JSON.stringify(scopes)})`,
        );
      }
      const names = tools.map((t) => t.name);
      const versions = names.filter((n) => /version|history/.test(n) && /fact/.test(n));
      assert(
        !versions.length,
        `the MCP server now offers ${versions.join(", ")} — connector.md says fact history is app-only`,
      );
      const deletes = names.filter((n) => /delete|remove/.test(n));
      assert(
        !deletes.length,
        `the MCP server now offers ${deletes.join(", ")}, but connector.md says removal is done in the app`,
      );
      const task = tools.find((t) => t.name === "create_task");
      assert(task, "the MCP server no longer offers create_task");
      const taskProps = Object.keys(task.inputSchema?.properties ?? {});
      assert(
        !taskProps.includes("externalId"),
        "create_task now takes externalId — connector.md tells the reader to dedupe by title instead",
      );
      return `${names.length} tools; no fact-history or delete tool; create_task: ${taskProps.join(", ")}`;
    },
  );
}

// ---------------------------------------------------------------------- main

await loadSpec();
specChecks();
captureChecks();
connectorChecks();
cadenceCheck();
liveChecks();

const skippedLive = await runRegistry({ runLive: Boolean(KEY) });

if (!KEY && REQUIRE_LIVE) {
  record(
    "live checks ran",
    false,
    "REQUIRE_LIVE is set but no key reached the job. On a push or a scheduled run that is a broken secret,\n     not a reason to pass: the live half of this suite checked nothing. Re-add NOAN_API_KEY (read-only).",
    "config",
  );
} else if (!KEY) {
  console.log(
    `NOAN_API_KEY not set — spec checks only, ${skippedLive} live checks skipped (their anchors were still validated).\n`,
  );
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  const unchecked = results.filter((r) => r.kind === "unchecked");
  for (const r of results) {
    const tag = r.kind === "unchecked" ? "SKIP" : r.ok ? "PASS" : "FAIL";
    console.log(`${tag}  ${r.name}`);
    if (r.detail) console.log(`      ${r.detail}`);
  }
  console.log(
    `\n${results.length - failed.length - unchecked.length}/${results.length} checks passed${KEY ? "" : " (spec only)"}` +
      (unchecked.length
        ? `, ${unchecked.length} not checkable with this key's scope (SKIP above).`
        : "."),
  );
  // Exit 1 is drift: the skill says something the API no longer does. Exit 2 is a
  // configuration fault: the suite could not check, because of the key's scope or
  // the workspace behind it. CI branches on this, so the two never get reported as
  // each other.
  const configOnly =
    failed.length > 0 && failed.every((r) => r.kind === "config");
  const outcome = !failed.length ? "pass" : configOnly ? "config" : "drift";
  const blocked = failed.filter((r) => r.kind === "config").length;
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `outcome=${outcome}\n`);
    // How much of the run could not happen, so a drift report can say it checked
    // less than it looks.
    appendFileSync(process.env.GITHUB_OUTPUT, `blocked=${blocked}\n`);
    // The failing check names, so the report path can name them without paying
    // for a second run of the whole suite.
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `failures<<CONF_EOF\n${failed.map((r) => r.name).join("\n")}\nCONF_EOF\n`,
    );
  }

  if (outcome === "config") {
    console.log(
      "\nNothing above says the documentation is wrong. The suite could not run its live half:\nthe key's scope, or the workspace behind it, cannot answer what these checks read.\nFix the key, not the skill.",
    );
    process.exit(2);
  }
  if (outcome === "drift") {
    if (blocked) {
      console.log(
        `\nNote: ${blocked} of these could not run at all (key, network or API), so this run checked less than it looks.`,
      );
    }
    console.log(
      "\nA failure here means the skill tells agents something the API no longer does.\nFix the documentation, not the check — unless the claim itself was restated, in which case update its anchor.",
    );
    process.exit(1);
  }
  process.exit(0);
}

finish();
