import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Flame, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth, type Role } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvitePayload {
  role: Role;
  id: string;
  name: string;
  expires: number;
}

function encodeToken(payload: InvitePayload): string {
  const json = JSON.stringify(payload);
  // UTF-8 safe base64
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1: string) =>
    String.fromCharCode(parseInt(p1, 16))
  ));
}

function decodeToken(token: string): InvitePayload | null {
  try {
    const binary = atob(token);
    const decoded = decodeURIComponent(
      binary.split("").map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(decoded) as InvitePayload;
  } catch {
    return null;
  }
}

const ROLE_LABELS: Record<Role, string> = {
  manager: "Manager / Admin",
  supervisor: "Supervisor",
  technician: "Technician",
  customer: "Customer",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  manager: "Full access to all management features",
  supervisor: "Team scheduling and field oversight",
  technician: "Personal schedule and job management",
  customer: "Service history and upcoming visits",
};

const ROLE_REDIRECT: Record<Role, string> = {
  manager: "/dashboard",
  supervisor: "/supervisor",
  technician: "/tech-portal",
  customer: "/customer-portal",
};

const ROLE_COLORS: Record<Role, string> = {
  manager: "bg-primary",
  supervisor: "bg-blue-600",
  technician: "bg-emerald-600",
  customer: "bg-amber-600",
};

export function InvitePage() {
  const [params] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [payload, setPayload] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("No invitation token found in this link.");
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded) {
      setError("Invalid invitation link. Please request a new one.");
      return;
    }
    if (decoded.expires < Date.now()) {
      setError("This invitation link has expired. Please request a new one.");
      return;
    }
    setPayload(decoded);
  }, [params]);

  useEffect(() => {
    if (isAuthenticated && !entering) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, entering, navigate]);

  function handleEnter() {
    if (!payload) return;
    setEntering(true);
    login({ role: payload.role, name: payload.name, id: payload.id });
    setTimeout(() => {
      navigate(ROLE_REDIRECT[payload.role], { replace: true });
    }, 800);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto size-14 rounded-xl bg-primary flex items-center justify-center mb-4">
            <Flame className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">TechForce Pro</h1>
          <p className="text-muted-foreground text-sm mt-1">Multicorp Fire Protection Services</p>
        </div>

        {error ? (
          <Card className="border-destructive/50">
            <CardContent className="pt-6 text-center space-y-4">
              <XCircle className="size-12 text-destructive mx-auto" />
              <div>
                <div className="font-semibold text-foreground">Invalid Invitation</div>
                <div className="text-sm text-muted-foreground mt-1">{error}</div>
              </div>
              <Button variant="outline" onClick={() => navigate("/login")}>Go to Login</Button>
            </CardContent>
          </Card>
        ) : payload && !entering ? (
          <Card>
            <CardHeader className="text-center">
              <div className={`mx-auto size-12 rounded-full ${ROLE_COLORS[payload.role]} flex items-center justify-center mb-2`}>
                <span className="text-white font-bold text-lg">{payload.name.charAt(0)}</span>
              </div>
              <CardTitle>You've been invited!</CardTitle>
              <CardDescription>
                Multicorp Fire Protection has set up a portal for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="font-semibold text-sm">{payload.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Portal Access</span>
                  <Badge className={`${ROLE_COLORS[payload.role]} text-white text-[11px]`}>
                    {ROLE_LABELS[payload.role]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">What you'll see</span>
                  <span className="text-xs text-muted-foreground text-right max-w-[60%]">{ROLE_DESCRIPTIONS[payload.role]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Expires</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(payload.expires).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              </div>
              <Button className="w-full" size="lg" onClick={handleEnter}>
                Enter {ROLE_LABELS[payload.role]} Portal →
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                By entering, you agree to use this system for authorized purposes only.
              </p>
            </CardContent>
          </Card>
        ) : entering ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <Loader2 className="size-10 text-primary mx-auto animate-spin" />
              <div className="font-semibold">Setting up your portal…</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="size-8 text-primary mx-auto animate-spin" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function generateInviteToken(payload: Omit<InvitePayload, "expires"> & { daysValid?: number }): string {
  const full: InvitePayload = {
    ...payload,
    expires: Date.now() + (payload.daysValid ?? 30) * 24 * 60 * 60 * 1000,
  };
  return encodeToken(full);
}
