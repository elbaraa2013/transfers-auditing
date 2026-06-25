import { Router } from "express";
import { spawn } from "node:child_process";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const router = Router();

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// dist/index.mjs -> package root is one level up; ocr/ lives in the package root.
const packageRoot = path.resolve(moduleDir, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");

function resolvePythonBin(): string {
  if (process.env.OCR_PYTHON_BIN) return process.env.OCR_PYTHON_BIN;
  const venvPython = path.join(repoRoot, ".pythonlibs", "bin", "python");
  if (existsSync(venvPython)) return venvPython;
  return "python3";
}

function resolveOcrScript(): string {
  if (process.env.OCR_SCRIPT_PATH) return process.env.OCR_SCRIPT_PATH;
  return path.join(packageRoot, "ocr", "bankak_ocr.py");
}

const PYTHON_BIN = resolvePythonBin();
const OCR_SCRIPT = resolveOcrScript();
const OCR_TIMEOUT_MS = 60_000;

interface OcrResult {
  operationNumber: string | null;
  amount: number | null;
  fromAccount: string | null;
  toAccount: string | null;
  recipientName: string | null;
  comment: string | null;
  transferDate: string | null;
  riskScore: number;
  confidence: number;
  rawLines?: string[];
  error?: string;
}

function runOcr(imagePath: string): Promise<OcrResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [OCR_SCRIPT, imagePath]);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill("SIGKILL");
      reject(new Error("انتهت مهلة معالجة الصورة"));
    }, OCR_TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr.trim() || `OCR process exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()) as OcrResult);
      } catch {
        reject(new Error(`فشل تحليل مخرجات المسح: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

// POST /api/scan
router.post("/scan", async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64 || typeof imageBase64 !== "string") {
    res.status(400).json({ error: "imageBase64 مطلوب" });
    return;
  }

  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  let dir: string | undefined;
  try {
    dir = await mkdtemp(path.join(tmpdir(), "scan-"));
    const imagePath = path.join(dir, "receipt.png");
    await writeFile(imagePath, Buffer.from(base64Data, "base64"));

    const result = await runOcr(imagePath);

    if (result.error) {
      res.status(400).json({ error: `تعذّر مسح الصورة: ${result.error}` });
      return;
    }

    const hasData =
      result.operationNumber || result.amount || result.recipientName || result.fromAccount;
    if (!hasData) {
      res.status(400).json({
        error: "لم يتمكن النظام من استخراج البيانات من الصورة. يرجى التأكد من وضوح الصورة.",
      });
      return;
    }

    res.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err: message }, "OCR scan failed");
    res.status(400).json({ error: `خطأ في معالجة الصورة: ${message}` });
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

export default router;
