import { pgTable, serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents";

export const accountProfilesTable = pgTable("account_profiles", {
  userId: text("user_id").primaryKey(),
  role: text("role", { enum: ["main", "sub"] }).notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subAccountsTable = pgTable(
  "sub_accounts",
  {
    id: serial("id").primaryKey(),
    subUserId: text("sub_user_id").notNull(),
    subEmail: text("sub_email").notNull(),
    ownerId: text("owner_id").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    agentId: integer("agent_id").references(() => agentsTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
  },
  (table) => [
    index("sub_accounts_owner_idx").on(table.ownerId),
    uniqueIndex("sub_accounts_sub_user_idx").on(table.subUserId),
  ],
);

export type AccountProfile = typeof accountProfilesTable.$inferSelect;
export type SubAccount = typeof subAccountsTable.$inferSelect;
