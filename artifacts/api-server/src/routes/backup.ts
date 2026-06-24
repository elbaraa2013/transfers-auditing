import { Router } from "express";
import JSZip from "jszip";
import { db } from "@workspace/db";
import { agentsTable, transfersTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

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

// GET /api/backup — downloads all of the current account's data as a ZIP of CSVs.
router.get("/backup", async (req, res) => {
  const ownerId = req.userId!;

  const [agents, transfers, messages] = await Promise.all([
    db.select().from(agentsTable).where(eq(agentsTable.ownerId, ownerId)),
    db.select().from(transfersTable).where(eq(transfersTable.ownerId, ownerId)),
    db.select().from(messagesTable).where(eq(messagesTable.ownerId, ownerId)),
  ]);

  const dateStr = new Date().toISOString().slice(0, 10);

  // Prefix with a UTF-8 BOM so Excel opens the Arabic CSV content correctly.
  const bom = "\uFEFF";
  const zip = new JSZip();
  zip.file(`agents.csv`, bom + toCsv(agents));
  zip.file(`transfers.csv`, bom + toCsv(transfers));
  zip.file(`messages.csv`, bom + toCsv(messages));

  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="hawala-backup-${dateStr}.zip"`,
  );
  res.send(buffer);
});

export default router;
