import type { ErrorRequestHandler } from "express";

type HttpError = Error & {
  status?: number;
  statusCode?: number;
};

export const errorHandler: ErrorRequestHandler = (err: HttpError, _req, res, _next) => {
  const statusCode = err.status || err.statusCode || 500;

  console.error("Unhandled Error:", err);

  res.status(statusCode).json({
    message: err.message || "An unexpected error occurred in the server",
    error: process.env["NODE_ENV"] === "development" ? err : {},
  });
};
