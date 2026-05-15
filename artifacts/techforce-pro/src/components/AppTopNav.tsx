import { useState, useRef, useEffect } from "react";
import {
  BarChart3, Banknote, Receipt, Briefcase, Building2, Calculator,
  CalendarDays, CalendarOff, ChevronDown, ClipboardCheck, ClipboardList,
  Clock, Database, DollarSign, FileBadge, FileCheck, FileText, Flame,
  LayoutDashboard, Link as LinkIcon, ListTodo, LogOut, Mail, Menu, MessageSquare,
  Moon, Navigation, PieChart, RotateCcw, Settings, Shield, ShieldX, Sun,
  TrendingUp, UserCircle, UserRound, Users, Box, X, Zap,
} from "lucide-react";
import { NotificationsBell } from "./NotificationsBell";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getSupervisorPermissions, PERM_HREF, type SupervisorPermKey } from "@/lib/supervisorPermissions";
import { countUnread } from "@/lib/messaging";
import { getExpiringLicenses } from "@/lib/licenses";

// ─── Nav definitions ───────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

type NavGroup = { label: string; items: NavItem[] };

const managerGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard",      label: "Dashboard",         icon: LayoutDashboard },
      { href: "/schedule",       label: "Schedule",          icon: CalendarDays },
      { href: "/calendar",       label: "Job Calendar",      icon: CalendarDays },
      { href: "/appointments",   label: "Appointments",      icon: CalendarOff },
      { href: "/recurring-jobs", label: "Recurring Jobs",    icon: RotateCcw },
      { href: "/estimates",      label: "Estimates & Quotes",icon: FileCheck },
      { href: "/jobs",           label: "Jobs",              icon: Briefcase },
      { href: "/open-jobs",      label: "Open Jobs & AI",    icon: Zap },
      { href: "/tasks",          label: "Team Tasks",        icon: ListTodo },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/employees",         label: "Employees",          icon: Users },
      { href: "/customers",         label: "Customers",          icon: Building2 },
      { href: "/customer-requests", label: "Customer Requests",  icon: ClipboardCheck },
      { href: "/licenses",          label: "Licenses",           icon: FileBadge },
      { href: "/time-off",          label: "Time-Off Approvals", icon: CalendarOff },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices",        label: "Invoices",            icon: FileText },
      { href: "/payroll",         label: "Payroll",             icon: Banknote },
      { href: "/shop-calculator", label: "Shop Calculator",     icon: Calculator },
      { href: "/profitability",   label: "P&L Engine",          icon: TrendingUp },
      { href: "/tax",             label: "Tax Tracker",         icon: Receipt },
      { href: "/reports",         label: "Reports",             icon: BarChart3 },
      { href: "/pricing",         label: "Pricing & Contracts", icon: DollarSign },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/analytics",       label: "Analytics",       icon: PieChart },
      { href: "/catalogs",        label: "Catalogs",        icon: Box },
      { href: "/gps-tracking",    label: "GPS Tracking",    icon: Navigation },
      { href: "/invites",         label: "Portal Invites",  icon: LinkIcon },
      { href: "/enquiries",       label: "Enquiries",       icon: MessageSquare },
      { href: "/data-management", label: "Data Management", icon: Database },
      { href: "/settings",        label: "Settings",        icon: Settings },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/messages", label: "Messages",   icon: Mail },
      { href: "/profile",  label: "My Profile", icon: UserRound },
    ],
  },
];

const supervisorGroups: NavGroup[] = [
  {
    label: "Supervisor",
    items: [
      { href: "/supervisor",    label: "Dashboard",         icon: LayoutDashboard },
      { href: "/schedule",      label: "Schedule",          icon: CalendarDays },
      { href: "/calendar",      label: "Job Calendar",      icon: CalendarDays },
      { href: "/appointments",  label: "Appointments",      icon: CalendarOff },
      { href: "/supervisor",    label: "Supervisor Portal", icon: Shield },
      { href: "/jobs",          label: "Jobs",              icon: Briefcase },
      { href: "/tasks",         label: "Team Tasks",        icon: ListTodo },
      { href: "/licenses",      label: "Licenses",          icon: FileBadge },
      { href: "/clock-history", label: "Clock History",     icon: Clock },
      { href: "/gps-tracking",  label: "GPS Tracking",      icon: Navigation },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/messages", label: "Messages",   icon: Mail },
      { href: "/profile",  label: "My Profile", icon: UserRound },
    ],
  },
];

const technicianGroups: NavGroup[] = [
  {
    label: "My Work",
    items: [
      { href: "/tech-portal",   label: "My Schedule",     icon: ClipboardList },
      { href: "/tasks",         label: "Team Tasks",      icon: ListTodo },
      { href: "/licenses",      label: "My Licenses",     icon: FileBadge },
      { href: "/clock-history", label: "Clock History",   icon: Clock },
      { href: "/time-off",      label: "Time-Off & Shop", icon: CalendarOff },
      { href: "/settings",      label: "Settings",        icon: Settings },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/messages", label: "Messages",   icon: Mail },
      { href: "/profile",  label: "My Profile", icon: UserRound },
    ],
  },
];

const customerGroups: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/customer-portal",         label: "My Portal",      icon: UserCircle },
      { href: "/customer-jobs",           label: "My Jobs",        icon: Building2 },
      { href: "/customer-invoices",       label: "My Invoices",    icon: FileText },
      { href: "/customer-non-compliance", label: "Non-Compliance", icon: ShieldX },
    ],
  },
  {
    label: "Comms",
    items: [
      { href: "/messages", label: "Messages",   icon: Mail },
      { href: "/profile",  label: "My Profile", icon: UserRound },
    ],
  },
];

// ─── Dropdown menu ─────────────────────────────────────────────────────────

function NavDropdown({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isGroupActive = group.items.some(i => i.href === pathname);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const totalBadge = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150
          ${open || isGroupActive
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/8"
          }
        `}
      >
        {group.label}
        {totalBadge > 0 && !open && (
          <span className="size-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
            {totalBadge > 9 ? "9+" : totalBadge}
          </span>
        )}
        <ChevronDown className={`size-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-white/10 bg-[oklch(0.13_0.015_260)] shadow-2xl shadow-black/40 py-1.5 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          {group.items.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href + item.label}
                to={item.href}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className={`
                  flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm transition-all duration-100
                  ${isActive
                    ? "bg-primary text-white font-medium"
                    : "text-white/70 hover:text-white hover:bg-white/8"
                  }
                `}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className={`text-[9px] font-bold rounded-full size-4 flex items-center justify-center ${isActive ? "bg-white/20 text-white" : "bg-primary text-white"}`}>
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── User menu ─────────────────────────────────────────────────────────────

function UserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel =
    user?.role === "manager"    ? "Manager / Admin" :
    user?.role === "supervisor" ? "Supervisor" :
    user?.role === "technician" ? "Technician" : "Customer";

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/8 transition-colors group"
      >
        <div className="size-7 rounded-lg bg-primary flex items-center justify-center text-white text-[11px] font-bold shadow shadow-primary/40">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-xs font-semibold text-white">{user?.name ?? "User"}</span>
          <span className="text-[10px] text-white/40">{roleLabel}</span>
        </div>
        <ChevronDown className={`size-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-52 rounded-xl border border-white/10 bg-[oklch(0.13_0.015_260)] shadow-2xl shadow-black/40 py-1.5 z-50 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b border-white/8 mb-1">
            <div className="text-xs font-semibold text-white">{user?.name ?? "User"}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{roleLabel}</div>
          </div>
          {[
            { to: "/profile", Icon: UserRound, label: "My Profile" },
            { to: "/settings", Icon: Settings, label: "Settings" },
          ].map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
          {switchable && (
            <button
              onClick={() => { toggleTheme?.(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            >
              {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
              {theme === "light" ? "Dark mode" : "Light mode"}
            </button>
          )}
          <div className="border-t border-white/8 mt-1 pt-1">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mobile full-screen menu ────────────────────────────────────────────────

function MobileMenu({
  groups,
  pathname,
  onClose,
}: {
  groups: NavGroup[];
  pathname: string;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.11_0.015_260)]">
      {/* Mobile menu header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <Flame className="size-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">TechForce Pro</div>
            <div className="text-[10px] text-white/40">Multicorp Fire Protection</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-white/60 hover:text-white"
          aria-label="Close menu"
          title="Close menu"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {groups.map(group => (
          <div key={group.label}>
            <div className="px-2 pb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{group.label}</span>
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href + item.label}
                    to={item.href}
                    onClick={onClose}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                      ${isActive
                        ? "bg-primary text-white shadow-sm shadow-primary/20"
                        : "text-white/65 hover:text-white hover:bg-white/6"
                      }
                    `}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge != null && item.badge > 0 && (
                      <span className={`text-[9px] font-bold rounded-full size-4 flex items-center justify-center ${isActive ? "bg-white/20" : "bg-primary"} text-white`}>
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile user footer */}
      <div className="border-t border-white/8 px-3 py-3 space-y-1 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">
            {(user?.name ?? "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{user?.name ?? "User"}</div>
            <div className="text-[10px] text-white/40">
              {user?.role === "manager" ? "Manager / Admin" : user?.role === "supervisor" ? "Supervisor" : user?.role === "technician" ? "Technician" : "Customer"}
            </div>
          </div>
        </div>
        {switchable && (
          <button
            onClick={() => { toggleTheme?.(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/65 hover:text-white hover:bg-white/6 transition-colors"
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
            {theme === "light" ? "Switch to Dark mode" : "Switch to Light mode"}
          </button>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Main AppTopNav ─────────────────────────────────────────────────────────

export function AppTopNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role ?? "manager";
  const userId = user?.id ?? "";

  const unread = countUnread(userId);
  let expiring = 0;
  try {
    expiring = (role === "manager" || role === "supervisor")
      ? getExpiringLicenses().length
      : getExpiringLicenses(userId).length;
  } catch { /* ignore */ }

  function injectBadges(groups: NavGroup[]): NavGroup[] {
    return groups.map(g => ({
      ...g,
      items: g.items.map(item => {
        if (item.href === "/messages" && unread > 0) return { ...item, badge: unread };
        if (item.href === "/licenses" && expiring > 0) return { ...item, badge: expiring };
        return item;
      }),
    }));
  }

  function getGroups(): NavGroup[] {
    if (role === "supervisor") {
      const perms = getSupervisorPermissions();
      return injectBadges(supervisorGroups).map(g => ({
        ...g,
        items: g.items.filter(item => {
          const permKey = PERM_HREF[item.href] as SupervisorPermKey | undefined;
          return !permKey || perms[permKey];
        }),
      })).filter(g => g.items.length > 0);
    }
    if (role === "technician") return injectBadges(technicianGroups);
    if (role === "customer")   return injectBadges(customerGroups);
    return injectBadges(managerGroups);
  }

  const groups = getGroups();

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-40 h-14 bg-[oklch(0.13_0.015_260)] border-b border-white/8 flex items-center px-4 gap-2 shadow-lg shadow-black/20">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 mr-4 shrink-0">
          <div className="size-8 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Flame className="size-4 text-white" />
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-bold text-white">TechForce Pro</span>
            <span className="text-[9px] text-white/35 leading-none">Multicorp Fire Protection</span>
          </div>
        </Link>

        {/* Divider */}
        <div className="hidden md:block w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* Desktop nav groups */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
          {groups.map(group => (
            <NavDropdown
              key={group.label}
              group={group}
              pathname={location.pathname}
            />
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          {(role === "manager" || role === "supervisor") && <NotificationsBell />}
          <UserMenu />
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden size-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-white/70 hover:text-white"
            aria-label="Open menu"
            title="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <MobileMenu
          groups={groups}
          pathname={location.pathname}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
