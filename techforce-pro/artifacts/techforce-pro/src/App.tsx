import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicLayout } from "./components/PublicLayout";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./contexts/AuthContext";
import {
  AnalyticsPage,
  CatalogPage,
  CustomerDetailPage,
  CustomerPortalPage,
  CustomersPage,
  DashboardPage,
  EmployeesPage,
  GPSTrackingPage,
  JobDetailPage,
  JobsPage,
  LandingPage,
  LoginPage,
  MessagingPage,
  PricingPage,
  ProfilePage,
  ReportsPage,
  RecurringJobsPage,
  SchedulePage,
  SettingsPage,
  ShopDayCalculatorPage,
  SignupPage,
  SupervisorPortalPage,
  TechPortalPage,
  InvitePage,
  InvitesPage,
  EnquiriesPage,
  ProfitabilityPage,
  InvoicesPage,
  TimeOffPage,
  OpenJobsPage,
  LicensesPage,
  ClockHistoryPage,
  EstimatesPage,
  CalendarPage,
  CustomerJobsPage,
  CustomerNonCompliancePage,
  CustomerInvoicesPage,
  AppointmentCalendarPage,
  TasksPage,
  CustomerRequestsPage,
  DataManagementPage,
  PayrollPage,
} from "./pages";
import { AIAssistant } from "./components/AIAssistant";

// Guard: supervisors cannot access financial/accounting pages
function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "supervisor") {
    return <Navigate to="/supervisor" replace />;
  }
  if (user?.role === "technician") {
    return <Navigate to="/tech-portal" replace />;
  }
  return <>{children}</>;
}

// Guard: blocks technicians from pages they shouldn't see — redirects to their portal
function NotTech({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role === "technician") return <Navigate to="/tech-portal" replace />;
  return <>{children}</>;
}

// Guard: role-specific portal redirect from /dashboard
function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role === "supervisor") return <Navigate to="/supervisor" replace />;
  if (user?.role === "technician") return <Navigate to="/tech-portal" replace />;
  return <DashboardPage />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <Toaster />
        <Routes>
          {/* Invite link — public, no auth needed */}
          <Route path="/invite" element={<InvitePage />} />

          {/* Public pages */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>
          </Route>

          {/* Protected pages */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Universal — all roles */}
              <Route path="/messages" element={<MessagingPage />} />
              <Route path="/profile"  element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Operations */}
              <Route path="/dashboard" element={<DashboardRoute />} />
              <Route path="/schedule"  element={<NotTech><SchedulePage /></NotTech>} />
              <Route path="/estimates" element={<ManagerOnly><EstimatesPage /></ManagerOnly>} />
              <Route path="/jobs"      element={<NotTech><JobsPage /></NotTech>} />
              <Route path="/jobs/:id"  element={<JobDetailPage />} />
              <Route path="/open-jobs"      element={<NotTech><OpenJobsPage /></NotTech>} />
              <Route path="/recurring-jobs" element={<NotTech><RecurringJobsPage /></NotTech>} />
              <Route path="/calendar"       element={<NotTech><CalendarPage /></NotTech>} />
              <Route path="/appointments"   element={<NotTech><AppointmentCalendarPage /></NotTech>} />

              {/* Management — financial pages restricted from supervisors + techs */}
              <Route path="/employees"        element={<NotTech><EmployeesPage /></NotTech>} />
              <Route path="/customers"        element={<NotTech><CustomersPage /></NotTech>} />
              <Route path="/customers/:id"    element={<NotTech><CustomerDetailPage /></NotTech>} />
              <Route path="/catalogs"         element={<NotTech><CatalogPage /></NotTech>} />
              <Route path="/gps-tracking"     element={<NotTech><GPSTrackingPage /></NotTech>} />
              <Route path="/time-off"         element={<TimeOffPage />} />

              {/* Financial — supervisors redirected to dashboard */}
              <Route path="/invoices"         element={<ManagerOnly><InvoicesPage /></ManagerOnly>} />
              <Route path="/shop-calculator"  element={<ManagerOnly><ShopDayCalculatorPage /></ManagerOnly>} />
              <Route path="/profitability"    element={<ManagerOnly><ProfitabilityPage /></ManagerOnly>} />
              <Route path="/reports"          element={<ManagerOnly><ReportsPage /></ManagerOnly>} />
              <Route path="/pricing"          element={<ManagerOnly><PricingPage /></ManagerOnly>} />

              {/* Admin */}
              <Route path="/analytics"  element={<ManagerOnly><AnalyticsPage /></ManagerOnly>} />
              <Route path="/invites"    element={<NotTech><InvitesPage /></NotTech>} />
              <Route path="/enquiries"  element={<NotTech><EnquiriesPage /></NotTech>} />

              {/* Licenses & Clock History */}
              <Route path="/licenses"       element={<LicensesPage />} />
              <Route path="/clock-history"  element={<ClockHistoryPage />} />

              {/* Shared task board — manager, supervisor, tech (not customer) */}
              <Route path="/tasks" element={<NotTech><TasksPage /></NotTech>} />

              {/* Customer Requests — manager only */}
              <Route path="/customer-requests" element={<ManagerOnly><CustomerRequestsPage /></ManagerOnly>} />
              {/* Data Management — manager only */}
              <Route path="/data-management" element={<ManagerOnly><DataManagementPage /></ManagerOnly>} />
              <Route path="/payroll"         element={<ManagerOnly><PayrollPage /></ManagerOnly>} />

              {/* Role-specific portals */}
              <Route path="/tech-portal"      element={<TechPortalPage />} />
              <Route path="/supervisor"       element={<SupervisorPortalPage />} />
              <Route path="/customer-portal"           element={<CustomerPortalPage />} />
              <Route path="/customer-jobs"             element={<CustomerJobsPage />} />
              <Route path="/customer-non-compliance"   element={<CustomerNonCompliancePage />} />
              <Route path="/customer-invoices"         element={<CustomerInvoicesPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
