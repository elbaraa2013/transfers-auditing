import { createClerkClient } from "@clerk/backend";
import { eq } from "drizzle-orm";
import { db, agentsTable, transfersTable, messagesTable } from "@workspace/db";
import { getResendClient } from "./lib/resendClient";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

async function buildBackupForOwner(ownerId: string) {
  const agents = await db.select().from(agentsTable).where(eq(agentsTable.ownerId, ownerId));
  const transfers = await db.select().from(transfersTable).where(eq(transfersTable.ownerId, ownerId));
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.ownerId, ownerId));

  return { agents, transfers, messages };
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is required to list accounts");
  }

  const clerk = createClerkClient({ secretKey });
  const { client: resend, fromEmail } = await getResendClient();

  const dateStr = new Date().toISOString().slice(0, 10);

  let offset = 0;
  const limit = 100;
  let totalSent = 0;
  let totalSkipped = 0;

  for (;;) {
    const page = await clerk.users.getUserList({ limit, offset });
    if (page.data.length === 0) break;

    for (const user of page.data) {
      const email =
        user.primaryEmailAddress?.emailAddress ??
        user.emailAddresses[0]?.emailAddress;

      if (!email) {
        totalSkipped++;
        continue;
      }

      const { agents, transfers, messages } = await buildBackupForOwner(user.id);

      const attachments = [
        { filename: `agents-${dateStr}.csv`, content: toCsv(agents) },
        { filename: `transfers-${dateStr}.csv`, content: toCsv(transfers) },
        { filename: `messages-${dateStr}.csv`, content: toCsv(messages) },
      ]
        .filter((a) => a.content.length > 0)
        .map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, "utf-8").toString("base64"),
        }));

      const html = `
        <div dir="rtl" style="font-family: Arial, sans-serif; color:#111827;">
          <h2 style="color:#0F6E56;">النسخة الاحتياطية الأسبوعية</h2>
          <p>مرفق نسخة احتياطية من بيانات حسابك في نظام تدقيق الحوالات بتاريخ ${dateStr}.</p>
          <ul>
            <li>عدد المناديب: ${agents.length}</li>
            <li>عدد الحوالات: ${transfers.length}</li>
            <li>عدد الرسائل: ${messages.length}</li>
          </ul>
          <p style="color:#6B7280; font-size:13px;">تم إنشاء هذه النسخة تلقائياً. احتفظ بها في مكان آمن.</p>
        </div>`;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `نسخة احتياطية أسبوعية - ${dateStr}`,
          html,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
        totalSent++;
        console.log(`backup sent to ${email} (agents=${agents.length}, transfers=${transfers.length})`);
      } catch (err) {
        console.error(`failed to send backup to ${email}:`, err);
      }
    }

    if (page.data.length < limit) break;
    offset += limit;
  }

  console.log(`weekly backup complete: sent=${totalSent}, skipped(no email)=${totalSkipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("weekly backup failed:", err);
    process.exit(1);
  });
