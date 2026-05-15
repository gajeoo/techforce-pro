import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function getRoleHome(role: string | undefined) {
  if (role === "technician") return "/tech-portal";
  if (role === "customer") return "/customer-portal";
  if (role === "supervisor") return "/supervisor";
  return "/dashboard";
}

export function PublicOnlyRoute() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={getRoleHome(user?.role)} replace />;
  }
  return <Outlet />;
}
