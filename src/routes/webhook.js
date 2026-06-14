import express from "express";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { parseEnrollment, shouldSendWelcome } from "../services/enrollment.js";
import { buildKey, alreadySent } from "../utils/dedupe.js";
import * as queue from "../utils/queue.js";

export const webhookRouter = express.Router();

function tokenIsValid(req) {
  // No token configured -> skip the check (handy for first-run testing).
  if (!config.webhookToken || config.webhookToken.startsWith("replace-with")) {
    return true;
  }
  const provided =
    req.query.token ||
    req.get("x-webhook-token") ||
    (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return provided === config.webhookToken;
}

webhookRouter.post("/learnyst", async (req, res) => {
  if (!tokenIsValid(req)) {
    logger.warn("Rejected webhook: invalid or missing token.");
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const payload = req.body || {};
  const enrollment = parseEnrollment(payload);

  logger.info(
    `Webhook received — event=${enrollment.event || "?"} email=${
      enrollment.email || "?"
    } product=${enrollment.product || "?"}`
  );

  const decision = shouldSendWelcome(enrollment, config.welcomeEvents);
  if (!decision.ok) {
    logger.warn(`Skipping welcome email: ${decision.reason}`);
    // Always 200 so Learnyst doesn't keep retrying a payload we intentionally skip.
    return res.status(200).json({ ok: true, skipped: decision.reason });
  }

  const key = buildKey(enrollment);

  // Idempotency: skip if we've already sent this, or it's already queued.
  if (alreadySent(key)) {
    logger.info(`Duplicate webhook ignored (already sent) for ${enrollment.email}.`);
    return res.status(200).json({ ok: true, deduped: true });
  }
  if (queue.hasActiveKey(key)) {
    logger.info(`Duplicate webhook ignored (already queued) for ${enrollment.email}.`);
    return res.status(200).json({ ok: true, deduped: true });
  }

  // Durably persist the job, then ack fast. The retry worker sends the email
  // (with backoff), so a crash/restart or a transient SMTP failure can't drop
  // an enrollment we've already accepted.
  const id = queue.enqueue({ key, enrollment });
  logger.info(`Queued welcome email for ${enrollment.email} (job ${id}).`);
  return res.status(200).json({ ok: true, queued: true, jobId: id });
});
