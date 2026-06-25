---
name: OCR scan pipeline (offline receipt extraction)
description: Why /api/scan uses Tesseract via Python subprocess instead of an AI vision API, and the constraints around it.
---

# Offline OCR for /api/scan

The `/api/scan` endpoint extracts bank-receipt fields offline using **Tesseract** (`ara+eng`),
called from Node by spawning the venv Python against `artifacts/api-server/ocr/bankak_ocr.py`.

**Why not EasyOCR / an AI vision API:**
- The Replit-managed OpenAI integration was blocked (`awaiting_phone_verification`), so vision-LLM scan was unavailable.
- EasyOCR cannot be installed here: `uv add easyocr` fails resolution ("No solution found ... no versions of easyocr{sys_platform == 'linux'}") because of its heavy PyTorch/torchvision dependency chain under the pre-configured pytorch-cpu index. Do not retry EasyOCR — use Tesseract.

**Why:** offline OCR needs no API key and no phone verification; Tesseract installs cleanly via the `tesseract` Nix system dep (ships 100+ langs incl. `ara`), and `pytesseract`+`opencv-python-headless` install fine via uv.

**RTL receipt extraction (real Bankak images):**
- Use **two OCR passes** on the same grayscale+upscaled (~1800px) image: `ara+eng` for Arabic labels and Arabic text values (recipient/comment); `eng` only for digits/amounts/dates — Arabic mode mangles digit groups and misreads the month name ("Jun" → "3200").
- Use `image_to_data` (word boxes) + `--psm 4`, and **order words within a line by `left` x-coordinate**. This undoes Tesseract's bidi reordering so account digit groups keep true visual order. Grouping line text directly (image_to_string) reverses digit groups.
- Match fields by **content pattern**, not label position: two 4×4 account lines disambiguated by vertical `top` (top=from, bottom=to); operation = standalone 9–12 digit run; amount = decimal/comma number; date via `\d{1,2}-[A-Za-z]{3,}-\d{4}` regex.
- Arabic value tokens come out in visual L→R order — **reverse them** to restore RTL reading order for names/comments.
- Two passes × image ≈ 10–15s; never run multiple full extractions in one shell command (times out). The 30s subprocess timeout in scan.ts is enough for one image.

**Recipient name on colored receipts (white/dark-on-color):**
- The plain full-image pass returns null or a truncated fragment for the recipient ("المرسل اليه" / bare "اسم") on green/red receipts. Fix: locate the label row, then re-OCR ONLY a contrast-enhanced horizontal band (CLAHE gray, normalize-stretch, Otsu, saturation-inverted) — but ONLY when the primary value is weak (<4 Arabic letters), to stay under the per-request timeout. Do NOT re-OCR enhanced full images (4 full passes → >120s timeout; binarized speckle makes Tesseract crawl).
- Band OCR must use **psm 6** (uniform block), not psm 4 — psm 4 returns nothing on a thin single-row strip.
- The value name often sits LOWER and larger than the label's first line (the label wraps to two rows), so pad the band generously BELOW the label bbox (~0.6× height above, ~1.6× below).
- Do NOT horizontally crop the band to drop the label column — it regresses psm 6 (too little content to anchor the line, and it drops trailing name tokens). Keep full width and clean the result instead.
- Clean label remnants bleeding into the value via Levenshtein vs label words {اسم,المرسل,اليه,المستفيد,التعليق}: threshold ≤1 for short tokens (≤3 letters), ≤2 for len 4-5 — because real short names collide (e.g. "علي" is edit-distance 2 from "اليه"). Also drop short edge tokens that are a prefix of an adjacent token (truncated OCR dup).
- Pick the candidate with the most Arabic letters across primary + band variants.

**Numeric fields on colored digital screenshots (white digits on a saturated gradient):**
- Grayscale collapses white-on-color contrast → the gray `eng` pass returns null/0 for accounts, amount and date even though the operation number still reads. Recover from the **HSV brightness (V) channel + CLAHE** (`value_channel()`), which keeps white text crisp.
- Run the recovery only when the page looks colored (`mean_saturation > 90`) OR the gray pass came up short — keeps normal photos on the cheap 2-pass path (no regression).
- `eng --psm 3` over the full V channel reads both 16-digit account groups and the amount. The **date row (month name + glued time) only survives `--psm 11` (sparse)**, but psm 11 on the full image is ~22s — crop to the data card (height 25%–75%) and it drops to ~4s while still reading the date.
- Treat a gray-pass amount of `0` as missing (`not amount`), not just `None` — a misread "000,000.00" parses to 0 and would otherwise block re-extraction.
- These extra passes push worst-case ~33s, so the scan.ts subprocess timeout was raised **30s → 60s**.

**How to apply / constraints:**
- Spawn the venv python at `<repoRoot>/.pythonlibs/bin/python` (resolve from `import.meta.url`, not `process.cwd()`, so deploy works); supports `OCR_PYTHON_BIN` / `OCR_SCRIPT_PATH` env overrides.
- esbuild bundles api-server to `dist/index.mjs` (ESM), so `import.meta.url` is available; the `ocr/` dir is NOT bundled — it must ship alongside the package and be referenced by absolute path.
- Always: subprocess timeout+SIGKILL, `express.json({ limit })` raised for base64 images, and `rm(tmpDir, {recursive:true})` in `finally` (cleaning only the file leaks the mkdtemp dir).
- OCR fields are inherently nullable — `ScanResult` props are `["string","null"]` in OpenAPI; the frontend create-transfer flow must block until mandatory fields are non-null (TransferInput still requires them).
