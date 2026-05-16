import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API = "/api";

const QUICK_PROMPTS = [
  "What locations does Lincoln Elementary have?",
  "Show all pending jobs by customer",
  "Create a job at Harbor Condos Main Location",
  "Which techs are available today?",
  "Schedule an extinguisher inspection",
  "What's our revenue this week?",
  "Show me high-priority overdue jobs",
  "List all customer locations",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1 px-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
        />
      ))}
    </div>
  );
}

function MsgBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-0.5">
          <Bot className="size-4 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
          ${isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-muted rounded-tl-sm"
          }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text.trim(), id: crypto.randomUUID() };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setShowQuickPrompts(false);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              accumulated += data.content;
              setStreamingContent(accumulated);
            }
            if (data.done) {
              setMessages(prev => [...prev, { role: "assistant", content: accumulated, id: crypto.randomUUID() }]);
              setStreamingContent("");
            }
            if (data.error) {
              setMessages(prev => [...prev, { role: "assistant", content: data.error, id: crypto.randomUUID() }]);
              setStreamingContent("");
            }
          } catch { /* skip bad json */ }
        }
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again.", id: crypto.randomUUID() }]);
      setStreamingContent("");
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setStreamingContent("");
    setShowQuickPrompts(true);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
        title="Open AI Assistant"
      >
        <Sparkles className="size-6" />
        <span className="absolute -top-1 -right-1 size-4 bg-emerald-500 rounded-full border-2 border-background animate-pulse" />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-5 right-5 z-50 flex flex-col bg-card border border-border rounded-2xl shadow-2xl transition-all duration-200
        ${minimized ? "w-72 h-14" : "w-[380px] sm:w-[420px]"}
      `}
      style={minimized ? undefined : { maxHeight: "min(600px, calc(100vh - 80px))" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <Bot className="size-4" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight">TechForce AI</div>
            {!minimized && <div className="text-[10px] opacity-75">Customer · Location · Scheduling</div>}
          </div>
          <Badge className="bg-emerald-500 text-[9px] px-1.5 py-0.5 ml-1">LIVE</Badge>
        </div>
        <div className="flex items-center gap-1">
          {!minimized && messages.length > 0 && (
            <button
              onClick={resetConversation}
              className="p-1.5 rounded-lg hover:bg-primary-foreground/10 transition-colors"
              title="New conversation"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          <button
            onClick={() => setMinimized(v => !v)}
            className="p-1.5 rounded-lg hover:bg-primary-foreground/10 transition-colors"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-primary-foreground/10 transition-colors"
            title="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            {messages.length === 0 && showQuickPrompts && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 mb-4">
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center mr-1 shrink-0 mt-0.5">
                    <Bot className="size-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                    Hi! I'm TechForce AI. I can help with scheduling, jobs, customers, and more. What would you like to do?
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1">Quick prompts</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {QUICK_PROMPTS.map(p => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="text-left text-xs px-3 py-2 rounded-xl border border-border hover:bg-muted hover:border-primary/30 transition-colors text-foreground/80 hover:text-foreground"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}

            {loading && (
              <div className="flex justify-start mb-3">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                  <Bot className="size-4 text-primary" />
                </div>
                {streamingContent ? (
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed bg-muted whitespace-pre-wrap">
                    {streamingContent}
                  </div>
                ) : (
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <TypingDots />
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t shrink-0">
            <div className="flex gap-2 items-center">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Ask anything…"
                className="flex-1 text-sm h-9 rounded-xl"
                disabled={loading}
              />
              <Button
                size="sm"
                className="h-9 w-9 p-0 rounded-xl shrink-0"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                <Send className="size-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              TechForce AI · Powered by GPT-4o
            </p>
          </div>
        </>
      )}
    </div>
  );
}
