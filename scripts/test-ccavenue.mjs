// Tests CCAvenue decryption round-trip and the parser. Sends NO emails.
// Run with: node scripts/test-ccavenue.mjs
import assert from "node:assert";
import querystring from "node:querystring";
import { encryptCCAvenue, decryptCCAvenue } from "../src/utils/crypto-ccavenue.js";
import { parseCCAvenue, isSuccessful } from "../src/services/ccavenue.js";

let pass = 0;
function check(name, cond) {
  assert.ok(cond, `FAILED: ${name}`);
  console.log(`  ok  ${name}`);
  pass++;
}

const WORKING_KEY = "TESTWORKINGKEY1234567890";

// Build a realistic CCAvenue Order Status payload, encrypt it, then decrypt.
const payload = querystring.stringify({
  order_id: "ALGOCAMP12345",
  tracking_id: "1122334455",
  order_status: "Success",
  amount: "14498.00",
  currency: "INR",
  billing_name: "Prajjawal Kushwaha",
  billing_email: "prajjawal.kushwaha41@gmail.com",
  merchant_param1: "Advanced backend development with Spring Boot",
});

const enc = encryptCCAvenue(payload, WORKING_KEY);
check("encrypt produces hex", /^[0-9a-f]+$/i.test(enc));

const decoded = decryptCCAvenue(enc, WORKING_KEY);
check("decrypt round-trips to original", decoded === payload);

const params = querystring.parse(decoded);
const enrollment = parseCCAvenue(params);
check("parser extracts email", enrollment.email === "prajjawal.kushwaha41@gmail.com");
check("parser extracts name", enrollment.name === "Prajjawal Kushwaha");
check("parser extracts product from merchant_param1", enrollment.product === "Advanced backend development with Spring Boot");
check("parser reads success status", enrollment.status === "success");
check("isSuccessful accepts a successful payment", isSuccessful(enrollment).ok === true);

// Failed payment should be rejected
const failed = parseCCAvenue({ order_status: "Failure", billing_email: "x@y.com" });
check("isSuccessful rejects a failed payment", isSuccessful(failed).ok === false);

// Wrong key should not decrypt to the same plaintext
let wrongKeyFailed = false;
try {
  const bad = decryptCCAvenue(enc, "WRONGKEY");
  wrongKeyFailed = bad !== payload;
} catch {
  wrongKeyFailed = true; // padding error is also an acceptable "failure"
}
check("wrong working key does not yield the payload", wrongKeyFailed);

console.log(`\nAll ${pass} CCAvenue checks passed.`);
