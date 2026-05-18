import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../config/prisma.js";
import { Role } from "@prisma/client";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../validators/auth.validator.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { sendEmail } from "../config/email.js";
import { welcomeEmail, passwordResetEmail } from "../templates/emails.js";

const withoutSensitiveFields = <T extends { password?: string | null; resetToken?: string | null; resetTokenExpiry?: Date | null }>(
  user: T
): Omit<T, "password" | "resetToken" | "resetTokenExpiry"> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, resetToken, resetTokenExpiry, ...rest } = user;
  return rest;
};

const adminNotificationRecipients = (): string[] => {
  const configured = process.env["ADMIN_NOTIFICATION_EMAILS"] || process.env["ADMIN_EMAIL"] || "fifingabire25@gmail.com";
  return configured.split(",").map((email) => email.trim()).filter(Boolean);
};

const notifyAdmins = (subject: string, html: string): void => {
  adminNotificationRecipients().forEach((email) => {
    sendEmail(email, subject, html).catch((err) => console.error(`Failed to send admin email to ${email}:`, err));
  });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = registerSchema.parse(req.body);
    const { name, email, phone, password } = parsed;

    // Use username from request if provided, otherwise auto-generate
    const baseUsername = (email.split("@")[0] ?? email).toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const username = parsed.username ?? `${baseUsername}${randomSuffix}`;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      if (existing.email === email) {
        res.status(409).json({ message: "Email already in use" });
        return;
      } else {
        // Username collision — regenerate
        const newUsername = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
          data: {
            name,
            email,
            username: newUsername,
            phone,
            password: hashedPassword,
            role: Role.GUEST,
            isSuperAdmin: email.toLowerCase() === "fifingabire25@gmail.com",
            avatar: null,
            bio: null,
          },
        });
        res.status(201).json(withoutSensitiveFields(user));
        Promise.resolve()
          .then(() => sendEmail(user.email, "Welcome to ListOn!", welcomeEmail(user.name, user.role)))
          .catch((err) => console.error("Failed to send welcome email:", err));
        notifyAdmins("New user registered", `<p>${user.name} (${user.email}) just registered as ${user.role}.</p>`);
      }
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        phone,
        password: hashedPassword,
        role: Role.GUEST,
        isSuperAdmin: email.toLowerCase() === "fifingabire25@gmail.com",
        avatar: null,
        bio: null,
      },
    });

    res.status(201).json(withoutSensitiveFields(user));

    // Send welcome email (non-blocking)
    Promise.resolve()
      .then(() => sendEmail(user.email, "Welcome to ListOn!", welcomeEmail(user.name, user.role)))
      .catch((err) => console.error("Failed to send welcome email:", err));
    notifyAdmins("New user registered", `<p>${user.name} (${user.email}) just registered as ${user.role}.</p>`);
    return;
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.parse(req.body);
    const { email, password } = parsed;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const secretEnv = process.env["JWT_SECRET"];
    if (!secretEnv) {
      res.status(500).json({ message: "JWT_SECRET is not set" });
      return;
    }
    const secret: jwt.Secret = secretEnv;
    const expiresIn = process.env["JWT_EXPIRES_IN"] ?? "7d";

    const token = jwt.sign({ userId: user.id, role: user.role }, secret, {
      expiresIn: expiresIn as unknown as jwt.SignOptions["expiresIn"],
    } as unknown as jwt.SignOptions);

    res.json({ token, user: withoutSensitiveFields(user) });
  } catch (error) {
    next(error);
  }
};

export const me = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(withoutSensitiveFields(user));
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    const parsed = changePasswordSchema.parse(req.body);
    const { currentPassword, newPassword } = parsed;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId },
      data: { password: hashed },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const { email } = parsed;

    const user = await prisma.user.findUnique({ where: { email } });
    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: "If that email exists, a reset link has been sent" });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const resetLink = `${process.env["API_URL"] || "http://localhost:3000"}/api/v1/auth/reset-password/${rawToken}`;
    console.log("Password Reset Link (for testing):", resetLink);

    // Send reset email (non-blocking — never crashes the request)
    Promise.resolve()
      .then(() => sendEmail(user.email, "Reset your password", passwordResetEmail(user.name, resetLink)))
      .catch((err) => console.error("Failed to send reset email:", err));

    res.json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const tokenParam = req.params.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
    if (!token) {
      res.status(400).json({ message: "Missing token" });
      return;
    }

    const parsed = resetPasswordSchema.parse(req.body);
    const { password } = parsed;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    next(error);
  }
};
