import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Durable, file-backed job queue.
//
// Every accepted webhook is persisted here BEFORE we attempt to send the email,
// so a crash/restart never loses an enrollment we've already received. The
// retry worker (services/processor.js) drains this queue with backoff and moves
// permanently-failing jobs to a "dead" state for inspection.
//
// Writes are atomic (temp file + rename) so a crash mid-write can't corrupt the
// store. For AWS this whole module is replaced by SQS + DynamoDB.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, "../../data");
const QUEUE_FILE = path.join(DATA_DIR, "queue.json");

/** @type {{ jobs: Record<string, Job> }} */
let store = { jobs: {} };

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {string} key            dedupe key (event|email|product)
 * @property {object} enrollment     parsed learner info
 * @property {"pending"|"dead"} status
 * @property {number} attempts       number of failed attempts so far
 * @property {number} nextAttemptAt  epoch ms; job is eligible when now >= this
 * @property {number} createdAt
 * @property {number} updatedAt
 * @property {string|null} lastError
 */

function load() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(QUEUE_FILE, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.jobs) store = parsed;
    }
  } catch {
    store = { jobs: {} };
  }
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${QUEUE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, QUEUE_FILE); // atomic on the same filesystem
}

load();

/** Is there already a live (pending) job for this dedupe key? */
export function hasActiveKey(key) {
  return Object.values(store.jobs).some(
    (j) => j.key === key && j.status === "pending"
  );
}

export function enqueue({ key, enrollment }) {
  const now = Date.now();
  const id = crypto.randomUUID();
  store.jobs[id] = {
    id,
    key,
    enrollment,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now, // eligible immediately
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
  persist();
  return id;
}

/** Pending jobs that are due to run now, oldest first. */
export function dueJobs(now = Date.now()) {
  return Object.values(store.jobs)
    .filter((j) => j.status === "pending" && j.nextAttemptAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function markDone(id) {
  delete store.jobs[id];
  persist();
}

/**
 * Persist updated enrollment data onto a job (e.g. a freshly created Discord
 * invite) so that an SMTP retry reuses the SAME single-use invite instead of
 * burning a new one on every attempt.
 */
export function updateEnrollment(id, enrollment) {
  const job = store.jobs[id];
  if (!job) return;
  job.enrollment = enrollment;
  job.updatedAt = Date.now();
  persist();
}

export function reschedule(id, { delayMs, error }) {
  const job = store.jobs[id];
  if (!job) return;
  job.attempts += 1;
  job.nextAttemptAt = Date.now() + delayMs;
  job.updatedAt = Date.now();
  job.lastError = error ? String(error).slice(0, 500) : null;
  persist();
}

export function markDead(id, { error }) {
  const job = store.jobs[id];
  if (!job) return;
  job.attempts += 1;
  job.status = "dead";
  job.updatedAt = Date.now();
  job.lastError = error ? String(error).slice(0, 500) : null;
  persist();
}

export function counts() {
  const jobs = Object.values(store.jobs);
  return {
    pending: jobs.filter((j) => j.status === "pending").length,
    dead: jobs.filter((j) => j.status === "dead").length,
  };
}

export function deadLetters() {
  return Object.values(store.jobs)
    .filter((j) => j.status === "dead")
    .map((j) => ({
      id: j.id,
      email: j.enrollment?.email,
      product: j.enrollment?.product,
      attempts: j.attempts,
      lastError: j.lastError,
      updatedAt: new Date(j.updatedAt).toISOString(),
    }));
}

/** Re-arm a dead job so the worker tries it again (used by /status retry). */
export function requeueDead(id) {
  const job = store.jobs[id];
  if (!job || job.status !== "dead") return false;
  job.status = "pending";
  job.attempts = 0;
  job.nextAttemptAt = Date.now();
  job.updatedAt = Date.now();
  job.lastError = null;
  persist();
  return true;
}
