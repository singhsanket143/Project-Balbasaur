import { config } from "../config.js";
import { logger } from "../logger.js";
import { sendWelcomeEmail } from "./mailer.js";
import { markSent } from "../utils/dedupe.js";
import * as queue from "../utils/queue.js";

let running = false;
let timer = null;

function backoffFor(attempts) {
  const schedule = config.retry.backoffMs;
  const idx = Math.min(attempts, schedule.length - 1);
  return schedule[idx];
}

async function processOne(job) {
  try {
    await sendWelcomeEmail(job.enrollment);
    markSent(job.key); // idempotency: future duplicates are skipped
    queue.markDone(job.id);
  } catch (err) {
    const nextAttempts = job.attempts + 1;
    if (nextAttempts >= config.retry.maxAttempts) {
      queue.markDead(job.id, { error: err.message });
      logger.error(
        `Job ${job.id} (${job.enrollment?.email}) moved to dead-letter after ${nextAttempts} attempts: ${err.message}`
      );
    } else {
      const delayMs = backoffFor(nextAttempts);
      queue.reschedule(job.id, { delayMs, error: err.message });
      logger.warn(
        `Job ${job.id} (${job.enrollment?.email}) failed (attempt ${nextAttempts}/${config.retry.maxAttempts}): ${err.message}. Retrying in ${Math.round(
          delayMs / 1000
        )}s.`
      );
    }
  }
}

async function tick() {
  if (running) return; // never overlap ticks
  running = true;
  try {
    const jobs = queue.dueJobs();
    for (const job of jobs) {
      await processOne(job); // sequential keeps SMTP load gentle
    }
  } catch (err) {
    logger.error(`Queue tick error: ${err.message}`);
  } finally {
    running = false;
  }
}

export function startProcessor() {
  const { pending, dead } = queue.counts();
  logger.info(
    `Retry worker started (poll every ${config.queuePollMs}ms). Recovered ${pending} pending, ${dead} dead-letter job(s).`
  );
  // run once immediately so a restart drains the backlog right away
  tick();
  timer = setInterval(tick, config.queuePollMs);
  if (timer.unref) timer.unref();
}

export function stopProcessor() {
  if (timer) clearInterval(timer);
}
