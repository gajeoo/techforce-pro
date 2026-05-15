import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, User, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  isAdmin: boolean;
}

const STORAGE_KEY = "tfpro_chat_messages";

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch { return []; }
}

function saveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

type Conversation = {
  senderId: string;
  senderName: string;
  senderRole: string;
  messages: ChatMessage[];
  lastMessage: ChatMessage;
  unread: number;
};

function groupByConversation(messages: ChatMessage[]): Conversation[] {
  const map = new Map<string, ChatMessage[]>();
  for (const msg of messages) {
    const key = msg.isAdmin ? "admin" : msg.senderId;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  }
  const convos: Conversation[] = [];
  map.forEach((msgs, key) => {
    if (key === "admin") return;
    const userMsgs = messages.filter(m => m.senderId === key || (m.isAdmin));
    const lastMsg = [...userMsgs].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
    const unread = userMsgs.filter(m => !m.isAdmin).length;
    convos.push({
      senderId: key,
      senderName: msgs[0].senderName,
      senderRole: msgs[0].senderRole,
      messages: userMsgs,
      lastMessage: lastMsg,
      unread,
    });
  });
  return convos.sort((a, b) => b.lastMessage.timestamp.localeCompare(a.lastMessage.timestamp));
}

const ROLE_COLORS: Record<string, string> = {
  technician: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  supervisor: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  customer: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function EnquiriesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const all = loadMessages();
    setMessages(all);
    if (all.length > 0 && !selectedId) {
      const convos = groupByConversation(all);
      if (convos.length > 0) setSelectedId(convos[0].senderId);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId, messages]);

  const conversations = groupByConversation(messages);
  const selectedConvo = conversations.find(c => c.senderId === selectedId);

  function sendReply() {
    if (!reply.trim() || !user || !selectedId) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: reply.trim(),
      timestamp: new Date().toISOString(),
      isAdmin: true,
    };
    const updated = [...messages, msg];
    saveMessages(updated);
    setMessages(updated);
    setReply("");
  }

  function clearAll() {
    saveMessages([]);
    setMessages([]);
    setSelectedId(null);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="size-6 text-primary shrink-0" />
            Enquiries
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Messages from technicians, supervisors, and customers
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
            Clear All
          </Button>
        )}
      </div>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <MessageSquare className="size-12 text-muted-foreground mx-auto mb-4" />
            <div className="font-semibold text-foreground">No enquiries yet</div>
            <p className="text-sm text-muted-foreground mt-1">
              Messages from your team and customers will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 500 }}>
          {/* Conversation list */}
          <div className="md:col-span-1 space-y-2">
            {conversations.map(conv => (
              <button
                key={conv.senderId}
                onClick={() => setSelectedId(conv.senderId)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${selectedId === conv.senderId ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50 bg-card"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                    {conv.senderName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm truncate">{conv.senderName}</span>
                      <Badge variant="secondary" className={`text-[10px] shrink-0 ${ROLE_COLORS[conv.senderRole] ?? ""}`}>
                        {conv.senderRole}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage.text}</div>
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Chat window */}
          <Card className="md:col-span-2 flex flex-col overflow-hidden" style={{ maxHeight: 560 }}>
            {selectedConvo ? (
              <>
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {selectedConvo.senderName.charAt(0)}
                    </div>
                    <div>
                      <CardTitle className="text-base">{selectedConvo.senderName}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">{selectedConvo.senderRole} · {selectedConvo.messages.filter(m => !m.isAdmin).length} message{selectedConvo.messages.filter(m => !m.isAdmin).length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                  {selectedConvo.messages.map(msg => {
                    const isAdmin = msg.isAdmin;
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                          {!isAdmin && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <User className="size-3 opacity-60" />
                              <span className="text-[10px] font-medium opacity-70">{msg.senderName}</span>
                            </div>
                          )}
                          <div>{msg.text}</div>
                          <div className="flex items-center gap-1 mt-1 opacity-60">
                            <Clock className="size-2.5" />
                            <span className="text-[10px]">
                              {new Date(msg.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </CardContent>
                <div className="p-3 border-t flex gap-2">
                  <Input
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendReply()}
                    placeholder="Reply as Admin…"
                    className="text-sm"
                  />
                  <Button onClick={sendReply} disabled={!reply.trim()} className="shrink-0">
                    <Send className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center text-center">
                <div>
                  <MessageSquare className="size-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Select a conversation</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
