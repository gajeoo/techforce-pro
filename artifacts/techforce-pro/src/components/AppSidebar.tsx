import {
  BarChart3,
  Banknote,
  Receipt,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CalendarOff,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Database,
  DollarSign,
  FileBadge,
  FileCheck,
  FileText,
  Flame,
  LayoutDashboard,
  Link as LinkIcon,
  ListTodo,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Navigation,
  PieChart,
  RotateCcw,
  Settings,
  Shield,
  ShieldX,
  Sun,
  TrendingUp,
  UserCircle,
  UserRound,
  Users,
  Box,
  Zap,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getSupervisorPermissions, PERM_HREF, type SupervisorPermKey } from "@/lib/supervisorPermissions";
import { countUnread } from "@/lib/messaging";
import { getExpiringLicenses } from "@/lib/licenses";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";

// ─── Nav definitions ──────────────────────────────────────────────────────

const managerMainNav = [
  { href: "/dashboard",       label: "Dashboard",           icon: LayoutDashboard },
  { href: "/schedule",        label: "Schedule",             icon: CalendarDays },
  { href: "/calendar",        label: "Job Calendar",         icon: CalendarDays },
  { href: "/appointments",    label: "Appointments",         icon: CalendarOff },
  { href: "/recurring-jobs",  label: "Recurring Jobs",       icon: RotateCcw },
  { href: "/estimates",       label: "Estimates & Quotes",   icon: FileCheck },
  { href: "/jobs",            label: "Jobs",                 icon: Briefcase },
  { href: "/open-jobs",       label: "Open Jobs & AI",       icon: Zap },
  { href: "/tasks",           label: "Team Tasks",           icon: ListTodo },
];

const managerManageNav = [
  { href: "/employees",         label: "Employees",           icon: Users },
  { href: "/customers",         label: "Customers",           icon: Building2 },
  { href: "/customer-requests", label: "Customer Requests",   icon: ClipboardCheck },
  { href: "/licenses",          label: "Licenses",            icon: FileBadge },
  { href: "/time-off",          label: "Time-Off Approvals",  icon: CalendarOff },
];

const managerFinanceNav = [
  { href: "/invoices",        label: "Invoices",            icon: FileText },
  { href: "/payroll",         label: "Payroll",             icon: Banknote },
  { href: "/shop-calculator", label: "Shop Calculator",     icon: Calculator },
  { href: "/profitability",   label: "P&L Engine",          icon: TrendingUp },
  { href: "/tax",             label: "Tax Tracker",         icon: Receipt },
  { href: "/reports",         label: "Reports",             icon: BarChart3 },
  { href: "/pricing",         label: "Pricing & Contracts", icon: DollarSign },
];

const managerAdminNav = [
  { href: "/analytics",       label: "Analytics",       icon: PieChart },
  { href: "/catalogs",        label: "Catalogs",        icon: Box },
  { href: "/gps-tracking",    label: "GPS Tracking",    icon: Navigation },
  { href: "/invites",         label: "Portal Invites",  icon: LinkIcon },
  { href: "/enquiries",       label: "Enquiries",       icon: MessageSquare },
  { href: "/data-management", label: "Data Management", icon: Database },
  { href: "/settings",        label: "Settings",        icon: Settings },
];

const managerCommsNav = [
  { href: "/messages",   label: "Messages",   icon: Mail },
  { href: "/profile",    label: "My Profile", icon: UserRound },
];

const supervisorNav = [
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
];

const supervisorCommsNav = [
  { href: "/messages",   label: "Messages",   icon: Mail },
  { href: "/profile",    label: "My Profile", icon: UserRound },
];

const technicianNav = [
  { href: "/tech-portal",   label: "My Schedule",     icon: ClipboardList },
  { href: "/tasks",         label: "Team Tasks",      icon: ListTodo },
  { href: "/licenses",      label: "My Licenses",     icon: FileBadge },
  { href: "/clock-history", label: "Clock History",   icon: Clock },
  { href: "/time-off",      label: "Time-Off & Shop", icon: CalendarOff },
  { href: "/settings",      label: "Settings",        icon: Settings },
];

const technicianCommsNav = [
  { href: "/messages",   label: "Messages",   icon: Mail },
  { href: "/profile",    label: "My Profile", icon: UserRound },
];

const customerNav = [
  { href: "/customer-portal",         label: "My Portal",      icon: UserCircle },
  { href: "/customer-jobs",           label: "My Jobs",        icon: Building2 },
  { href: "/customer-invoices",       label: "My Invoices",    icon: FileText },
  { href: "/customer-non-compliance", label: "Non-Compliance", icon: ShieldX },
];

const customerCommsNav = [
  { href: "/messages",   label: "Messages",   icon: Mail },
  { href: "/profile",    label: "My Profile", icon: UserRound },
];

// ─── NavLink ──────────────────────────────────────────────────────────────

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

function NavLink({ href, label, icon: Icon, isActive, badge }: NavItem & { isActive: boolean }) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem className="px-2">
      <Link
        to={href}
        onClick={() => setOpenMobile(false)}
        title={label}
        className={`
          group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-150 w-full
          ${isActive
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/5"
          }
        `}
      >
        <Icon className={`size-4 shrink-0 transition-transform duration-150 ${isActive ? "" : "group-hover:scale-110"}`} />
        <span className="truncate flex-1 min-w-0 leading-none">{label}</span>
        {badge != null && badge > 0 && (
          <span className={`
            ml-auto shrink-0 text-[9px] font-bold rounded-full size-4 flex items-center justify-center
            ${isActive ? "bg-white/20 text-white" : "bg-primary text-primary-foreground"}
          `}>
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {isActive && <ChevronRight className="size-3 ml-auto shrink-0 opacity-60" />}
      </Link>
    </SidebarMenuItem>
  );
}

// ─── NavGroup ─────────────────────────────────────────────────────────────

function NavGroup({
  label,
  items,
  pathname,
  separator,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  separator?: boolean;
}) {
  return (
    <div className={separator ? "mt-4 pt-4 border-t border-white/5" : "mt-2"}>
      <div className="px-5 pb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/30 select-none">
          {label}
        </span>
      </div>
      <SidebarMenu className="gap-0.5">
        {items.map(item => (
          <NavLink
            key={item.href + item.label}
            href={item.href}
            label={item.label}
            icon={item.icon}
            isActive={pathname === item.href}
            badge={item.badge}
          />
        ))}
      </SidebarMenu>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────

function SidebarHeaderContent() {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarHeader className="px-4 py-4 border-b border-white/5">
      <Link
        to="/dashboard"
        onClick={() => setOpenMobile(false)}
        className="flex items-center gap-3"
      >
        {/* Logo mark */}
        <div className="size-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
          <Flame className="size-5 text-primary-foreground" />
        </div>
        {/* Brand text */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-sidebar-foreground leading-tight">TechForce Pro</span>
          <span className="text-[10px] text-sidebar-foreground/40 leading-tight truncate">Multicorp Fire Protection</span>
        </div>
      </Link>
    </SidebarHeader>
  );
}

// ─── Nav by role ──────────────────────────────────────────────────────────

function SidebarNav() {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role ?? "manager";
  const userId = user?.id ?? "";
  const unread = countUnread(userId);

  let expiring = 0;
  try {
    expiring = (role === "manager" || role === "supervisor")
      ? getExpiringLicenses().length
      : getExpiringLicenses(userId).length;
  } catch { /* ignore */ }

  const commsWithBadge = (items: NavItem[]) =>
    items.map(i => i.href === "/messages" ? { ...i, badge: unread } : i);

  const withLicenseBadge = (items: NavItem[]) =>
    items.map(i => i.href === "/licenses" && expiring > 0 ? { ...i, badge: expiring } : i);

  if (role === "manager") {
    return (
      <SidebarContent className="overflow-y-auto py-2 gap-0">
        <NavGroup label="Operations"    items={managerMainNav}                          pathname={location.pathname} />
        <NavGroup label="People"        items={withLicenseBadge(managerManageNav)}      pathname={location.pathname} separator />
        <NavGroup label="Finance"       items={managerFinanceNav}                       pathname={location.pathname} separator />
        <NavGroup label="Admin"         items={managerAdminNav}                         pathname={location.pathname} separator />
        <NavGroup label="Communication" items={commsWithBadge(managerCommsNav)}         pathname={location.pathname} separator />
      </SidebarContent>
    );
  }

  if (role === "supervisor") {
    const perms = getSupervisorPermissions();
    const filteredNav = withLicenseBadge(supervisorNav).filter(item => {
      const permKey = PERM_HREF[item.href] as SupervisorPermKey | undefined;
      return !permKey || perms[permKey];
    });
    const filteredComms = commsWithBadge(supervisorCommsNav).filter(item => {
      const permKey = PERM_HREF[item.href] as SupervisorPermKey | undefined;
      return !permKey || perms[permKey];
    });
    return (
      <SidebarContent className="overflow-y-auto py-2 gap-0">
        <NavGroup label="Supervisor"    items={filteredNav}    pathname={location.pathname} />
        {filteredComms.length > 0 && (
          <NavGroup label="Communication" items={filteredComms} pathname={location.pathname} separator />
        )}
      </SidebarContent>
    );
  }

  if (role === "technician") {
    return (
      <SidebarContent className="overflow-y-auto py-2 gap-0">
        <NavGroup label="Technician"    items={withLicenseBadge(technicianNav)}   pathname={location.pathname} />
        <NavGroup label="Communication" items={commsWithBadge(technicianCommsNav)} pathname={location.pathname} separator />
      </SidebarContent>
    );
  }

  return (
    <SidebarContent className="overflow-y-auto py-2 gap-0">
      <NavGroup label="Customer Portal" items={customerNav}                        pathname={location.pathname} />
      <NavGroup label="Communication"   items={commsWithBadge(customerCommsNav)}   pathname={location.pathname} separator />
    </SidebarContent>
  );
}

// ─── Footer user menu ─────────────────────────────────────────────────────

function SidebarUserMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, switchable } = useTheme();
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();

  const initials = (user?.name ?? "U").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const roleLabel =
    user?.role === "manager"    ? "Manager / Admin" :
    user?.role === "supervisor" ? "Supervisor" :
    user?.role === "technician" ? "Technician" :
    "Customer";

  function handleLogout() {
    logout();
    navigate("/");
    setOpenMobile(false);
  }

  return (
    <SidebarFooter className="border-t border-white/5 p-3">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left">
                {/* Avatar */}
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0 text-primary-foreground text-xs font-bold shadow shadow-primary/30">
                  {initials}
                </div>
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-semibold text-sidebar-foreground leading-tight truncate w-full">
                    {user?.name ?? "User"}
                  </span>
                  <span className="text-[10px] text-sidebar-foreground/40 leading-tight">{roleLabel}</span>
                </div>
                <ChevronRight className="size-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60 transition-colors shrink-0 rotate-[-90deg]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
              <DropdownMenuItem asChild>
                <Link to="/profile" onClick={() => setOpenMobile(false)}>
                  <UserRound className="size-4" />
                  My Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" onClick={() => setOpenMobile(false)}>
                  <Settings className="size-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              {switchable && (
                <DropdownMenuItem onClick={toggleTheme}>
                  {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  {theme === "light" ? "Dark mode" : "Light mode"}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────

export function AppSidebar() {
  return (
    <Sidebar className="border-r-0">
      <div className="flex flex-col h-full bg-sidebar">
        <SidebarHeaderContent />
        <SidebarNav />
        <SidebarUserMenu />
      </div>
    </Sidebar>
  );
}
