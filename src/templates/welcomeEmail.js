import { config } from "../config.js";

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstName(name) {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

export function buildWelcomeEmail({ enrollment, branding }) {
  const { companyName, supportEmail, loginUrl } = branding;
  const greetingName = escapeHtml(firstName(enrollment.name));
  const course = enrollment.product
    ? escapeHtml(enrollment.product)
    : "your new course";

  const subject = enrollment.product
    ? `Welcome to ${enrollment.product} 🎉 — ${companyName}`
    : `Welcome to ${companyName} 🎉`;

  // When a unique Discord invite was minted for this enrollment we deliver it
  // immediately (instead of the "within 48 hours" promise).
  const inviteUrl = enrollment.discordInvite || null;
  const inviteDays = Math.round(config.discord.inviteMaxAgeSec / 86400);
  const inviteNeverExpires = !config.discord.inviteMaxAgeSec || config.discord.inviteMaxAgeSec <= 0;
  const inviteExpiryHtml = inviteNeverExpires
    ? ""
    : ` (and is valid for <strong>${inviteDays} days</strong>)`;

  const discordTextLines = inviteUrl
    ? [
        "Your private Discord invite is ready — but PLEASE read these steps first, because this link works only ONCE and is just for you:",
        "",
        "  STEP 1 — Set up your Discord account FIRST (before you click the link):",
        "    - No Discord account yet? Create a free one at https://discord.com/register and verify your email.",
        "    - Our community server also requires a verified phone number, so please add and verify your phone in Discord (User Settings > My Account).",
        "    - Already have Discord? Just open the app (or https://discord.com) and LOG IN.",
        "",
        "  STEP 2 — Make sure you are logged into the correct Discord account you want to use.",
        "",
        '  STEP 3 — Only now, open your personal invite link below and click "Accept Invite":',
        `    ${inviteUrl}`,
        "",
        "  Please note:",
        "    - This link works only once and is unique to you — do NOT share it with anyone.",
        "    - Do not click it until you are logged into the right account, or you may use it up by mistake.",
        "    - Once used or expired, this link cannot be reissued — please follow the steps above carefully.",
      ]
    : [
        "You'll be receiving a Discord link within the next 48 hours so you can connect with your fellow peers.",
      ];

  const text = [
    `Hi ${firstName(enrollment.name)},`,
    "",
    `Thanks for enrolling in ${
      enrollment.product || "your new course"
    }! We're really excited that you're here. Let's get started.`,
    "",
    ...discordTextLines,
    "",
    `In the meantime, you can start learning right away by logging in here: ${loginUrl}`,
    "",
    "A few tips to get the most out of your course:",
    "  - Set aside regular time each week to practice.",
    "  - Code along with every lesson, don't just watch.",
    "  - Ask questions whenever you're stuck.",
    "",
    `If you need anything, just reply to this email or reach us at ${supportEmail}.`,
    "",
    "Happy coding!",
    `The ${companyName} Team`,
  ].join("\n");

  const discordHtmlBlock = inviteUrl
    ? `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:20px 24px;margin:0 0 16px;color:#3730a3;">
                  <div style="font-weight:700;font-size:16px;margin-bottom:6px;color:#312e81;">💬 Your private Discord invite is ready</div>
                  <div style="margin-bottom:14px;">This link is <strong>unique to you</strong> and works <strong>only once</strong>${inviteExpiryHtml}. Please follow these steps in order so you don't accidentally use it up:</div>
                  <ol style="margin:0;padding-left:22px;color:#312e81;">
                    <li style="margin-bottom:12px;">
                      <strong>Set up Discord FIRST.</strong><br/>
                      No account yet? <a href="https://discord.com/register" style="color:#4f46e5;">Create one here</a> and verify your email. Our server also requires a <strong>verified phone number</strong>, so add yours under User Settings &rsaquo; My Account.<br/>
                      Already have Discord? Open the app or <a href="https://discord.com" style="color:#4f46e5;">discord.com</a> and <strong>log in</strong>.
                    </li>
                    <li style="margin-bottom:12px;"><strong>Make sure you're logged into the correct account</strong> you want to use before going further.</li>
                    <li><strong>Only then</strong> click the button below and choose <strong>"Accept Invite"</strong>.</li>
                  </ol>
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                  <tr>
                    <td style="border-radius:10px;background:#5865F2;">
                      <a href="${escapeHtml(inviteUrl)}"
                         style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">
                        Join the Discord →
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="background:#fff7ed;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:0 0 28px;color:#92400e;font-size:14px;line-height:1.5;">
                  ⚠️ This is a <strong>one-time link just for you</strong> — please don't share it, and don't click it until you're logged into Discord. Once used or expired, <strong>this link cannot be reissued</strong>, so follow the steps above carefully.
                </div>`
    : `<div style="background:#eef2ff;border-left:4px solid #4f46e5;border-radius:8px;padding:16px 20px;margin:0 0 24px;color:#3730a3;">
                  💬 You'll be receiving a <strong>Discord link within the next 48 hours</strong>
                  so you can connect with your fellow peers.
                </div>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:40px 40px 32px;">
                <div style="color:#ffffff;font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85;">${escapeHtml(
                  companyName
                )}</div>
                <div style="color:#ffffff;font-size:28px;font-weight:700;margin-top:8px;">You're in! 🎉</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;color:#1e293b;font-size:16px;line-height:1.6;">
                <p style="margin:0 0 16px;">Hi ${greetingName},</p>
                <p style="margin:0 0 16px;">
                  Thanks for enrolling in <strong>${course}</strong>! We're really
                  excited that you're here. Let's get started.
                </p>
                ${discordHtmlBlock}
                <p style="margin:0 0 24px;">In the meantime, jump straight into your lessons:</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                  <tr>
                    <td style="border-radius:10px;background:#4f46e5;">
                      <a href="${escapeHtml(loginUrl)}"
                         style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">
                        Start Learning →
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="background:#f1f5f9;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
                  <div style="font-weight:600;margin-bottom:8px;color:#0f172a;">Quick tips to succeed</div>
                  <ul style="margin:0;padding-left:20px;color:#334155;">
                    <li style="margin-bottom:6px;">Set aside regular time each week to practice.</li>
                    <li style="margin-bottom:6px;">Code along with every lesson — don't just watch.</li>
                    <li>Ask questions whenever you're stuck.</li>
                  </ul>
                </div>
                <p style="margin:0 0 8px;">
                  Need help? Just reply to this email or reach us at
                  <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4f46e5;">${escapeHtml(
    supportEmail
  )}</a>.
                </p>
                <p style="margin:24px 0 0;">Happy coding!<br/>The ${escapeHtml(
                  companyName
                )} Team</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;background:#f8fafc;color:#94a3b8;font-size:12px;text-align:center;">
                You're receiving this because you enrolled at ${escapeHtml(
                  companyName
                )}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
