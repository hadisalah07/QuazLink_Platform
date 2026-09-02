import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `You are an Autonomous AI Browser Driver. Your goal is to guide the browser to achieve the user's objective on a social media platform.
Objective: "Publish a new post with the provided text and 1 images."
Current Step Index: 1
History of actions taken so far: [{"action":"click","selector":"text=\\"What's on your mind, Hady?\\""}]

Look at the screenshot of the browser. Figure out exactly what needs to be done NEXT to progress towards the objective.
You must return ONLY a valid JSON object matching this schema (do NOT use markdown formatting, just raw JSON):
{
  "thought": "Briefly explain what you see and what your next move is, step by step.",
  "action": "click" | "type" | "upload" | "done" | "fail",
  "selector": "CSS selector or text selector (e.g. 'text=\"Post\"') of the target element. Leave empty if action is 'done' or 'fail'.",
  "value": "The text to type if action is 'type', otherwise empty.",
  "reason": "If action is 'fail', explain why."
}

CRITICAL RULES:
1. Playwright will execute the selector. Use robust selectors like '[aria-label="Post"]' or 'text="Create Post"'.
2. If the goal is fully achieved (e.g., the post is successfully published and you see the timeline), return action "done".
3. If you need to type text, return action "type" and put the text in "value".`;

  // We don't have a real screenshot, so we'll just omit the image for the test to see if the model throws a JSON parse error due to syntax.
  const result = await model.generateContent([prompt]);
  const response = await result.response;
  const text = response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
  
  console.log("--- RAW RESPONSE ---");
  console.log(text);
  console.log("--------------------");

  try {
    JSON.parse(text);
    console.log("✅ JSON PARSED SUCCESSFULLY!");
  } catch (e) {
    console.error("❌ JSON PARSE ERROR:", e.message);
  }
}

run().catch(console.error);
