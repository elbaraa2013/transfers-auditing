import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
export const subscriptionsTable = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    plan: text("plan", { enum: ["trial", "paid"] }).notNull(),
    scanLimit: integer("scan_limit").notNull(),
    scansUsed: integer("scans_used").notNull().default(0),
    priceAed: integer("price_aed"),
    startsAt: timestamp("starts_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("subscriptions_owner_idx").on(table.ownerId)],
);
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;