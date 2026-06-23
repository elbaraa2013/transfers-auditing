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

**How to apply / constraints:**
- Spawn the venv python at `<repoRoot>/.pythonlibs/bin/python` (resolve from `import.meta.url`, not `process.cwd()`, so deploy works); supports `OCR_PYTHON_BIN` / `OCR_SCRIPT_PATH` env overrides.
- esbuild bundles api-server to `dist/index.mjs` (ESM), so `import.meta.url` is available; the `ocr/` dir is NOT bundled — it must ship alongside the package and be referenced by absolute path.
- Always: subprocess timeout+SIGKILL, `express.json({ limit })` raised for base64 images, and `rm(tmpDir, {recursive:true})` in `finally` (cleaning only the file leaks the mkdtemp dir).
- OCR fields are inherently nullable — `ScanResult` props are `["string","null"]` in OpenAPI; the frontend create-transfer flow must block until mandatory fields are non-null (TransferInput still requires them).
