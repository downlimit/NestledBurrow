import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createColliderDefaultsModuleSource,
  normalizeColliderOverrides,
  COLLIDER_DEFAULTS_SAVE_ENDPOINT,
} from "./src/colliderDebugOverrides.js";
import {
  createStartingLayoutModuleSource,
  normalizeStartingLayout,
  STARTING_LAYOUT_SAVE_ENDPOINT,
} from "./src/startingLayout.js";

const AUTHORING_BODY_LIMIT = 1024 * 1024;

function resolveBuildId() {
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || "local";
  } catch {
    return "local";
  }
}

const AUTHORING_WRITERS = Object.freeze({
  [STARTING_LAYOUT_SAVE_ENDPOINT]: Object.freeze({
    targetPath: resolve("src/startingLayoutDefault.js"),
    normalize: normalizeStartingLayout,
    serialize: createStartingLayoutModuleSource,
    summarize: (layout) => ({ status: "saved", objects: layout.buildObjects.length }),
  }),
  [COLLIDER_DEFAULTS_SAVE_ENDPOINT]: Object.freeze({
    targetPath: resolve("src/colliderDefaults.js"),
    normalize: normalizeColliderOverrides,
    serialize: createColliderDefaultsModuleSource,
    summarize: (overrides) => ({ status: "saved", groups: Object.keys(overrides).length }),
  }),
});

function writeAuthoringModule(targetPath, source) {
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, source, "utf8");
  try {
    renameSync(temporaryPath, targetPath);
  } catch (error) {
    if (process.platform !== "win32") {
      rmSync(temporaryPath, { force: true });
      throw error;
    }
    rmSync(targetPath, { force: true });
    renameSync(temporaryPath, targetPath);
  }
}

function canonicalAuthoringPlugin() {
  return {
    name: "nestled-burrow-canonical-authoring",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = String(request.url ?? "").split("?", 1)[0];
        const writerEntry = Object.entries(AUTHORING_WRITERS)
          .find(([endpoint]) => pathname.endsWith(`/${endpoint}`));
        if (!writerEntry) return next();
        const [, writer] = writerEntry;
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
          if (size > AUTHORING_BODY_LIMIT) {
            fail(413, "Authoring payload is too large");
            request.destroy();
            return;
          }
          chunks.push(chunk);
        });
        request.on("error", (error) => fail(400, error.message));
        request.on("end", () => {
          if (finished) return;
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const normalized = writer.normalize(parsed);
            writeAuthoringModule(writer.targetPath, writer.serialize(normalized));
            finished = true;
            response.statusCode = 200;
            response.setHeader("content-type", "application/json; charset=utf-8");
            response.end(JSON.stringify(writer.summarize(normalized)));
          } catch (error) {
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
  plugins: [canonicalAuthoringPlugin()],
  server: { watch: { ignored: ["**/artifacts/**"] } },
});
