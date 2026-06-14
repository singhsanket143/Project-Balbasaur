import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Lightweight idempotency guard so webhook retries don't email a student twice.
// Keys are persisted to a JSON file so restarts don't re-send. For production
// (AWS) swap this for DynamoDB/Redis.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "sent.json");

// Drop dedupe keys older than this so the file doesn't grow forever.
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

let store = {};

function load() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      store = JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) || {};
    }
  } catch {
    store = {};
  }
  const cutoff = Date.now() - TTL_MS;
  for (const [k, ts] of Object.entries(store)) {
    if (typeof ts !== "number" || ts < cutoff) delete store[k];
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

export function buildKey(enrollment) {
  return [enrollment.event || "event", enrollment.email, enrollment.product || "*"]
    .join("|")
    .toLowerCase();
}

export function alreadySent(key) {
  return Boolean(store[key]);
}

export function markSent(key) {
  store[key] = Date.now();
  persist();
}
