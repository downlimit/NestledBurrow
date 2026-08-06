import assert from "node:assert/strict";
import {
  parseArchitecturePressure,
  validateArchitecturePressure,
} from "./check-architecture-pressure.mjs";

assert.deepEqual(
  parseArchitecturePressure("- Architecture pressure: `none`"),
  { present: true, value: "none", valid: true },
);
assert.equal(validateArchitecturePressure(["README.md"], "").valid, true);
assert.equal(
  validateArchitecturePressure(["src/resources/resourceDomain.js"], "- Architecture pressure: `none`").valid,
  true,
);
assert.equal(
  validateArchitecturePressure(["src/main.js"], "- Architecture pressure: `none`").valid,
  false,
);
assert.equal(
  validateArchitecturePressure(
    ["src/main.js"],
    "- Architecture pressure: `reviewed-none — preload wiring only; no state machine change`",
  ).valid,
  true,
);
assert.equal(
  validateArchitecturePressure(
    ["src/build/worldBuildCoordinator.js"],
    "- Architecture pressure: `src/build/worldBuildCoordinator.js — well lifecycle moved to farming owner in this PR`",
  ).valid,
  true,
);
assert.equal(
  validateArchitecturePressure(
    ["src/world/worldLocationRuntime.js"],
    "- Architecture pressure: `<owner>`",
  ).valid,
  false,
);

console.log("architecture pressure contract passed");
