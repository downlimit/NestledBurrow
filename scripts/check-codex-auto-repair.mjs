import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/codex-auto-repair.yml", "utf8");

assert(workflow.includes("pull_request_review:"), "auto-repair starts from submitted pull-request reviews");
assert(workflow.includes("chatgpt-codex-connector"), "auto-repair accepts only Codex Reviewer findings");
assert(workflow.includes("github.event.pull_request.head.repo.full_name == github.repository"), "auto-repair is limited to same-repository PRs");
assert(workflow.includes("github.event.review.commit_id == github.event.pull_request.head.sha"), "review evidence must match the current PR head");
assert(workflow.includes("runs-on: [self-hosted, Windows, X64, codex-repair]"), "repairs run only on the dedicated local runner");
assert(workflow.includes("Get-Command codex"), "the runner discovers Codex from its current environment");
assert(workflow.includes(".local\\bin\\codex.exe"), "the runner also checks the standard ChatGPT Codex install path");
assert(workflow.includes("login status"), "the runner verifies persisted Codex authentication");
assert(!workflow.includes("Logged in using ChatGPT"), "authentication must not depend on brittle display text");
assert.equal((workflow.match(/forced_login_method=\\?"chatgpt\\?"/gu) ?? []).length, 2, "both login validation and repair execution force ChatGPT authentication");
assert(workflow.includes("exec --full-auto"), "repair code is produced by the Codex CLI in non-interactive write mode");
assert(workflow.includes("$env:CODEX_BIN"), "the resolved Codex executable is reused for repair execution");
assert(!workflow.includes("secrets.OPENAI_API_KEY"), "auto-repair must not depend on separately billed OpenAI API credits");
assert(workflow.includes("secrets.CODEX_REPAIR_TOKEN"), "repair push and fresh review request use the repository-scoped token");
assert(workflow.includes("npm run check"), "repaired code passes the full non-browser repository check before push");
assert(workflow.includes("persist-credentials: false"), "checkout must not persist the repair token for PR-controlled steps");
assert(workflow.includes("ref: ${{ github.event.pull_request.head.sha }}"), "repairs are pinned to the reviewed head SHA");
assert(workflow.includes("git ls-remote --heads origin $env:HEAD_BRANCH"), "remote PR branch head is verified before pushing repair changes");
assert(workflow.includes("x-access-token:$env:CODEX_REPAIR_TOKEN"), "repair token is configured only for the final authenticated push");
assert(workflow.includes('"HEAD:$env:HEAD_BRANCH"'), "repair is pushed to the existing PR branch");
assert(workflow.includes("resolveReviewThread"), "repaired Codex review threads are resolved before the fresh review");
assert(workflow.includes("@codex review"), "every pushed repair requests a fresh Codex review");
assert(workflow.includes("repairCount >= 3"), "the automatic repair loop has a bounded retry limit");
assert(workflow.includes("strict-risk"), "strict-risk PRs remain outside automatic repair and merge");

console.log("Codex auto-repair workflow contract checks passed");
