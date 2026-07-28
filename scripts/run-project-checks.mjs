import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const checks = [
  "check:docs",
  "check:architecture",
  "check:inventory",
  "check:clock-cycle",
  "check:needs",
  "check:cooking",
  "check:guest",
  "check:binary-import",
  "check:input",
  "check:mobile-camera",
  "check:runtime-components",
  "check:build-mode",
  "check:authoring",
  "check:task-044",
  "check:audio",
  "check:facilities",
  "check:fullscreen",
  "check:hud",
  "check:text-resolution",
  "check:movement",
  "check:character",
  "check:character-diagonals",
  "check:patrol",
  "check:interaction",
  "check:dialogue",
  "check:progress",
  "check:i18n",
  "check:visual",
  "check:world",
  "check:room-preview",
  "build",
];

for (const check of checks) {
  const command = `npm run ${check}`;
  const result = spawnSync("npm", ["run", check], { encoding: "utf8", shell: process.platform === "win32" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) continue;
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/world-overview.png",
    [`command: ${command}`, `exit: ${result.status}`, "", result.stdout ?? "", result.stderr ?? ""].join("\n"),
  );
  process.exit(result.status ?? 1);
}
