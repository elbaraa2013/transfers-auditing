"""AI-first Bankak receipt extractor.

Tries Claude vision API (accurate Arabic OCR), validates the result,
retries once with a stronger model when weak, and falls back to the
legacy tesseract pipeline (bankak_ocr.py) if the API is unavailable.
Prints the same JSON schema the Node server expects.
"""
import base64
import json
import os
import re
import sys
import urllib.request
import urllib.error

import bankak_ocr  # legacy tesseract fallback (same directory)

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
    "Rules: use null for any field not present; keep Arabic text exactly as written;\n"
    "account numbers are usually 16 digits shown in groups of 4 - join them without spaces."
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


def call_claude(image_b64: str, media_type: str, model: str, api_key: str):
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
                    {"type": "text", "text": PROMPT},
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
        if amount >= 1000000:
            risk = 0.9
        elif amount >= 100000:
            risk = 0.7
        elif amount >= 50000:
            risk = 0.5
        elif amount >= 10000:
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

    fields = normalize(call_claude(image_b64, media_type, MODEL_PRIMARY, api_key))
    if is_weak(fields):
        try:
            better = normalize(call_claude(image_b64, media_type, MODEL_FALLBACK, api_key))
            keys = ["operationNumber", "amount", "fromAccount", "toAccount", "recipientName", "transferDate"]
            if sum(1 for k in keys if better.get(k)) > sum(1 for k in keys if fields.get(k)):
                fields = better
        except Exception:
            pass  # keep primary result
    return finalize(fields)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path argument required"}))
        sys.exit(1)
    image_path = sys.argv[1]
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    if api_key:
        try:
            result = ai_extract(image_path, api_key)
            print(json.dumps(result, ensure_ascii=False))
            return
        except Exception as exc:  # noqa: BLE001 — fall back to tesseract
            print("AI extraction failed, falling back: %s" % exc, file=sys.stderr)

    try:
        result = bankak_ocr.extract(image_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
    