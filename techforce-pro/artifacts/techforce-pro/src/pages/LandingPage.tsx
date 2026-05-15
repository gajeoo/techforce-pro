import { useState } from "react";
import {
  AlertTriangle, ArrowRight, CalendarDays, Check, DollarSign, Edit3,
  Flame, Shield, TrendingUp, Users, X, Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const HERO_IMG =
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1600&q=80";

const STORAGE_KEY = "tfpro_landing_content";
const FEATURE_ICONS = [CalendarDays, DollarSign, AlertTriangle, Users, TrendingUp, Shield];

type Content = {
  heroLine1: string;
  heroLine2: string;
  heroSub: string;
  ctaBtn: string;
  stats: { value: string; label: string }[];
  features: { title: string; desc: string }[];
  ctaTitle: string;
  ctaSub: string;
};

const DEFAULT: Content = {
  heroLine1: "Turn Shop Days Into",
  heroLine2: "Billable Revenue",
  heroSub:
    "TechForce Pro gives dispatchers, supervisors, and owners real-time visibility into tech utilization, profit per employee, and scheduling gaps — so every day counts.",
  ctaBtn: "Start Demo",
  stats: [
    { value: "6", label: "Active Technicians" },
    { value: "180+", label: "Service Locations" },
    { value: "89%", label: "Team Utilization" },
    { value: "$582K", label: "Revenue YTD" },
  ],
  features: [
    { title: "AI-Powered Scheduling", desc: "Auto-assign the right tech to the right job based on certs, proximity, and profit potential." },
    { title: "Profit-Per-Tech Tracking", desc: "See real-time ROI for every technician: revenue, shop day costs, and utilization rates." },
    { title: "Profit Leak Alerts", desc: "Automatic warnings when shop days exceed thresholds or utilization drops below targets." },
    { title: "Cert-Based Workforce", desc: "Manage suppression, sprinkler, extinguisher, and exit light certifications per tech." },
    { title: "Customer Pricing Engine", desc: "Per-customer, per-service pricing that auto-populates on every invoice." },
    { title: "Compliance Tracking", desc: "Service history ensures every location stays up to code with zero missed inspections." },
  ],
  ctaTitle: "Ready to Maximize Your Crew's Output?",
  ctaSub: "Stop losing revenue to unnecessary shop days. See exactly where your money goes.",
};

function loadContent(): Content {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return { ...DEFAULT, ...(JSON.parse(s) as Partial<Content>) };
  } catch {}
  return DEFAULT;
}

function saveContent(c: Content) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

type Field = string | null;

function EditInput({
  value, onSave, onCancel, multiline = false, className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  multiline?: boolean;
  className?: string;
}) {
  const [v, setV] = useState(value);
  if (multiline) {
    return (
      <div>
        <textarea
          autoFocus
          rows={3}
          value={v}
          onChange={e => setV(e.target.value)}
          className={`${className} w-full border border-primary rounded px-2 py-1 bg-background resize-none focus:outline-none`}
        />
        <div className="flex gap-1.5 mt-1.5">
          <button onClick={() => onSave(v)} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white rounded text-xs font-medium">
            <Check className="size-3" /> Save
          </button>
          <button onClick={onCancel} className="flex items-center gap-1 px-2 py-0.5 bg-muted border rounded text-xs">
            <X className="size-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onSave(v); if (e.key === "Escape") onCancel(); }}
        className={`${className} border border-primary rounded px-2 py-0.5 bg-background focus:outline-none min-w-[120px]`}
      />
      <button onClick={() => onSave(v)} className="p-1 bg-emerald-600 text-white rounded"><Check className="size-3" /></button>
      <button onClick={onCancel} className="p-1 bg-muted border rounded"><X className="size-3" /></button>
    </span>
  );
}

function Editable({
  field, text, editing, isManager, onStartEdit, onSave, onCancel,
  multiline = false, className = "", wrapperClassName = "",
}: {
  field: string;
  text: string;
  editing: Field;
  isManager: boolean;
  onStartEdit: (f: string, v: string) => void;
  onSave: (f: string, v: string) => void;
  onCancel: () => void;
  multiline?: boolean;
  className?: string;
  wrapperClassName?: string;
}) {
  if (editing === field) {
    return (
      <EditInput
        value={text}
        onSave={v => onSave(field, v)}
        onCancel={onCancel}
        multiline={multiline}
        className={className}
      />
    );
  }
  return (
    <span
      onClick={() => isManager && onStartEdit(field, text)}
      className={`${wrapperClassName} ${isManager ? "cursor-pointer group/edit relative hover:outline hover:outline-1 hover:outline-primary/30 hover:outline-offset-2 rounded" : ""}`}
    >
      <span className={className}>{text}</span>
      {isManager && (
        <Edit3 className="size-3 text-primary opacity-0 group-hover/edit:opacity-60 absolute -top-0.5 -right-4 pointer-events-none" />
      )}
    </span>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const isManager = user?.role === "manager";
  const [content, setContent] = useState<Content>(loadContent);
  const [editing, setEditing] = useState<Field>(null);
  const [heroErr, setHeroErr] = useState(false);

  function startEdit(field: string, _val: string) {
    setEditing(field);
  }

  function handleSave(field: string, val: string) {
    const parts = field.split(".");
    const next = { ...content };
    if (parts[0] === "stats" && parts.length === 3) {
      const i = Number(parts[1]);
      const k = parts[2] as "value" | "label";
      next.stats = next.stats.map((s, j) => (j === i ? { ...s, [k]: val } : s));
    } else if (parts[0] === "features" && parts.length === 3) {
      const i = Number(parts[1]);
      const k = parts[2] as "title" | "desc";
      next.features = next.features.map((f, j) => (j === i ? { ...f, [k]: val } : f));
    } else {
      (next as unknown as Record<string, string>)[field] = val;
    }
    setContent(next);
    saveContent(next);
    setEditing(null);
  }

  function handleCancel() {
    setEditing(null);
  }

  const ep = { editing, isManager, onStartEdit: startEdit, onSave: handleSave, onCancel: handleCancel };

  return (
    <div className="bg-background">
      {/* Hero — split layout with kitchen suppression image */}
      <section className="border-b overflow-hidden">
        <div className="container grid lg:grid-cols-2 min-h-[480px] md:min-h-[520px]">
          {/* Left: text */}
          <div className="flex flex-col justify-center py-16 md:py-20 lg:pr-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold rounded-full px-4 py-1.5 mb-6 w-fit">
              <Zap className="size-3.5" /> Built for Multicorp Fire Protection Services
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              <Editable field="heroLine1" text={content.heroLine1} {...ep} className="text-4xl md:text-5xl lg:text-6xl font-extrabold" />
              <br />
              <Editable field="heroLine2" text={content.heroLine2} {...ep} className="text-primary text-4xl md:text-5xl lg:text-6xl font-extrabold" />
            </h1>
            <div className="mt-6">
              <Editable field="heroSub" text={content.heroSub} {...ep} multiline className="text-lg text-muted-foreground" wrapperClassName="block max-w-xl" />
            </div>
            <div className="flex flex-col sm:flex-row items-start gap-3 mt-8">
              <Button size="lg" className="gap-2" asChild>
                <Link to="/signup">
                  <Editable field="ctaBtn" text={content.ctaBtn} {...ep} className="font-semibold" />
                  <ArrowRight className="size-4 ml-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
            </div>
          </div>

          {/* Right: kitchen suppression hero image */}
          <div className="relative hidden lg:block">
            {!heroErr ? (
              <img
                src={HERO_IMG}
                alt="Kitchen fire suppression system"
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setHeroErr(true)}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-orange-900/20 to-red-900/30 flex items-center justify-center">
                <Flame className="size-32 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 right-5 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 text-white">
              <div className="text-sm font-bold text-orange-300">Kitchen Suppression Systems</div>
              <div className="text-[11px] text-white/60 mt-0.5">Commercial fire protection specialists</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-muted/30 border-b">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {content.stats.map((stat, i) => (
              <div key={i}>
                <div className="text-3xl md:text-4xl font-extrabold text-primary">
                  <Editable field={`stats.${i}.value`} text={stat.value} {...ep} className="text-3xl md:text-4xl font-extrabold text-primary" />
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  <Editable field={`stats.${i}.label`} text={stat.label} {...ep} className="text-sm text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold">Everything You Need to Run a Profitable Fire Protection Business</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Purpose-built for fire protection — not a generic field service tool.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i] ?? Shield;
              return (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">
                      <Editable field={`features.${i}.title`} text={feature.title} {...ep} className="text-base font-semibold" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Editable field={`features.${i}.desc`} text={feature.desc} {...ep} multiline className="text-sm text-muted-foreground" wrapperClassName="block" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t bg-primary/5">
        <div className="container text-center max-w-2xl mx-auto">
          <Flame className="size-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            <Editable field="ctaTitle" text={content.ctaTitle} {...ep} className="text-2xl md:text-3xl font-bold" />
          </h2>
          <div className="text-muted-foreground mb-6">
            <Editable field="ctaSub" text={content.ctaSub} {...ep} className="text-base text-muted-foreground" wrapperClassName="block" />
          </div>
          <Button size="lg" className="gap-2" asChild>
            <Link to="/signup">
              Start Using TechForce Pro <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-primary" />
            <span>© 2026 Multicorp Fire Protection Services</span>
          </div>
          <span>9693 Gerwig Lane, Columbia, MD 21046 · (410) 876-5000</span>
        </div>
      </footer>
    </div>
  );
}
