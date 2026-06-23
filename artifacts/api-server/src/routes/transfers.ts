import { Router } from "express";
import { db } from "@workspace/db";
import { transfersTable, agentsTable } from "@workspace/db";
import { eq, desc, sql, and, like, isNull } from "drizzle-orm";

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
    createdAt: transfer.createdAt.toISOString(),
  };
}

// GET /api/transfers
router.get("/transfers", async (req, res) => {
  const { status, agentId, search } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status && ["pending", "approved", "rejected"].includes(status)) {
    conditions.push(eq(transfersTable.status, status as "pending" | "approved" | "rejected"));
  }
  if (agentId) {
    conditions.push(eq(transfersTable.agentId, parseInt(agentId)));
  }

  const rows = await db
    .select({
      transfer: transfersTable,
      agentName: agentsTable.name,
    })
    .from(transfersTable)
    .innerJoin(agentsTable, eq(transfersTable.agentId, agentsTable.id))
    .where(
      conditions.length > 0
        ? and(...conditions)
        : undefined
    )
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
  const { operationNumber, amount, fromAccount, toAccount, recipientName, comment, agentId, riskScore, transferDate } = req.body;

  const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId)).limit(1);
  if (!agent.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const score = Number(riskScore ?? 0);
  const riskLevel = getRiskLevel(score);

  const [created] = await db.insert(transfersTable).values({
    operationNumber,
    amount: String(amount),
    fromAccount,
    toAccount,
    recipientName,
    comment,
    agentId,
    riskScore: score,
    riskLevel,
    transferDate,
    status: "pending",
  }).returning();

  // Update agent last activity
  await db.update(agentsTable).set({ lastActivityAt: new Date() }).where(eq(agentsTable.id, agentId));

  res.status(201).json(await buildTransferResponse(created, agent[0].name));
});

// GET /api/transfers/stats
router.get("/transfers/stats", async (req, res) => {
  const all = await db.select().from(transfersTable);

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
  const rows = await db
    .select({
      transfer: transfersTable,
      agentName: agentsTable.name,
    })
    .from(transfersTable)
    .innerJoin(agentsTable, eq(transfersTable.agentId, agentsTable.id))
    .where(eq(transfersTable.status, "pending"))
    .orderBy(desc(transfersTable.createdAt));

  const transfers = await Promise.all(rows.map((r) => buildTransferResponse(r.transfer, r.agentName)));
  res.json(transfers);
});

// GET /api/transfers/:id
router.get("/transfers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db
    .select({ transfer: transfersTable, agentName: agentsTable.name })
    .from(transfersTable)
    .innerJoin(agentsTable, eq(transfersTable.agentId, agentsTable.id))
    .where(eq(transfersTable.id, id))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "الحوالة غير موجودة" });
    return;
  }

  res.json(await buildTransferResponse(rows[0].transfer, rows[0].agentName));
});

// PATCH /api/transfers/:id/approve
router.patch("/transfers/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(transfersTable).where(eq(transfersTable.id, id)).limit(1);

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
    .where(eq(transfersTable.id, id))
    .returning();

  const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, updated.agentId)).limit(1);
  res.json(await buildTransferResponse(updated, agent[0]?.name ?? ""));
});

// PATCH /api/transfers/:id/reject
router.patch("/transfers/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id);
  const rows = await db.select().from(transfersTable).where(eq(transfersTable.id, id)).limit(1);

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
    .where(eq(transfersTable.id, id))
    .returning();

  const agent = await db.select().from(agentsTable).where(eq(agentsTable.id, updated.agentId)).limit(1);
  res.json(await buildTransferResponse(updated, agent[0]?.name ?? ""));
});

export default router;
