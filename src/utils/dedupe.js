import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Idempotency + cross-source reconciliation guard.
//
// We track two things so a student is welcomed exactly once even when BOTH the
// Learnyst and CCAvenue webhooks fire for the same purchase:
//   - keys:   per (email|product) — exact dedupe of the same enrollment
//   - emails: per email -> last welcomed timestamp — coarse, source-agnostic net
//             (used within RECONCILE_WINDOW so a backup source doesn't re-send)
//
// Persisted to JSON so restarts don't re-send. For AWS swap this for DynamoDB.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "sent.json");

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

/** @type {{ keys: Record<string, number>, emails: Record<string, number> }} */
let store = { keys: {}, emails: {} };

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) || {};
      // Migrate old flat format ({ key: ts }) into the new shape.
      if (parsed.keys || parsed.emails) {
        store = { keys: parsed.keys || {}, emails: parsed.emails || {} };
      } else {
        store = { keys: parsed, emails: {} };
      }
    }
  } catch {
    store = { keys: {}, emails: {} };
  }
  const cutoff = Date.now() - TTL_MS;
  for (const map of [store.keys, store.emails]) {
    for (const [k, ts] of Object.entries(map)) {
      if (typeof ts !== "number" || ts < cutoff) delete map[k];
    }
  }
}

function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, STORE_FILE);
  } catch {
    // best-effort only
  }
}

load();

// Source-agnostic key so Learnyst + CCAvenue dedupe to the same enrollment.
export function buildKey(enrollment) {
  return [enrollment.email, enrollment.product || "*"].join("|").toLowerCase();
}

export function alreadySent(key) {
  return Boolean(store.keys[key]);
}

/** Was this email welcomed within the reconciliation window? (cross-source net) */
export function recentlyWelcomed(email, windowMs) {
  if (!email) return false;
  const ts = store.emails[String(email).toLowerCase()];
  return Boolean(ts) && Date.now() - ts < windowMs;
}

export function markSent(key, email) {
  const now = Date.now();
  store.keys[key] = now;
  if (email) store.emails[String(email).toLowerCase()] = now;
  persist();
}
