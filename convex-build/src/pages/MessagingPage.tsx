import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Bot, Send, Plus, MessageSquare, Loader2, User, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { toast } from "sonner";

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ role, content, ts }: { role: string; content: string; ts?: number }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3 max-w-[85%]", isUser ? "ml-auto flex-row-reverse" : "")}>
      <div className={cn(
        "flex-shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-bold mt-1",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted border"
      )}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn(
        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-muted text-foreground rounded-bl-sm border"
      )}>
        <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>
        {ts && <p className={cn("text-[10px] mt-1 opacity-60", isUser ? "text-right" : "")}>{formatTime(ts)}</p>}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: any[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col h-full border-r bg-muted/20">
      <div className="p-3 border-b">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 text-sm font-medium rounded-lg px-3 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-4" /> New Conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8 px-4">
            No conversations yet. Start one above!
          </p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv._id}
            onClick={() => onSelect(conv._id)}
            className={cn(
              "w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors",
              activeId === conv._id ? "bg-muted border-r-2 border-primary font-medium" : ""
            )}
          >
            <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{conv.title || "New conversation"}</span>
            <ChevronRight className="size-3 text-muted-foreground ml-auto shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessagingPage() {
  const [activeConvId, setActiveConvId] = useState<Id<"conversations"> | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const conversations = useQuery(api.ai.listConversations) ?? [];
  const messages = useQuery(api.ai.getMessages, activeConvId ? { conversationId: activeConvId } : "skip") ?? [];
  const createConversation = useMutation(api.ai.createConversation);
  const sendMessage = useAction(api.ai.chat);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleNewConversation() {
    const id = await createConversation({ title: "New conversation" });
    setActiveConvId(id as Id<"conversations">);
    setInput("");
  }

  async function handleSend() {
    if (!input.trim() || !activeConvId || sending) return;
    const userText = input.trim();
    setInput("");
    setSending(true);
    try {
      await sendMessage({ conversationId: activeConvId, userMessage: userText });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI error — please try again");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={(id) => setActiveConvId(id as Id<"conversations">)}
          onNew={handleNewConversation}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b bg-background/80 backdrop-blur flex items-center gap-3">
          <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">TechForce AI</h2>
            <p className="text-[11px] text-muted-foreground">
              AI assistant for Multicorp Fire Protection Services
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!activeConvId && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="size-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">TechForce AI Assistant</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  I can schedule appointments, create jobs, look up customers, and answer questions about Multicorp's operations.
                </p>
              </div>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="size-4" /> Start a conversation
              </button>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md text-left mt-2">
                {[
                  "Schedule a site visit for Harbor View next Monday at 9am",
                  "Create an extinguisher inspection job for Riverside School",
                  "Who are our active technicians?",
                  "List all pending jobs this week",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={async () => {
                      if (!activeConvId) {
                        const id = await createConversation({ title: prompt.slice(0, 40) });
                        setActiveConvId(id as Id<"conversations">);
                        setSending(true);
                        try {
                          await sendMessage({ conversationId: id as Id<"conversations">, userMessage: prompt });
                        } catch { toast.error("AI error"); }
                        finally { setSending(false); }
                      }
                    }}
                    className="text-left text-xs rounded-lg border bg-muted/30 hover:bg-muted/60 px-3 py-2 transition-colors leading-relaxed"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConvId && messages.length === 0 && !sending && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Send a message to get started</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg._id}
              role={msg.role}
              content={msg.content}
              ts={msg._creationTime}
            />
          ))}

          {sending && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="size-8 rounded-full bg-muted border flex items-center justify-center shrink-0 mt-1">
                <Bot className="size-4" />
              </div>
              <div className="bg-muted border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        {activeConvId && (
          <div className="px-5 py-3 border-t bg-background">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                disabled={sending}
                placeholder="Ask TechForce AI anything… (Enter to send, Shift+Enter for new line)"
                className="flex-1 resize-none rounded-xl border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 max-h-[120px] overflow-y-auto"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
