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
  const [convId, setConvId] = useState<number | null>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !convId) {
      initConversation();
    }
  }, [open]);

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

  async function initConversation() {
    try {
      const r = await fetch(`${API}/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `TechForce AI Session — ${new Date().toLocaleString()}` }),
      });
      if (r.ok) {
        const conv = await r.json();
        setConvId(conv.id);
      }
    } catch { /* silent */ }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    // If no convId yet, try to create one first
    let activeConvId = convId;
    if (!activeConvId) {
      try {
        const r = await fetch(`${API}/openai/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: `TechForce AI Session — ${new Date().toLocaleString()}` }),
        });
        if (r.ok) {
          const conv = await r.json();
          activeConvId = conv.id;
          setConvId(conv.id);
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: "Unable to connect to AI. Please try again.", id: crypto.randomUUID() }]);
          return;
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", content: "Unable to connect to AI. Please try again.", id: crypto.randomUUID() }]);
        return;
      }
    }

    const userMsg: Message = { role: "user", content: text.trim(), id: crypto.randomUUID() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setStreamingContent("");
    setShowQuickPrompts(false);

    try {
      const res = await fetch(`${API}/openai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });

      if (!res.body) throw new Error("No body");

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
    setConvId(null);
    setShowQuickPrompts(true);
    initConversation();
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
          {!minimized && (
            <button onClick={resetConversation} title="New conversation" className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
              <RotateCcw className="size-3.5" />
            </button>
          )}
          <button onClick={() => setMinimized(m => !m)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
            {minimized ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-0">
            {messages.length === 0 && !loading && (
              <div className="text-center py-4">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="size-7 text-primary" />
                </div>
                <p className="font-semibold text-sm text-foreground">Hi! I'm TechForce AI</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">
                  I know your customers, their locations, jobs, schedules, and more. Ask me anything or give me a command.
                </p>
              </div>
            )}

            {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}

            {loading && streamingContent === "" && (
              <div className="flex justify-start mb-3">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}

            {streamingContent && (
              <div className="flex justify-start mb-3">
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-0.5">
                  <Bot className="size-4 text-primary" />
                </div>
                <div className="max-w-[85%] bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                  {streamingContent}
                  <span className="inline-block w-0.5 h-3.5 bg-foreground/60 ml-0.5 animate-pulse rounded" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts */}
          {showQuickPrompts && messages.length === 0 && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-center gap-1 mb-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                <Sparkles className="size-3" /> Quick Actions
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors text-left leading-tight"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex gap-2 items-end shrink-0">
            <Input
              ref={inputRef}
              placeholder="Ask about customers, locations, jobs…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              disabled={loading}
              className="text-sm flex-1 rounded-xl border-border focus-visible:ring-primary/40"
            />
            <Button
              size="icon"
              className="size-9 rounded-xl shrink-0"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              <Send className="size-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
