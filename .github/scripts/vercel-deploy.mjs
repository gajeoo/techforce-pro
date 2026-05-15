import fs from "fs";
import https from "https";
import path from "path";

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;

if (!TOKEN) { console.error("Missing VERCEL_TOKEN"); process.exit(1); }
if (!TEAM_ID) { console.error("Missing VERCEL_TEAM_ID"); process.exit(1); }
if (!PROJECT_ID) { console.error("Missing VERCEL_PROJECT_ID"); process.exit(1); }
const DIST = "convex-build/dist";

function readFile(filePath) {
  return fs.readFileSync(filePath, "base64");
}

function collectFiles(dir, base = "") {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(abs, rel));
    } else {
      result.push({ file: rel, data: readFile(abs), encoding: "base64" });
    }
  }
  return result;
}

const files = collectFiles(DIST);

// Add 404.html as copy of index.html for SPA routing
const indexHtml = files.find(f => f.file === "index.html");
if (indexHtml && !files.find(f => f.file === "404.html")) {
  files.push({ file: "404.html", data: indexHtml.data, encoding: "base64" });
}

const payload = JSON.stringify({
  name: "techforce-pro",
  target: "production",
  files,
  routes: [
    { src: "/assets/(.*)", dest: "/assets/$1" },
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index.html" },
  ],
  framework: null,
  buildCommand: "",
  outputDirectory: "",
});

const options = {
  hostname: "api.vercel.com",
  path: `/v13/deployments?teamId=${TEAM_ID}&projectId=${PROJECT_ID}`,
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  },
};

console.log(`Uploading ${files.length} files to Vercel...`);

const req = https.request(options, res => {
  let data = "";
  res.on("data", chunk => (data += chunk));
  res.on("end", () => {
    const d = JSON.parse(data);
    if (d.error) {
      console.error("Vercel error:", JSON.stringify(d.error));
      process.exit(1);
    }
    console.log("Deploy ID:", d.id);
    console.log("URL:", `https://${d.url}`);
    console.log("Status:", d.status);
  });
});
req.on("error", e => { console.error(e); process.exit(1); });
req.write(payload);
req.end();
