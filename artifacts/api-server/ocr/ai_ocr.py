"""AI-first Bankak receipt extractor with a dedicated recipient-name pass.

Full-page extraction via Claude vision, then the recipient row is located
(tesseract layout pass), cropped, enlarged and re-read letter-by-letter.
Falls back to the legacy tesseract pipeline if the API is unavailable.
"""
import base64
import json
import os
import re
import sys
import urllib.request
import urllib.error

import cv2

import bankak_ocr  # legacy pipeline + layout helpers (same directory)

API_URL = "https://api.anthropic.com/v1/messages"
MODEL_PRIMARY = os.environ.get("OCR_MODEL", "claude-haiku-4-5")
MODEL_FALLBACK = os.environ.get("OCR_MODEL_FALLBACK", "claude-sonnet-5")
API_TIMEOUT_S = 25

PROMPT = (
    "This image is a bank transfer receipt from Bankak (Bank of Khartoum), in Arabic.\n"
    "Extract the fields and answer with ONLY a raw JSON object - no markdown, no explanations.\n"
    "Schema:\n"
    "{\n"
    '  "operationNumber": string|null,   // رقم العملية - digits only\n'
    '  "amount": number|null,            // المبلغ - plain number, no commas\n'
    '  "fromAccount": string|null,       // من / من حساب - digits only\n'
    '  "toAccount": string|null,         // إلى / الى حساب - digits only\n'
    '  "recipientName": string|null,     // إسم المرسل اليه - Arabic, copy exactly\n'
    '  "comment": string|null,           // التعليق - copy exactly\n'
    '  "transferDate": string|null       // التاريخ والوقت - exactly as shown, e.g. "09-Jul-2026 18:28:00"\n'
    "}\n"
    "Rules: use null for any field not present; account numbers are usually 16 digits\n"
    "shown in groups of 4 - join them without spaces.\n"
    "CRITICAL rule for recipientName and comment: Sudanese personal names are often\n"
    "UNCOMMON words. Transcribe letter-by-letter EXACTLY as printed. NEVER substitute\n"
    "a similar common name. Examples of forbidden corrections:\n"
    "- printed حانز -> do NOT write حائز or حازم, keep حانز\n"
    "- printed البلوله -> do NOT write البالولة, keep البلوله\n"
    "Preserve ة vs ه and ى vs ي exactly as printed. Do not add or remove ال."
)

NAME_PROMPT = (
    "This is an enlarged crop of the recipient-name row (إسم المرسل اليه) from a bank receipt.\n"
    "Transcribe ONLY the person's name, letter-by-letter, EXACTLY as printed.\n"
    "The name may be an uncommon Sudanese name - do NOT autocorrect it to a similar\n"
    "common name (e.g. printed حانز stays حانز, never حائز/حازم; printed البلوله stays\n"
    "البلوله, never البالولة). Preserve ة vs ه and ى vs ي exactly. Ignore the field label.\n"
    'Answer with ONLY raw JSON: {"recipientName": "..."} - null if unreadable.'
)


def sniff_media_type(data: bytes) -> str:
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    return "image/png"


def parse_json_block(text: str):
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("no JSON object in model reply")
    return json.loads(text[start : end + 1])


def call_claude(image_b64: str, media_type: str, model: str, api_key: str, prompt: str):
    body = {
        "model": model,
        "max_tokens": 1024,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=API_TIMEOUT_S) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    text = "".join(
        block.get("text", "")
        for block in payload.get("content", [])
        if block.get("type") == "text"
    )
    return parse_json_block(text)


def name_crop_b64(image_path: str):
    """Locate the recipient row with the legacy layout pass, crop it from the
    original color image, enlarge x2 and return it as base64 PNG."""
    try:
        gray = bankak_ocr.load_gray(image_path)
        orig = cv2.imread(image_path)
        if orig is None:
            return None
        scale = max(gray.shape[:2]) / max(orig.shape[:2])
        ar_lines = bankak_ocr.ocr_lines(gray, "ara+eng")
        label = bankak_ocr.find_recipient_band(ar_lines)
        if not label:
            return None
        h_line = label["bottom"] - label["top"]
        top = int(max(0, (label["top"] - h_line * 1.0) / scale))
        bottom = int(min(orig.shape[0], (label["bottom"] + h_line * 2.2) / scale))
        if bottom - top < 10:
            return None
        crop = orig[top:bottom, :]
        crop = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        ok, buf = cv2.imencode(".png", crop)
        if not ok:
            return None
        return base64.standard_b64encode(buf.tobytes()).decode("ascii")
    except Exception:  # noqa: BLE001 — refinement is best-effort
        return None


def refine_recipient(image_path: str, api_key: str):
    crop_b64 = name_crop_b64(image_path)
    if not crop_b64:
        return None
    try:
        raw = call_claude(crop_b64, "image/png", MODEL_FALLBACK, api_key, NAME_PROMPT)
    except Exception:  # noqa: BLE001
        return None
    name = raw.get("recipientName")
    if isinstance(name, str):
        name = name.strip()
        if len(re.findall(r"[\u0600-\u06FF]", name)) >= 4:
            return name
    return None


def _digits(value):
    if value is None:
        return None
    d = re.sub(r"\D", "", str(value))
    return d or None


def normalize(raw: dict) -> dict:
    op = _digits(raw.get("operationNumber"))
    if op and not (8 <= len(op) <= 14):
        op = None
    frm = _digits(raw.get("fromAccount"))
    if frm and not (10 <= len(frm) <= 20):
        frm = None
    to = _digits(raw.get("toAccount"))
    if to and not (10 <= len(to) <= 20):
        to = None
    amount = raw.get("amount")
    if isinstance(amount, str):
        try:
            amount = float(amount.replace(",", ""))
        except ValueError:
            amount = None
    if isinstance(amount, float) and amount.is_integer():
        amount = int(amount)
    if not isinstance(amount, (int, float)):
        amount = None

    def _text(key):
        v = raw.get(key)
        if isinstance(v, str) and v.strip() and v.strip().lower() not in ("null", "n/a"):
            return v.strip()
        return None

    return {
        "operationNumber": op,
        "amount": amount,
        "fromAccount": frm,
        "toAccount": to,
        "recipientName": _text("recipientName"),
        "comment": _text("comment"),
        "transferDate": _text("transferDate"),
    }


def risk_score(amount, completeness):
    risk = 0.1
    if amount:
        if amount > 3000000:
            risk = 0.9
        elif amount >= 100000:
            risk = 0.7
        elif amount >= 500000:
            risk = 0.5
        elif amount >= 100000:
            risk = 0.35
        else:
            risk = 0.2
    return round(min(1.0, risk + (1.0 - completeness) * 0.2), 2)


def finalize(fields: dict) -> dict:
    keys = ["operationNumber", "amount", "fromAccount", "toAccount", "recipientName", "transferDate"]
    found = [k for k in keys if fields.get(k) is not None]
    completeness = len(found) / len(keys)
    fields["riskScore"] = risk_score(fields.get("amount"), completeness)
    fields["confidence"] = round(min(1.0, 0.55 + completeness * 0.44), 2)
    return fields


def is_weak(fields: dict) -> bool:
    core = [fields.get("operationNumber"), fields.get("amount")]
    keys = ["operationNumber", "amount", "fromAccount", "toAccount", "recipientName", "transferDate"]
    found = sum(1 for k in keys if fields.get(k) is not None)
    return any(v is None for v in core) or found < 4


def ai_extract(image_path: str, api_key: str) -> dict:
    with open(image_path, "rb") as fh:
        data = fh.read()
    image_b64 = base64.standard_b64encode(data).decode("ascii")
    media_type = sniff_media_type(data)

    fields = normalize(call_claude(image_b64, media_type, MODEL_PRIMARY, api_key, PROMPT))
    if is_weak(fields):
        try:
            better = normalize(call_claude(image_b64, media_type, MODEL_FALLBACK, api_key, PROMPT))
            keys = ["operationNumber", "amount", "fromAccount", "toAccount", "recipientName", "transferDate"]
            if sum(1 for k in keys if better.get(k)) > sum(1 for k in keys if fields.get(k)):
                fields = better
        except Exception:  # noqa: BLE001
            pass

    #