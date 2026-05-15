import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { installMockApi } from "./lib/mockApi";
import "./index.css";

const base = import.meta.env.BASE_URL ?? "/";

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  installMockApi();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={base.replace(/\/$/, "")}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
