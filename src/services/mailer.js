import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { buildWelcomeEmail } from "../templates/welcomeEmail.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth:
      config.smtp.user && config.smtp.pass
        ? { user: config.smtp.user, pass: config.smtp.pass }
        : undefined,
  });
  return transporter;
}

export async function verifyMailer() {
  if (config.dryRun) {
    logger.warn("DRY_RUN is enabled — emails will be logged, not sent.");
    return;
  }
  try {
    await getTransporter().verify();
    logger.info("SMTP connection verified.");
  } catch (err) {
    logger.warn(`SMTP verification failed: ${err.message}. Check your .env.`);
  }
}

export async function sendWelcomeEmail(enrollment) {
  const { subject, text, html } = buildWelcomeEmail({
    enrollment,
    branding: config.branding,
  });

  const message = {
    from: `"${config.mail.fromName}" <${config.mail.fromEmail}>`,
    to: enrollment.name
      ? `"${enrollment.name}" <${enrollment.email}>`
      : enrollment.email,
    subject,
    text,
    html,
    ...(config.mail.bcc ? { bcc: config.mail.bcc } : {}),
  };

  if (config.dryRun) {
    logger.info(`[DRY_RUN] Would email ${enrollment.email}: "${subject}"`);
    return { dryRun: true };
  }

  const info = await getTransporter().sendMail(message);
  logger.info(`Welcome email sent to ${enrollment.email} (id: ${info.messageId})`);
  return info;
}
