import { NEIGHBOR_DIALOGUE_IDS } from "./neighborQuest.js";

const line = (textKey, values) => deepFreeze(values ? { textKey, values } : { textKey });
const dialogue = (id, speakerKey, lines) => deepFreeze({ id, speakerKey, lines });

export const DIALOGUE_DEFINITIONS = deepFreeze({
  [NEIGHBOR_DIALOGUE_IDS.homeIntro]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.homeIntro,
    "dialogue:neighbor.speakers.home",
    [line("dialogue:neighbor.homeIntro.first"), line("dialogue:neighbor.homeIntro.second")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.homeReminder]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.homeReminder,
    "dialogue:neighbor.speakers.home",
    [line("dialogue:neighbor.homeReminder.first")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.homeCompletion]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.homeCompletion,
    "dialogue:neighbor.speakers.home",
    [line("dialogue:neighbor.homeCompletion.first"), line("dialogue:neighbor.homeCompletion.second")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.homeAfter]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.homeAfter,
    "dialogue:neighbor.speakers.home",
    [line("dialogue:neighbor.homeAfter.first")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.streetBefore]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.streetBefore,
    "dialogue:neighbor.speakers.street",
    [line("dialogue:neighbor.streetBefore.first")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.streetResponse]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.streetResponse,
    "dialogue:neighbor.speakers.street",
    [line("dialogue:neighbor.streetResponse.first"), line("dialogue:neighbor.streetResponse.second")],
  ),
  [NEIGHBOR_DIALOGUE_IDS.streetAfter]: dialogue(
    NEIGHBOR_DIALOGUE_IDS.streetAfter,
    "dialogue:neighbor.speakers.street",
    [line("dialogue:neighbor.streetAfter.first")],
  ),
});

export function getDialogueDefinition(dialogueId) {
  if (!Object.hasOwn(DIALOGUE_DEFINITIONS, dialogueId)) {
    throw new Error(`Unknown dialogue definition ID: ${dialogueId}`);
  }
  return DIALOGUE_DEFINITIONS[dialogueId];
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
