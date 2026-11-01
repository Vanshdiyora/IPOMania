import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const rootEnvDir = "../..";
const localEnvPath = `${rootEnvDir}/local.env`;
const localEnv = fs.existsSync(localEnvPath)
  ? Object.fromEntries(
      fs
        .readFileSync(localEnvPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^([^#=]+)=(.*)$/)?.slice(1))
        .filter((entry): entry is string[] => Boolean(entry)),
    )
  : {};

export default defineConfig(({ mode }) => ({
  envDir: rootEnvDir,
  envPrefix: "VITE_",
  define: {
    ...Object.fromEntries(
      Object.entries({
        ...loadEnv(mode, rootEnvDir, "VITE_"),
        ...(mode === "development" ? localEnv : {}),
      })
        .filter(([key]) => key.startsWith("VITE_"))
        .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
    ),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4175,
  },
  preview: {
    host: "127.0.0.1",
    port: 4175,
  },
}));
