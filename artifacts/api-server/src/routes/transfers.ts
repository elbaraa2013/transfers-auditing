import { Router } from "express";
import { db } from "@workspace/db";
import { transfersTable, agentsTable } from "@workspace/db";
import { eq, desc, and, type SQL } from "drizzle-orm";

const router = Router();

function getRiskLevel(score: number): "low" | "medium" | "high" {
  if (score >= 0.6) return "high";
  if (score >= 0.3) return "medium";
  return "low";
}

async function buildTransferResponse(transfer: typeof transfersTable.$inferSelect, agentName: string) {
  return {
    id: transfer.id,
    operationNumber: transfer.operationNumber,
    amount: Number(transfer.amount),
    fromAccount: transfer.fromAccount,
    toAccount: transfer.toAccount,
    recipientName: transfer.recipientName,
    comment: transfer.comment,
    status: transfer.status,
    riskLevel: transfer.riskLevel,
    riskScore: transfer.riskScore,
    agentId: transfer.agentId,
    agentName,
    rejectionReason: transfer.rejectionReason,
    transferDate: transfer.transferDate,
    paymentMethod: transfer.paymentMethod,
    createdAt: transfer.createdAt.toISOString(),
  };
}

// GET /api/transfers
router.get("/transfers", async (req, res) => {
  const ownerId = req.userId!;
  const { status, agentId, search } = req.query as Record<string, string>;

  const conditions: SQL[] = [eq(transfersTable.ownerId, ownerId)];
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    conditions.push(eq(transfersTable.status, status as "pending" | "approved" | "rejected"));
  }
  const parsedAgentId = agentId ? parseInt(agentId) : NaN;
  if (!isNaN(parsedAgentId)) {
    conditions.push(eq(transfersTable.agentId, parsedAgentId));
  }

  const rows = await db
    .select({
      transfer: transfersTable,
      agentName: agentsTable.name,
    })
    .from(transfersTable)
    .innerJoin(agentsTable, and(eq(transfersTable.agentId, agentsTable.id), eq(agentsTable.ownerId, ownerId)))
    .where(and(...conditions))
    .orderBy(desc(transfersTable.createdAt));

  let results = rows;
  if (search) {
    results = rows.filter((r) =>
      r.transfer.operationNumber.toLowerCase().includes(search.toLowerCase())
    );
  }

  const transfers = await Promise.all(
    results.map((r) => buildTransferResponse(r.transfer, r.agentName))
  );

  res.json(transfers);
});

// POST /api/transfers
router.post("/transfers", async (req, res) => {
  const ownerId = req.userId!;
  const { operationNumber, amount, fromAccount, toAccount, recipientName, comment, agentId, riskScore, transferDate } = req.body;

  const agent = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.ownerId, ownerId)))
    .limit(1);
  if (!agent.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const score = Number(riskScore ?? 0);
  const riskLevel = getRiskLevel(score);

  const [created] = await db.insert(transfersTable).values({
    ownerId,
    operationNumber,
    amount: String(amount),
    fromAccount: fromAccount ?? null,
    toAccount: toAccount ?? null,
    recipientName: recipientName ?? null,
    comment,
    agentId,
    riskScore: score,
    riskLevel,
    transferDate,
    status: "pending",
  }).returning();

  // Update agent last activity
  await db.update(agentsTable).set({ lastActivityAt: new Date() }).where(and(eq(agentsTable.id, agentId), eq(agentsTable.ownerId, ownerId)));

  res.status(201).json(await buildTransferResponse(created, agent[0].name));
});

// POST /api/transfers/cash — record a manual cash payment (no receipt/scan)
router.post("/transfers/cash", async (req, res) => {
  const ownerId = req.userId!;
  const { agentId, amount, comment, recipientName, transferDate } = req.body;

  const numericAgentId = Number(agentId);
  if (!Number.isInteger(numericAgentId)) {
    res.status(400).json({ error: "المندوب غير صحيح" });
    return;
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    res.status(400).json({ error: "المبلغ غير صحيح" });
    return;
  }

  const agent = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, numericAgentId), eq(agentsTable.ownerId, ownerId)))
    .limit(1);
  if (!agent.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const baseValues = {
    ownerId,
    amount: String(numericAmount),
    recipientName: recipientName?.trim() || null,
    comment: comment?.trim() || null,
    agentId: numericAgentId,
    riskScore: 0,
    riskLevel: "low" as const,
    transferDate: transferDate?.trim() || null,
    paymentMethod: "cash" as const,
    status: "pending" as const,
  };

  // operationNumber is unique per owner; retry on the rare collision.
  let created: typeof transfersTable.$inferSelect | undefined;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const operationNumber = `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    try {
      [created] = await db.insert(transfersTable).values({ ...baseValues, operationNumber }).returning();
    } catch (err: any) {
      if (err?.code === "23505" && attempt < 4) continue;
      throw err;
    }
  }

  if (!created) {
    res.status(500).json({ error: "تعذّر إنشاء رقم مرجع فريد" });
    return;
  }

  await db.update(agentsTable).set({ lastActivityAt: new Date() }).where(and(eq(agentsTable.id, numericAgentId), eq(agentsTable.ownerId, ownerId)));

  res.status(201).json(await buildTransferResponse(created, agent[0].name));
});

// GET /api/transfers/stats
router.get("/transfers/stats", async (req, res) => {
  const ownerId = req.userId!;
  const all = await db.select().from(transfersTable).where(eq(transfersTable.ownerId, ownerId));

  const stats = {
    total: all.length,
    pending: all.filter((t) => t.status === "pending").length,
    approved: all.filter((t) => t.status === "approved").length,
    rejected: all.filter((t) => t.status === "rejected").length,
    totalAmount: all.reduce((s, t) => s + Number(t.amount), 0),
    pendingAmount: all.filter((t) => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0),
    approvedAmount: all.filter((t) => t.status === "approved").reduce((s, t) => s + Number(t.amount), 0),
    rejectedAmount: all.filter((t) => t.status === "rejected").reduce((s, t) => s + Number(t.amount), 0),
  };

  res.json(stats);
});

// GET /api/transfers/pending
router.get("/transfers/pending", async (req, res) => {
  const ownerId = req.userId!;
  const rows = await db
    .select({
      transfer: transfersTable,
      agentName: agentsTable.name,
    })
    .from(transfersTable)
    .innerJoin(agentsTable, and(eq(transfersTable.agentId, agentsTable.id), eq(agentsTable.ownerId, ownerId)))
    .where(and(eq(transfersTable.ownerId, ownerId), eq(transfersTable.status, "pending")))
    .orderBy(desc(transfersTable.createdAt));

  const transfers = await Promise.all(rows.map((r) => buildTransferResponse(r.transfer, r.agentName)));
  res.json(transfers);
});

// GET /api/transfers/:id
router.get("/transfers/:id", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const rows = await db
    .select({ transfer: transfersTable, agentName: agentsTable.name })
    .from(transfersTable)
    .innerJoin(agentsTable, and(eq(transfersTable.agentId, agentsTable.id), eq(agentsTable.ownerId, ownerId)))
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "الحوالة غير موجودة" });
    return;
  }

  res.json(await buildTransferResponse(rows[0].transfer, rows[0].agentName));
});

// DELETE /api/transfers/:id
router.delete("/transfers/:id", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const rows = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "الحوالة غير موجودة" });
    return;
  }

  if (rows[0].status === "approved") {
    res.status(409).json({ error: "لا يمكن حذف حوالة معتمدة" });
    return;
  }

  await db
    .delete(transfersTable)
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)));

  res.status(204).end();
});

// PATCH /api/transfers/:id/approve
router.patch("/transfers/:id/approve", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const rows = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "الحوالة غير موجودة" });
    return;
  }

  if (rows[0].status === "approved") {
    res.status(409).json({ error: "الحوالة مقفلة بالفعل" });
    return;
  }

  const [updated] = await db
    .update(transfersTable)
    .set({ status: "approved" })
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .returning();

  const agent = await db.select().from(agentsTable).where(and(eq(agentsTable.id, updated.agentId), eq(agentsTable.ownerId, ownerId))).limit(1);
  res.json(await buildTransferResponse(updated, agent[0]?.name ?? ""));
});

// PATCH /api/transfers/:id/agent
router.patch("/transfers/:id/agent", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const newAgentId = Number(req.body?.agentId);

  if (!Number.isInteger(newAgentId)) {
    res.status(400).json({ error: "معرّف المندوب غير صحيح" });
    return;
  }

  const agent = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, newAgentId), eq(agentsTable.ownerId, ownerId)))
    .limit(1);
  if (!agent.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  // Atomic guard: only reassign while the transfer is still pending, so a
  // concurrent approve/reject can't slip in between a status check and the
  // update (TOCTOU).
  const [updated] = await db
    .update(transfersTable)
    .set({ agentId: newAgentId })
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId), eq(transfersTable.status, "pending")))
    .returning();

  if (!updated) {
    const existing = await db
      .select({ status: transfersTable.status })
      .from(transfersTable)
      .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
      .limit(1);
    if (!existing.length) {
      res.status(404).json({ error: "الحوالة غير موجودة" });
      return;
    }
    res.status(409).json({ error: "لا يمكن تغيير المندوب بعد اعتماد أو رفض الحوالة" });
    return;
  }

  await db.update(agentsTable).set({ lastActivityAt: new Date() }).where(and(eq(agentsTable.id, newAgentId), eq(agentsTable.ownerId, ownerId)));

  res.json(await buildTransferResponse(updated, agent[0].name));
});

// PATCH /api/transfers/:id/reject
router.patch("/transfers/:id/reject", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const rows = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "الحوالة غير موجودة" });
    return;
  }

  if (rows[0].status === "approved") {
    res.status(409).json({ error: "الحوالة مقفلة ولا يمكن رفضها" });
    return;
  }

  const reason = req.body?.reason ?? null;

  const [updated] = await db
    .update(transfersTable)
    .set({ status: "rejected", rejectionReason: reason })
    .where(and(eq(transfersTable.id, id), eq(transfersTable.ownerId, ownerId)))
    .returning();

  const agent = await db.select().from(agentsTable).where(and(eq(agentsTable.id, updated.agentId), eq(agentsTable.ownerId, ownerId))).limit(1);
  res.json(await buildTransferResponse(updated, agent[0]?.name ?? ""));
});

export default router;
