import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppTopNav } from "./AppTopNav";
import { ChatWidget } from "./ChatWidget";
import { AIAssistant } from "./AIAssistant";

export function AppLayout() {
  const { user } = useAuth();
  const showAI = user?.role === "manager" || user?.role === "supervisor";

  return (
    <div className="min-h-screen bg-background">
      <AppTopNav />
      {/* Offset for the fixed nav bar */}
      <main className="pt-14">
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
      <ChatWidget />
      {showAI && <AIAssistant />}
    </div>
  );
}
