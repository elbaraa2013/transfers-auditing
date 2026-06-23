import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, transfersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

async function buildAgentResponse(agent: typeof agentsTable.$inferSelect, totalTransfers: number, pendingTransfers: number) {
  return {
    id: agent.id,
    name: agent.name,
    phone: agent.phone,
    balance: Number(agent.balance),
    lastActivityAt: agent.lastActivityAt.toISOString(),
    totalTransfers,
    pendingTransfers,
  };
}

// GET /api/agents
router.get("/agents", async (req, res) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.name);

  const result = await Promise.all(
    agents.map(async (agent) => {
      const transfers = await db.select().from(transfersTable).where(eq(transfersTable.agentId, agent.id));
      const pending = transfers.filter((t) => t.status === "pending").length;
      return buildAgentResponse(agent, transfers.length, pending);
    })
  );

  res.json(result);
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
  const pending = transfers.filter((t) => t.status === "pending").length;

  res.json(await buildAgentResponse(agents[0], transfers.length, pending));
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

  const totalTransfers = transfers.length;
  const pending = transfers.filter((t) => t.status === "pending").length;

  res.json({
    agent: await buildAgentResponse(agents[0], totalTransfers, pending),
    balance: Number(agents[0].balance),
    transfers: transfersFormatted,
  });
});

export default router;
