import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/invoice-scan", async (req, res) => {
  const { imageBase64, mimeType = "image/jpeg" } = req.body as {
    imageBase64: string;
    mimeType?: string;
  };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: `Analyze this invoice image and extract the invoice template structure. Return ONLY a valid JSON object (no markdown, no code fences, no extra text) with this exact structure:
{
  "companyName": "company or vendor name on the invoice",
  "address": "company address if visible, or empty string",
  "services": [
    {
      "name": "service or item name",
      "description": "brief description if available, or empty string",
      "qty": 1,
      "unitPrice": 0
    }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "notes": "payment terms or special notes if visible, or empty string"
}
Extract every line item visible. For numeric values not clearly readable, use 0. Return only the raw JSON object with no surrounding text.`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      const data = JSON.parse(cleaned);
      res.json({ success: true, data });
    } catch {
      req.log.warn({ raw }, "invoice-scan: could not parse AI response");
      res.status(422).json({
        success: false,
        error: "Could not parse invoice structure from image",
      });
    }
  } catch (err) {
    req.log.error(err, "invoice-scan: AI service error");
    res.status(500).json({ error: "AI service error" });
  }
});

export default router;
