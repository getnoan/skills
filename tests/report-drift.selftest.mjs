#!/usr/bin/env node
// Exercises the reporter without a key, a network or a board, so that pull
// request CI proves it works rather than the first real failure being its first
// real execution.
//
// Each case stubs fetch with a board, runs the reporter in-process, and asserts
// what it would have written.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORTER = join(HERE, "report-drift.mjs");

const ME = { identity: { id: "u-1", email: "someone@example.com" } };
const task = (over = {}) => ({
  id: "t-drift",
  title: "[Skill drift] 1 claim in the public skill no longer holds",
  details: "First seen 2026-01-01. Last seen 2026-01-01.",
  status: "backlog",
  completed: false,
  ...over,
});

// A board is { backlog: [...], "in-progress": [...] }; every other route 404s so
// an unexpected call is loud rather than silently fine.
function harness(board) {
  return `
    const calls = [];
    globalThis.fetch = async (url, init = {}) => {
      const u = String(url);
      const method = init.method ?? "GET";
      calls.push(method + " " + u.replace(/^https?:\\/\\/[^/]+/, ""));
      const json = (body, status = 200) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (u.includes("/me")) return json(${JSON.stringify(ME)});
      const board = ${JSON.stringify(board)};
      for (const status of Object.keys(board)) {
        if (u.includes("status=" + status)) {
          return json({ meta: { totalItems: board[status].length, hasNext: false }, items: board[status] });
        }
      }
      if (method === "POST" && u.endsWith("/tasks")) return json({ task: { id: "t-new" } }, 201);
      if (method === "PATCH" || method === "PUT") return new Response(null, { status: 204 });
      return json({ error: "unexpected" }, 404);
    };
    process.on("exit", () => console.log("CALLS " + JSON.stringify(calls)));
    await import(${JSON.stringify(REPORTER)});
  `;
}

function run(board, env = {}) {
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", harness(board)], {
    env: {
      ...process.env,
      NOAN_TASK_API_KEY: "stub",
      FAILURES: "descriptions are absent from every read schema",
      ISSUE_URL: "https://example.invalid/issues/1",
      RUN_URL: "https://example.invalid/runs/1",
      DRY_RUN: "",
      KIND: "drift",
      ...env,
    },
    encoding: "utf8",
  });
  const calls = JSON.parse(/CALLS (\[.*\])/.exec(res.stdout ?? "")?.[1] ?? "[]");
  return { ...res, calls, writes: calls.filter((c) => !c.startsWith("GET ")) };
}

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) {
    failures++;
    if (detail) console.log(`      ${detail}`);
  }
};

// An open task in backlog is refreshed, not duplicated.
let r = run({ backlog: [task()], "in-progress": [] });
check(
  "refreshes an open task in backlog",
  r.status === 0 && r.writes.length === 1 && r.writes[0] === "PATCH /v1/tasks/t-drift",
  `writes were ${JSON.stringify(r.writes)}`,
);

// The week someone starts it is the week a duplicate would have appeared.
r = run({ backlog: [], "in-progress": [task({ status: "in-progress" })] });
check(
  "refreshes an open task someone has started",
  r.status === 0 && r.writes.length === 1 && r.writes[0] === "PATCH /v1/tasks/t-drift",
  `writes were ${JSON.stringify(r.writes)}`,
);

// A completed task is history; a new one is correct.
r = run({ backlog: [task({ completed: true, status: "backlog" })], "in-progress": [] });
check(
  "files a new task when the previous one is done",
  r.status === 0 &&
    r.writes.includes("POST /v1/tasks") &&
    r.writes.includes("PUT /v1/tasks/t-new/assignees"),
  `writes were ${JSON.stringify(r.writes)}`,
);

// Drift and a blocked suite must not overwrite each other's task.
r = run({ backlog: [task()], "in-progress": [] }, { KIND: "config" });
check(
  "a config report does not reuse the drift task",
  r.status === 0 && r.writes.includes("POST /v1/tasks"),
  `writes were ${JSON.stringify(r.writes)}`,
);

// An empty board is a key that cannot see tasks, not an empty board.
r = run({ backlog: [], "in-progress": [] });
check(
  "refuses to file against a board it cannot see",
  r.status !== 0 && /entirely empty board/.test(r.stderr ?? ""),
  `exit ${r.status}, stderr ${(r.stderr ?? "").split("\n")[0]}`,
);

// Nothing to report is not an error.
r = run({ backlog: [task()], "in-progress": [] }, { FAILURES: "" });
check("does nothing when there are no failures", r.status === 0 && r.writes.length === 0);

console.log(`\n${failures ? `${failures} failing` : "all cases pass"}`);
process.exit(failures ? 1 : 0);
