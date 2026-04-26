import { NextFunction, Request, Response } from "express";
import { HttpError } from "./error";
import { verifyAdminToken } from "../lib/auth";

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    const payload = verifyAdminToken(token);
    if (payload) return next();
  }

  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.header("x-admin-key") === adminKey) return next();

  if (
    !adminKey &&
    !process.env.ADMIN_USER &&
    !process.env.ADMIN_PASS &&
    !process.env.SESSION_SECRET
  ) {
    return next();
  }

  return next(new HttpError(401, "unauthorized"));
}
