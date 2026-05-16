import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import "./index.css";

const base = import.meta.env.BASE_URL ?? "/";
const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL ?? "https://quixotic-partridge-824.convex.cloud"
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter basename={base.replace(/\/$/, "")}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>,
);
