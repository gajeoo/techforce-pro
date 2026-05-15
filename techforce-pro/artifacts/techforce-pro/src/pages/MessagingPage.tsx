import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteMessage,
  loadMessages,
  markAsRead,
  seedMessagesIfNeeded,
  sendMessage,
  type Attachment,
  type Message,
  type MessageRole,
} from "@/lib/messaging";
import {
  getEmployees,
  getCustomers,
  type ApiEmployee,
  type ApiCustomer,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────

type Recipient = { id: string; name: string; role: MessageRole; subtitle: string };

// ─── Role mapping ─────────────────────────────────────────────────────────

function empToMsgRole(emp: ApiEmployee): MessageRole {
  if (emp.role === "admin") return "manager";
  if (emp.role === "suppression_lead") return "supervisor";
  return "technician";
}

// ─── Recipient list builder ───────────────────────────────────────────────

function buildRecipients(
  userId: string,
  userRole: string,
  employees: ApiEmployee[],
  customers: ApiCustomer[],
): Recipient[] {
  const empList: Recipient[] = employees
    .filter(e => String(e.id) !== userId)
    .map(e => ({
      id: String(e.id),
      name: e.name,
      role: empToMsgRole(e),
      subtitle: e.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    }));

  const custList: Recipient[] = customers
    .filter(c => String(c.id) !== userId)
    .map(c => ({
      id: String(c.id),
      name: c.name,
      role: "customer" as MessageRole,
      subtitle: `${c.facilityType} · ${c.contactName}`,
    }));

  // Customers can only message manager and supervisor
  if (userRole === "customer") {
    return empList.filter(r => r.role === "manager" || r.role === "supervisor");
  }
  // Technicians can only message other employees — not customers
  if (userRole === "technician") {
    return empList;
  }
  return [...empList, ...custList];
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function roleBadgeColor(role: MessageRole) {
  if (role === "manager")    return "bg-primary/10 text-primary";
  if (role === "supervisor") return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (role === "technician") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

function roleLabel(role: MessageRole) {
  if (role === "manager")    return "Manager";
  if (role === "supervisor") return "Supervisor";
  if (role === "technician") return "Technician";
  return "Customer";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "Just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AttachIcon({ type }: { type: Attachment["type"] }) {
  if (type === "image") return <ImageIcon className="size-3.5 text-blue-500 shrink-0" />;
  if (type === "pdf")   return <FileText   className="size-3.5 text-red-500 shrink-0" />;
  return                       <Paperclip  className="size-3.5 text-muted-foreground shrink-0" />;
}

function inferAttachType(filename: string): Attachment["type"] {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "heic"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "document";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Searchable Recipient Picker ──────────────────────────────────────────

function RecipientPicker({
  recipients,
  value,
  onChange,
  userRole,
}: {
  recipients: Recipient[];
  value: string;
  onChange: (id: string) => void;
  userRole: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = recipients.find(r => r.id === value);

  const filtered = search.trim()
    ? recipients.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.subtitle.toLowerCase().includes(search.toLowerCase()) ||
        roleLabel(r.role).toLowerCase().includes(search.toLowerCase())
      )
    : recipients;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger / selected display */}
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-muted/30 transition-colors text-left"
        >
          {selected ? (
            <>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${roleBadgeColor(selected.role)}`}>
                {roleLabel(selected.role)}
              </span>
              <span className="font-medium flex-1 truncate">{selected.name}</span>
              <span className="text-muted-foreground text-xs truncate hidden sm:block">{selected.subtitle}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Select recipient…</span>
          )}
          <Search className="size-3.5 text-muted-foreground ml-auto shrink-0" />
        </button>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search by name or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 text-sm"
            onKeyDown={e => {
              if (e.key === "Escape") { setOpen(false); setSearch(""); }
              if (e.key === "Enter" && filtered.length === 1) handleSelect(filtered[0].id);
            }}
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">No recipients found</div>
          ) : (
            filtered.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted/50 transition-colors text-left ${r.id === value ? "bg-primary/10 font-semibold" : ""}`}
              >
                <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                  {r.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-muted-foreground text-[10px] truncate">{r.subtitle}</div>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0 ${roleBadgeColor(r.role)}`}>
                  {roleLabel(r.role)}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {userRole === "customer" && (
        <p className="text-[10px] text-muted-foreground mt-1">
          You can message the Manager or Supervisor directly.
        </p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function MessagingPage() {
  const { user } = useAuth();
  const userId   = user?.id   ?? "";
  const userRole = user?.role ?? "manager";
  const userName = user?.name ?? "User";

  const [tab, setTab]           = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const [apiEmployees, setApiEmployees] = useState<ApiEmployee[]>([]);
  const [apiCustomers, setApiCustomers] = useState<ApiCustomer[]>([]);

  // Compose state
  const [toId,        setToId]        = useState("");
  const [subject,     setSubject]      = useState("");
  const [body,        setBody]         = useState("");
  const [attachments, setAttachments]  = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inbox search
  const [inboxSearch, setInboxSearch] = useState("");

  useEffect(() => {
    seedMessagesIfNeeded();
    setMessages(loadMessages());
    Promise.all([getEmployees(), getCustomers()]).then(([emps, custs]) => {
      setApiEmployees(emps);
      setApiCustomers(custs);
    });
  }, []);

  const recipients = buildRecipients(userId, userRole, apiEmployees, apiCustomers);

  function refresh() { setMessages(loadMessages()); }

  const inbox  = messages.filter(m => m.toId   === userId && !m.deletedByRecipient);
  const sent   = messages.filter(m => m.fromId === userId && !m.deletedBySender);
  const unread = inbox.filter(m => !m.readByRecipient).length;

  const displayListRaw = tab === "inbox" ? inbox : sent;
  const displayList = inboxSearch.trim()
    ? displayListRaw.filter(m => {
        const q = inboxSearch.toLowerCase();
        return (
          m.subject.toLowerCase().includes(q) ||
          m.fromName.toLowerCase().includes(q) ||
          m.toName.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q)
        );
      })
    : displayListRaw;

  function canDelete(msg: Message): boolean {
    if (userRole === "manager" || userRole === "supervisor") return true;
    return msg.fromId === userId;
  }

  function openMessage(msg: Message) {
    if (msg.toId === userId && !msg.readByRecipient) { markAsRead(msg.id); }
    refresh();
    setSelected(msg);
  }

  function handleDelete(msg: Message) {
    if (!canDelete(msg)) return;
    deleteMessage(msg.id, userId);
    if (selected?.id === msg.id) setSelected(null);
    refresh();
  }

  function handleSend() {
    const r = recipients.find(r => r.id === toId);
    if (!r || !subject.trim() || !body.trim()) return;
    sendMessage({
      fromId: userId, fromName: userName, fromRole: userRole as MessageRole,
      toId: r.id, toName: r.name, toRole: r.role,
      subject: subject.trim(), body: body.trim(), attachments,
    });
    setToId(""); setSubject(""); setBody(""); setAttachments([]);
    setComposeOpen(false);
    setTab("sent");
    refresh();
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newAtts: Attachment[] = files.map(f => ({
      name: f.name,
      type: inferAttachType(f.name),
      size: formatFileSize(f.size),
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function closeCompose() { setComposeOpen(false); setAttachments([]); }

  const showDetail = !!selected;

  return (
    <div className="space-y-4 md:space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="size-6 text-primary shrink-0" />
            Messages
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Communicate with your team and clients</p>
        </div>
        <Button size="sm" className="gap-1.5 self-start sm:self-auto" onClick={() => setComposeOpen(true)}>
          <Plus className="size-3.5" /> Compose
        </Button>
      </div>

      {/* ── Two-panel layout ── */}
      <div className="grid gap-4 lg:grid-cols-5">

        {/* List panel */}
        <div className={`lg:col-span-2 space-y-3 ${showDetail ? "hidden lg:block" : "block"}`}>
          <div className="flex items-center gap-3">
            <Tabs value={tab} onValueChange={v => { setTab(v as "inbox" | "sent"); setSelected(null); }}>
              <TabsList className="h-8">
                <TabsTrigger value="inbox" className="text-xs gap-1.5 px-3">
                  <Inbox className="size-3.5" />
                  Inbox
                  {unread > 0 && (
                    <Badge className="text-[9px] h-4 min-w-4 px-1 bg-primary ml-1">{unread}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sent" className="text-xs gap-1.5 px-3">
                  <Send className="size-3.5" />
                  Sent ({sent.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Inbox search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search messages…"
              value={inboxSearch}
              onChange={e => setInboxSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {inboxSearch && (
              <button onClick={() => setInboxSearch("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {displayList.length === 0 ? (
                <div className="py-12 text-center">
                  <Mail className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {inboxSearch ? "No messages match your search." : tab === "inbox" ? "Your inbox is empty." : "No sent messages yet."}
                  </p>
                  {!inboxSearch && (
                    <Button variant="link" size="sm" className="mt-1 text-xs" onClick={() => setComposeOpen(true)}>
                      Compose a message →
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {displayList.map(msg => {
                    const isUnread   = msg.toId === userId && !msg.readByRecipient;
                    const isSelected = selected?.id === msg.id;
                    const counterpart = tab === "inbox" ? msg.fromName : msg.toName;
                    const counterRole = tab === "inbox" ? msg.fromRole : msg.toRole;
                    const deletable   = canDelete(msg);
                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors group
                          ${isSelected ? "bg-primary/5 lg:bg-primary/5" : ""}
                          ${isUnread   ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
                        onClick={() => openMessage(msg)}
                      >
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {counterpart.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs truncate ${isUnread ? "font-bold" : "font-medium"}`}>
                              {counterpart}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(msg.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor(counterRole)}`}>
                              {roleLabel(counterRole)}
                            </span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${isUnread ? "font-semibold" : "text-muted-foreground"}`}>
                            {msg.subject}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tab === "sent" && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Sent</span>
                            )}
                            {msg.attachments.length > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Paperclip className="size-2.5" />{msg.attachments.length}
                              </span>
                            )}
                            {isUnread && <div className="size-2 rounded-full bg-primary ml-auto" />}
                          </div>
                        </div>
                        {deletable && (
                          <button
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded shrink-0"
                            title="Delete"
                            onClick={e => { e.stopPropagation(); handleDelete(msg); }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        <div className={`lg:col-span-3 ${showDetail ? "block" : "hidden lg:flex lg:items-start"}`}>
          {selected ? (
            <div className="w-full space-y-3">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden gap-1.5 text-xs -ml-1"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft className="size-3.5" /> Back to messages
              </Button>

              <Card>
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base leading-snug break-words">{selected.subject}</CardTitle>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          From <strong>{selected.fromName}</strong>
                        </p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${roleBadgeColor(selected.fromRole)}`}>
                          {roleLabel(selected.fromRole)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">· {timeAgo(selected.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost" size="sm" className="h-8 gap-1.5 text-xs"
                        onClick={() => {
                          setToId(selected.fromId);
                          setSubject(`Re: ${selected.subject.startsWith("Re: ") ? selected.subject.slice(4) : selected.subject}`);
                          setBody(""); setComposeOpen(true);
                        }}
                      >
                        <Reply className="size-3.5" />
                        <span className="hidden sm:inline">Reply</span>
                      </Button>
                      {canDelete(selected) && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(selected)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</p>
                  {selected.attachments.length > 0 && (
                    <div className="border-t pt-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Attachments ({selected.attachments.length})</p>
                      {selected.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                          <AttachIcon type={att.type} />
                          <span className="text-xs flex-1 truncate">{att.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{att.size}</span>
                          <Button variant="outline" size="sm" className="text-[10px] h-6 px-2 gap-1 shrink-0">
                            <FileText className="size-3" /> View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="hidden lg:flex w-full h-48 items-center justify-center">
              <div className="text-center">
                <Mail className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Select a message to read it</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── Compose Dialog ── */}
      <Dialog open={composeOpen} onOpenChange={open => { if (!open) closeCompose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" /> New Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">To</Label>
              <RecipientPicker
                recipients={recipients}
                value={toId}
                onChange={setToId}
                userRole={userRole}
              />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input placeholder="Message subject…" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea placeholder="Write your message…" rows={4} value={body} onChange={e => setBody(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Attachments</Label>
              <div className="flex gap-2 mt-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip className="size-3" /> Choose Files
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleFileSelect} />
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                      <AttachIcon type={att.type} />
                      <span className="text-xs flex-1 truncate">{att.name}</span>
                      <span className="text-[10px] text-muted-foreground">{att.size}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeCompose}>Cancel</Button>
              <Button className="gap-1.5" disabled={!toId || !subject.trim() || !body.trim()} onClick={handleSend}>
                <Send className="size-3.5" /> Send Message
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
