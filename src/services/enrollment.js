// Learnyst does not publish a fixed webhook schema, and the exact field names can
// vary slightly between event types (Sign Up, Purchase, Trial Enrolment, ...).
// To stay robust we search the payload for the fields we care about, checking a
// list of likely key names at the top level and one level of nesting.

const EMAIL_KEYS = ["email", "user_email", "learner_email", "useremail", "mail"];
const NAME_KEYS = [
  "name",
  "full_name",
  "fullname",
  "user_name",
  "username",
  "learner_name",
  "first_name",
  "firstname",
];
const PRODUCT_KEYS = [
  "product_title",
  "product_name",
  "product",
  "course_name",
  "course_title",
  "course",
  "title",
];
const EVENT_KEYS = ["event", "event_type", "eventName", "type", "trigger", "action"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  // case-insensitive lookup
  const lower = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
  for (const key of keys) {
    const v = lower[key.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return undefined;
}

function deepPick(payload, keys) {
  // top level first
  const top = pick(payload, keys);
  if (top !== undefined) return top;
  // then one level of nested objects (e.g. payload.data, payload.user, payload.learner)
  for (const value of Object.values(payload || {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = pick(value, keys);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

function findAnyEmail(payload, depth = 0) {
  if (!payload || typeof payload !== "object" || depth > 4) return undefined;
  for (const value of Object.values(payload)) {
    if (typeof value === "string" && EMAIL_RE.test(value.trim())) {
      return value.trim();
    }
    if (value && typeof value === "object") {
      const found = findAnyEmail(value, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

export function parseEnrollment(payload) {
  const email =
    deepPick(payload, EMAIL_KEYS) || findAnyEmail(payload) || undefined;

  let name = deepPick(payload, NAME_KEYS);
  if (name && typeof name === "object") name = undefined;

  const product = deepPick(payload, PRODUCT_KEYS);
  const event = deepPick(payload, EVENT_KEYS);

  return {
    email: email ? String(email).trim().toLowerCase() : undefined,
    name: name ? String(name).trim() : undefined,
    product: product ? String(product).trim() : undefined,
    event: event ? String(event).trim().toLowerCase() : undefined,
  };
}

export function shouldSendWelcome(enrollment, welcomeEvents) {
  if (!enrollment.email || !EMAIL_RE.test(enrollment.email)) {
    return { ok: false, reason: "no_valid_email" };
  }
  if (welcomeEvents === "*") {
    return { ok: true };
  }
  if (!enrollment.event) {
    // We can't determine the event name; default to sending since an email exists.
    return { ok: true, reason: "event_unknown_but_allowed" };
  }
  if (welcomeEvents.includes(enrollment.event)) {
    return { ok: true };
  }
  return { ok: false, reason: `event_not_in_allowlist:${enrollment.event}` };
}
