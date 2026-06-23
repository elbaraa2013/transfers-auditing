"""
Bankak receipt OCR extractor (offline, Tesseract-based).

Reads an image path from argv, runs Arabic+English OCR, and prints a single
JSON object to stdout with the extracted transfer fields. Designed to be
spawned as a subprocess by the Node API server.

Extraction strategy (ported from the dynamic label-matching approach):
- OCR the image into text blocks with bounding boxes.
- Group blocks into visual lines.
- For each known field, locate its label keyword, then take the value on the
  same line or the line directly below it.
"""

import sys
import json
import re

import cv2
import numpy as np
import pytesseract
from pytesseract import Output


def preprocess(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("could not read image")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Upscale small images to help OCR.
    h, w = gray.shape[:2]
    if max(h, w) < 1000:
        scale = 1000.0 / max(h, w)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


def ocr_lines(image):
    """Return list of {text, center_y, center_x, conf} grouped into lines."""
    data = pytesseract.image_to_data(
        image, lang="ara+eng", config="--psm 6", output_type=Output.DICT
    )

    words = []
    n = len(data["text"])
    for i in range(n):
        text = (data["text"][i] or "").strip()
        try:
            conf = float(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1.0
        if not text or conf < 0:
            continue
        words.append(
            {
                "text": text,
                "left": data["left"][i],
                "top": data["top"][i],
                "width": data["width"][i],
                "height": data["height"][i],
                "conf": conf,
                "line_key": (data["block_num"][i], data["par_num"][i], data["line_num"][i]),
            }
        )

    # Group words by their tesseract line key, preserving reading order.
    grouped = {}
    for wd in words:
        grouped.setdefault(wd["line_key"], []).append(wd)

    lines = []
    for key, ws in grouped.items():
        ws.sort(key=lambda x: x["left"])
        text = " ".join(w["text"] for w in ws)
        top = min(w["top"] for w in ws)
        bottom = max(w["top"] + w["height"] for w in ws)
        left = min(w["left"] for w in ws)
        right = max(w["left"] + w["width"] for w in ws)
        confs = [w["conf"] for w in ws]
        lines.append(
            {
                "text": text.strip(),
                "center_y": (top + bottom) / 2.0,
                "center_x": (left + right) / 2.0,
                "conf": sum(confs) / len(confs) if confs else 0.0,
            }
        )

    lines.sort(key=lambda x: (x["center_y"], x["center_x"]))
    return lines


def find_value_below(lines, label_keywords):
    """Find the value on the same line after the label, or the next line."""
    for i, line in enumerate(lines):
        if any(kw in line["text"] for kw in label_keywords):
            # Try to strip the label off the same line.
            remainder = line["text"]
            for kw in label_keywords:
                if kw in remainder:
                    remainder = remainder.split(kw, 1)[1]
            remainder = remainder.strip(" :：-\t")
            if remainder:
                return remainder
            # Otherwise take the line directly below.
            if i + 1 < len(lines):
                return lines[i + 1]["text"].strip()
    return None


def clean_number(value):
    if value is None:
        return None
    # Normalize Arabic-Indic digits to ASCII.
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    value = value.translate(trans)
    digits = re.sub(r"[^0-9.]", "", value)
    if not digits:
        return None
    try:
        num = float(digits)
        return int(num) if num.is_integer() else num
    except ValueError:
        return None


def clean_account(value):
    if value is None:
        return None
    trans = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")
    value = value.translate(trans)
    digits = re.sub(r"[^0-9]", "", value)
    return digits or value.strip()


def extract(image_path):
    image = preprocess(image_path)
    lines = ocr_lines(image)

    amount_raw = find_value_below(lines, ["المبلغ", "Amount"])
    op_raw = find_value_below(lines, ["رقم العملية", "رقم العمليه", "Transaction", "Reference", "المرجع"])
    from_raw = find_value_below(lines, ["من حساب", "From Account", "من"])
    to_raw = find_value_below(lines, ["إلى حساب", "الى حساب", "To Account"])
    recipient_raw = find_value_below(lines, ["المرسل إليه", "المرسل اليه", "Recipient", "اسم المستفيد", "المستفيد"])
    date_raw = find_value_below(lines, ["التاريخ", "Date", "الوقت", "Time"])

    amount = clean_number(amount_raw)

    if op_raw:
        # Strip leftover label fragments like "No", "No:", "#".
        op_raw = re.sub(r"^(no\.?|#|رقم)\s*[:：]?\s*", "", op_raw.strip(), flags=re.IGNORECASE).strip()

    overall_conf = (
        sum(l["conf"] for l in lines) / len(lines) / 100.0 if lines else 0.0
    )

    found = [v for v in [amount, op_raw, from_raw, to_raw, recipient_raw] if v]
    completeness = len(found) / 5.0

    # Simple risk heuristic: large amounts and missing fields raise risk.
    risk = 0.1
    if amount:
        if amount >= 100000:
            risk = 0.85
        elif amount >= 50000:
            risk = 0.6
        elif amount >= 10000:
            risk = 0.4
        else:
            risk = 0.2
    risk = min(1.0, risk + (1.0 - completeness) * 0.2)

    confidence = round(min(1.0, overall_conf * 0.6 + completeness * 0.4), 2)

    return {
        "operationNumber": (op_raw or "").strip() or None,
        "amount": amount,
        "fromAccount": clean_account(from_raw),
        "toAccount": clean_account(to_raw),
        "recipientName": (recipient_raw or "").strip() or None,
        "comment": None,
        "transferDate": (date_raw or "").strip() or None,
        "riskScore": round(risk, 2),
        "confidence": confidence,
        "rawLines": [l["text"] for l in lines],
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "image path argument required"}))
        sys.exit(1)
    try:
        result = extract(sys.argv[1])
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"error": str(exc)}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
