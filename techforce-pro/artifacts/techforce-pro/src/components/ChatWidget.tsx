import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, ChevronDown, Paperclip, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { getEmployees, type ApiEmployee } from "@/lib/api";

interface ChatAttachment {
  name: string;
  size: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachments?: ChatAttachment[];
  timestamp: string;
  isAdmin: boolean;
  recipientId?: string;
}

const STORAGE_KEY = "tfpro_chat_messages";

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [staff, setStaff] = useState<ApiEmployee[]>([]);
  const [recipientId, setRecipientId] = useState<string>("");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const isManager = user?.role === "manager";

  useEffect(() => {
    if (!isManager) {
      getEmployees().then(emps => {
        // Customers see both admin (manager) and suppression_lead (supervisor)
        const mgmt = emps.filter(e => e.role === "admin" || e.role === "suppression_lead");
        setStaff(mgmt);
        if (mgmt.length > 0 && !recipientId) setRecipientId(String(mgmt[0].id));
      });
    }
  }, [isManager]);

  useEffect(() => {
    const all = loadMessages();
    if (isManager) {
      setMessages(all);
    } else {
      setMessages(all.filter(m => m.senderId === user?.id || m.isAdmin));
    }
  }, [open, isManager, user?.id]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [open, messages]);

  useEffect(() => {
    const interval = setInterval(() => {
      const all = loadMessages();
      const mine = isManager ? all : all.filter(m => m.senderId === user?.id || m.isAdmin);
      setMessages(mine);
      if (!open) {
        const newAdminReplies = all.filter(m => m.isAdmin && m.senderId !== user?.id).length;
        setUnread(prev => newAdminReplies > prev ? newAdminReplies : prev);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [open, isManager, user?.id]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const atts: ChatAttachment[] = files.map(f => ({ name: f.name, size: formatFileSize(f.size) }));
    setPendingAttachments(prev => [...prev, ...atts]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function send() {
    if ((!input.trim() && pendingAttachments.length === 0) || !user) return;
    const recipient = staff.find(e => String(e.id) === recipientId);
    const msg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      text: input.trim(),
      attachments: pendingAttachments.length > 0 ? [...pendingAttachments] : undefined,
      timestamp: new Date().toISOString(),
      isAdmin: isManager,
      recipientId: recipient ? String(recipient.id) : undefined,
    };
    const all = loadMessages();
    const updated = [...all, msg];
    saveMessages(updated);
    const mine = isManager ? updated : updated.filter(m => m.senderId === user.id || m.isAdmin);
    setMessages(mine);
    setInput("");
    setPendingAttachments([]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  if (!user) return null;

  const selectedStaff = staff.find(e => String(e.id) === recipientId);
  const getStaffLabel = (emp: ApiEmployee) =>
    emp.role === "admin" ? "Manager" : emp.role === "suppression_lead" ? "Supervisor" : emp.role;

  const recipientLabel = selectedStaff
    ? `${selectedStaff.name} (${getStaffLabel(selectedStaff)})`
    : "Multicorp Office";

  const filteredStaff = recipientSearch.trim()
    ? staff.filter(e =>
        e.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
        getStaffLabel(e).toLowerCase().includes(recipientSearch.toLowerCase())
      )
    : staff;

  return (
    <>
      <div ref={containerRef} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {open && (
          <div className="w-80 bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-2" style={{ maxHeight: 500 }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground shrink-0">
              <div>
                <div className="font-semibold text-sm">
                  {isManager ? "Enquiries — All Conversations" : "Message Admin"}
                </div>
                <div className="text-xs text-primary-foreground/70">
                  {isManager ? "Responding as Admin" : "Multicorp Fire Protection"}
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="hover:bg-primary-foreground/20 rounded p-1 transition-colors">
                <ChevronDown className="size-4" />
              </button>
            </div>

            {/* Recipient selector for non-managers */}
            {!isManager && staff.length > 0 && (
              <div className="px-3 py-2 border-b border-border bg-muted/30 shrink-0">
                <div className="relative">
                  {!recipientOpen ? (
                    <button
                      onClick={() => {
                        setRecipientOpen(true);
                        setRecipientSearch("");
                        setTimeout(() => searchRef.current?.focus(), 50);
                      }}
                      className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded border border-border bg-background hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-muted-foreground mr-1">To:</span>
                      <span className="font-medium flex-1 text-left truncate">{recipientLabel}</span>
                      <Search className="size-3 text-muted-foreground" />
                    </button>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-2 top-1.5 size-3 text-muted-foreground" />
                      <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search by name or role…"
                        value={recipientSearch}
                        onChange={e => setRecipientSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Escape") { setRecipientOpen(false); setRecipientSearch(""); }
                          if (e.key === "Enter" && filteredStaff.length === 1) {
                            setRecipientId(String(filteredStaff[0].id));
                            setRecipientOpen(false);
                            setRecipientSearch("");
                          }
                        }}
                        className="w-full text-xs pl-6 pr-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}
                  {recipientOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden max-h-40 overflow-y-auto">
                      {filteredStaff.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground text-center">No staff found</div>
                      ) : (
                        filteredStaff.map(emp => (
                          <button
                            key={emp.id}
                            onClick={() => { setRecipientId(String(emp.id)); setRecipientOpen(false); setRecipientSearch(""); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left ${String(emp.id) === recipientId ? "bg-primary/10 font-semibold" : ""}`}
                          >
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                              {emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium">{emp.name}</div>
                              <div className="text-muted-foreground text-[10px]">{getStaffLabel(emp)}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  {isManager ? "No messages yet." : "Send a message — we typically respond within the hour."}
                </div>
              )}
              {messages.map(msg => {
                const isMine = (!isManager && msg.senderId === user.id && !msg.isAdmin) || (isManager && msg.isAdmin);
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${isMine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {isManager && !msg.isAdmin && (
                        <div className="font-semibold text-[10px] mb-0.5 opacity-70">{msg.senderName} ({msg.senderRole})</div>
                      )}
                      {msg.text && <div>{msg.text}</div>}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`mt-1 space-y-1 ${msg.text ? "pt-1 border-t border-current/20" : ""}`}>
                          {msg.attachments.map((att, i) => (
                            <div key={i} className="flex items-center gap-1.5 opacity-90">
                              <Paperclip className="size-2.5 shrink-0" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <span className="opacity-60 text-[9px]">{att.size}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Pending attachments preview */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 py-1.5 border-t border-border bg-muted/20 space-y-1 shrink-0">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <Paperclip className="size-3 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-muted-foreground">{att.name}</span>
                    <span className="text-[10px] text-muted-foreground">{att.size}</span>
                    <button onClick={() => setPendingAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border flex gap-2 shrink-0">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && send()}
                placeholder={isManager ? "Reply to enquiry…" : "Type a message…"}
                className="text-xs h-8"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-8 w-8 flex items-center justify-center rounded border border-border bg-background hover:bg-muted/50 transition-colors shrink-0"
                title="Attach file"
              >
                <Paperclip className="size-3.5 text-muted-foreground" />
              </button>
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} />
              <Button size="sm" onClick={send} disabled={!input.trim() && pendingAttachments.length === 0} className="h-8 px-3 shrink-0">
                <Send className="size-3" />
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => setOpen(v => !v)}
          className="rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all relative"
          style={{ width: 52, height: 52 }}
        >
          {open ? <X className="size-5" /> : <MessageSquare className="size-5" />}
          {!open && unread > 0 && (
            <Badge className="absolute -top-1 -right-1 size-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-destructive text-destructive-foreground">
              {unread}
            </Badge>
          )}
        </button>
      </div>
    </>
  );
}
