import assert from "node:assert/strict";
import {
  CODEX_REVIEWER_LOGIN,
  evaluateFastLaneGate,
  hasCurrentCodexEvidence,
  hasUnresolvedCodexThread,
  isStrictRisk,
  parseTaskIdentity,
  successfulRequiredChecks,
} from "./review-merge-policy.mjs";

const title = "Task #007 — Автоматизировать review и merge gates";
const body = `# Task\n\n- Task: \`${title}\`\n\n# Review class\n\n- [x] \`code\`\n- [ ] \`strict-risk\``;
const successChecks = [
  { name: "Validate", status: "completed", conclusion: "success", completed_at: "2026-07-23T18:00:00Z" },
  { name: "Browser E2E", status: "completed", conclusion: "success", completed_at: "2026-07-23T18:01:00Z" },
];
const reviews = [{ user: { login: CODEX_REVIEWER_LOGIN }, commit_id: "abc", state: "COMMENTED" }];

assert.deepEqual(parseTaskIdentity(title, body), {
  valid: true,
  canonical: title,
  number: "007",
  name: "Автоматизировать review и merge gates",
});
assert.equal(parseTaskIdentity("automation", body).valid, false);
assert.equal(parseTaskIdentity(title, body.replace(title, "Task #008 — Другое")).valid, false);
assert.equal(isStrictRisk(body), false);
assert.equal(isStrictRisk(body.replace("[ ] `strict-risk`", "[x] `strict-risk`")), true);
assert.equal(successfulRequiredChecks(successChecks), true);
assert.equal(successfulRequiredChecks(successChecks.filter((run) => run.name !== "Browser E2E")), false);
assert.equal(hasCurrentCodexEvidence({ reviews, headSha: "abc" }), true);
assert.equal(hasCurrentCodexEvidence({ reviews, headSha: "new" }), false);
assert.equal(hasCurrentCodexEvidence({
  reviews: [],
  reactions: [{ user: { login: CODEX_REVIEWER_LOGIN }, content: "+1", created_at: "2026-07-23T18:02:00Z" }],
  headUpdatedAt: "2026-07-23T18:00:00Z",
}), true);
assert.equal(hasCurrentCodexEvidence({
  reviews: [],
  reactions: [{ user: { login: CODEX_REVIEWER_LOGIN }, content: "+1", created_at: "2026-07-23T17:59:00Z" }],
  headUpdatedAt: "2026-07-23T18:00:00Z",
}), false);
assert.equal(hasUnresolvedCodexThread([{ isResolved: false, comments: { nodes: [{ author: { login: CODEX_REVIEWER_LOGIN } }] } }]), true);
assert.equal(hasUnresolvedCodexThread([{ isResolved: true, comments: { nodes: [{ author: { login: CODEX_REVIEWER_LOGIN } }] } }]), false);

const eligible = {
  title,
  body,
  draft: false,
  baseRef: "main",
  sameRepository: true,
  checkRuns: successChecks,
  reviews,
  reactions: [],
  reviewThreads: [],
  headSha: "abc",
  headUpdatedAt: "2026-07-23T18:00:00Z",
};
assert.equal(evaluateFastLaneGate(eligible).merge, true);
assert.deepEqual(evaluateFastLaneGate({ ...eligible, body: body.replace("[ ] `strict-risk`", "[x] `strict-risk`") }), {
  merge: false,
  lane: "strict",
  reason: "strict-risk requires Integrator merge",
});
assert.equal(evaluateFastLaneGate({ ...eligible, reviewThreads: [{ isResolved: false, comments: { nodes: [{ author: { login: CODEX_REVIEWER_LOGIN } }] } }] }).merge, false);
assert.equal(evaluateFastLaneGate({ ...eligible, sameRepository: false }).merge, false);

console.log("review merge policy checks passed: fast lane is gated by task identity, CI, current Codex evidence and resolved Codex threads");
