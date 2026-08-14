import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Ensure you have GEMINI_API_KEY in your apps/api/.env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// POST /api/ai/generate-copy
router.post('/generate-copy', async (req: Request, res: Response) => {
  try {
    const { product, tone = 'Professional', language = 'Arabic' } = req.body;

    if (!product || !product.title) {
      return res.status(400).json({ error: 'Product data is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    }

    const prompt = `Write an engaging social media advertisement for the following product:
Product Name: ${product.title}
Price: ${product.price} ${product.currency}
Description: ${product.description || 'N/A'}

Requirements:
- Tone: ${tone}
- Language: ${language}
- Include a strong Call-to-Action (CTA).
- Include appropriate emojis.
- Return ONLY the ad copy text, no extra conversational filler.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const copy = response.text();

    res.json({ copy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
