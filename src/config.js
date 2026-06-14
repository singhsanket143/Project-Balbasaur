import dotenv from "dotenv";

dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function required(name, value) {
  if (!value || String(value).startsWith("replace-with")) {
    console.warn(
      `[config] WARNING: ${name} is not set. Update your .env before going live.`
    );
  }
  return value;
}

const welcomeEventsRaw = (process.env.WELCOME_EVENTS || "*").trim();

export const config = {
  port: Number(process.env.PORT || 3000),
  webhookToken: required("WEBHOOK_TOKEN", process.env.WEBHOOK_TOKEN),

  // "*" means: handle any event that carries a learner email.
  welcomeEvents:
    welcomeEventsRaw === "*"
      ? "*"
      : welcomeEventsRaw
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  mail: {
    fromName: process.env.MAIL_FROM_NAME || "Algocam",
    fromEmail: process.env.MAIL_FROM_EMAIL || "hello@algocam.com",
    bcc: process.env.MAIL_BCC || "",
  },

  branding: {
    companyName: process.env.COMPANY_NAME || "Algocam",
    supportEmail: process.env.SUPPORT_EMAIL || "support@algocam.com",
    loginUrl: process.env.LMS_LOGIN_URL || "https://learnyst.com",
  },

  dryRun: bool(process.env.DRY_RUN, false),

  // CCAvenue payment-gateway webhook (second, redundant enrollment source).
  ccavenue: {
    workingKey: process.env.CCAVENUE_WORKING_KEY || "",
  },

  // Cross-source reconciliation so a student is welcomed exactly once even when
  // both Learnyst and CCAvenue fire.
  reconcile: {
    // If this email was welcomed within this window, a backup source won't re-send.
    windowMs: Number(process.env.RECONCILE_WINDOW_MS || 12 * 60 * 60 * 1000),
    // Grace delay on the CCAvenue path so Learnyst (richer payload) usually wins.
    ccavenueDelayMs: Number(process.env.CCAVENUE_DELAY_MS || 120_000),
  },

  // How often the retry worker scans the durable queue.
  queuePollMs: Number(process.env.QUEUE_POLL_MS || 5000),

  retry: {
    // Total attempts before a job is moved to the dead-letter state.
    maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS || 8),
    // Backoff between attempts, indexed by attempt number.
    // ~30s, 2m, 5m, 10m, 30m, 1h, 2h, then capped.
    backoffMs: [0, 30_000, 120_000, 300_000, 600_000, 1_800_000, 3_600_000, 7_200_000],
  },
};
