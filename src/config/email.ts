import "dotenv/config";
import nodemailer from "nodemailer";

const host = process.env["SMTP_HOST"] || process.env["EMAIL_HOST"];
const port = Number(process.env["SMTP_PORT"] || process.env["EMAIL_PORT"] || 587);
const user = process.env["SMTP_USER"] || process.env["EMAIL_USER"];
const pass = process.env["SMTP_PASS"] || process.env["EMAIL_PASS"];

export const emailTransporter = nodemailer.createTransport({
  host,
  port,
  secure: process.env["SMTP_SECURE"] === "true" || port === 465,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  auth: user && pass
    ? {
        user,
        pass,
      }
    : undefined,
});

export const emailFrom = process.env["EMAIL_FROM"] || user || "no-reply@example.com";

export async function sendOtpEmail({
  email,
  otp,
  purpose,
}: {
  email: string;
  otp: string;
  purpose: "verify" | "reset";
}) {
  if (!host || !user || !pass) {
    throw new Error("Email delivery is not configured");
  }

  const isVerification = purpose === "verify";
  await emailTransporter.sendMail({
    from: emailFrom,
    to: email,
    subject: isVerification ? "Verify your ReviveTech account" : "Reset your ReviveTech password",
    text: `Your ReviveTech ${isVerification ? "verification" : "password reset"} code is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#172033">
        <h2 style="color:#127058">ReviveTech</h2>
        <p>${isVerification ? "Welcome! Use this code to verify your account." : "Use this code to reset your password."}</p>
        <div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:18px 20px;background:#f0faf7;border-radius:12px;color:#127058">${otp}</div>
        <p style="color:#667085;font-size:13px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });
}
