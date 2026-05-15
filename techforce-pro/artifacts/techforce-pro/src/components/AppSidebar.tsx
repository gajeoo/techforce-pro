import {
  BarChart3,
  Banknote,
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  CalendarOff,
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
import { Avatar, AvatarFallback } from "./ui/avatar";
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
  SidebarMenuButton,
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
  { href: "/invoices",        label: "Invoices",           icon: FileText },
  { href: "/payroll",         label: "Payroll",            icon: Banknote },
  { href: "/shop-calculator", label: "Shop Calculator",    icon: Calculator },
  { href: "/profitability",   label: "P&L Engine",         icon: TrendingUp },
  { href: "/reports",         label: "Reports",            icon: BarChart3 },
  { href: "/pricing",         label: "Pricing & Contracts",icon: DollarSign },
];

const managerAdminNav = [
  { href: "/analytics",       label: "Analytics",       icon: PieChart },
  { href: "/catalogs",        label: "Catalogs",        icon: Box },
  { href: "/gps-tracking",   label: "GPS Tracking",    icon: Navigation },
  { href: "/invites",         label: "Portal Invites",  icon: LinkIcon },
  { href: "/enquiries",       label: "Enquiries",       icon: MessageSquare },
  { href: "/data-management", label: "Data Management", icon: Database },
  { href: "/settings",        label: "Settings",        icon: Settings },
];

const managerCommsNav = [
  { href: "/messages",   label: "Messages",         icon: Mail },
  { href: "/profile",    label: "My Profile",       icon: UserRound },
];

const supervisorNav = [
  { href: "/supervisor",    label: "Dashboard",        icon: LayoutDashboard },
  { href: "/schedule",      label: "Schedule",         icon: CalendarDays },
  { href: "/calendar",      label: "Job Calendar",     icon: CalendarDays },
  { href: "/appointments",  label: "Appointments",     icon: CalendarOff },
  { href: "/supervisor",    label: "Supervisor Portal",icon: Shield },
  { href: "/jobs",          label: "Jobs",             icon: Briefcase },
  { href: "/tasks",         label: "Team Tasks",       icon: ListTodo },
  { href: "/licenses",      label: "Licenses",         icon: FileBadge },
  { href: "/clock-history", label: "Clock History",    icon: Clock },
  { href: "/gps-tracking",  label: "GPS Tracking",     icon: Navigation },
];

const supervisorCommsNav = [
  { href: "/messages",   label: "Messages",         icon: Mail },
  { href: "/profile",    label: "My Profile",       icon: UserRound },
];

const technicianNav = [
  { href: "/tech-portal",   label: "My Schedule",    icon: ClipboardList },
  { href: "/tasks",         label: "Team Tasks",     icon: ListTodo },
  { href: "/licenses",      label: "My Licenses",    icon: FileBadge },
  { href: "/clock-history", label: "Clock History",  icon: Clock },
  { href: "/time-off",      label: "Time-Off & Shop",icon: CalendarOff },
  { href: "/settings",      label: "Settings",       icon: Settings },
];

const technicianCommsNav = [
  { href: "/messages",   label: "Messages",         icon: Mail },
  { href: "/profile",    label: "My Profile",       icon: UserRound },
];

const customerNav = [
  { href: "/customer-portal",          label: "My Portal",         icon: UserCircle },
  { href: "/customer-jobs",            label: "My Jobs",           icon: Building2 },
  { href: "/customer-invoices",        label: "My Invoices",       icon: FileText },
  { href: "/customer-non-compliance",  label: "Non-Compliance",    icon: ShieldX },
];

const customerCommsNav = [
  { href: "/messages",   label: "Messages",         icon: Mail },
  { href: "/profile",    label: "My Profile",       icon: UserRound },
];

// ─── NavLink ──────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  badge?: number;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} title={label}>
        <Link to={href} onClick={() => setOpenMobile(false)}>
          <Icon className="size-4 shrink-0" />
          <span className="truncate flex-1 min-w-0">{label}</span>
          {badge != null && badge > 0 && (
            <span className="ml-auto shrink-0 text-[9px] font-bold bg-primary text-primary-foreground rounded-full size-4 flex items-center justify-center">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── NavGroup ─────────────────────────────────────────────────────────────

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number };

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
    <div className={separator ? "border-t border-sidebar-border/50 mt-2 pt-1" : "mt-1"}>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 select-none">
          {label}
        </span>
      </div>
      <SidebarMenu>
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

// ─── Logo ─────────────────────────────────────────────────────────────────

function SidebarHeaderContent() {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarHeader className="border-b border-sidebar-border pb-3">
      <Link
        to="/dashboard"
        onClick={() => setOpenMobile(false)}
        className="flex items-center gap-2.5 px-2 py-1 font-semibold text-lg"
      >
        <div className="size-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Flame className="size-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold leading-tight truncate">TechForce Pro</span>
          <span className="text-[10px] text-muted-foreground leading-tight truncate">Multicorp Fire Protection</span>
        </div>
      </Link>
    </SidebarHeader>
  );
}

// ─── Nav by role ─────────────────────────────────────────────────────────

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
      <SidebarContent className="gap-0 overflow-y-auto">
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
      <SidebarContent className="gap-0 overflow-y-auto">
        <NavGroup label="Supervisor"    items={filteredNav}    pathname={location.pathname} />
        {filteredComms.length > 0 && (
          <NavGroup label="Communication" items={filteredComms} pathname={location.pathname} separator />
        )}
      </SidebarContent>
    );
  }

  if (role === "technician") {
    return (
      <SidebarContent className="gap-0 overflow-y-auto">
        <NavGroup label="Technician"    items={withLicenseBadge(technicianNav)}            pathname={location.pathname} />
        <NavGroup label="Communication" items={commsWithBadge(technicianCommsNav)}         pathname={location.pathname} />
      </SidebarContent>
    );
  }

  return (
    <SidebarContent className="gap-0 overflow-y-auto">
      <NavGroup label="Customer Portal" items={customerNav}                         pathname={location.pathname} />
      <NavGroup label="Communication"   items={commsWithBadge(customerCommsNav)}    pathname={location.pathname} />
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
  const roleLabel = user?.role === "manager"    ? "Manager / Admin"
    : user?.role === "supervisor" ? "Supervisor"
    : user?.role === "technician" ? "Technician"
    : "Customer";

  function handleLogout() {
    logout();
    navigate("/");
    setOpenMobile(false);
  }

  return (
    <SidebarFooter className="border-t border-sidebar-border">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate">{user?.name ?? "User"}</span>
                  <span className="text-xs text-muted-foreground truncate">{roleLabel}</span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[--radix-dropdown-menu-trigger-width]">
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
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
    <Sidebar>
      <SidebarHeaderContent />
      <SidebarNav />
      <SidebarUserMenu />
    </Sidebar>
  );
}
