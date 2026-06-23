import cv2
import easyocr
import re

def extract_bankak_data_dynamic(image_path):
    # Initialize EasyOCR with Arabic and English
    reader = easyocr.Reader(['ar', 'en'], gpu=False)
    
    # Read text with bounding boxes
    results = reader.readtext(image_path)
    
    # Initialize fields
    data = {
        "transaction_number": None,
        "amount": None,
        "from_account": None,
        "to_account": None,
        "recipient_name": None,
        "date_time": None
    }
    
    # Sort results vertically (by top Y coordinate) then horizontally (by left X)
    results.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
    
    text_lines = []
    for bbox, text, prob in results:
        text_lines.append({
            "text": text.strip(),
            "box": bbox,
            "center_y": (bbox[0][1] + bbox[2][1]) / 2,
            "center_x": (bbox[0][0] + bbox[1][0]) / 2
        })
    
    # Helper to find text near a label on the same line or right below it
    def find_value_near(label_keywords, alignment='horizontal', tolerance=30):
        for i, line in enumerate(text_lines):
            if any(kw in line['text'] for kw in label_keywords):
                # Target found, look for values
                if alignment == 'horizontal':
                    # Look for something on the same Y level but either right or left depending on language layout
                    # In Bankak, usually the value is aligned horizontally or on the next line
                    for j in range(len(text_lines)):
                        if i != j and abs(text_lines[j]['center_y'] - line['center_y']) < tolerance:
                            # Avoid matching another keyword
                            return text_lines[j]['text']
                
                # Check the line right below it if horizontal didn't work
                if i + 1 < len(text_lines):
                    return text_lines[i+1]['text']
        return "Not Found"

    # Dynamic extraction rules based on typical Bankak layout
    # 1. Amount (المبلغ)
    for line in text_lines:
        if 'المبلغ' in line['text'] or 'Amount' in line['text']:
            # The amount is often a large number with commas or 'SDG' nearby
            idx = text_lines.index(line)
            if idx + 1 < len(text_lines):
                data['amount'] = text_lines[idx+1]['text']
    
    # 2. Transaction Number (رقم العملية)
    for line in text_lines:
        if 'رقم العملية' in line['text'] or 'Transaction No' in line['text']:
            idx = text_lines.index(line)
            if idx + 1 < len(text_lines):
                data['transaction_number'] = text_lines[idx+1]['text']

    # 3. From Account (من حساب)
    for line in text_lines:
        if 'من حساب' in line['text'] or 'From Account' in line['text']:
            idx = text_lines.index(line)
            if idx + 1 < len(text_lines):
                data['from_account'] = text_lines[idx+1]['text']

    # 4. To Account (إلى حساب) or (الى حساب)
    for line in text_lines:
        if 'إلى حساب' in line['text'] or 'الى حساب' in line['text'] or 'To Account' in line['text']:
            idx = text_lines.index(line)
            if idx + 1 < len(text_lines):
                data['to_account'] = text_lines[idx+1]['text']

    # 5. Recipient Name (إسم المرسل إليه)
    for line in text_lines:
        if 'المرسل إليه' in line['text'] or 'Recipient' in line['text'] or 'إسم' in line['text']:
            idx = text_lines.index(line)
            if idx + 1 < len(text_lines):
                data['recipient_name'] = text_lines[idx+1]['text']

    # Clean up results using regular expressions if needed
    return data

# Example of usage:
# print(extract_bankak_data_dynamic("receipt.png"))
