import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppSidebar } from "./AppSidebar";
import { ChatWidget } from "./ChatWidget";
import { AIAssistant } from "./AIAssistant";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./ui/sidebar";

export function AppLayout() {
  const { user } = useAuth();
  const showAI = user?.role === "manager" || user?.role === "supervisor";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center px-4 md:hidden border-b">
          <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </SidebarInset>
      <ChatWidget />
      {showAI && <AIAssistant />}
    </SidebarProvider>
  );
}
