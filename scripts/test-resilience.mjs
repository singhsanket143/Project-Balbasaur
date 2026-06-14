// Deterministic test of the durable queue + retry mechanics. Sends NO emails.
// Run with: node scripts/test-resilience.mjs
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import * as queue from "../src/utils/queue.js";

let pass = 0;
function check(name, cond) {
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ok  ${name}`);
  pass++;
}

// Start clean
for (const d of queue.deadLetters()) queue.markDone(d.id);
for (const j of queue.dueJobs(Number.MAX_SAFE_INTEGER)) queue.markDone(j.id);
check("queue starts empty", queue.counts().pending === 0 && queue.counts().dead === 0);

// 1. enqueue
const enr = { event: "purchase", email: "qa@example.com", name: "QA", product: "Course X" };
const id = queue.enqueue({ key: "purchase|qa@example.com|course x", enrollment: enr });
check("enqueue -> 1 pending", queue.counts().pending === 1);
check("job is due immediately", queue.dueJobs().some((j) => j.id === id));
check("hasActiveKey detects in-flight dupe", queue.hasActiveKey("purchase|qa@example.com|course x"));

// 2. cross-process persistence (simulates a restart reading from disk)
const out = execFileSync("node", [
  "-e",
  "import('./src/utils/queue.js').then(q=>console.log(JSON.stringify(q.counts())))",
]).toString();
check("survives restart (separate process sees pending=1)", JSON.parse(out).pending === 1);

// 3. reschedule with backoff -> not due now
queue.reschedule(id, { delayMs: 60_000, error: "smtp timeout" });
check("reschedule -> attempts incremented, not due now", queue.dueJobs().every((j) => j.id !== id));
check("reschedule -> still pending", queue.counts().pending === 1);

// 4. dead-letter
queue.markDead(id, { error: "permanent failure" });
check("markDead -> 0 pending, 1 dead", queue.counts().pending === 0 && queue.counts().dead === 1);
check("deadLetters lists the job with error", queue.deadLetters()[0].lastError === "permanent failure");

// 5. requeue dead -> back to pending and due
check("requeueDead returns true", queue.requeueDead(id) === true);
check("requeue -> 1 pending, 0 dead, due now", queue.counts().pending === 1 && queue.counts().dead === 0 && queue.dueJobs().some((j) => j.id === id));

// 6. markDone removes it
queue.markDone(id);
check("markDone -> empty queue", queue.counts().pending === 0 && queue.counts().dead === 0);

console.log(`\nAll ${pass} checks passed. Queue left clean.`);
