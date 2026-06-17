import { config } from "../config.js";
import { logger } from "../logger.js";
import { sendWelcomeEmail } from "./mailer.js";
import { markSent } from "../utils/dedupe.js";
import {
  discordChannelForProduct,
  discordEnabledForProduct,
  createUniqueInvite,
} from "./discord.js";
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
    // For products enrolled in the auto-invite program, mint a unique single-use
    // Discord invite BEFORE sending the email. We persist it onto the job so an
    // SMTP retry reuses the same invite instead of burning a new one each time.
    if (
      discordEnabledForProduct(job.enrollment?.product) &&
      !job.enrollment?.discordInvite
    ) {
      const channelId = discordChannelForProduct(job.enrollment.product);
      const invite = await createUniqueInvite(channelId, {
        reason: `Enrollment: ${job.enrollment.email} / ${job.enrollment.product}`,
      });
      job.enrollment.discordInvite = invite.url;
      queue.updateEnrollment(job.id, job.enrollment);
      logger.info(
        `Created Discord invite for ${job.enrollment.email} (${job.enrollment.product}): ${invite.url}`
      );
    }

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
