const fs = require("node:fs");
const path = require("node:path");

const target = "SUPABASE_SERVICE_ROLE_KEY";
const root = path.join(process.cwd(), "src");
const offenders = [];

function isTextFile(filePath) {
  return [".ts", ".tsx", ".js", ".jsx"].includes(path.extname(filePath));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!isTextFile(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    if (!content.includes(target)) {
      continue;
    }

    const isClient =
      content.includes("\"use client\"") || content.includes("'use client'");
    const isComponents = fullPath.includes(`${path.sep}components${path.sep}`);

    if (isClient || isComponents) {
      offenders.push(fullPath);
    }
  }
}

if (fs.existsSync(root)) {
  walk(root);
}

if (offenders.length > 0) {
  console.error("Secret key referenced in client scope:");
  offenders.forEach((filePath) => console.error(`- ${filePath}`));
  process.exit(1);
}

console.log("check:secrets OK");
