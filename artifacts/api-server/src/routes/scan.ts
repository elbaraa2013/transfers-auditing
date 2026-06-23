import { Router } from "express";

const router = Router();

// POST /api/scan
router.post("/scan", async (req, res) => {
  const { imageBase64 } = req.body;

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 مطلوب" });
    return;
  }

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!baseUrl || !apiKey) {
    res.status(400).json({ error: "خدمة الذكاء الاصطناعي غير مُهيأة. يرجى التحقق من إعدادات التكامل." });
    return;
  }

  const prompt = `أنت نظام استخراج بيانات من صور الحوالات المصرفية. استخرج المعلومات التالية من الصورة وأرجعها كـ JSON فقط بدون أي نص إضافي:

{
  "operationNumber": "رقم العملية (string)",
  "amount": "المبلغ (number بدون رموز عملة)",
  "fromAccount": "من حساب (string)",
  "toAccount": "إلى حساب (string)",
  "recipientName": "اسم المرسل إليه (string)",
  "comment": "التعليق إن وجد (string أو null)",
  "transferDate": "التاريخ والزمن (string)",
  "riskScore": "درجة المخاطرة من 0 إلى 1 بناءً على المبلغ والبيانات (number)",
  "confidence": "نسبة الثقة في البيانات المستخرجة من 0 إلى 1 (number)"
}

إذا لم تتمكن من قراءة حقل معين، ضع قيمة افتراضية معقولة. لا ترجع أي شيء غير JSON.`;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      res.status(400).json({ error: `فشل الاتصال بخدمة الذكاء الاصطناعي: ${response.status} - ${errorData}` });
      return;
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content ?? "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(400).json({ error: "لم يتمكن النظام من استخراج البيانات من الصورة. يرجى التأكد من وضوح الصورة." });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `خطأ في معالجة الصورة: ${message}` });
  }
});

export default router;
