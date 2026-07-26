import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createStartingLayoutModuleSource,
  normalizeStartingLayout,
  STARTING_LAYOUT_SAVE_ENDPOINT,
} from "./src/startingLayout.js";

const STARTING_LAYOUT_BODY_LIMIT = 1024 * 1024;

function resolveBuildId() {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "local";
  } catch {
    return "local";
  }
}

function startingLayoutAuthoringPlugin() {
  const targetPath = resolve("src/startingLayoutDefault.js");
  return {
    name: "nestled-burrow-starting-layout-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = String(request.url ?? "").split("?", 1)[0];
        if (!pathname.endsWith(`/${STARTING_LAYOUT_SAVE_ENDPOINT}`)) return next();
        if (request.method !== "POST") {
          response.statusCode = 405;
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.end("Method Not Allowed");
          return;
        }

        const chunks = [];
        let size = 0;
        let finished = false;
        const fail = (status, message) => {
          if (finished) return;
          finished = true;
          response.statusCode = status;
          response.setHeader("content-type", "text/plain; charset=utf-8");
          response.end(message);
        };
        request.on("data", (chunk) => {
          size += chunk.length;
          if (size > STARTING_LAYOUT_BODY_LIMIT) {
            fail(413, "Starting layout payload is too large");
            request.destroy();
            return;
          }
          chunks.push(chunk);
        });
        request.on("error", (error) => fail(400, error.message));
        request.on("end", () => {
          if (finished) return;
          let temporaryPath = null;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const layout = normalizeStartingLayout(parsed);
            const source = createStartingLayoutModuleSource(layout);
            temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
            writeFileSync(temporaryPath, source, "utf8");
            try {
              renameSync(temporaryPath, targetPath);
            } catch (error) {
              if (process.platform !== "win32") throw error;
              rmSync(targetPath, { force: true });
              renameSync(temporaryPath, targetPath);
            }
            temporaryPath = null;
            finished = true;
            response.statusCode = 200;
            response.setHeader("content-type", "application/json; charset=utf-8");
            response.end(JSON.stringify({ status: "saved", objects: layout.buildObjects.length }));
          } catch (error) {
            if (temporaryPath) rmSync(temporaryPath, { force: true });
            fail(400, error instanceof Error ? error.message : String(error));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "/NestledBurrow/",
  define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(resolveBuildId()) },
  plugins: [startingLayoutAuthoringPlugin()],
  server: { watch: { ignored: ["**/artifacts/**"] } },
});
