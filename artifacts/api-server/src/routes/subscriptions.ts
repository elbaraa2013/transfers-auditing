import { Router, type Request } from "express";
import { db, accountProfilesTable, subscriptionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getOrCreateSubscription, activatePaidSubscription } from "../lib/subscriptions";
const router = Router();
function isAdmin(req: Request): boolean {
  const admins = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const actor = req.actorUserId ?? req.userId;
  return !!actor && admins.includes(actor);
}
// GET /api/subscription/me — اشتراك المستخدم الحالي (أو مالكه إن كان فرعياً)
router.get("/subscription/me", async (req, res) => {
  const info = await getOrCreateSubscription(req.userId!);
  res.json(info);
});
// GET /api/admin/subscriptions — قائمة كل الحسابات واشتراكاتها (للإدارة فقط)
router.get("/admin/subscriptions", async (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }
  const profiles = await db
    .select()
    .from(accountProfilesTable)
    .where(eq(accountProfilesTable.role, "main"));
  const subs = await db.select().from(subscriptionsTable).orderBy(desc(subscriptionsTable.id));
  const latestByOwner = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (!latestByOwner.has(s.ownerId)) latestByOwner.set(s.ownerId, s);
  }
  const emailByOwner = new Map(profiles.map((p) => [p.userId, p.email]));
  const owners = new Set([...latestByOwner.keys(), ...emailByOwner.keys()]);
  const now = new Date();
  const rows = [...owners].map((ownerId) => {
    const s = latestByOwner.get(ownerId);
    return {
      ownerId,
      email: emailByOwner.get(ownerId) ?? null,
      plan: s?.plan ?? null,
      scansUsed: s?.scansUsed ?? 0,
      scanLimit: s?.scanLimit ?? 0,
      expiresAt: s?.expiresAt ?? null,
      active: s
        ? s.scansUsed < s.scanLimit && (s.expiresAt === null || s.expiresAt > now)
        : false,
    };
  });
  res.json(rows);
});
// POST /api/admin/subscriptions/activate — تفعيل اشتراك مدفوع (للإدارة فقط)
router.post("/admin/subscriptions/activate", async (req, res) => {
  if (!isAdmin(req)) {
    res.status(403).json({ error: "غير مصرح" });
    return;
  }
  const { ownerId } = req.body ?? {};
  if (!ownerId || typeof ownerId !== "string") {
    res.status(400).json({ error: "ownerId مطلوب" });
    return;
  }
  const info = await activatePaidSubscription(ownerId);
  res.json(info);
});
export default router;