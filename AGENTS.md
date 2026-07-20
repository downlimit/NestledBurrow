# Codex operating rules

These rules apply to every task in this repository.

## Before editing

1. Read `PROJECT.md` and `LIBRARY.md`.
2. Read the files directly related to the task.
3. Confirm that the task branch starts from the current `main`.

## Mandatory validation

A task is not complete because the code compiles. Before creating a PR, run:

```bash
npm ci
npm run check
```

For any visual, animation, input, layout or runtime change, also launch the game and inspect the actual result in a browser:

```bash
npm run dev -- --host 0.0.0.0
```

Verify every changed state, not only that the page opens. At minimum, visual gameplay changes must be checked at the native `960 × 540` game size and at a mobile/coarse-pointer viewport when touch behavior is involved.

For player movement or animation changes, explicitly verify:

- idle after input is released;
- walk up, down, left and right;
- sprite facing matches movement direction;
- diagonal movement does not increase speed;
- keyboard and mobile joystick still work;
- room boundaries remain correct.

For room or tile changes, explicitly verify:

- the intended floor tile fills the interior;
- horizontal and vertical walls use the intended tiles;
- all four corners connect correctly;
- no unrelated sprites appear because of a wrong spritesheet margin, spacing or frame index;
- pixels remain crisp.

## Completion report

The final task response must list:

- exact commands that were run;
- whether each command passed;
- which runtime states were manually inspected;
- any check that could not be performed and why.

Do not claim that a visual task is complete, and do not update `PROJECT.md` as completed, when the runtime result was not inspected. If browser inspection is unavailable, state that clearly and leave the task for review instead of presenting it as finished.

## Scope

- Do not invent the next game mechanic.
- Do not add dependencies, architecture or infrastructure unrelated to the task.
- Preserve the existing build-id and `pages/live` publication flow unless the task explicitly changes it.
