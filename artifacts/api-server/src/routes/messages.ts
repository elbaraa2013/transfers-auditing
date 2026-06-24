import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, agentsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

// GET /api/messages
router.get("/messages", async (req, res) => {
  const ownerId = req.userId!;
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.ownerId, ownerId));

  const conversations = await Promise.all(
    agents.map(async (agent) => {
      const msgs = await db
        .select()
        .from(messagesTable)
        .where(and(eq(messagesTable.agentId, agent.id), eq(messagesTable.ownerId, ownerId)))
        .orderBy(desc(messagesTable.sentAt))
        .limit(1);

      if (!msgs.length) return null;

      const unreadRows = await db
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.agentId, agent.id),
            eq(messagesTable.ownerId, ownerId),
            eq(messagesTable.isRead, false),
            eq(messagesTable.direction, "incoming")
          )
        );

      return {
        agentId: agent.id,
        agentName: agent.name,
        lastMessage: msgs[0].content,
        lastMessageAt: msgs[0].sentAt.toISOString(),
        unreadCount: unreadRows.length,
      };
    })
  );

  res.json(conversations.filter(Boolean));
});

// GET /api/messages/:agentId
router.get("/messages/:agentId", async (req, res) => {
  const ownerId = req.userId!;
  const agentId = parseInt(req.params.agentId);

  // Ensure the agent belongs to this account before exposing messages.
  const agent = await db
    .select({ id: agentsTable.id })
    .from(agentsTable)
    .where(and(eq(agentsTable.id, agentId), eq(agentsTable.ownerId, ownerId)))
    .limit(1);
  if (!agent.length) {
    res.status(404).json({ error: "المندوب غير موجود" });
    return;
  }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.agentId, agentId), eq(messagesTable.ownerId, ownerId)))
    .orderBy(messagesTable.sentAt);

  // Mark as read
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.agentId, agentId),
        eq(messagesTable.ownerId, ownerId),
        eq(messagesTable.direction, "incoming")
      )
    );

  res.json(
    msgs.map((m) => ({
      id: m.id,
      agentId: m.agentId,
      content: m.content,
      type: m.type,
      direction: m.direction,
      imageUrl: m.imageUrl,
      sentAt: m.sentAt.toISOString(),
    }))
  );
});

export default router;
