import { useState } from "react";
import { useAuth, type UserRole } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Flame, ChevronDown } from "lucide-react";

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "manager", label: "Manager / Admin", desc: "Full access — scheduling, invoicing, reports" },
  { value: "supervisor", label: "Supervisor", desc: "Schedule management and job status updates" },
  { value: "technician", label: "Technician", desc: "Personal schedule and time-off requests" },
  { value: "customer", label: "Customer", desc: "Upcoming visits and invoice portal" },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("manager");
  const [name, setName] = useState("Admin");

  function handleLogin() {
    if (!name.trim()) return;
    login(role, name.trim());
    navigate("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-12 bg-red-600 rounded-xl flex items-center justify-center">
            <Flame className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">TechForce Pro</h1>
            <p className="text-sm text-gray-500">Multicorp Fire Protection Services</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-1">Sign in</h2>
        <p className="text-sm text-gray-500 mb-6">Select your role to continue</p>

        <div className="space-y-3 mb-5">
          {ROLES.map(r => (
            <button
              key={r.value}
              onClick={() => {
                setRole(r.value);
                setName(r.label.split(" / ")[0]);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                role === r.value
                  ? "border-red-600 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className={`text-sm font-medium ${role === r.value ? "text-red-700" : "text-gray-800"}`}>
                {r.label}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>

        <div className="mb-5">
          <label className="text-xs font-medium text-gray-600 block mb-1.5">Display name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="Your name"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={!name.trim()}
          className="w-full bg-red-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          Continue as {ROLES.find(r => r.value === role)?.label}
        </button>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Convex · No auth required in demo mode
        </p>
      </div>
    </div>
  );
}
