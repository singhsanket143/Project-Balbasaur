import querystring from "node:querystring";
import { decryptCCAvenue } from "../utils/crypto-ccavenue.js";

// CCAvenue's decrypted Order Status payload is a query-string of key=value pairs.
// Field names can vary a little by account/integration, so we look up several
// likely names. The customer's email/name come from the billing fields; the
// course/product is often not present (CCAvenue doesn't know your LMS catalog),
// in which case we fall back to merchant_param fields if you map them.

const EMAIL_KEYS = [
  "billing_email",
  "order_bill_email",
  "customer_email",
  "email",
];
const NAME_KEYS = [
  "billing_name",
  "order_bill_name",
  "customer_name",
  "delivery_name",
  "name",
];
const PRODUCT_KEYS = [
  "product",
  "order_desc",
  "merchant_param1",
  "merchant_param2",
  "merchant_param3",
];
const STATUS_KEYS = ["order_status", "status"];
const ORDER_ID_KEYS = ["order_id", "order_no", "reference_no"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pick(params, keys) {
  for (const k of keys) {
    const v = params[k] ?? params[k?.toUpperCase?.()] ?? params[k?.toLowerCase?.()];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return undefined;
}

/** Extract the raw CCAvenue params object from a request body (decrypting if needed). */
export function extractParams(body, workingKey) {
  const enc =
    body?.encResp || body?.enc_response || body?.encResponse || body?.encResponce;
  if (enc) {
    const decoded = decryptCCAvenue(enc, workingKey);
    return querystring.parse(decoded);
  }
  // Fallback: some setups post the fields directly (or already-decrypted).
  return body || {};
}

export function parseCCAvenue(params) {
  const email = pick(params, EMAIL_KEYS);
  const status = (pick(params, STATUS_KEYS) || "").toLowerCase();
  return {
    email: email ? email.toLowerCase() : undefined,
    name: pick(params, NAME_KEYS),
    product: pick(params, PRODUCT_KEYS),
    orderId: pick(params, ORDER_ID_KEYS),
    status,
    source: "ccavenue",
  };
}

export function isSuccessful(enrollment) {
  if (!enrollment.email || !EMAIL_RE.test(enrollment.email)) {
    return { ok: false, reason: "no_valid_email" };
  }
  // CCAvenue uses "Success" for completed payments.
  if (!enrollment.status.includes("success")) {
    return { ok: false, reason: `status_not_success:${enrollment.status || "?"}` };
  }
  return { ok: true };
}
