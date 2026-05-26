import type { NextFunction, Request, Response } from "express";

type DeprecationOptions = {
  message?: string;
  sunset?: string;
};

export const deprecationMiddleware = (options: DeprecationOptions = {}) => {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader("Deprecation", "true");

    if (options.sunset) {
      res.setHeader("Sunset", options.sunset);
    }

    if (options.message) {
      res.setHeader("Warning", `299 - "${options.message}"`);
    }

    next();
  };
};
