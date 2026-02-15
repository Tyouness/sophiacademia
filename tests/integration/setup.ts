import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse } from "dotenv";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function findProjectRoot(startDir: string) {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

const rootDir = findProjectRoot(process.cwd()) ?? findProjectRoot(currentDir);
if (!rootDir) {
  throw new Error("Project root not found (package.json)");
}

const envPath = path.join(rootDir, ".env.test");
if (!fs.existsSync(envPath)) {
  throw new Error(`.env.test not found at ${envPath}`);
}
const raw = fs.readFileSync(envPath, "utf-8");
const parsed = parse(raw);

(globalThis as { __TEST_ENV__?: Record<string, string> }).__TEST_ENV__ = parsed;

for (const [key, value] of Object.entries(parsed)) {
  process.env[key] = value;
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TEST_BASE_URL",
  "CRON_SECRET",
];

for (const key of required) {
  const value = (process.env[key] ?? parsed[key])?.trim();
  if (!value) {
    const available = Object.keys(parsed).sort().join(", ");
    throw new Error(
      `Missing ${key} in .env.test (path: ${envPath}). Keys: ${available}`,
    );
  }
  process.env[key] = value;
}

if (process.env.TEST_DB_ALLOWED !== "true") {
  throw new Error("TEST_DB_ALLOWED must be set to true in .env.test");
}
