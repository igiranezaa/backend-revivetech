import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { UserRole } from "@prisma/client";
import { writeAuditLog } from "../utils/audit-log.js";

// Generate 6 digit numeric OTP
const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ message: "Required fields: firstName, lastName, email, password" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: "User with this email already exists" });
      return;
    }

    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        res.status(400).json({ message: "User with this phone number already exists" });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    const requestedRole = role && Object.values(UserRole).includes(role) ? (role as UserRole) : UserRole.CUSTOMER;

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        role: requestedRole,
        isVerified: false,
        otpCode: otp,
        otpExpiresAt: otpExpires,
      },
    });

    await writeAuditLog({
      action: "USER_REGISTER",
      details: `User ${user.email} registered with role ${user.role}.`,
      userId: user.id,
    });

    res.status(201).json({
      message: "Registration successful. Please verify using the OTP code sent.",
      userId: user.id,
      email: user.email,
      otpCode: otp, // Return OTP directly for testing purposes
    });
  } catch (error: any) {
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otpCode } = req.body;

    if (!email || !otpCode) {
      res.status(400).json({ message: "Required fields: email, otpCode" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.isVerified) {
      res.status(400).json({ message: "User is already verified" });
      return;
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpCode !== otpCode) {
      res.status(400).json({ message: "Invalid OTP code" });
      return;
    }

    if (new Date() > user.otpExpiresAt) {
      res.status(400).json({ message: "OTP has expired. Please register again or request reset." });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    await writeAuditLog({
      action: "OTP_VERIFIED",
      details: `User ${user.email} verified account successfully.`,
      userId: user.id,
    });

    res.status(200).json({ message: "Account verified successfully. You can now login." });
  } catch (error: any) {
    res.status(500).json({ message: "Verification failed", error: error.message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Required fields: email, password" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({ message: "Account not verified. Please verify using OTP first.", userId: user.id });
      return;
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtSecret = process.env["JWT_SECRET"] || "defaultsecret";
    const expires = process.env["JWT_EXPIRES_IN"] || "7d";
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: expires as any });

    await writeAuditLog({
      action: "USER_LOGIN",
      details: `User ${user.email} logged in.`,
      userId: user.id,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "Required field: email" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiresAt: otpExpires,
      },
    });

    res.status(200).json({
      message: "Password reset OTP generated.",
      otpCode: otp, // Return OTP directly for testing purposes
    });
  } catch (error: any) {
    res.status(500).json({ message: "Request failed", error: error.message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otpCode, newPassword } = req.body;

    if (!email || !otpCode || !newPassword) {
      res.status(400).json({ message: "Required fields: email, otpCode, newPassword" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpCode !== otpCode) {
      res.status(400).json({ message: "Invalid OTP code" });
      return;
    }

    if (new Date() > user.otpExpiresAt) {
      res.status(400).json({ message: "OTP has expired" });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    await writeAuditLog({
      action: "PASSWORD_RESET",
      details: `User ${user.email} reset password successfully.`,
      userId: user.id,
    });

    res.status(200).json({ message: "Password reset successfully. You can now login with your new password." });
  } catch (error: any) {
    res.status(500).json({ message: "Reset failed", error: error.message });
  }
};
