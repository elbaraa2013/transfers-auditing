import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id),
  content: text("content").notNull(),
  type: text("type", { enum: ["text", "image"] }).notNull().default("text"),
  direction: text("direction", { enum: ["incoming", "outgoing"] }).notNull(),
  imageUrl: text("image_url"),
  isRead: boolean("is_read").notNull().default(false),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
