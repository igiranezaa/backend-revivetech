import nodemailer from "nodemailer";

const smtpUser = process.env["SMTP_USER"]?.trim();
const smtpPass = process.env["SMTP_PASS"]?.replace(/\s+/g, "");

export const emailFromName = process.env["EMAIL_FROM_NAME"] || "ecommerce";

export const emailFrom = process.env["EMAIL_FROM"] || smtpUser || "no-reply@example.com";

export const isEmailConfigured = (): boolean => Boolean(smtpUser && smtpPass);

export const emailTransporter = nodemailer.createTransport({
  host: process.env["SMTP_HOST"] || "smtp.gmail.com",
  port: Number(process.env["SMTP_PORT"] || 587),
  secure: process.env["SMTP_SECURE"] === "true",
  auth: isEmailConfigured()
    ? {
        user: smtpUser,
        pass: smtpPass,
      }
    : undefined,
});
