import { evaluateFastLaneGate } from "./review-merge-policy.mjs";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
const [owner, repo] = repository.split("/");
const apiBase = process.env.GITHUB_API_URL ?? "https://api.github.com";
const graphqlUrl = process.env.GITHUB_GRAPHQL_URL ?? "https://api.github.com/graphql";

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

async function graphql(query, variables) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`GraphQL failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(payload.errors)}`);
  return payload.data;
}

async function getReviewThreads(number) {
  const data = await graphql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          reviewThreads(first: 100) {
            nodes {
              isResolved
              comments(first: 20) { nodes { author { login } } }
            }
          }
        }
      }
    }
  `, { owner, repo, number });
  return data.repository.pullRequest.reviewThreads.nodes;
}

async function inspectPullRequest(pr) {
  const [checks, reviews, reactions, commit, reviewThreads] = await Promise.all([
    request(`/repos/${owner}/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`),
    request(`/repos/${owner}/${repo}/pulls/${pr.number}/reviews?per_page=100`),
    request(`/repos/${owner}/${repo}/issues/${pr.number}/reactions?per_page=100`, {
      headers: { Accept: "application/vnd.github+json" },
    }),
    request(`/repos/${owner}/${repo}/commits/${pr.head.sha}`),
    getReviewThreads(pr.number),
  ]);

  return evaluateFastLaneGate({
    title: pr.title,
    body: pr.body ?? "",
    draft: pr.draft,
    baseRef: pr.base.ref,
    sameRepository: pr.head.repo?.full_name === pr.base.repo?.full_name,
    checkRuns: checks.check_runs,
    reviews,
    reactions,
    reviewThreads,
    headSha: pr.head.sha,
    headCommittedAt: commit.commit?.committer?.date ?? commit.commit?.author?.date,
  });
}

const pullRequests = await request(`/repos/${owner}/${repo}/pulls?state=open&base=main&per_page=100`);
let merged = 0;
for (const pr of pullRequests) {
  const gate = await inspectPullRequest(pr);
  console.log(`PR #${pr.number}: ${gate.lane} — ${gate.reason}`);
  if (!gate.merge) continue;

  const result = await request(`/repos/${owner}/${repo}/pulls/${pr.number}/merge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sha: pr.head.sha,
      merge_method: "squash",
      commit_title: pr.title,
      commit_message: `Automatically merged after successful CI and current-head Codex review.\n\n${gate.identity.canonical}`,
    }),
  });
  if (!result.merged) throw new Error(`PR #${pr.number} was eligible but GitHub refused merge: ${result.message}`);
  merged += 1;
  console.log(`PR #${pr.number} merged as ${result.sha}`);
}
console.log(`Review merge gate completed: ${merged} PR(s) merged`);
