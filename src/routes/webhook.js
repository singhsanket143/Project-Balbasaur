import express from "express";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { parseEnrollment, shouldSendWelcome } from "../services/enrollment.js";
import { extractParams, parseCCAvenue, isSuccessful } from "../services/ccavenue.js";
import { buildKey, alreadySent, recentlyWelcomed } from "../utils/dedupe.js";
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

// Shared: dedupe across sources, then durably enqueue. Returns a result object.
function acceptEnrollment(enrollment, { source, delayMs = 0 }) {
  const key = buildKey(enrollment);

  if (alreadySent(key)) {
    return { status: "deduped", reason: "already_sent" };
  }
  if (recentlyWelcomed(enrollment.email, config.reconcile.windowMs)) {
    return { status: "deduped", reason: "recently_welcomed" };
  }
  if (queue.hasActiveKey(key)) {
    return { status: "deduped", reason: "already_queued" };
  }

  const jobId = queue.enqueue({ key, enrollment, source, delayMs });
  return { status: "queued", jobId };
}

webhookRouter.post("/learnyst", async (req, res) => {
  if (!tokenIsValid(req)) {
    logger.warn("Rejected Learnyst webhook: invalid or missing token.");
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const enrollment = { ...parseEnrollment(req.body || {}), source: "learnyst" };
  logger.info(
    `[learnyst] webhook — event=${enrollment.event || "?"} email=${
      enrollment.email || "?"
    } product=${enrollment.product || "?"}`
  );

  const decision = shouldSendWelcome(enrollment, config.welcomeEvents);
  if (!decision.ok) {
    logger.warn(`[learnyst] skipping: ${decision.reason}`);
    return res.status(200).json({ ok: true, skipped: decision.reason });
  }

  // Learnyst is the primary source (has the course name) -> send immediately.
  const result = acceptEnrollment(enrollment, { source: "learnyst", delayMs: 0 });
  if (result.status === "deduped") {
    logger.info(`[learnyst] deduped (${result.reason}) for ${enrollment.email}.`);
    return res.status(200).json({ ok: true, deduped: true, reason: result.reason });
  }
  logger.info(`[learnyst] queued welcome for ${enrollment.email} (job ${result.jobId}).`);
  return res.status(200).json({ ok: true, queued: true, jobId: result.jobId });
});

webhookRouter.post("/ccavenue", async (req, res) => {
  if (!tokenIsValid(req)) {
    logger.warn("Rejected CCAvenue webhook: invalid or missing token.");
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  let params;
  try {
    params = extractParams(req.body || {}, config.ccavenue.workingKey);
  } catch (err) {
    logger.error(`[ccavenue] could not decrypt payload: ${err.message}`);
    // 200 so CCAvenue doesn't hammer retries on an undecryptable payload.
    return res.status(200).json({ ok: true, error: "decrypt_failed" });
  }

  const enrollment = { ...parseCCAvenue(params), source: "ccavenue" };
  logger.info(
    `[ccavenue] webhook — status=${enrollment.status || "?"} email=${
      enrollment.email || "?"
    } order=${enrollment.orderId || "?"}`
  );

  const decision = isSuccessful(enrollment);
  if (!decision.ok) {
    logger.warn(`[ccavenue] skipping: ${decision.reason}`);
    return res.status(200).json({ ok: true, skipped: decision.reason });
  }

  // CCAvenue is the backup/reconciliation source -> small grace delay so Learnyst
  // (which knows the course name) normally sends first.
  const result = acceptEnrollment(enrollment, {
    source: "ccavenue",
    delayMs: config.reconcile.ccavenueDelayMs,
  });
  if (result.status === "deduped") {
    logger.info(`[ccavenue] deduped (${result.reason}) for ${enrollment.email}.`);
    return res.status(200).json({ ok: true, deduped: true, reason: result.reason });
  }
  logger.info(
    `[ccavenue] queued backup welcome for ${enrollment.email} (job ${result.jobId}, fires in ${Math.round(
      config.reconcile.ccavenueDelayMs / 1000
    )}s if not already sent).`
  );
  return res.status(200).json({ ok: true, queued: true, jobId: result.jobId });
});
