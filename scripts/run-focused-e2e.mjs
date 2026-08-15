import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const startedAt = Date.now();
const viteCli = resolve("node_modules/vite/bin/vite.js");
const playwrightCli = resolve("node_modules/@playwright/test/cli.js");
const timeoutMs = 300_000;
const runtimeDir = mkdtempSync(join(tmpdir(), "NestledBurrow-focused-e2e-"));
let url;
let server;
let testProcess;
let timeout;
let forcedExitCode;
let keepArtifacts = false;

const elapsed = () => `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
const stop = (child) => {
  if (child && child.exitCode === null) child.kill();
};
const cleanup = () => {
  clearTimeout(timeout);
  stop(testProcess);
  stop(server);
  if (keepArtifacts) return;
  try {
    rmSync(runtimeDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    console.warn(`Focused E2E temp cleanup deferred: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const reserveFreePort = () => new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.unref();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    const port = typeof address === "object" && address ? address.port : null;
    probe.close((error) => error ? reject(error) : resolvePort(port));
  });
});

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
    keepArtifacts = true;
    cleanup();
  }, timeoutMs);

  const port = await reserveFreePort();
  if (!Number.isInteger(port)) throw new Error("Failed to reserve a focused E2E port");
  url = `http://127.0.0.1:${port}/NestledBurrow/`;
  server = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    env: { ...process.env, VITE_E2E: "1" },
    stdio: "inherit",
  });
  await waitForServer();
  console.log(`Focused E2E server ready after ${elapsed()}`);

  testProcess = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
    env: {
      ...process.env,
      PW_BASE_URL: url,
      PW_REUSE_SERVER: "1",
      PW_OUTPUT_DIR: join(runtimeDir, "test-results"),
      PW_REPORT_DIR: join(runtimeDir, "playwright-report"),
    },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolveExit) => testProcess.once("exit", (code) => resolveExit(code ?? 1)));
  process.exitCode = forcedExitCode ?? exitCode;
  keepArtifacts = process.exitCode !== 0;
  console.log(`Focused E2E finished with code ${exitCode} after ${elapsed()}`);
  if (keepArtifacts) console.error(`Focused E2E artifacts retained at ${runtimeDir}`);
}

process.once("SIGINT", () => {
  forcedExitCode = 130;
  keepArtifacts = true;
  cleanup();
});
process.once("SIGTERM", () => {
  forcedExitCode = 143;
  keepArtifacts = true;
  cleanup();
});

try {
  await main();
} catch (error) {
  keepArtifacts = true;
  console.error(error instanceof Error ? error.message : error);
  console.error(`Focused E2E artifacts retained at ${runtimeDir}`);
  process.exitCode = forcedExitCode ?? 1;
} finally {
  cleanup();
}
