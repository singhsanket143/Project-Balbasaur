import express from "express";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { webhookRouter } from "./routes/webhook.js";
import { verifyMailer } from "./services/mailer.js";
import { startProcessor } from "./services/processor.js";
import * as queue from "./utils/queue.js";

const app = express();

function tokenOk(req) {
  if (!config.webhookToken || config.webhookToken.startsWith("replace-with")) {
    return true;
  }
  const provided =
    req.query.token ||
    req.get("x-webhook-token") ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return provided === config.webhookToken;
}

// Capture the raw body (useful if Learnyst ever adds signed requests) while
// still parsing JSON and form-encoded payloads.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ service: "algocam-learnyst-welcome", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Operational visibility into the durable queue + dead-letters (token-protected).
app.get("/status", (req, res) => {
  if (!tokenOk(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  res.json({ ok: true, uptime: process.uptime(), queue: queue.counts(), deadLetters: queue.deadLetters() });
});

// Re-arm a dead-letter job so the worker retries it.
app.post("/status/retry/:id", (req, res) => {
  if (!tokenOk(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  const ok = queue.requeueDead(req.params.id);
  res.status(ok ? 200 : 404).json({ ok });
});

app.use("/webhook", webhookRouter);

app.use((req, res) => {
  res.status(404).json({ ok: false, error: "not_found", path: req.path });
});

app.listen(config.port, () => {
  logger.info(`Algocam Learnyst welcome service listening on :${config.port}`);
  logger.info(`Webhook endpoint: POST /webhook/learnyst`);
  if (config.dryRun) logger.warn("Running in DRY_RUN mode.");
  verifyMailer();
  startProcessor();
});
