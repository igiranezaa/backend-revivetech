import nodemailer from "nodemailer";

export const emailTransporter = nodemailer.createTransport({
  host: process.env["SMTP_HOST"],
  port: Number(process.env["SMTP_PORT"] || 587),
  secure: process.env["SMTP_SECURE"] === "true",
  auth: process.env["SMTP_USER"] && process.env["SMTP_PASS"]
    ? {
        user: process.env["SMTP_USER"],
        pass: process.env["SMTP_PASS"],
      }
    : undefined,
});

export const emailFrom = process.env["EMAIL_FROM"] || process.env["SMTP_USER"] || "no-reply@example.com";
