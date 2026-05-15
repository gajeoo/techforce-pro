import { useState, useRef, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Building2, Briefcase, FileText, ListTodo,
  CalendarDays, Clock, Truck, RefreshCw, TrendingUp, Database,
  MessageSquare, LogOut, Flame, ChevronDown, Menu, X,
  CalendarOff, CheckSquare,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

type NavItem = { label: string; href: string; icon: React.ElementType };
type NavGroup = { label: string; items: NavItem[] };

const managerGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard",   label: "Dashboard",     icon: LayoutDashboard },
      { href: "/schedule",    label: "Schedule",      icon: CalendarDays },
      { href: "/appointments",label: "Appointments",  icon: CalendarOff },
      { href: "/jobs",        label: "Jobs",          icon: Briefcase },
      { href: "/open-jobs",   label: "Open Jobs",     icon: ListTodo },
      { href: "/tasks",       label: "Team Tasks",    icon: CheckSquare },
      { href: "/recurring",   label: "Recurring Jobs",icon: RefreshCw },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/employees",   label: "Employees",     icon: Users },
      { href: "/customers",   label: "Customers",     icon: Building2 },
      { href: "/time-off",    label: "Time-Off",      icon: Clock },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/invoices",     label: "Invoices",   icon: FileText },
      { href: "/profitability",label: "P&L Engine", icon: TrendingUp },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/vans",           label: "GPS Tracking",    icon: Truck },
      { href: "/data-management",label: "Data Management", icon: Database },
      { href: "/messages",       label: "Messages",        icon: MessageSquare },
    ],
  },
];

const supervisorGroups: NavGroup[] = [
  {
    label: "Supervisor",
    items: [
      { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
      { href: "/schedule",     label: "Schedule",     icon: CalendarDays },
      { href: "/jobs",         label: "Jobs",         icon: Briefcase },
      { href: "/tasks",        label: "Team Tasks",   icon: CheckSquare },
      { href: "/appointments", label: "Appointments", icon: CalendarOff },
    ],
  },
  {
    label: "Comms",
    items: [{ href: "/messages", label: "Messages", icon: MessageSquare }],
  },
];

const technicianGroups: NavGroup[] = [
  {
    label: "My Work",
    items: [
      { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
      { href: "/schedule",   label: "My Schedule",  icon: CalendarDays },
      { href: "/tasks",      label: "Team Tasks",   icon: CheckSquare },
      { href: "/time-off",   label: "Time-Off",     icon: Clock },
    ],
  },
  {
    label: "Comms",
    items: [{ href: "/messages", label: "Messages", icon: MessageSquare }],
  },
];

const customerGroups: NavGroup[] = [
  {
    label: "My Account",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/jobs",      label: "My Jobs",   icon: Briefcase },
      { href: "/invoices",  label: "Invoices",  icon: FileText },
    ],
  },
  {
    label: "Comms",
    items: [{ href: "/messages", label: "Messages", icon: MessageSquare }],
  },
];

function NavDropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
          open || isGroupActive
            ? "bg-white/10 text-white"
            : "text-white/70 hover:text-white hover:bg-white/8"
        )}
      >
        {group.label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-52 rounded-xl border border-white/10 bg-[oklch(0.13_0.015_260)] shadow-2xl shadow-black/40 py-1.5 z-50">
          {group.items.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 mx-1.5 rounded-lg text-sm transition-all duration-100",
                  isActive
                    ? "bg-red-600 text-white font-medium"
                    : "text-white/70 hover:text-white hover:bg-white/8"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
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
    navigate("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/8 transition-colors"
      >
        <div className="size-7 rounded-lg bg-red-600 flex items-center justify-center text-white text-[11px] font-bold shadow shadow-red-500/40">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-xs font-semibold text-white">{user?.name ?? "User"}</span>
          <span className="text-[10px] text-white/40">{roleLabel}</span>
        </div>
        <ChevronDown className={cn("size-3.5 text-white/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-52 rounded-xl border border-white/10 bg-[oklch(0.13_0.015_260)] shadow-2xl shadow-black/40 py-1.5 z-50">
          <div className="px-3 py-2 border-b border-white/8 mb-1">
            <div className="text-xs font-semibold text-white">{user?.name ?? "User"}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{roleLabel}</div>
          </div>
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

function MobileMenu({ groups, pathname, onClose }: { groups: NavGroup[]; pathname: string; onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[oklch(0.11_0.015_260)]">
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30">
            <Flame className="size-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">TechForce Pro</div>
            <div className="text-[10px] text-white/40">Multicorp Fire Protection</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-white/60 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

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
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      isActive
                        ? "bg-red-600 text-white shadow-sm shadow-red-600/20"
                        : "text-white/65 hover:text-white hover:bg-white/6"
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/8 px-3 py-3 space-y-1 shrink-0">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="size-8 rounded-lg bg-red-600 flex items-center justify-center text-white text-xs font-bold">
            {(user?.name ?? "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{user?.name ?? "User"}</div>
            <div className="text-[10px] text-white/40">
              {user?.role === "manager" ? "Manager / Admin" : user?.role === "supervisor" ? "Supervisor" : user?.role === "technician" ? "Technician" : "Customer"}
            </div>
          </div>
        </div>
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

export function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role ?? "manager";

  function getGroups(): NavGroup[] {
    if (role === "supervisor") return supervisorGroups;
    if (role === "technician") return technicianGroups;
    if (role === "customer")   return customerGroups;
    return managerGroups;
  }

  const groups = getGroups();

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-40 h-14 bg-[oklch(0.13_0.015_260)] border-b border-white/8 flex items-center px-4 gap-2 shadow-lg shadow-black/20">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 mr-4 shrink-0">
          <div className="size-8 rounded-xl bg-red-600 flex items-center justify-center shadow-md shadow-red-600/30">
            <Flame className="size-4 text-white" />
          </div>
          <div className="hidden md:flex flex-col leading-tight">
            <span className="text-sm font-bold text-white">TechForce Pro</span>
            <span className="text-[9px] text-white/35 leading-none">Multicorp Fire Protection</span>
          </div>
        </NavLink>

        <div className="hidden md:block w-px h-5 bg-white/10 mx-1 shrink-0" />

        <div className="hidden md:flex items-center gap-0.5 flex-1 min-w-0">
          {groups.map(group => (
            <NavDropdown key={group.label} group={group} pathname={location.pathname} />
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <UserMenu />
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden size-8 rounded-lg flex items-center justify-center hover:bg-white/8 transition-colors text-white/70 hover:text-white"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <MobileMenu groups={groups} pathname={location.pathname} onClose={() => setMobileOpen(false)} />
      )}

      <main className="pt-14 min-h-screen bg-gray-50">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </>
  );
}
