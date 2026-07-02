import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable, transfersTable, insertAgentSchema } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

// The business date of a transfer is its (OCR-parsed or manually entered)
// transferDate. Fall back to the system createdAt only when transferDate is
// missing or unparseable. Returned as a YYYY-MM-DD string for range compare.
function transferDateKey(t: typeof transfersTable.$inferSelect): string {
  if (t.transferDate) {
    const d = new Date(t.transferDate);
    if (!isNaN(d.getTime())) return ymdUTC(d);
  }
  return ymdUTC(t.createdAt);
}

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
  const ownerId = req.userId!;
  const agents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.ownerId, ownerId))
    .orderBy(agentsTable.name);

  const result = await Promise.all(
    agents.map(async (agent) => {
      const transfers = await db
        .select()
        .from(transfersTable)
        .where(and(eq(transfersTable.agentId, agent.id), eq(transfersTable.ownerId, ownerId)));
      return buildAgentResponse(agent, transfers);
    })
  );

  res.json(result);
});

// POST /api/agents
router.post("/agents", async (req, res) => {
  const ownerId = req.userId!;
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
    .values({ name, phone, ownerId })
    .returning();

  res.status(201).json(buildAgentResponse(created, []));
});

// GET /api/agents/inactive
router.get("/agents/inactive", async (req, res) => {
  const ownerId = req.userId!;
  const agents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.ownerId, ownerId))
    .orderBy(agentsTable.lastActivityAt);
  const now = Date.now();

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

// GET /api/agents/summary
// One row per agent with their transfer counts/amounts by status, plus grand
// totals across all agents (ملخص حوالات كل المناديب مع الإجماليات).
router.get("/agents/summary", async (req, res) => {
  const ownerId = req.userId!;
  const fromParam = (req.query.from as string) || "";
  const toParam = (req.query.to as string) || "";

  const agents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.ownerId, ownerId))
    .orderBy(agentsTable.name);

  const from = fromParam && !isNaN(new Date(fromParam).getTime()) ? fromParam : "";
  const to = toParam && !isNaN(new Date(toParam).getTime()) ? toParam : "";

  // Filter by the transfer's business date (transferDate, falling back to
  // createdAt), NOT the row's createdAt — so a receipt registered today for a
  // transfer dated last week counts in last week's period.
  const allTransfers = await db
    .select()
    .from(transfersTable)
    .where(eq(transfersTable.ownerId, ownerId));

  const transfers = allTransfers.filter((t) => {
    const key = transferDateKey(t);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  });

  const rows = agents.map((a) => {
    const ts = transfers.filter((t) => t.agentId === a.id);
    const approved = ts.filter((t) => t.status === "approved");
    const pending = ts.filter((t) => t.status === "pending");
    const rejected = ts.filter((t) => t.status === "rejected");
    const sum = (list: typeof ts) =>
      list.reduce((s, t) => s + Number(t.amount), 0);
    return {
      agentId: a.id,
      agentName: a.name,
      totalCount: ts.length,
      totalAmount: sum(ts),
      approvedCount: approved.length,
      approvedAmount: sum(approved),
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      rejectedCount: rejected.length,
      rejectedAmount: sum(rejected),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      totalCount: acc.totalCount + r.totalCount,
      totalAmount: acc.totalAmount + r.totalAmount,
      approvedCount: acc.approvedCount + r.approvedCount,
      approvedAmount: acc.approvedAmount + r.approvedAmount,
      pendingCount: acc.pendingCount + r.pendingCount,
      pendingAmount: acc.pendingAmount + r.pendingAmount,
      rejectedCount: acc.rejectedCount + r.rejectedCount,
      rejectedAmount: acc.rejectedAmount + r.rejectedAmount,
    }),
    {
      totalCount: 0,
      totalAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      rejectedCount: 0,
      rejectedAmount: 0,
    },
  );

  res.json({ agents: rows, totals });
});

// GET /api/agents/:id
router.get("/agents/:id", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const agents = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, id), eq(agentsTable.ownerId, ownerId)))
    .limit(1);

  if (!agents.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const transfers = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.agentId, id), eq(transfersTable.ownerId, ownerId)));

  res.json(buildAgentResponse(agents[0], transfers));
});

// PATCH /api/agents/:id
router.patch("/agents/:id", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المندوب غير صحيح" });
    return;
  }

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

  const [updated] = await db
    .update(agentsTable)
    .set({ name, phone })
    .where(and(eq(agentsTable.id, id), eq(agentsTable.ownerId, ownerId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const transfers = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.agentId, id), eq(transfersTable.ownerId, ownerId)));

  res.json(buildAgentResponse(updated, transfers));
});

// GET /api/agents/:id/statement
router.get("/agents/:id/statement", async (req, res) => {
  const ownerId = req.userId!;
  const id = parseInt(req.params.id);
  const agents = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, id), eq(agentsTable.ownerId, ownerId)))
    .limit(1);

  if (!agents.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const transfers = await db
    .select()
    .from(transfersTable)
    .where(and(eq(transfersTable.agentId, id), eq(transfersTable.ownerId, ownerId)))
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
    paymentMethod: t.paymentMethod,
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
