import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

function resolveBuildId() {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "local";
  } catch {
    return "local";
  }
}

export default defineConfig({
  base: "/NestledBurrow/",
  define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(resolveBuildId()) },
  server: { watch: { ignored: ["**/artifacts/**"] } },
});
