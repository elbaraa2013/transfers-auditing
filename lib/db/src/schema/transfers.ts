import { pgTable, serial, text, numeric, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { agentsTable } from "./agents";

export const transfersTable = pgTable("transfers", {
  id: serial("id").primaryKey(),
  operationNumber: text("operation_number").notNull().unique(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  fromAccount: text("from_account").notNull(),
  toAccount: text("to_account").notNull(),
  recipientName: text("recipient_name").notNull(),
  comment: text("comment"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  riskScore: real("risk_score").notNull().default(0),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high"] }).notNull().default("low"),
  agentId: integer("agent_id").notNull().references(() => agentsTable.id),
  rejectionReason: text("rejection_reason"),
  transferDate: text("transfer_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransferSchema = createInsertSchema(transfersTable).omit({ id: true, createdAt: true });
export type InsertTransfer = z.infer<typeof insertTransferSchema>;
export type Transfer = typeof transfersTable.$inferSelect;
