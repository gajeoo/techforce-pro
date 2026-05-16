import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_ORIGINS = [
  "https://techforce-pro.vercel.app",
  "https://techforce-pro-gajeoos-projects.vercel.app",
];

const SYSTEM_PROMPT = `You are TechForce AI — an intelligent assistant for Multicorp Fire Protection Services, a commercial fire protection company based in Columbia, MD.

You help with:
- Scheduling and managing appointments (meetings, site visits, calls)
- Creating jobs and work orders for customers at specific locations
- Answering questions about the business, employees, customers, and jobs
- Generating service estimates and quotes
- Looking up customer, employee, and job information

Company info:
- Name: Multicorp Fire Protection Services
- Address: 9693 Gerwig Lane, Columbia MD 21046
- Phone: (410) 876-5000
- Services: Sprinkler inspection, Suppression inspection, Extinguisher inspection, Fire alarm inspection

Be concise, professional, and proactive. If you are missing information to complete a task, ask for just what you need.`;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  const origin = req.headers["origin"] ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method Not Allowed");
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    "unknown";

  if (!checkRateLimit(ip)) {
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Too many requests. Please wait a moment." }));
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.write(`data: ${JSON.stringify({ error: "AI service not configured." })}\n\n`);
    res.end();
    return;
  }

  try {
    const body = req.body as { messages?: Array<{ role: string; content: string }> } | undefined;
    const userMessages = (body?.messages ?? [])
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content).slice(0, 4000),
      }));

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1024,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...userMessages],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI ${openaiRes.status}: ${errText}`);
    }

    const data = (await openaiRes.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = data.choices[0]?.message?.content ?? "";

    const words = content.split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch {
    res.write(`data: ${JSON.stringify({ error: "AI assistant error. Please try again." })}\n\n`);
    res.end();
  }
}
