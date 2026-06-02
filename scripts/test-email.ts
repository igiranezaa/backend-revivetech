import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "src/.env") });

const { isEmailConfigured, emailTransporter } = await import("../src/config/email.js");
const { sendOtpEmail } = await import("../src/services/email.service.js");

const to = process.argv[2] || process.env["SMTP_USER"];

if (!isEmailConfigured()) {
  console.error("Email not configured. Set SMTP_USER and SMTP_PASS in backend/.env");
  process.exit(1);
}

console.log("Verifying SMTP connection...");
await emailTransporter.verify();
console.log("SMTP OK. Sending test OTP to", to);

await sendOtpEmail(to!, "123456", "verification");
console.log("Test email sent successfully.");
