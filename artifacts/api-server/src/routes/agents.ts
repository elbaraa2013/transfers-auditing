import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, transfersTable, insertAgentSchema } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

// The agent balance is the total value of approved (settled) transfers they
// handled. It is always computed from transfers, never read from a stored
// column, so it stays correct as transfers are approved/rejected/reassigned.
function computeBalance(transfers: (typeof transfersTable.$inferSelect)[]): number {
  return transfers
    .filter((t) => t.status === "approved")
    .reduce((sum, t) => sum + Number(t.amount), 0);
}

function buildAgentResponse(
  agent: typeof agentsTable.$inferSelect,
  transfers: (typeof transfersTable.$inferSelect)[],
) {
  return {
    id: agent.id,
    name: agent.name,
    phone: agent.phone,
    balance: computeBalance(transfers),
    lastActivityAt: agent.lastActivityAt.toISOString(),
    totalTransfers: transfers.length,
    pendingTransfers: transfers.filter((t) => t.status === "pending").length,
  };
}

// GET /api/agents
router.get("/agents", async (req, res) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);

  const result = await Promise.all(
    agents.map(async (agent) => {
      const transfers = await db.select().from(transfersTable).where(eq(transfersTable.agentId, agent.id));
      return buildAgentResponse(agent, transfers);
    })
  );

  res.json(result);
});

// POST /api/agents
router.post("/agents", async (req, res) => {
  const parsed = insertAgentSchema
    .pick({ name: true, phone: true })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات المندوب غير صحيحة" });
    return;
  }

  const name = parsed.data.name.trim();
  const phone = parsed.data.phone.trim();
  if (!name || !phone) {
    res.status(400).json({ error: "الاسم ورقم الهاتف مطلوبان" });
    return;
  }

  const [created] = await db
    .insert(agentsTable)
    .values({ name, phone })
    .returning();

  res.status(201).json(buildAgentResponse(created, []));
});

// GET /api/agents/inactive
router.get("/agents/inactive", async (req, res) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.lastActivityAt);
  const now = Date.now();
  const THRESHOLD_MS = 48 * 60 * 60 * 1000;

  const inactive = agents
    .map((a) => {
      const inactiveMs = now - a.lastActivityAt.getTime();
      const inactiveHours = inactiveMs / (1000 * 60 * 60);
      return {
        id: a.id,
        name: a.name,
        phone: a.phone,
        lastActivityAt: a.lastActivityAt.toISOString(),
        inactiveHours: Math.round(inactiveHours * 10) / 10,
      };
    })
    .filter((a) => a.inactiveHours >= 48)
    .sort((a, b) => b.inactiveHours - a.inactiveHours);

  res.json(inactive);
});

// GET /api/agents/:id
router.get("/agents/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);

  if (!agents.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const transfers = await db.select().from(transfersTable).where(eq(transfersTable.agentId, id));

  res.json(buildAgentResponse(agents[0], transfers));
});

// GET /api/agents/:id/statement
router.get("/agents/:id/statement", async (req, res) => {
  const id = parseInt(req.params.id);
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);

  if (!agents.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const transfers = await db
    .select()
    .from(transfersTable)
    .where(eq(transfersTable.agentId, id))
    .orderBy(desc(transfersTable.createdAt));

  const transfersFormatted = transfers.map((t) => ({
    id: t.id,
    operationNumber: t.operationNumber,
    amount: Number(t.amount),
    fromAccount: t.fromAccount,
    toAccount: t.toAccount,
    recipientName: t.recipientName,
    comment: t.comment,
    status: t.status,
    riskLevel: t.riskLevel,
    riskScore: t.riskScore,
    agentId: t.agentId,
    agentName: agents[0].name,
    rejectionReason: t.rejectionReason,
    transferDate: t.transferDate,
    createdAt: t.createdAt.toISOString(),
  }));

  const approved = transfers.filter((t) => t.status === "approved");
  const pending = transfers.filter((t) => t.status === "pending");
  const rejected = transfers.filter((t) => t.status === "rejected");
  const sumAmount = (rows: typeof transfers) =>
    rows.reduce((sum, t) => sum + Number(t.amount), 0);

  const summary = {
    totalCount: transfers.length,
    approvedCount: approved.length,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    totalAmount: sumAmount(transfers),
    approvedAmount: sumAmount(approved),
    pendingAmount: sumAmount(pending),
    rejectedAmount: sumAmount(rejected),
  };

  res.json({
    agent: buildAgentResponse(agents[0], transfers),
    balance: summary.approvedAmount,
    summary,
    transfers: transfersFormatted,
  });
});

export default router;
