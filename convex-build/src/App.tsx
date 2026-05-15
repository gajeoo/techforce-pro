import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { AppLayout } from "./components/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { CustomersPage } from "./pages/CustomersPage";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { OpenJobsPage } from "./pages/OpenJobsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { TimeOffPage } from "./pages/TimeOffPage";
import { VansPage } from "./pages/VansPage";
import { TasksPage } from "./pages/TasksPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { RecurringSchedulesPage } from "./pages/RecurringSchedulesPage";
import { DataManagementPage } from "./pages/DataManagementPage";
import { ProfitabilityPage } from "./pages/ProfitabilityPage";
import { MessagingPage } from "./pages/MessagingPage";

function ManagerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "manager") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  if (!user) return <Routes><Route path="*" element={<LoginPage />} /></Routes>;

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<ManagerOnly><EmployeesPage /></ManagerOnly>} />
        <Route path="/customers" element={<ManagerOnly><CustomersPage /></ManagerOnly>} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/invoices" element={<ManagerOnly><InvoicesPage /></ManagerOnly>} />
        <Route path="/open-jobs" element={<ManagerOnly><OpenJobsPage /></ManagerOnly>} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/time-off" element={<TimeOffPage />} />
        <Route path="/vans" element={<ManagerOnly><VansPage /></ManagerOnly>} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/recurring" element={<ManagerOnly><RecurringSchedulesPage /></ManagerOnly>} />
        <Route path="/profitability" element={<ManagerOnly><ProfitabilityPage /></ManagerOnly>} />
        <Route path="/data-management" element={<ManagerOnly><DataManagementPage /></ManagerOnly>} />
        <Route path="/messages" element={<MessagingPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}
