import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../prisma';

const router = Router();

// Pinned official AI model per system architecture
const AI_MODEL_NAME = 'gemini-3.5-flash-lite';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface DefaultPreset {
  presetKey: string;
  title: string;
  category: 'social' | 'video' | 'messaging' | 'urgency' | 'wholesale';
  systemPrompt: string;
  isDefault: boolean;
}

export const DEFAULT_PRESETS: DefaultPreset[] = [
  {
    presetKey: 'fb_ig_feed',
    title: 'Facebook & Instagram Feed (AIDA Hook & Close)',
    category: 'social',
    systemPrompt: `أنت خبير كتابة إعلانات تسويقية احترافية للفيسبوك وإنستجرام بالسوق المصري والعربي.
اكتب إعلان جذاب باستخدام صيغة AIDA (انتباه، اهتمام، رغبة، اتخاذ إجراء) للمنتج:
اسم المنتج: {title}
السعر: {price}
الوصف والمواصفات: {description}

القواعد:
1. ابدأ بهوك قوي جداً يلفت النظر من أول سطر.
2. اذكر أهم المميزات العملية اللي بتفرق مع العميل.
3. وضّح السعر والعرض بطريقة مشجعة للشراء.
4. أضف دعوة واضحة لاتخاذ القرار (Call To Action) مثل "اكتب تم في كومنت أو ابعتلنا رسالة".
5. استخدم لهجة مصرية بيعية شيك مع إيموجيز مناسبة ومنظمة بدون مبالغة.
6. لا تكتب أي مقدمات أو خاتمة خارج نص الإعلان.`,
    isDefault: true,
  },
  {
    presetKey: 'tiktok_reels',
    title: 'TikTok & Reels Viral Script (15s-30s)',
    category: 'video',
    systemPrompt: `أنت خبير سكريبتات فيديو ريلز وتيك توك للفيديوهات القصيرة سريعة الانتشار (Viral Short-Form).
اكتب سكريبت إعلاني سريع مدته 20-30 ثانية للمنتج:
اسم المنتج: {title}
السعر: {price}
الوصف: {description}

نسّق السكريبت بنظام المشاهد كالتالي:
⏱️ [0-3 ثواني - الهوك الخاطف]: حركة بصرية + جملة صادمة توقف السكرول.
🎬 [4-15 ثانية - التجربة العملية]: استعراض المنتج وهو بيحل مشكلة حقيقية.
⚡ [16-25 ثانية - العرض والسعر]: إبراز السعر {price} والعرض الخاص.
🚀 [26-30 ثانية - الطلب السريع]: دعوة واضحة للضغط على الرابط أو إرسال رسالة.

اللهجة: سريعة، حماسية، شبابية بيعية. أخرج النص جاهز للتصوير والإلقاء.`,
    isDefault: true,
  },
  {
    presetKey: 'whatsapp_direct',
    title: 'WhatsApp Direct Close & Quick Order',
    category: 'messaging',
    systemPrompt: `أنت خبير مبيعات ومحادثات واتساب متخصص في إتمام الصفقات وتأكيد الأوردرات بسرعة.
اكتب رسالة واتساب متكاملة وواضحة لعرض المنتج وإتمام الطلب:
اسم المنتج: {title}
السعر: {price}
الوصف: {description}

القواعد:
1. ترحيب ودود ومختصر.
2. تفاصيل المنتج وسعره بوضوح تام.
3. طمأنة العميل: (معاينة قبل الاستلام، دفع عند الاستلام، شحن سريع لجميع المحافظات).
4. نموذج إتمام الطلب جاهز لملء العميل: (الاسم - رقم الموبايل - العنوان بالتفصيل).
الأسلوب: مباشر، مريح، وموثوق.`,
    isDefault: true,
  },
  {
    presetKey: 'flash_sale',
    title: 'Flash Sale & Limited Stock (FOMO / Urgency)',
    category: 'urgency',
    systemPrompt: `أنت كاتب إعلانات متخصص في عروض التخفيضات الكبرى واستراتيجيات الـ FOMO (الخوف من فوات الفرصة).
اكتب إعلان عرض خاص وخصم قوي للمنتج:
اسم المنتج: {title}
السعر: {price}
الوصف: {description}

القواعد:
1. استخدم مفردات الاستعجال: "عرض الـ 24 ساعة فقط"، "الكمية المتبقية محدودة جداً"، "الحق الخصم قبل نفاد الكمية".
2. أبرز ميزة التوفير وقيمة العرض مقارنة بالسعر.
3. زرع إحساس السرعة والمبادرة الفورية.
4. إيموجيز قوية مثل 🔥، ⚡، ⏳، 🚨.`,
    isDefault: true,
  },
  {
    presetKey: 'b2b_wholesale',
    title: 'B2B Wholesale & Resellers (Bulk Deals)',
    category: 'wholesale',
    systemPrompt: `أنت مستشار مبيعات تجارية موجه لتجار التجزئة، أصحاب المحلات، والمسوقين أونلاين (B2B & Resellers).
اكتب عرض بيع تجاري وجملة للمنتج:
اسم المنتج: {title}
السعر: {price}
الوصف: {description}

القواعد:
1. ركز على هامش الربح العالي وسرعة تصريف المنتج في السوق.
2. وضح استعداد توريد كميات فورية وشحن لجميع المحافظات ومنافذ التوزيع.
3. اذكر أقل كمية للطلب ومزايا التعاقد التجاري.
4. دعوة مباشرة للتواصل لطلب لستة أسعار الجملة ونماذج العينات.
الأسلوب: جاد، تجاري، وبيزنس راقي.`,
    isDefault: true,
  },
];

// Helper: Smart Rule-Based Copy Fallback (Zero-latency fallback)
function generateDirectResponseFallback(product: any, presetKey: string): string {
  const title = product.title || 'منتج مميز';
  const price = `${product.price || ''} ${product.currency || 'EGP'}`.trim();
  const desc = product.description || 'خامات عالية الجودة وتصميم عصري عملي مناسب للاستخدام اليومي.';

  switch (presetKey) {
    case 'tiktok_reels':
      return `🎬 سكريبت ريلز سريع لـ ${title} 🚀

⏱️ [0-3 ثواني]: لو بتدور على أعلى جودة وأفضل سعر، الفيديو ده معمول ليك بالظبط!
🎥 [4-15 ثانية]: شوف معانا ${title} على الطبيعة.. ${desc}.. سهولة، عملية، وشياكة مفيش زيها.
⚡ [16-25 ثانية]: وسعر القطعة النهاردة بـ ${price} فقط! خصم خاص لفترة محدودة جداً.
🛒 [26-30 ثانية]: اطلب دلوقتي من الرابط أو ابعتلنا رسالة خاصة قبل ما الكمية تخلص!`;

    case 'whatsapp_direct':
      return `أهلاً بحضرتك يا فندم! 🌟
بخصوص استفسارك عن *${title}*:

✨ *أهم المواصفات:*
${desc}

💰 *السعر:* ${price} فقط!
🚚 *الشحن:* متاح شحن سريع لجميع المحافظات.
🛡️ *الضمان:* الدفع عند الاستلام مع إمكانية المعاينة قبل الدفع لضمان رضاك التام.

لتأكيد الأوردر برجاء إرسال:
1. الاسم:
2. رقم الموبايل:
3. العنوان بالتفصيل:`;

    case 'flash_sale':
      return `🔥 عرض قنبلة وخصم حصري لفترة محدودة جداً! ⏳

المنتج الأكثر طلباً: *${title}*
سعر العرض الخاص اليوم: *${price}* فقط! 🏷️

${desc}

⚠️ الكمية محدودة جداً بأسبقية الحجز!
✅ الدفع عند الاستلام بعد المعاينة والتأكد من الجودة.
🚚 الشحن متوفر لباب بيتك أينما كنت.

👈 اطلب الآن قبل انتهاء العرض أو نفاذ الكمية! ابعتلنا رسالة فوراً 📩`;

    case 'b2b_wholesale':
      return `📢 لتجار التجزئة وأصحاب المحلات والمسوقين أونلاين 💼
متاح حالياً جملة للطلب الفوري: *${title}*

🔹 منتج سريع البيع ومضمون الإقبال والطلب.
🔹 متوفر بكميات للمحلات والمتاجر الإلكترونية بأسعار تنافسية بهامش ربح ممتاز.
🔹 شحن وتوصيل فوري لجميع محافظات مصر.
🔹 سعر القطعة في العرض: ${price} (يوجد خصم إضافي للكميات الكبيرة).

للطلب واستلام لستة أسعار الجملة، تواصل معنا على الخاص أو واتساب 🤝`;

    case 'fb_ig_feed':
    default:
      return `✨ الحل الأمثل اللي بتدور عليه وصل! ✨

بنقدملك *${title}* بجودة استثنائية وأداء لا غنى عنه! 💎

🌟 *ليه تختاره؟*
${desc}

💰 *السعر:* ${price} فقط!
🛡️ *مميزاتنا:*
- معاينة قبل الاستلام لراحتك التامة.
- دفع عند الاستلام.
- توصيل سريع لحد باب البيت.

📩 للطلب الفوري: ابعتلنا رسالة على الصفحة أو سيب تعليق بـ "تفاصيل" وهنتواصل معاك فوراً! 🚀`;
  }
}

// ── GET /api/ai/presets ──────────────────────────────────────────────
router.get('/presets', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    // Fetch user customized presets if any
    const userPresets = userId
      ? await prisma.aiAdPreset.findMany({ where: { userId } })
      : [];

    const userPresetMap = new Map(userPresets.map((p) => [p.presetKey, p]));

    // Merge defaults with custom DB overrides
    const merged = DEFAULT_PRESETS.map((def) => {
      const custom = userPresetMap.get(def.presetKey);
      if (custom) {
        return {
          id: custom.id,
          presetKey: custom.presetKey,
          title: custom.title,
          category: custom.category,
          systemPrompt: custom.systemPrompt,
          isDefault: false,
          isCustomized: true,
        };
      }
      return def;
    });

    res.json(merged);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/ai/presets ─────────────────────────────────────────────
router.post('/presets', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { presetKey, systemPrompt, title, category } = req.body;
    if (!presetKey || !systemPrompt) {
      return res.status(400).json({ error: 'presetKey and systemPrompt are required' });
    }

    const defaultDef = DEFAULT_PRESETS.find((p) => p.presetKey === presetKey);
    const resolvedTitle = title || defaultDef?.title || presetKey;
    const resolvedCategory = category || defaultDef?.category || 'social';

    const saved = await prisma.aiAdPreset.upsert({
      where: {
        userId_presetKey: { userId, presetKey },
      },
      update: {
        systemPrompt,
        title: resolvedTitle,
        category: resolvedCategory,
      },
      create: {
        userId,
        presetKey,
        title: resolvedTitle,
        category: resolvedCategory,
        systemPrompt,
      },
    });

    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/ai/generate-ad ──────────────────────────────────────────
router.post('/generate-ad', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      product,
      presetKey = 'fb_ig_feed',
      customPrompt,
      tone = 'Egyptian Commercial',
      language = 'Arabic',
    } = req.body;

    if (!product || !product.title) {
      return res.status(400).json({ error: 'Product title and data are required' });
    }

    // 1. Resolve prompt template
    let systemPrompt = customPrompt?.trim();

    if (!systemPrompt) {
      if (userId) {
        const customPreset = await prisma.aiAdPreset.findUnique({
          where: { userId_presetKey: { userId, presetKey } },
        });
        if (customPreset?.systemPrompt) {
          systemPrompt = customPreset.systemPrompt;
        }
      }

      if (!systemPrompt) {
        const def = DEFAULT_PRESETS.find((p) => p.presetKey === presetKey) || DEFAULT_PRESETS[0];
        systemPrompt = def.systemPrompt;
      }
    }

    // 2. Interpolate product tokens
    const titleVal = product.title || '';
    const priceVal = `${product.price || ''} ${product.currency || 'EGP'}`.trim();
    const descVal = product.description || 'عالي الجودة وتصميم مميز';

    const interpolatedPrompt = systemPrompt
      .replace(/{title}/gi, titleVal)
      .replace(/{product_name}/gi, titleVal)
      .replace(/{price}/gi, priceVal)
      .replace(/{description}/gi, descVal)
      .replace(/{tone}/gi, tone)
      .replace(/{language}/gi, language);

    // 3. Try Gemini Generation (Strictly gemini-3.5-flash-lite)
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: interpolatedPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        });

        const response = await result.response;
        const copy = response.text()?.trim();
        if (copy) {
          return res.json({ copy, source: 'gemini-3.5-flash-lite', presetKey });
        }
      } catch (geminiError: any) {
        console.warn(`⚠️ [AI Gateway] Gemini call failed (${geminiError.message}). Engaging smart fallback.`);
      }
    }

    // 4. Zero-Latency High-Converting Direct Response Engine Fallback
    const fallbackCopy = generateDirectResponseFallback(product, presetKey);
    res.json({ copy: fallbackCopy, source: 'smart-fallback', presetKey });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Legacy Compatibility: POST /api/ai/generate-copy ─────────────────
router.post('/generate-copy', async (req: Request, res: Response) => {
  try {
    const { product, tone = 'Professional', language = 'Arabic' } = req.body;

    if (!product || !product.title) {
      return res.status(400).json({ error: 'Product data is required' });
    }

    if (process.env.GEMINI_API_KEY) {
      try {
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

        const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const copy = response.text();
        return res.json({ copy });
      } catch (err: any) {
        console.warn('Gemini legacy call fallback:', err.message);
      }
    }

    const fallbackCopy = generateDirectResponseFallback(product, 'fb_ig_feed');
    res.json({ copy: fallbackCopy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
