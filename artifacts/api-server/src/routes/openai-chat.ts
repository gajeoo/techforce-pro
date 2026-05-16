import { Router } from "express";
import { m, q, asId } from "../lib/convex-utils";

const router = Router();

router.get("/openai/conversations", async (req, res) => {
  try {
    return res.json(await q("ai:listConversations"));
  } catch (err) {
    req.log.error(err, "Failed to list conversations");
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const title = String(req.body?.title ?? "New Conversation");
    const id = await m("ai:createConversation", { title });
    return res.status(201).json({ _id: id, title });
  } catch (err) {
    req.log.error(err, "Failed to create conversation");
    return res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  try {
    return res.json(await q("ai:getMessages", { conversationId: asId(req.params.id) }));
  } catch (err) {
    req.log.error(err, "Failed to list messages");
    return res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const conversationId = asId(req.params.id);
  const content = String(req.body?.content ?? "").trim();
  if (!content) return res.status(400).json({ error: "content is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const reply = await m<string>("ai:chat", { conversationId, userMessage: content });
    const words = String(reply ?? "").split(" ");
    for (let i = 0; i < words.length; i++) {
      const chunk = (i === 0 ? "" : " ") + words[i];
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  } catch (err) {
    req.log.error(err, "OpenAI chat error");
    res.write(`data: ${JSON.stringify({ error: "AI assistant error. Please try again." })}\n\n`);
    return res.end();
  }
});

export default router;
