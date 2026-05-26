import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { UserRole } from "@prisma/client";
import type { User } from "@prisma/client";

// Extend Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "No token provided, authorization denied" });
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      res.status(401).json({ message: "No token provided, authorization denied" });
      return;
    }

    const jwtSecret = process.env["JWT_SECRET"] || "defaultsecret";
    const decoded = jwt.verify(token, jwtSecret) as { id: string; email: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      res.status(401).json({ message: "Token is invalid, user not found" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Token is not valid or has expired" });
  }
};

export const requireRoles = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: You do not have permission to access this resource" });
      return;
    }

    next();
  };
};
