import type { Response } from "express";

export const sendMissingFields = (res: Response, fields: string[]): void => {
  res.status(400).json({ message: `Required fields: ${fields.join(", ")}` });
};

export const parseOptionalNumber = (value: unknown, fallback = 0): number => {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseOptionalString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
};
