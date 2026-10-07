import { Product } from '../database/types';

export type AdPreset = 'facebook_post' | 'whatsapp_broadcast' | 'flash_sale' | 'tech_review';

export interface GenerateAdOptions {
  product: Product;
  preset: AdPreset;
  storeName?: string;
  storePhone?: string;
  customPrompt?: string;
}

export class AiAdService {
  /**
   * Generates tailored Egyptian retail and electronics advertising copy.
   * Leverages Gemini API if GEMINI_API_KEY is present in env, or falls back to
   * high-converting structured copy engine.
   */
  public async generateAd(options: GenerateAdOptions): Promise<string> {
    const { product, preset, storeName = 'كويزلينك ستور', storePhone = '01000000000', customPrompt } = options;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const aiResult = await this.callGeminiApi(apiKey, options);
        if (aiResult) return aiResult;
      } catch (err: any) {
        console.warn('⚠️ [AiAdService] Gemini API call failed, falling back to local engine:', err?.message || err);
      }
    }

    return this.generateLocalSmartAd(product, preset, storeName, storePhone, customPrompt);
  }

  private async callGeminiApi(apiKey: string, options: GenerateAdOptions): Promise<string | null> {
    const { product, preset, storeName = 'كويزلينك ستور', storePhone = '01000000000', customPrompt } = options;

    const systemPrompt = `أنت خبير تسويق رقمي وكوبي رايتر محترف في مصر متخصص في أجهزة الكمبيوتر، اللابتوب، والإلكترونيات والتجارة بالتجزئة.
اكتب إعلاناً جذاباً ومحفزاً للبيع باللهجة المصرية البيعية الودودة والواثقة، مستخدماً الإيموجي بشكل احترافي، وموضحاً السعر والمواصفات والضمان وطريقة الشراء.`;

    const userPrompt = `
المنتج: ${product.name}
سعر البيع: ${product.sellPriceRetail} جنيه مصري
سعر الجملة: ${product.sellPriceWholesale || product.sellPriceRetail} جنيه
يحمل سيريال/ضمان: ${product.hasSerial ? 'نعم - ضمان معتمد بسيريال رسمي' : 'لا'}
الكمية المتاحة: ${product.stockQuantity} قطع
اسم المحل: ${storeName}
رقم الهاتف / الواتساب: ${storePhone}
النوع المطلوب: ${preset}
ملاحظات إضافية: ${customPrompt || 'ركز على الجودة والسرعة وثقة العميل'}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 800,
        },
      }),
    });

    if (!response.ok) return null;
    const json = (await response.json()) as any;
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  }

  private generateLocalSmartAd(
    product: Product,
    preset: AdPreset,
    storeName: string,
    storePhone: string,
    customPrompt?: string
  ): string {
    const name = product.name;
    const retailPrice = product.sellPriceRetail.toLocaleString('en-US');
    const wholesalePrice = (product.sellPriceWholesale || product.sellPriceRetail).toLocaleString('en-US');
    const hasSerial = product.hasSerial;
    const stock = product.stockQuantity;
    const stockWarning = stock > 0 && stock <= 5 ? `⚠️ متبقي ${stock} قطع فقط في الفرع - الحق احجز!` : '🔥 الكمية محدودة ومتاحة للتسليم الفوري!';

    if (preset === 'facebook_post') {
      return `🔥 لمحبي التميز والأداء العالي.. وصل حديثاً في ${storeName}! 🚀✨

لو بتدور على أقوى قيمة مقابل سعر، جهازك جاهز النهاردة:
🌟 *${name}*

💡 *أهم المميزات:*
✅ أداء استثنائي وتجربة استخدام فائقة السلاسة.
✅ فحص وتست كامل للأجهزة لضمان أعلى استقرار.
${hasSerial ? '✅ ضمان ساري وموثق بالسيريال نمبر الأصلي من تاريخ الشراء 🛡️' : '✅ خامة واعتمادية مضمونة 100%'}
${stockWarning}

💰 *السعر المفاجأة:*
✨ سعر القطاعي: *${retailPrice} جنيه فقط*
${product.sellPriceWholesale ? `💼 متوفر خصم خاص لطلبات الجملة والمحلات: *${wholesalePrice} جنيه*` : ''}

📦 المعاينة والتجربة حقك قبل الاستلام!
📍 شرفنا في الفرع أو اطلب شحن سريع لباب بيتك:
📞 تليفون / واتساب: ${storePhone}
${customPrompt ? `\n📌 ملاحظة: ${customPrompt}` : ''}
#تكنولوجيا #كمبيوتر #عروض #جيمنج #${storeName.replace(/\s+/g, '_')}`;
    }

    if (preset === 'whatsapp_broadcast') {
      return `أهلاً بيك يا فندم في *${storeName}* ⚡👋

عشان دايم بنوفرلك أفضل العروض وأقوى الأجهزة:
عرض اليوم الخاص على:
📱 *${name}*

• السعر الحصري: *${retailPrice} EGP* 🎉
${hasSerial ? '• الجهاز بسيريال أصلي ومشمول بضمان كامل 🛡️' : '• جودة ممتازة جاهزة للاستخدام الفوري'}
• متوفر في الفرع وجاهز للشحن الفوري 🚚

${stockWarning}
لحجز طلبك أو للاستفسار، ابعتلنا الرد على الرسالة دي أو اتصل على:
📞 ${storePhone}`;
    }

    if (preset === 'flash_sale') {
      return `🚨⚡ عـرض خـاطـف لمـدة 48 سـاعـة فـقـط! ⏳💥
تصفية دفعة أجهزة محدودة جداً في ${storeName}!

الجهاز الملكي:
👑 *${name}*

السعر نزل رسمي علشانك:
💥 *${retailPrice} جـنـيـه بـس!* (بدلاً من الأسعار القديمة)

${hasSerial ? '🛡️ استلم جهازك بفاتورة ضريبية رسمية وضمان موثق بالسيريال' : '🛡️ ضمان أعلى جودة ومعاينة حقيقية'}
${stockWarning}

🏃‍♂️ العرض ساري حتى نفاد الكمية فقط!
📲 للحجز الفوري عبر الواتساب: ${storePhone}
أو شرفنا في فرعنا لمعاينة الجهاز عملياً!`;
    }

    // Default: tech_review
    return `💻 مراجعة سريعة للمواصفات والأداء: *${name}* 📊

لكل المهتمين بالشغل التقني والأداء العالي:
🔹 الموديل: ${name}
🔹 السعر الرسمي: *${retailPrice} جنيه مصري*
${hasSerial ? '🔹 التتبع والضمان: سيريال مخصص مفعل بالسيستم' : ''}
🔹 حالة التوافر: متوفر حالياً بالمخزن (${stock} قطعة)

⭐ الخيار الأفضل في فئته السعرية للطلاب والمحترفين والجيمرز.
📞 متاح الدفع كاش أو بالفيزا أو التقسيط في ${storeName}: ${storePhone}`;
  }
}
