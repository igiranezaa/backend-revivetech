import { emailFrom, emailFromName, emailTransporter, isEmailConfigured } from "../config/email.js";

export type OtpEmailPurpose = "verification" | "password-reset";

const purposeCopy: Record<OtpEmailPurpose, { subject: string; heading: string; intro: string }> = {
  verification: {
    subject: "Verify your ecommerce account",
    heading: "Verify your email",
    intro: "Use this code to complete your ecommerce registration:",
  },
  "password-reset": {
    subject: "Reset your ecommerce password",
    heading: "Password reset",
    intro: "Use this code to reset your ecommerce password:",
  },
};

export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: OtpEmailPurpose,
): Promise<void> {
  if (!isEmailConfigured()) {
    throw new Error("Email is not configured. Set SMTP_USER and SMTP_PASS in .env");
  }

  const copy = purposeCopy[purpose];
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#127058;margin:0 0 8px">${copy.heading}</h2>
      <p style="color:#444;line-height:1.5">${copy.intro}</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#127058;margin:24px 0">${otp}</p>
      <p style="color:#666;font-size:14px">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="color:#999;font-size:12px">${emailFromName}</p>
    </div>
  `;

  await emailTransporter.sendMail({
    from: `"${emailFromName}" <${emailFrom}>`,
    to,
    subject: copy.subject,
    html,
    text: `${copy.intro} ${otp}. This code expires in 10 minutes.`,
  });
}
