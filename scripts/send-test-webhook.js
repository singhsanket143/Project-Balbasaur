// Simulates a Learnyst enrollment webhook against the local server.
// Usage:
//   node scripts/send-test-webhook.js [email] [name] [product]
// Env:
//   PORT (default 3000), WEBHOOK_TOKEN (must match server)

import dotenv from "dotenv";
dotenv.config();

const port = process.env.PORT || 3000;
const token = process.env.WEBHOOK_TOKEN || "";

const email = process.argv[2] || "test.student@example.com";
const name = process.argv[3] || "Test Student";
const product = process.argv[4] || "Python for Beginners";

// Shape mirrors what Learnyst-style enrollment/purchase webhooks send:
// learner fields plus product details. Our parser is tolerant of variations.
const payload = {
  event: "purchase",
  name,
  email,
  phone: "+910000000000",
  product_title: product,
  amount: 4999,
  currency: "INR",
  created_at: new Date().toISOString(),
};

const url = `http://localhost:${port}/webhook/learnyst${
  token ? `?token=${encodeURIComponent(token)}` : ""
}`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(token ? { "x-webhook-token": token } : {}),
  },
  body: JSON.stringify(payload),
});

console.log("Status:", res.status);
console.log("Body:", await res.text());
