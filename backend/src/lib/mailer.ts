import "dotenv/config";
import nodemailer from "nodemailer";
import { logger } from "./logger";

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpFrom = process.env.SMTP_FROM || `"Daily Tasks" <${smtpUser || "noreply@dailytasks.app"}>`;

export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
});

export interface EmailTemplateOptions {
  title: string;
  badge?: string;
  headline: string;
  bodyParagraphs: string[];
  buttonText?: string;
  buttonUrl?: string;
  warningNote?: string;
}

export function buildBrandEmailHtml(options: EmailTemplateOptions): string {
  const { title, badge = "Private 2-Seat Room", headline, bodyParagraphs, buttonText, buttonUrl, warningNote } = options;

  const paragraphsHtml = bodyParagraphs
    .map(
      (p) =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">${p}</p>`
    )
    .join("");

  const buttonHtml =
    buttonText && buttonUrl
      ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${buttonUrl}" target="_blank" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.4); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: 0.3px;">
          ${buttonText} →
        </a>
      </div>
    `
      : "";

  const warningHtml = warningNote
    ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 8px; margin-top: 24px;">
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          🔒 <strong style="color: #334155;">Security Notice:</strong> ${warningNote}
        </p>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #090b18 0%, #1e1b4b 50%, #0f172a 100%); padding: 36px 32px; text-align: center; border-bottom: 1px solid #1e293b;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <div style="background-color: #2563eb; width: 56px; height: 56px; border-radius: 16px; display: inline-block; line-height: 56px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35); text-align: center;">
                      <span style="color: #ffffff; font-size: 24px; font-weight: bold;">DT</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 16px;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; font-family: Georgia, serif;">Daily Tasks</h1>
                    <p style="margin: 6px 0 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 2.5px; color: #38bdf8;">${badge}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 40px 36px; background-color: #ffffff;">
              <h2 style="margin: 0 0 18px 0; font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px; line-height: 1.3;">
                ${headline}
              </h2>

              ${paragraphsHtml}

              ${buttonHtml}

              ${warningHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 36px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                Daily Tasks · Sealed Workspace for Two
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                This email was sent automatically from your secure portal.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function sendPasswordResetEmail(toEmail: string, resetLink: string): Promise<boolean> {
  const html = buildBrandEmailHtml({
    title: "Reset your Daily Tasks Password",
    badge: "Account Security & Recovery",
    headline: "Password Reset Request",
    bodyParagraphs: [
      "We received a request to reset the password for your Daily Tasks private room account.",
      "Click the secure button below to set a new strong password. If you didn't make this request, your account is still completely safe and you can ignore this message.",
    ],
    buttonText: "Reset My Password",
    buttonUrl: resetLink,
    warningNote: "This link will automatically expire in 1 hour for your protection. Never share this email or link with anyone.",
  });

  try {
    if (!smtpUser || !smtpPass) {
      logger.info({ toEmail, resetLink }, "SMTP credentials not configured — reset link generated & logged");
      return true;
    }

    await transporter.sendMail({
      from: smtpFrom,
      to: toEmail,
      subject: "Reset your Daily Tasks Password 🔑",
      html,
    });
    logger.info({ toEmail }, "Password reset email sent via Nodemailer SMTP");
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, toEmail }, "Failed to send password reset email");
    return false;
  }
}
