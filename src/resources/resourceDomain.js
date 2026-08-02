export const RESOURCE_ACTIONS = Object.freeze(["chop", "mine", "mow"]);
export const LARGE_RESOURCE_HP_MULTIPLIER = 1.6;

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    actionHp: Object.freeze({ chop: null, mine: null, mow: null, ...profile.actionHp }),
    reward: Object.freeze({ ...profile.reward }),
    footprint: Object.freeze({ ...profile.footprint }),
  });
}

const profiles = [
  { id: "log-small", kind: "log", size: "small", requiredTool: "axe", preferredAction: "chop", actionHp: { chop: "smallLogChopHp" }, reward: { resource: "wood", amount: 1 }, visual: "log", footprint: { width: 2, height: 2 }, collisionTopInset: 3, prompt: "hud:interaction.chop", sfx: "chop" },
  { id: "log-large", kind: "log", size: "large", requiredTool: "axe", preferredAction: "chop", actionHp: { chop: { tuning: "smallLogChopHp", multiplier: LARGE_RESOURCE_HP_MULTIPLIER } }, reward: { resource: "wood", amount: 3 }, visual: "log", footprint: { width: 3, height: 3 }, collisionTopInset: 4.5, prompt: "hud:interaction.chop", sfx: "chop" },
  { id: "stone-small", kind: "stone", size: "small", requiredTool: "pickaxe", preferredAction: "mine", actionHp: { mine: 7 }, reward: { resource: "stone", amount: 1 }, visual: "stone", footprint: { width: 2, height: 2 }, collisionTopInset: 3, collisionLeftInset: 1, collisionRightInset: 2, prompt: "hud:interaction.mine", sfx: "mine" },
  { id: "stone-large", kind: "stone", size: "large", requiredTool: "pickaxe", preferredAction: "mine", actionHp: { mine: { value: 7, multiplier: LARGE_RESOURCE_HP_MULTIPLIER } }, reward: { resource: "stone", amount: 3 }, visual: "stone", footprint: { width: 3, height: 3 }, collisionTopInset: 4.5, prompt: "hud:interaction.mine", sfx: "mine" },
  { id: "ruby-node", kind: "ruby", size: "small", requiredTool: "pickaxe", preferredAction: "mine", actionHp: { mine: 5 }, reward: { resource: "rubies", amount: 1 }, visual: "ruby", footprint: { width: 2, height: 2 }, prompt: "hud:interaction.mine", sfx: "mine" },
  { id: "tree-planted", kind: "plant", size: "large", requiredTool: "axe", preferredAction: "chop", actionHp: { chop: "smallLogChopHp" }, reward: { resource: "wood", amount: 5 }, visual: "tree", footprint: { width: 2, height: 2 }, collisionRect: { left: 16, top: 48, right: 32, bottom: 64 }, prompt: "hud:interaction.chop", sfx: "chop" },
].map(freezeProfile);

export const RESOURCE_PROFILES = Object.freeze(Object.fromEntries(profiles.map((profile) => [profile.id, profile])));

export function getResourceProfile(profileId) {
  const profile = RESOURCE_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown resource profile: ${String(profileId)}`);
  return profile;
}

export function resourceActionForTool(profile, toolId) {
  return profile?.requiredTool === toolId ? profile.preferredAction : null;
}

export function resourceEffectType(profile, status) {
  const kind = profile?.kind === "ruby" ? "ruby"
    : profile?.kind === "stone" ? "stone"
      : "wood";
  return `${kind}-${status === "cleared" ? "break" : "hit"}`;
}

export function resolveActionHp(profile, action, tuning = {}) {
  const source = profile.actionHp[action];
  if (source == null) return null;
  if (Number.isFinite(source)) return source;
  if (typeof source === "string") {
    if (!Number.isFinite(tuning[source])) throw new Error(`Missing HP for ${profile.id}.${action}`);
    return tuning[source];
  }
  const base = source.tuning ? tuning[source.tuning] : source.value;
  if (!Number.isFinite(base)) throw new Error(`Missing HP for ${profile.id}.${action}`);
  return Math.round(base * (source.multiplier ?? 1));
}

export function applyResourceWork(nodeState, profile, { action = profile.preferredAction, damage = 1, tuning = {} } = {}) {
  if (nodeState.cleared || nodeState.progress >= 1) return { status: "already-cleared", mutated: false };
  const hp = resolveActionHp(profile, action, tuning);
  if (hp == null) return { status: "unsupported-action", mutated: false, action };
  const normalizedDamage = Math.max(0, Number(damage) || 0);
  if (normalizedDamage === 0) return { status: "no-damage", mutated: false, action };
  nodeState.progress = Math.min(1, Math.max(0, nodeState.progress + normalizedDamage / hp));
  if (nodeState.progress >= 1 - 1e-9) {
    nodeState.progress = 1;
    nodeState.cleared = true;
    return { status: "cleared", mutated: true, action, progress: 1 };
  }
  return { status: "hit", mutated: true, action, progress: nodeState.progress };
}
