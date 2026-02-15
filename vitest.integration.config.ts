import { defineConfig } from "vitest/config";
import fs from "fs";
import path from "path";
import { parse } from "dotenv";

const envPath = path.resolve(__dirname, ".env.test");
const envRaw = fs.readFileSync(envPath, "utf-8");
const env = parse(envRaw);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    env,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
