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

  const text = [
    `Hi ${firstName(enrollment.name)},`,
    "",
    `Thanks for enrolling in ${
      enrollment.product || "your new course"
    }! We're really excited that you're here. Let's get started.`,
    "",
    "You'll be receiving a Discord link within the next 48 hours so you can connect with your fellow peers.",
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
                <div style="background:#eef2ff;border-left:4px solid #4f46e5;border-radius:8px;padding:16px 20px;margin:0 0 24px;color:#3730a3;">
                  💬 You'll be receiving a <strong>Discord link within the next 48 hours</strong>
                  so you can connect with your fellow peers.
                </div>
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
