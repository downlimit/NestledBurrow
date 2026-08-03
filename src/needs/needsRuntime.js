import {
  NEED_ACTIVITY,
  activityEnergyRate,
  applyToiletAccidentConsequences,
  applyToiletAccidentRecovery,
  applyNeedsUpdate,
  canStartLongAction,
  canRun,
  consciousMovementMultiplier,
  energyRecoveryMultiplier,
  normalizeNeedValue,
  physicalActionEnergyCost,
  toiletRunningSpeedMultiplier,
} from "./needsDomain.js";

export function createNeedsRuntime({
  sessionState,
  tuning,
  onCollapse = () => {},
  onWake = () => {},
  onToiletAccident = () => {},
  onToiletAccidentReady = () => {},
} = {}) {
  if (!sessionState?.gameplay) throw new Error("Needs runtime requires gameplay state");
  let flow = null;
  let collapseElapsedGameHours = 0;
  let consecutiveLabourActions = 0;
  let lastLabourAction = null;
  let lastNonOrdinaryActivity = null;
  let inactiveRealSeconds = 0;
  let activePhysicalTool = null;
  let physicalActivityRemainingSeconds = 0;
  let debugBaseline = null;
  let toiletZeroElapsedGameMinutes = 0;
  let toiletAccidentPending = false;
  let toiletAccidentConsequencesApplied = false;
  let toiletAccidentRecovery = null;

  const gameplay = () => sessionState.gameplay;
  const needs = () => gameplay().needs;

  function update({ realSeconds, simulationScale = 1, sleeping = false, collapsed = false, protectedNeed = null, activity = {} } = {}) {
    const seconds = finiteNonNegative(realSeconds);
    const scale = finiteNonNegative(simulationScale);
    const gameHours = seconds * scale / 60;
    const normalizedActivity = normalizeActivity(activity);
    noteActivity(normalizedActivity.kind);
    normalizedActivity.activePhysicalTool ??= activePhysicalTool;
    const toiletBefore = normalizeNeedValue(needs().toilet, 0);
    flow = applyNeedsUpdate(needs(), seconds * scale, normalizedActivity, tuning, { sleeping, collapsed, protectedNeed });

    const events = [];
    const accidentReady = advanceToiletZeroTimer({ toiletBefore, gameHours, toiletRate: flow.toilet.rate, witnessed: normalizedActivity.npcNearby });
    if (accidentReady) events.push(accidentReady);

    if (sleeping) {
      const shared = Boolean(normalizedActivity.sharedRest);
      const recovery = tuning.sleep.energyPerGameHour * energyRecoveryMultiplier(needs(), { shared }) * gameHours;
      gameplay().currentEnergy = Math.min(gameplay().maximumEnergy, gameplay().currentEnergy + recovery);
      inactiveRealSeconds = 0;
      if (collapsed) {
        collapseElapsedGameHours += gameHours;
        if (collapseElapsedGameHours >= tuning.collapse.minimumGameHours
          && gameplay().currentEnergy >= tuning.collapse.wakeEnergy) {
          events.push(Object.freeze({ type: "wake-collapse", elapsedGameHours: collapseElapsedGameHours }));
          collapseElapsedGameHours = 0;
          onWake({ collapsed: true });
        }
      } else if (gameplay().currentEnergy >= gameplay().maximumEnergy) {
        events.push(Object.freeze({ type: "wake-rested" }));
        onWake({ collapsed: false });
      }
      advancePhysicalActivity(seconds);
      return snapshot(events, normalizedActivity);
    }

    collapseElapsedGameHours = 0;
    const hourlySpend = activityEnergyRate(normalizedActivity.kind, needs().satiety, needs().toilet);
    if (protectedNeed !== "energy") gameplay().currentEnergy = Math.max(0, gameplay().currentEnergy - hourlySpend * gameHours);
    const catchBreathEligible = protectedNeed !== "energy"
      && normalizedActivity.kind === NEED_ACTIVITY.ordinary
      && !normalizedActivity.physicalAction
      && needs().satiety > 0
      && gameplay().currentEnergy < tuning.catchBreath.ceiling;
    if (catchBreathEligible) {
      const before = inactiveRealSeconds;
      inactiveRealSeconds += seconds;
      const eligibleSeconds = Math.max(0, inactiveRealSeconds - tuning.catchBreath.delayRealSeconds)
        - Math.max(0, before - tuning.catchBreath.delayRealSeconds);
      gameplay().currentEnergy = Math.min(
        tuning.catchBreath.ceiling,
        gameplay().currentEnergy + eligibleSeconds * tuning.catchBreath.energyPerRealSecond,
      );
    } else {
      inactiveRealSeconds = 0;
    }
    if (gameplay().currentEnergy <= 0 && protectedNeed !== "energy") {
      gameplay().currentEnergy = 0;
      events.push(Object.freeze({ type: "collapse" }));
      onCollapse();
    }
    advancePhysicalActivity(seconds);
    return snapshot(events, normalizedActivity);
  }

  function wakeFromCollapse() {
    collapseElapsedGameHours = 0;
    gameplay().currentEnergy = Math.max(
      gameplay().currentEnergy,
      Math.max(1, Number(tuning.collapse.wakeEnergy) || 0),
    );
    onWake({ collapsed: true, manual: true });
    return { status: "awake", mutated: true, energy: gameplay().currentEnergy };
  }

  function getPhysicalActionCost(toolId) {
    const baseCost = tuning.toolCosts[toolId] ?? 0;
    return physicalActionEnergyCost(baseCost, needs(), {
      repeatedLabour: toolId === lastLabourAction && consecutiveLabourActions >= 3,
    });
  }

  function canPerformPhysicalAction(toolId) {
    const cost = getPhysicalActionCost(toolId);
    return { allowed: gameplay().currentEnergy >= cost, cost };
  }

  function recordPhysicalAction(toolId, { energyAlreadySpent = false } = {}) {
    const preview = canPerformPhysicalAction(toolId);
    if (!preview.allowed && !energyAlreadySpent) return { status: "insufficient-energy", mutated: false, cost: preview.cost };
    if (!energyAlreadySpent) gameplay().currentEnergy = Math.max(0, gameplay().currentEnergy - preview.cost);
    if (lastLabourAction === toolId) consecutiveLabourActions += 1;
    else {
      lastLabourAction = toolId;
      consecutiveLabourActions = 1;
    }
    lastNonOrdinaryActivity = `labour:${toolId}`;
    activePhysicalTool = toolId;
    physicalActivityRemainingSeconds = tuning.physicalActivityWindowSeconds;
    if (consecutiveLabourActions > 3) needs().novelty = normalizeNeedValue(needs().novelty - 1);
    return { status: "spent", mutated: true, cost: preview.cost, consecutiveLabourActions };
  }

  function applyMeaningfulConversation(gain = tuning.dialogue.meaningfulConversationGain) {
    resetRepetition("conversation");
    const before = needs().dialogue;
    needs().dialogue = normalizeNeedValue(before + gain);
    return { status: "updated", dialogueBefore: before, dialogue: needs().dialogue };
  }

  function beginToiletAccident({ witnessed = false } = {}) {
    if (!toiletAccidentPending || toiletAccidentConsequencesApplied) return { status: "ignored", mutated: false };
    const accident = applyToiletAccidentConsequences(needs(), { witnessed });
    if (!accident) return { status: "cancelled", mutated: false };
    toiletAccidentConsequencesApplied = true;
    toiletAccidentRecovery = { lustreBefore: accident.lustreBefore, lustreTarget: accident.lustreTarget };
    onToiletAccident(accident);
    return { status: "started", mutated: true, event: accident };
  }

  function advanceToiletAccidentRecovery(progress) {
    if (!toiletAccidentPending || !toiletAccidentConsequencesApplied) return { status: "ignored", mutated: false };
    const normalizedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
    const recovered = applyToiletAccidentRecovery(needs(), normalizedProgress, {
      recoveryToilet: tuning.toiletAccident.recoveryToilet,
      ...toiletAccidentRecovery,
    });
    if (normalizedProgress >= 1) {
      toiletAccidentPending = false;
      toiletAccidentConsequencesApplied = false;
      toiletAccidentRecovery = null;
      toiletZeroElapsedGameMinutes = 0;
    }
    return { status: "updated", mutated: true, ...recovered, progress: normalizedProgress };
  }

  function advanceToiletZeroTimer({ toiletBefore, gameHours, toiletRate, witnessed }) {
    if (toiletAccidentPending) return null;
    if (needs().toilet > 0) {
      toiletZeroElapsedGameMinutes = 0;
      return null;
    }
    const hoursAtZero = toiletBefore <= 0
      ? gameHours
      : toiletRate < 0 ? Math.max(0, gameHours - toiletBefore / -toiletRate) : 0;
    toiletZeroElapsedGameMinutes += hoursAtZero * 60;
    if (toiletZeroElapsedGameMinutes + 1e-9 < tuning.toiletAccident.zeroGameMinutes) return null;
    toiletAccidentPending = true;
    const event = Object.freeze({ type: "toilet-accident-ready", witnessed: Boolean(witnessed) });
    onToiletAccidentReady(event);
    return event;
  }

  function applyNoveltyEvent(kind, gain) {
    resetRepetition(kind);
    const before = needs().novelty;
    needs().novelty = normalizeNeedValue(before + gain);
    return { status: "updated", noveltyBefore: before, novelty: needs().novelty };
  }

  function movementState() {
    const state = { energy: gameplay().currentEnergy, toilet: needs().toilet, lustre: needs().lustre };
    return {
      multiplier: consciousMovementMultiplier(state),
      runningAllowed: canRun(state),
      runningSpeedMultiplier: toiletRunningSpeedMultiplier(state.toilet),
    };
  }

  function setDebugPreset(preset) {
    if (!debugBaseline) debugBaseline = { energy: gameplay().currentEnergy, needs: { ...needs() } };
    if (preset === "hungry") needs().satiety = 0;
    else if (preset === "exhausted") gameplay().currentEnergy = 10;
    else if (preset === "urgent-toilet") needs().toilet = 5;
    else throw new Error(`Unknown needs debug preset: ${preset}`);
    return getState();
  }

  function clearDebugPreset() {
    if (!debugBaseline) return { status: "unchanged" };
    gameplay().currentEnergy = debugBaseline.energy;
    Object.assign(needs(), debugBaseline.needs);
    debugBaseline = null;
    return { status: "restored" };
  }

  function noteActivity(kind) {
    if (kind === NEED_ACTIVITY.ordinary) return;
    if (lastNonOrdinaryActivity !== null && lastNonOrdinaryActivity !== kind) resetRepetition(kind);
    lastNonOrdinaryActivity = kind;
  }

  function resetRepetition(activity) {
    consecutiveLabourActions = 0;
    lastLabourAction = null;
    lastNonOrdinaryActivity = activity;
  }

  function advancePhysicalActivity(seconds) {
    physicalActivityRemainingSeconds = Math.max(0, physicalActivityRemainingSeconds - seconds);
    if (physicalActivityRemainingSeconds <= 0) activePhysicalTool = null;
  }

  function snapshot(events = [], activity = null) {
    return Object.freeze({ ...getState(), events: Object.freeze(events), activity });
  }

  function getState() {
    return {
      flow,
      collapseElapsedGameHours,
      consecutiveLabourActions,
      lastLabourAction,
      catchBreathInactiveSeconds: inactiveRealSeconds,
      activePhysicalTool,
      debugPresetActive: Boolean(debugBaseline),
      toiletZeroElapsedGameMinutes,
      toiletAccidentPending,
      toiletAccidentConsequencesApplied,
      movement: movementState(),
    };
  }

  return Object.freeze({
    update,
    wakeFromCollapse,
    getState,
    getFlow: () => flow,
    getPhysicalActionCost,
    canPerformPhysicalAction,
    recordPhysicalAction,
    applyMeaningfulConversation,
    applyNoveltyEvent,
    beginToiletAccident,
    advanceToiletAccidentRecovery,
    movementState,
    canStartLongAction: () => canStartLongAction({ toilet: needs().toilet }),
    setDebugPreset,
    clearDebugPreset,
    shouldSuppressPersistence: () => Boolean(debugBaseline),
  });
}

function normalizeActivity(activity) {
  const kind = activity.running ? NEED_ACTIVITY.running : activity.moving ? NEED_ACTIVITY.walking : NEED_ACTIVITY.ordinary;
  return {
    ...activity,
    kind,
    npcNearby: Boolean(activity.npcNearby),
    sharedRest: Boolean(activity.sharedRest),
  };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
