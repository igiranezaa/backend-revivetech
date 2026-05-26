import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimiterOptions = {
  windowMs?: number;
  max?: number;
};

const clients = new Map<string, RateLimitEntry>();

export const rateLimiter = (options: RateLimiterOptions = {}) => {
  const windowMs = options.windowMs || Number(process.env["RATE_LIMIT_WINDOW_MS"] || 15 * 60 * 1000);
  const max = options.max || Number(process.env["RATE_LIMIT_MAX_REQUESTS"] || 100);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const current = clients.get(key);

    if (!current || current.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;

    const remaining = Math.max(max - current.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.status(429).json({ message: "Too many requests, please try again later" });
      return;
    }

    next();
  };
};
