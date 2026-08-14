import { chromium, Page } from 'playwright';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

// Load environment variables from .env
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("❌ Please set GEMINI_API_KEY in .env");
    process.exit(1);
}

// Initialize Gemini SDK
const genAI = new GoogleGenerativeAI(apiKey);
const MODEL_NAME = "gemini-3.5-flash-lite"; 
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

// 1. Fetch Product from API
async function fetchProduct() {
    console.log("🌐 Fetching product from catalog API...");
    const response = await fetch("http://127.0.0.1:3000/api/n8n/products-catalog");
    const data = await response.json();
    if (!data.products || data.products.length === 0) {
        console.error("❌ API Response:", data);
        throw new Error("No products found in the catalog. Check the API response above.");
    }
    // Select a random product for testing, or just the first one
    const product = data.products[Math.floor(Math.random() * data.products.length)];
    console.log(`📦 Selected Product: ${product.title}`);
    return product;
}

// 2. Download Images
async function downloadImages(urls: string[], outDir: string) {
    console.log(`📥 Downloading ${urls.length} images...`);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    const downloadedPaths: string[] = [];
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        
        // Use extension from URL or fallback to .jpg
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        const dest = path.join(outDir, `image_${i}.${ext}`);
        
        const fileStream = fs.createWriteStream(dest, { flags: 'wx' });
        await finished(Readable.fromWeb(res.body as any).pipe(fileStream));
        downloadedPaths.push(dest);
        console.log(`✅ Downloaded: ${dest}`);
    }
    return downloadedPaths;
}

// 3. Generate Ad Copy with AI
async function generateAd(product: any, imagePaths: string[]) {
    console.log("🧠 Asking Gemini to write a professional Facebook ad...");
    
    const prompt = `You are an expert social media marketer. Write a professional, engaging Facebook ad post for the following product.
Use emojis, a catchy hook, and a call to action. Write the ad in Arabic.
Do not use markdown formatting (no bold/italics), just raw text ready to be pasted into Facebook.

Product Details:
Title: ${product.title}
Category: ${product.category}
Price: ${product.price} EGP
Description: ${product.description || 'N/A'}`;

    // Read local images for Gemini
    const imageParts = imagePaths.map(img => {
        return {
            inlineData: {
                data: fs.readFileSync(img).toString("base64"),
                mimeType: "image/" + path.extname(img).substring(1)
            }
        };
    });

    const result = await model.generateContent([prompt, ...imageParts]);
    const adText = result.response.text();
    console.log("\n📝 Generated Ad Copy:\n" + adText + "\n");
    return adText;
}

// Helper to write the post using clipboard
async function writePostAntiBot(page: Page, text: string) {
    console.log("⌨️ Waiting for modal to open...");
    await page.waitForTimeout(2000); 
    
    console.log("📋 Copy-Pasting generated Ad (Anti-Bot measure)...");
    await page.evaluate((t) => navigator.clipboard.writeText(t), text);
    
    // Paste it using keyboard shortcut
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+v`);
    await page.waitForTimeout(1000);
}

// Upload images to Facebook
async function uploadImagesToPost(page: Page, imagePaths: string[]) {
    console.log("🖼️ Uploading images to the Facebook post...");
    // Facebook has multiple hidden file inputs, so we must use .first() to avoid strict mode violations
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 5000 });
    await fileInput.setInputFiles(imagePaths);
    console.log("✅ Images uploaded!");
    // Wait for upload processing
    await page.waitForTimeout(5000);
}

async function run() {
    console.log("🚀 Starting End-to-End Campaign Test...");
    
    // Preparation Phase
    const product = await fetchProduct();
    const tempDir = path.join(__dirname, 'temp');
    
    // Clear old temp images
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Limit to max 3 images to speed things up
    const imagesToDownload = product.images.slice(0, 3); 
    const imagePaths = await downloadImages(imagesToDownload, tempDir);
    const adCopy = await generateAd(product, imagePaths);
    
    console.log("===================================");
    console.log("🌐 Starting Browser Automation...");
    
    const browser = await chromium.launch({ headless: false });
    const sessionPath = path.join(__dirname, 'session.json');
    const hasSession = fs.existsSync(sessionPath);

    const contextOptions: any = {
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        permissions: ['clipboard-read', 'clipboard-write']
    };

    if (hasSession) {
        contextOptions.storageState = sessionPath;
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await page.goto('https://www.facebook.com');

    if (!hasSession) {
        console.log("🕒 ACTION REQUIRED: Please log in manually...");
        await askQuestion("Press ENTER when you are ready to let the AI take over...");
        await context.storageState({ path: sessionPath });
    } else {
        console.log("✅ Logged in automatically using saved session!");
        await page.waitForTimeout(4000); 
    }

    // ---------------------------------------------------------
    // POST CREATION (Hybrid Agent)
    // ---------------------------------------------------------
    let actionSucceeded = false;
    console.log("\n⚡ [PHASE 1] Attempting Fast Path (DOM Template)...");
    try {
        const searchKeyword = "What's on your mind"; 
        console.log(`🔍 Searching DOM for: "${searchKeyword}" (Timeout: 4s)`);
        
        const postInput = page.getByText(new RegExp(searchKeyword, 'i')).first();
        await postInput.waitFor({ state: 'visible', timeout: 4000 });
        await postInput.click();
        
        console.log("✅ Fast Path Success! No AI needed.");
        
        await uploadImagesToPost(page, imagePaths);
        await writePostAntiBot(page, adCopy);
        
        actionSucceeded = true;
    } catch (e) {
        console.log("⚠️ Fast Path Failed.");
    }

    if (!actionSucceeded) {
        console.log("\n🚨 [PHASE 2] Initiating Spatial Vision AI Fallback...");
        const screenshotBuffer = await page.screenshot();
        
        const prompt = `Look at this screenshot of a Facebook page.
Find the button to create a new post (usually says "What's on your mind?").
Return ONLY a JSON object:
{
  "explanation": "brief explanation",
  "action": "click",
  "bounding_box_1000": [ymin, xmin, ymax, xmax]
}
If not found, return an empty array [].`;

        const imagePart = {
            inlineData: { data: screenshotBuffer.toString("base64"), mimeType: "image/png" }
        };

        try {
            const result = await model.generateContent([prompt, imagePart]);
            let jsonStr = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
            const jsonResponse = JSON.parse(jsonStr);
            
            if (jsonResponse.bounding_box_1000 && jsonResponse.bounding_box_1000.length === 4) {
                const [ymin, xmin, ymax, xmax] = jsonResponse.bounding_box_1000;
                const viewport = page.viewportSize();
                if (viewport) {
                    const x = ((xmin + xmax) / 2 / 1000) * viewport.width;
                    const y = ((ymin + ymax) / 2 / 1000) * viewport.height;
                    await page.mouse.click(x, y);
                    console.log("✅ Clicked successfully using AI Spatial Coordinates!");
                    
                    await uploadImagesToPost(page, imagePaths);
                    await writePostAntiBot(page, adCopy);
                    actionSucceeded = true;
                }
            }
        } catch (error) {
            console.error("\n❌ Error:", error);
        }
    }

    if (actionSucceeded) {
        console.log("\n🎉 The post is ready with AI-generated text and Images!");
    }

    await askQuestion("Press ENTER to close the browser (or click Post manually)...");
    
    // Cleanup Temp Dir
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log("🧹 Closing browser...");
    await browser.close();
    rl.close();
}

run();
