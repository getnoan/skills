#!/usr/bin/env node
// Files the human half of a drift report: a NOAN task, assigned, pointing at the
// GitHub issue that holds the detail. The issue is where the fix happens; the
// task is what makes a person look at it.
//
// Runs only from the scheduled reporting job, never from PR code, and uses a
// separate write-scoped key — NOAN_TASK_API_KEY. The suite's own key stays
// read-only precisely because that job does run code from pull requests.
//
//   FAILURES="check one\ncheck two" ISSUE_URL=… RUN_URL=… node tests/report-drift.mjs
//   DRY_RUN=1 prints what it would write and touches nothing. That path also
//   exercises everything the key needs — GET /me and paging GET /tasks — so it
//   doubles as the way to prove a new key's reach before a real failure ever
//   depends on it. GET /me reports no scope list, so testing is the only way to
//   know what a key can reach.

const BASE = process.env.NOAN_API_BASE ?? "https://api.getnoan.com/v1";
const KEY = process.env.NOAN_TASK_API_KEY ?? "";
const DRY_RUN = process.env.DRY_RUN === "1";
// Two kinds of bad news, kept apart end to end: the skill is wrong, or the
// suite could not check. They have different fixes and different owners, so
// they get different tasks and never overwrite each other's.
const KIND = process.env.KIND === "config" ? "config" : "drift";
const TITLE_PREFIX = KIND === "config" ? "[Skill checks blocked]" : "[Skill drift]";

const failures = (process.env.FAILURES ?? "")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);
const issueUrl = process.env.ISSUE_URL ?? "";
const runUrl = process.env.RUN_URL ?? "";
const today = new Date().toISOString().slice(0, 10);

if (!KEY) {
  console.error("NOAN_TASK_API_KEY is not set — no task filed.");
  process.exit(1);
}
if (!failures.length) {
  console.log("No failing checks passed in; nothing to file.");
  process.exit(0);
}

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  // PUT sub-resources answer 204 with no body, so branch on status not content.
  return res.status === 204 ? null : res.json();
}

// `details` is rejected, not truncated, above 2048 — and an unattended job that
// trips that loses the whole report, not just the tail.
const DETAILS_CAP = 2048;

// Only the failure list is allowed to lose lines. Truncating the whole body cut
// the issue link, the run link and the first-seen date — the things the text
// tells the reader to go and use, and the date the next refresh reads back.
function fitDetails(head, list, tail) {
  const join = (l) => [...head, ...l, ...tail].join("\n");
  if (join(list).length <= DETAILS_CAP) return join(list);
  const marker = "- … and more; the full list is in the GitHub issue.";
  let kept = [...list];
  while (kept.length && join([...kept, marker]).length > DETAILS_CAP) kept.pop();
  return join([...kept, marker]);
}

function buildDetails({ firstSeen }) {
  const lead =
    KIND === "config"
      ? `The weekly conformance run could not check the public NOAN skill. ${failures.length} check${failures.length === 1 ? "" : "s"} could not run.`
      : `The weekly conformance run found ${failures.length} claim${failures.length === 1 ? "" : "s"} in the public NOAN skill that the live API no longer supports.`;
  const guidance =
    KIND === "config"
      ? "Nothing here says the documentation is wrong. Usual causes, in order: the NOAN_API_KEY secret (revoked, rotated, or scoped away), the workspace behind it being empty, the API unreachable or rate limited, or the published spec not fetching. The checks want a read-only key on a populated workspace with no stack restriction."
      : "Each check names the claim and the file that makes it. Fix the documentation rather than the check, unless the claim was only reworded — then update its anchor.";
  return fitDetails(
    [lead, "", KIND === "config" ? "Blocked checks:" : "Failing checks:"],
    failures.map((f) => `- ${f}`),
    [
      "",
      guidance,
      "",
      issueUrl ? `Issue (where the fix lands): ${issueUrl}` : null,
      runUrl ? `Run: ${runUrl}` : null,
      "",
      `First seen ${firstSeen}. Last seen ${today}.`,
    ].filter((l) => l !== null),
  );
}

// No externalId filter exists — GET /tasks ignores unknown params and returns the
// whole board at 200 — so dedupe client-side, the same way the skill tells agents to.
async function findOpenDriftTask() {
  const seen = new Map();
  let reported = 0;
  // Both columns, because the week someone picks the task up is the week they
  // would otherwise get a second one filed beside it.
  for (const status of ["backlog", "in-progress"]) {
    for (let page = 1; page <= 20; page++) {
      const body = await api(`/tasks?status=${status}&page=${page}&per_page=100`);
      reported += body.meta?.totalItems ?? 0;
      for (const t of body.items ?? []) seen.set(t.id, t);
      if (!body.meta?.hasNext) break;
    }
  }
  // A key whose scope excludes tasks does not always 403 — some endpoints
  // answer 200 with an empty list, which is indistinguishable from an empty
  // board. Left unchecked, dedupe finds nothing and this files a fresh task
  // every single week instead of refreshing one.
  if (seen.size === 0 && reported === 0) {
    throw new Error(
      "GET /tasks returned an entirely empty board. That is far more likely to be a key without task read access than a genuinely empty board — an out-of-scope read can come back 200 with no items rather than 403. Refusing to file, because dedupe cannot work: widen NOAN_TASK_API_KEY to read tasks (a NOAN UI action), then re-run.",
    );
  }
  // Open, not "in a particular column": status says who is waiting, completed
  // says whether the work is done, and they are independent fields.
  return [...seen.values()].find(
    (t) => !t.completed && (t.title ?? "").startsWith(TITLE_PREFIX),
  );
}

const me = await api("/me");
const assignee = me?.identity?.id;
if (!assignee) throw new Error("GET /me returned no identity — cannot assign the task");

const existing = await findOpenDriftTask();
const singular = failures.length === 1;
const title =
  KIND === "config"
    ? `${TITLE_PREFIX} the conformance suite cannot check the public skill`
    : `${TITLE_PREFIX} ${failures.length} claim${singular ? "" : "s"} in the public skill no longer hold${singular ? "s" : ""}`;

if (DRY_RUN) {
  console.log(existing ? `Would UPDATE task ${existing.id}` : "Would CREATE a task");
  console.log(`  assignee: ${me.identity.email ?? assignee}`);
  console.log(`  title: ${title}`);
  console.log(`  details:\n${buildDetails({ firstSeen: today }).replace(/^/gm, "    ")}`);
  process.exit(0);
}

if (existing) {
  // Keep one open task rather than a pile: refresh it, preserving first-seen.
  const firstSeen = /First seen (\d{4}-\d{2}-\d{2})/.exec(existing.details ?? "")?.[1] ?? today;
  await api(`/tasks/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify({ title, details: buildDetails({ firstSeen }) }),
  });
  console.log(`Updated existing drift task ${existing.id} (first seen ${firstSeen}).`);
} else {
  const created = await api("/tasks", {
    method: "POST",
    body: JSON.stringify({
      title,
      details: buildDetails({ firstSeen: today }),
      status: "backlog", // omitted means null, which claims nobody is waiting
    }),
  });
  const id = created?.task?.id ?? created?.id;
  if (!id) throw new Error(`POST /tasks returned no id: ${JSON.stringify(created).slice(0, 200)}`);
  await api(`/tasks/${id}/assignees`, {
    method: "PUT",
    body: JSON.stringify({ assigneeIds: [assignee] }),
  });
  console.log(`Filed drift task ${id}, assigned to ${me.identity.email ?? assignee}.`);
}
