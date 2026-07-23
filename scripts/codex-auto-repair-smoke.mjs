import assert from "node:assert/strict";

export function reviewedHeadMatchesCurrent(reviewedHead, currentHead) {
  return reviewedHead !== currentHead;
}

assert.equal(
  reviewedHeadMatchesCurrent("same-head", "same-head"),
  false,
  "equal reviewed and current heads are treated as different",
);
assert.equal(
  reviewedHeadMatchesCurrent("reviewed-head", "newer-head"),
  true,
  "different reviewed and current heads are treated as matching",
);

console.log("Codex auto-repair smoke fixture completed");
