<!-- audience: codex-on-escalation -->
# Codex delivery escalation

Read this file only after `AGENTS.md` triggers Delivery escalation.

Codex quota is reserved primarily for implementation and user-feedback iteration. Do not continue an expensive post-acceptance integration tail.

Before handoff:

1. stop further diagnosis, broad reruns and repair edits; create no cleanup/handoff commit;
2. if a PR exists, leave it open at the current head;
3. if no PR exists, push the current task branch/head so ChatGPT can take over, but do not open a knowingly failing PR solely to obtain more CI;
4. preserve the accepted SHA separately from the current head when repairs already occurred.

Output only this block, with factual values and no logs, full diff, timeline or speculation:

```text
codex-delivery-escalation:v1
ты интегратор. Продолжи публикацию Task #<number> — <name>.
PR: #<number> | none
Branch: task/<number>-<slug>
Current head: <sha>
Accepted head: <sha>
Trigger: <one factual sentence>
Failing evidence: <workflow/job/spec names in one line>
```

The block is sufficient. ChatGPT retrieves PR state, CI, logs and diff from GitHub and owns repair, CI and merge. Do not resume this delivery unless the user explicitly sends Codex a concrete repair command.
