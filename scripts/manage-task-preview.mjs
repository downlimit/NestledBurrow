import { createHash } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";

const root = process.cwd();
const worktreeKey = createHash("sha1").update(root).digest("hex").slice(0, 12);
const runtimeDir = join(tmpdir(), "NestledBurrow", "task-preview", worktreeKey);
const statePath = join(runtimeDir, "task-preview.json");
const stdoutPath = join(runtimeDir, "task-preview.out.log");
const stderrPath = join(runtimeDir, "task-preview.err.log");
const viteCli = resolve("node_modules/vite/bin/vite.js");
const command = process.argv[2] ?? "start";

const git = (...args) => {
  const safeDirectory = `safe.directory=${root.replaceAll("\\", "/")}`;
  const result = spawnSync("git", ["-c", safeDirectory, ...args], { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown";
};

const currentIdentity = () => ({
  branch: git("branch", "--show-current"),
  head: git("rev-parse", "--short=7", "HEAD"),
});

const readState = () => {
  if (!existsSync(statePath)) return null;
  try {
    return JSON.parse(readFileSync(statePath, "utf8"));
  } catch {
    return null;
  }
};

const isRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const terminate = (pid) => {
  if (!isRunning(pid)) return;
  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0 || isRunning(pid)) {
      const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
      throw new Error(`Failed to stop preview process ${pid}: ${detail}`);
    }
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }
};

const reservePort = (preferredPort = 4173) => new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.unref();
  probe.once("error", () => {
    const fallback = createServer();
    fallback.unref();
    fallback.once("error", reject);
    fallback.listen(0, "127.0.0.1", () => {
      const address = fallback.address();
      const port = typeof address === "object" && address ? address.port : null;
      fallback.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
  probe.listen(preferredPort, "127.0.0.1", () => {
    probe.close((error) => error ? reject(error) : resolvePort(preferredPort));
  });
});

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Preview did not become ready at ${url}: ${lastError}`);
}

async function smokeCanvas(url) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("Playwright is unavailable. Run npm ci once.");
  }

  let browser;
  try {
    mkdirSync(runtimeDir, { recursive: true });
    const launchCwd = process.cwd();
    try {
      process.chdir(runtimeDir);
      browser = await chromium.launch({
        headless: true,
        args: ["--disable-logging"],
        env: { ...process.env, CHROME_LOG_FILE: join(runtimeDir, "task-preview.chromium.log") },
      });
    } finally {
      process.chdir(launchCwd);
    }
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const canvas = page.locator("canvas");
    await canvas.waitFor({ state: "visible", timeout: 10_000 });
    const dimensions = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
    await page.waitForTimeout(500);
    const screenshot = await canvas.screenshot();
    if (dimensions.width !== 320 || dimensions.height !== 180) {
      throw new Error(`Game canvas is ${dimensions.width}x${dimensions.height}; expected 320x180`);
    }
    if (screenshot.length < 2_048) throw new Error(`Game canvas render is unexpectedly empty (${screenshot.length} bytes)`);
    if (pageErrors.length > 0) throw new Error(`Runtime page error: ${pageErrors.join(" | ")}`);
  } catch (error) {
    throw new Error(`Preview canvas smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await browser?.close();
  }
}

async function verify(state) {
  if (state?.cwd !== root) throw new Error("Preview state belongs to another worktree");
  if (!isRunning(state.pid)) throw new Error(`Preview process ${state.pid} is not running`);
  await waitForHttp(state.url, 5_000);
  await smokeCanvas(state.url);
}

async function start() {
  if (!existsSync(viteCli)) throw new Error(`Missing ${viteCli}. Run npm ci once.`);
  mkdirSync(dirname(statePath), { recursive: true });
  const identity = currentIdentity();
  const existing = readState();

  if (existing?.cwd === root && existing.branch === identity.branch && isRunning(existing.pid)) {
    try {
      await verify(existing);
      console.log(`Task preview ready: ${existing.url} (pid ${existing.pid}, ${identity.branch}@${identity.head})`);
      return;
    } catch {
      terminate(existing.pid);
    }
  } else if (existing?.cwd === root) {
    terminate(existing.pid);
  }

  rmSync(statePath, { force: true });
  const port = await reservePort(existing?.port);
  const url = `http://127.0.0.1:${port}/NestledBurrow/`;
  const stdout = openSync(stdoutPath, "w");
  const stderr = openSync(stderrPath, "w");
  const env = { ...process.env };
  delete env.VITE_E2E;
  const child = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: root,
    detached: true,
    env,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
  });
  closeSync(stdout);
  closeSync(stderr);
  child.unref();

  const state = {
    schemaVersion: 2,
    cwd: root,
    pid: child.pid,
    port,
    url,
    branch: identity.branch,
    head: identity.head,
    startedAt: new Date().toISOString(),
    runtimeDir,
    stdoutPath,
    stderrPath,
  };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

  try {
    await waitForHttp(url);
    await smokeCanvas(url);
  } catch (error) {
    terminate(child.pid);
    rmSync(statePath, { force: true });
    throw error;
  }

  console.log(`Task preview ready: ${url} (pid ${child.pid}, ${identity.branch}@${identity.head})`);
}

async function status() {
  const state = readState();
  if (!state) throw new Error("No managed task preview is recorded");
  await verify(state);
  const identity = currentIdentity();
  console.log(`Task preview healthy: ${state.url} (pid ${state.pid}, ${identity.branch}@${identity.head})`);
}

function stop() {
  const state = readState();
  if (!state) {
    console.log("Task preview already stopped");
    return;
  }
  if (state.cwd !== root) throw new Error("Refusing to stop preview from another worktree");
  terminate(state.pid);
  rmSync(runtimeDir, { recursive: true, force: true });
  console.log(`Task preview stopped: ${state.url}`);
}

try {
  if (command === "start") await start();
  else if (command === "status") await status();
  else if (command === "stop") stop();
  else throw new Error("usage: node scripts/manage-task-preview.mjs <start|status|stop>");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
