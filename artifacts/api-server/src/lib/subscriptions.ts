import { db, subscriptionsTable } from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
const TRIAL_SCAN_LIMIT = 20;
export const PAID_SCAN_LIMIT = 2000;
export const PAID_PRICE_AED = 150;
export const PAID_DURATION_DAYS = 30;
export type SubscriptionInfo = {
  id: number;
  plan: "trial" | "paid";
  scanLimit: number;
  scansUsed: number;
  remaining: number;
  expiresAt: Date | null;
  active: boolean;
};
function toInfo(row: typeof subscriptionsTable.$inferSelect): SubscriptionInfo {
  const now = new Date();
  const notExpired = row.expiresAt === null || row.expiresAt > now;
  const hasScans = row.scansUsed < row.scanLimit;
  return {
    id: row.id,
    plan: row.plan,
    scanLimit: row.scanLimit,
    scansUsed: row.scansUsed,
    remaining: Math.max(0, row.scanLimit - row.scansUsed),
    expiresAt: row.expiresAt,
    active: notExpired && hasScans,
  };
}
export async function getOrCreateSubscription(ownerId: string): Promise<SubscriptionInfo> {
  const [latest] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.ownerId, ownerId))
    .orderBy(desc(subscriptionsTable.id))
    .limit(1);
  if (latest) return toInfo(latest);
  const [created] = await db
    .insert(subscriptionsTable)
    .values({ ownerId, plan: "trial", scanLimit: TRIAL_SCAN_LIMIT })
    .returning();
  return toInfo(created);
}
export async function recordScanUsage(subscriptionId: number): Promise<void> {
  await db
    .update(subscriptionsTable)
    .set({ scansUsed: sql`${subscriptionsTable.scansUsed} + 1` })
    .where(eq(subscriptionsTable.id, subscriptionId));
}
export async function activatePaidSubscription(ownerId: string): Promise<SubscriptionInfo> {
  const expiresAt = new Date(Date.now() + PAID_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(subscriptionsTable)
    .values({ ownerId, plan: "paid", scanLimit: PAID_SCAN_LIMIT, priceAed: PAID_PRICE_AED, expiresAt })
    .returning();
  return toInfo(created);
}
