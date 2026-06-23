import { Router } from "express";
import { db } from "@workspace/db";
import { messagesTable, agentsTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";

const router = Router();

// GET /api/messages
router.get("/messages", async (req, res) => {
  const agents = await db.select().from(agentsTable);

  const conversations = await Promise.all(
    agents.map(async (agent) => {
      const msgs = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.agentId, agent.id))
        .orderBy(desc(messagesTable.sentAt))
        .limit(1);

      if (!msgs.length) return null;

      const unreadRows = await db
        .select()
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.agentId, agent.id),
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
  const agentId = parseInt(req.params.agentId);

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.agentId, agentId))
    .orderBy(messagesTable.sentAt);

  // Mark as read
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.agentId, agentId),
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
