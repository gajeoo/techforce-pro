import { spawn, spawnSync } from "node:child_process";

const defaults = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://local:local@localhost:5432/db",
  AI_INTEGRATIONS_OPENAI_BASE_URL: "http://localhost:8080",
  AI_INTEGRATIONS_OPENAI_API_KEY: "sk-mock",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

const nodeCmd = process.execPath;

function runStep(args, label) {
  const result = spawnSync(nodeCmd, args, {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.signal) {
    process.exit(1);
  }

  if (!result.status) {
    console.log(`[dev] ${label} completed`);
  }
}

runStep(["./build.mjs"], "build");

const server = spawn(nodeCmd, ["--enable-source-maps", "./dist/index.mjs"], {
  stdio: "inherit",
  env: process.env,
});

const forwardSignal = (signal) => {
  if (!server.killed) {
    server.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

server.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
  }
  if (signal) {
    process.exit(1);
  }
  process.exit(0);
});
