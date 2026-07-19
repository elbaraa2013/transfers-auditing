import type { Request, Response, NextFunction } from "express";
import { db, accountProfilesTable, subAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Actual authenticated user id (before tenant rewrite). */
      actorUserId?: string;
      /** When set, the caller is an approved sub account restricted to this agent. */
      agentScope?: number;
    }
  }
}
/**
 * Resolves the effective tenant for data routes.
 */
export function resolveTenant(req: Request, res: Response, next: NextFunction): void {
  void (async () => {
    const userId = req.userId!;
    const [profile] = await db
      .select()
      .from(accountProfilesTable)
      .where(eq(accountProfilesTable.userId, userId))
      .limit(1);
    if (!profile || profile.role === "main") {
      next();
      return;
    }
    const [sub] = await db
      .select()
      .from(subAccountsTable)
      .where(eq(subAccountsTable.subUserId, userId))
      .limit(1);
    if (!sub || sub.status !== "approved" || !sub.agentId) {
      res.status(403).json({ error: "حسابك الفرعي غير مفعّل بعد. بانتظار موافقة الحساب الرئيسي." });
      return;
    }
    const method = req.method;
    const path = req.path;
    const allowed =
      (method === "POST" && path === "/transfers") ||
      (method === "POST" && path === "/scan") ||
      (method === "GET" && path === "/transfers") ||
      (method === "GET" && path === "/subscription/me") ||
      (method === "GET" && path === `/agents/${sub.agentId}/statement`);
    if (!allowed) {
      res.status(403).json({ error: "غير مسموح لهذه العملية من حساب فرعي" });
      return;
    }
    req.actorUserId = userId;
    req.userId = sub.ownerId;
    req.agentScope = sub.agentId;
    if (method === "POST" && path === "/transfers") {
      req.body = { ...req.body, agentId: sub.agentId };
    }
    if (method === "GET" && path === "/transfers") {
      const scopedQuery = { ...req.query, agentId: String(sub.agentId) };
      Object.defineProperty(req, "query", { value: scopedQuery, writable: false });
    }
    next();
  })().catch(next);
}
