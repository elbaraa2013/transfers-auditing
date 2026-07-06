import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db, accountProfilesTable, subAccountsTable, agentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

async function getClerkEmail(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return (primary ?? user.emailAddresses[0])?.emailAddress ?? "";
}

async function buildMe(userId: string) {
  const [profile] = await db
    .select()
    .from(accountProfilesTable)
    .where(eq(accountProfilesTable.userId, userId))
    .limit(1);

  if (!profile) {
    return { role: "none" as const };
  }

  if (profile.role === "main") {
    return { role: "main" as const, email: profile.email };
  }

  const [row] = await db
    .select({
      sub: subAccountsTable,
      agentName: agentsTable.name,
      ownerEmail: accountProfilesTable.email,
    })
    .from(subAccountsTable)
    .leftJoin(agentsTable, eq(subAccountsTable.agentId, agentsTable.id))
    .leftJoin(accountProfilesTable, eq(subAccountsTable.ownerId, accountProfilesTable.userId))
    .where(eq(subAccountsTable.subUserId, userId))
    .limit(1);

  return {
    role: "sub" as const,
    email: profile.email,
    subStatus: row?.sub.status ?? null,
    ownerEmail: row?.ownerEmail ?? null,
    agentId: row?.sub.agentId ?? null,
    agentName: row?.agentName ?? null,
  };
}

function subRequestResponse(sub: typeof subAccountsTable.$inferSelect, agentName: string | null) {
  return {
    id: sub.id,
    subEmail: sub.subEmail,
    status: sub.status,
    agentId: sub.agentId,
    agentName,
    createdAt: sub.createdAt.toISOString(),
    decidedAt: sub.decidedAt ? sub.decidedAt.toISOString() : null,
  };
}

// GET /api/account/me
router.get("/account/me", async (req, res) => {
  res.json(await buildMe(req.userId!));
});

// POST /api/account/register-main
router.post("/account/register-main", async (req, res) => {
  const userId = req.userId!;
  const [existing] = await db
    .select()
    .from(accountProfilesTable)
    .where(eq(accountProfilesTable.userId, userId))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "الحساب مسجل بالفعل" });
    return;
  }

  const email = await getClerkEmail(userId);
  await db.insert(accountProfilesTable).values({ userId, role: "main", email });
  req.log.info({ role: "main" }, "account registered");
  res.json(await buildMe(userId));
});

// POST /api/account/register-sub
router.post("/account/register-sub", async (req, res) => {
  const userId = req.userId!;
  const ownerEmail = String(req.body?.ownerEmail ?? "").trim().toLowerCase();
  if (!ownerEmail) {
    res.status(400).json({ error: "البريد الإلكتروني للحساب الرئيسي مطلوب" });
    return;
  }

  const [existingProfile] = await db
    .select()
    .from(accountProfilesTable)
    .where(eq(accountProfilesTable.userId, userId))
    .limit(1);
  if (existingProfile?.role === "main") {
    res.status(409).json({ error: "الحساب مسجل بالفعل كحساب رئيسي" });
    return;
  }

  const [existingSub] = await db
    .select()
    .from(subAccountsTable)
    .where(eq(subAccountsTable.subUserId, userId))
    .limit(1);
  if (existingSub && existingSub.status !== "rejected") {
    res.status(409).json({ error: "لديك طلب مسجل بالفعل" });
    return;
  }

  // Find the main account by email via Clerk, then verify it is a main profile.
  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [ownerEmail] });
  let ownerId: string | null = null;
  for (const u of users) {
    const [ownerProfile] = await db
      .select()
      .from(accountProfilesTable)
      .where(and(eq(accountProfilesTable.userId, u.id), eq(accountProfilesTable.role, "main")))
      .limit(1);
    if (ownerProfile) {
      ownerId = u.id;
      break;
    }
  }

  if (!ownerId) {
    res.status(404).json({ error: "لا يوجد حساب رئيسي بهذا البريد الإلكتروني" });
    return;
  }

  const email = await getClerkEmail(userId);

  if (!existingProfile) {
    await db.insert(accountProfilesTable).values({ userId, role: "sub", email });
  }

  if (existingSub) {
    // Re-request after rejection: reset to pending under the (possibly new) owner.
    await db
      .update(subAccountsTable)
      .set({ ownerId, subEmail: email, status: "pending", agentId: null, decidedAt: null })
      .where(eq(subAccountsTable.id, existingSub.id));
  } else {
    await db.insert(subAccountsTable).values({ subUserId: userId, subEmail: email, ownerId });
  }

  req.log.info({ role: "sub" }, "sub account request created");
  res.json(await buildMe(userId));
});

// GET /api/account/sub-requests — main account lists its sub account requests
router.get("/account/sub-requests", async (req, res) => {
  const ownerId = req.userId!;
  const rows = await db
    .select({ sub: subAccountsTable, agentName: agentsTable.name })
    .from(subAccountsTable)
    .leftJoin(agentsTable, eq(subAccountsTable.agentId, agentsTable.id))
    .where(eq(subAccountsTable.ownerId, ownerId))
    .orderBy(desc(subAccountsTable.createdAt));

  res.json(rows.map((r) => subRequestResponse(r.sub, r.agentName)));
});

// PATCH /api/account/sub-requests/:id/approve
router.patch("/account/sub-requests/:id/approve", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const { agentId, newAgentName, newAgentPhone } = req.body ?? {};

  const [sub] = await db
    .select()
    .from(subAccountsTable)
    .where(and(eq(subAccountsTable.id, id), eq(subAccountsTable.ownerId, ownerId)))
    .limit(1);
  if (!sub) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }

  let resolvedAgentId: number;
  let resolvedAgentName: string;

  if (Number.isInteger(Number(agentId))) {
    const [agent] = await db
      .select()
      .from(agentsTable)
      .where(and(eq(agentsTable.id, Number(agentId)), eq(agentsTable.ownerId, ownerId)))
      .limit(1);
    if (!agent) {
      res.status(404).json({ error: "المندوب غير موجود" });
      return;
    }
    resolvedAgentId = agent.id;
    resolvedAgentName = agent.name;
  } else if (typeof newAgentName === "string" && newAgentName.trim()) {
    const [agent] = await db
      .insert(agentsTable)
      .values({
        ownerId,
        name: newAgentName.trim(),
        phone: typeof newAgentPhone === "string" ? newAgentPhone.trim() : "",
      })
      .returning();
    resolvedAgentId = agent.id;
    resolvedAgentName = agent.name;
  } else {
    res.status(400).json({ error: "يجب اختيار مندوب موجود أو إدخال اسم مندوب جديد" });
    return;
  }

  const [updated] = await db
    .update(subAccountsTable)
    .set({ status: "approved", agentId: resolvedAgentId, decidedAt: new Date() })
    .where(and(eq(subAccountsTable.id, id), eq(subAccountsTable.ownerId, ownerId)))
    .returning();

  req.log.info({ subRequestId: id, agentId: resolvedAgentId }, "sub account approved");
  res.json(subRequestResponse(updated, resolvedAgentName));
});

// PATCH /api/account/sub-requests/:id/reject
router.patch("/account/sub-requests/:id/reject", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);

  const [updated] = await db
    .update(subAccountsTable)
    .set({ status: "rejected", agentId: null, decidedAt: new Date() })
    .where(and(eq(subAccountsTable.id, id), eq(subAccountsTable.ownerId, ownerId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "الطلب غير موجود" });
    return;
  }

  req.log.info({ subRequestId: id }, "sub account rejected");
  res.json(subRequestResponse(updated, null));
});

export default router;
