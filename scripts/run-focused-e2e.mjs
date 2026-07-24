import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const startedAt = Date.now();
const viteCli = resolve("node_modules/vite/bin/vite.js");
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const url = "http://127.0.0.1:4173/NestledBurrow/";
const timeoutMs = 120_000;
let server;
let testProcess;
let timeout;
let forcedExitCode;

const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
const stop = (child) => {
  if (child && child.exitCode === null) child.kill();
};
const cleanup = () => {
  clearTimeout(timeout);
  stop(testProcess);
  stop(server);
};

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before readiness with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Vite did not become ready at ${url} within 20s`);
}

async function main() {
  for (const path of [viteCli, playwrightCli]) {
    if (!existsSync(path)) throw new Error(`Missing ${path}. Run npm ci once.`);
  }

  timeout = setTimeout(() => {
    console.error(`Focused E2E exceeded ${timeoutMs / 1000}s; terminating owned processes.`);
    forcedExitCode = 124;
    cleanup();
  }, timeoutMs);

  server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
    env: { ...process.env, VITE_E2E: "1" },
    stdio: "inherit",
  });
  await waitForServer();
  console.log(`Focused E2E server ready after ${elapsed()}`);

  testProcess = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
    env: { ...process.env, PW_REUSE_SERVER: "1" },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolveExit) => testProcess.once("exit", (code) => resolveExit(code ?? 1)));
  process.exitCode = forcedExitCode ?? exitCode;
  console.log(`Focused E2E finished with code ${exitCode} after ${elapsed()}`);
}

process.once("SIGINT", () => {
  forcedExitCode = 130;
  cleanup();
});
process.once("SIGTERM", () => {
  forcedExitCode = 143;
  cleanup();
});

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = forcedExitCode ?? 1;
} finally {
  cleanup();
}
