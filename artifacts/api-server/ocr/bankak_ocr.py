"""
Bankak receipt OCR extractor (offline, Tesseract-based).

Reads an image path from argv, runs OCR, and prints a single JSON object to
stdout with the extracted transfer fields. Designed to be spawned as a
subprocess by the Node API server.

Extraction strategy (tuned for real Bankak RTL receipts):
- Two OCR passes on the same grayscale, upscaled image:
    * Pass A (ara+eng): used for Arabic labels and Arabic text values
      (recipient name, comment).
    * Pass B (eng): reads Latin digits, amounts and dates far more cleanly
      than Arabic mode, which mangles digit groups and the month name.
- Words are grouped into lines and ordered by their on-screen x position
  (left -> right), which undoes Tesseract's bidi reordering so that account
  digit groups keep their true visual order.
- Numeric/date fields are matched purely by content pattern from Pass B.
  The two account numbers are disambiguated by vertical position
  (top one = "from", bottom one = "to").
- Arabic text values are matched by label tokens in Pass A; their tokens are
  reversed to restore right-to-left reading order.
"""

import sys
import json
import re

import cv2
import pytesseract
from pytesseract import Output


AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def load_gray(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("could not read image")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    longest = max(h, w)
    if longest < 1800:
        scale = 1800.0 / longest
        gray = cv2.resize(
            gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC
        )
    return gray


def ocr_lines(image, lang):
    """Return list of line dicts, words ordered left->right (visual order)."""
    data = pytesseract.image_to_data(
        image, lang=lang, config="--psm 4", output_type=Output.DICT
    )

    grouped = {}
    n = len(data["text"])
    for i in range(n):
        text = (data["text"][i] or "").strip()
        try:
            conf = float(data["conf"][i])
        except (ValueError, TypeError):
            conf = -1.0
        if not text or conf < 0:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        grouped.setdefault(key, []).append(
            {
                "text": text,
                "left": data["left"][i],
                "top": data["top"][i],
                "width": data["width"][i],
                "height": data["height"][i],
                "conf": conf,
            }
        )

    lines = []
    for words in grouped.values():
        words.sort(key=lambda x: x["left"])  # visual left -> right
        top = min(w["top"] for w in words)
        bottom = max(w["top"] + w["height"] for w in words)
        confs = [w["conf"] for w in words]
        lines.append(
            {
                "tokens": [w["text"] for w in words],
                "text": " ".join(w["text"] for w in words),
                "top": top,
                "bottom": bottom,
                "center_y": (top + bottom) / 2.0,
                "conf": sum(confs) / len(confs) if confs else 0.0,
            }
        )

    lines.sort(key=lambda x: x["top"])
    return lines


def normalize_ar(text):
    text = text.translate(AR_DIGITS)
    text = re.sub(r"[إأآا]", "ا", text)
    text = text.replace("ى", "ي").replace("ة", "ه")
    return text


def has_tokens(line_text, *needles):
    norm = normalize_ar(line_text)
    return all(normalize_ar(nd) in norm for nd in needles)


# ----- numeric extraction from the English pass -----

ACCOUNT_GROUP_RE = re.compile(r"\d{3,4}(?:\s+\d{3,4}){3}")
DATE_RE = re.compile(
    r"(\d{1,2}[-/][A-Za-z]{3,}[-/]\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)"
)
AMOUNT_RE = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d{2}\b")


def extract_accounts(eng_lines):
    """Return account lines (16 digits) sorted top->bottom: [from, to]."""
    found = []
    for line in eng_lines:
        txt = line["text"].translate(AR_DIGITS)
        m = ACCOUNT_GROUP_RE.search(txt)
        if m:
            digits = re.sub(r"\D", "", m.group(0))
            if 12 <= len(digits) <= 17:
                found.append((line["top"], digits))
            continue
        digits = re.sub(r"\D", "", txt)
        if 14 <= len(digits) <= 18:
            found.append((line["top"], digits))
    found.sort(key=lambda x: x[0])
    return [d for _, d in found]


def extract_date(eng_lines):
    for line in eng_lines:
        m = DATE_RE.search(line["text"])
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
    return None


def extract_amount(eng_lines):
    candidates = []
    for line in eng_lines:
        txt = line["text"].translate(AR_DIGITS)
        for m in AMOUNT_RE.finditer(txt):
            raw = m.group(0).replace(",", "")
            try:
                candidates.append(float(raw))
            except ValueError:
                continue
    if not candidates:
        return None
    val = max(candidates)
    return int(val) if val.is_integer() else val


def extract_operation(eng_lines, account_digits):
    """Longest standalone 9-12 digit run not belonging to an account line."""
    acct_set = set(account_digits)
    best = None
    for line in eng_lines:
        digits_only = re.sub(r"\D", "", line["text"].translate(AR_DIGITS))
        if digits_only in acct_set:
            continue
        for tok in line["text"].translate(AR_DIGITS).split():
            t = re.sub(r"\D", "", tok)
            if 9 <= len(t) <= 12 and (best is None or len(t) > len(best)):
                best = t
    return best


# ----- arabic text extraction from the arabic pass -----

LABEL_TOKENS = {
    "المرسل", "اليه", "اله", "اسم", "التعليق", "العمليه", "رقم",
    "المبلغ", "حساب", "من", "الي", "التاريخ", "الوقت", "الزمن",
    "الحاله", "نوع", "الموبايل", "و",
}


def arabic_value(ar_lines, *needles):
    """Find a labeled line and return its non-label Arabic tokens in
    right-to-left reading order."""
    for line in ar_lines:
        if has_tokens(line["text"], *needles):
            kept = []
            for tok in line["tokens"]:
                norm = normalize_ar(tok)
                if norm in LABEL_TOKENS:
                    continue
                if not re.search(r"[\u0600-\u06FF]", tok):
                    continue  # drop non-arabic noise
                kept.append(tok)
            if kept:
                # tokens are in visual order; reverse for RTL reading order
                return " ".join(reversed(kept)).strip()
    return None


def extract(image_path):
    gray = load_gray(image_path)
    ar_lines = ocr_lines(gray, "ara+eng")
    eng_lines = ocr_lines(gray, "eng")

    accounts = extract_accounts(eng_lines)
    from_account = accounts[0] if len(accounts) >= 1 else None
    to_account = accounts[1] if len(accounts) >= 2 else None

    operation_number = extract_operation(eng_lines, accounts)
    amount = extract_amount(eng_lines)
    transfer_date = extract_date(eng_lines)

    recipient = arabic_value(ar_lines, "المرسل") or arabic_value(ar_lines, "المستفيد")
    comment = arabic_value(ar_lines, "التعليق")

    fields = [operation_number, amount, from_account, to_account, recipient, transfer_date]
    found = [f for f in fields if f]
    completeness = len(found) / len(fields)

    overall_conf = (
        sum(l["conf"] for l in eng_lines) / len(eng_lines) / 100.0
        if eng_lines else 0.0
    )

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
    risk = min(1.0, risk + (1.0 - completeness) * 0.2)

    confidence = round(min(1.0, overall_conf * 0.5 + completeness * 0.5), 2)

    return {
        "operationNumber": operation_number,
        "amount": amount,
        "fromAccount": from_account,
        "toAccount": to_account,
        "recipientName": recipient,
        "comment": comment,
        "transferDate": transfer_date,
        "riskScore": round(risk, 2),
        "confidence": confidence,
        "rawLines": [l["text"] for l in ar_lines],
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
