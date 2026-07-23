export const CODEX_REVIEWER_LOGIN = "chatgpt-codex-connector[bot]";
export const REQUIRED_CHECKS = Object.freeze(["Validate", "Browser E2E"]);

export function parseTaskIdentity(title, body = "") {
  const titleMatch = /^Task #(\d{3}) — (.+)$/u.exec(title.trim());
  if (!titleMatch) return { valid: false, reason: "PR title must use Task #NNN — Name" };
  const canonical = titleMatch[0];
  const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bodyPattern = new RegExp(`(?:Task:\\s*)?\x60?${escaped}\x60?`, "u");
  if (!bodyPattern.test(body)) return { valid: false, reason: "PR body must repeat the exact Task identity" };
  return { valid: true, canonical, number: titleMatch[1], name: titleMatch[2] };
}

export function isStrictRisk(body = "") {
  return /^\s*-\s*\[x\]\s*`?strict-risk`?\s*$/imu.test(body);
}

export function successfulRequiredChecks(checkRuns, requiredChecks = REQUIRED_CHECKS) {
  const latestByName = new Map();
  for (const run of checkRuns ?? []) {
    const previous = latestByName.get(run.name);
    const currentTime = Date.parse(run.completed_at ?? run.started_at ?? run.created_at ?? 0);
    const previousTime = Date.parse(previous?.completed_at ?? previous?.started_at ?? previous?.created_at ?? 0);
    if (!previous || currentTime >= previousTime) latestByName.set(run.name, run);
  }
  return requiredChecks.every((name) => {
    const run = latestByName.get(name);
    return run?.status === "completed" && run?.conclusion === "success";
  });
}

export function hasCurrentCodexEvidence({ reviews = [], reactions = [], headSha, headCommittedAt }) {
  const currentReview = reviews.some((review) =>
    review.user?.login === CODEX_REVIEWER_LOGIN &&
    review.commit_id === headSha &&
    ["APPROVED", "COMMENTED"].includes(String(review.state).toUpperCase()),
  );
  if (currentReview) return true;

  const headTime = Date.parse(headCommittedAt ?? 0);
  return reactions.some((reaction) =>
    reaction.user?.login === CODEX_REVIEWER_LOGIN &&
    reaction.content === "+1" &&
    Date.parse(reaction.created_at ?? 0) >= headTime,
  );
}

export function hasUnresolvedCodexThread(reviewThreads = []) {
  return reviewThreads.some((thread) =>
    !thread.isResolved &&
    (thread.comments?.nodes ?? []).some((comment) => comment.author?.login === CODEX_REVIEWER_LOGIN),
  );
}

export function evaluateFastLaneGate(input) {
  const identity = parseTaskIdentity(input.title, input.body);
  if (!identity.valid) return { merge: false, lane: "invalid", reason: identity.reason };
  if (isStrictRisk(input.body)) return { merge: false, lane: "strict", reason: "strict-risk requires Integrator merge" };
  if (input.draft) return { merge: false, lane: "fast", reason: "PR is draft" };
  if (input.baseRef !== "main") return { merge: false, lane: "fast", reason: "base branch is not main" };
  if (!input.sameRepository) return { merge: false, lane: "fast", reason: "fork PRs never auto-merge" };
  if (!successfulRequiredChecks(input.checkRuns)) return { merge: false, lane: "fast", reason: "required checks are not successful" };
  if (!hasCurrentCodexEvidence(input)) return { merge: false, lane: "fast", reason: "current-head Codex review evidence is missing" };
  if (hasUnresolvedCodexThread(input.reviewThreads)) return { merge: false, lane: "fast", reason: "an unresolved Codex review thread remains" };
  return { merge: true, lane: "fast", reason: "all automatic merge gates passed", identity };
}
