import { NEED_IDS } from "../needs/needsDomain.js";
import { HUD_DEPTH } from "../ui/hud.js";
import { needValueFromTrackPointerX } from "../ui/needBarGeometry.js";
import { createNeedsPanelGeometry, drawNeedsPanel, NEED_PANEL_SIZE } from "../ui/needsPanelPresentation.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import { PRESENTATION_DENSITY } from "../ui/presentationCameraRuntime.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";
import { createDisplayFamilyTree } from "./personFamilyTree.js";
import { PERSON_LIFE_STATUSES } from "./populationDomain.js";

export const NPC_HOVER_EXPAND_MS = 667;
export const NPC_HOVER_FAMILY_MS = NPC_HOVER_EXPAND_MS * 2;
export const NPC_CARD_EXPAND_MS = 220;
export const NPC_FAMILY_EXPAND_MS = 280;
export const NPC_CARD_LEAVE_GRACE_MS = 660;

const CARD = Object.freeze({ width: 84, familyWidth: 196, compactHeight: 14, expandedHeight: 82, margin: 4 });
const NEEDS_PANEL_OFFSET = Object.freeze({ x: Math.round((CARD.width - NEED_PANEL_SIZE.width) / 2), y: CARD.compactHeight });
const ACTOR_HIT = Object.freeze({ halfWidth: 10, top: -28, bottom: 3 });
const ACTOR_VISUAL_WORLD_HEIGHT = 16;
const TOUCH_MOVE_CANCEL_PX = 7;
const FAMILY_NODE_COUNT = 7;

export function createPersonInspectionRuntime(scene, {
  getActivePersonBindings = () => [],
  getPerson = () => null,
  setPersonNeed = () => ({ status: "ignored", mutated: false }),
  onPersistentMutation = () => {},
  isCoarsePointer = () => false,
} = {}) {
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 10).setScrollFactor(0).setVisible(false);
  const nameText = createManagedText(scene, 0, 0, "", {
    fontSize: "7px",
    color: "#fff2c1",
  }).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setVisible(false);
  const familyTitleText = createManagedText(scene, 0, 0, "", {
    fontSize: "5px",
    color: "#b39a6a",
  }).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setVisible(false);
  const familyNodeTexts = Array.from({ length: FAMILY_NODE_COUNT }, () => createManagedText(scene, 0, 0, "", {
    fontSize: "5px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 12).setScrollFactor(0).setVisible(false));
  const cardHit = scene.add.zone(0, 0, CARD.width + CARD.familyWidth, CARD.expandedHeight)
    .setOrigin(0)
    .setDepth(HUD_DEPTH + 15)
    .setScrollFactor(0)
    .setVisible(false);

  let destroyed = false;
  let personId = null;
  let hoverElapsedMs = 0;
  let leaveElapsedMs = 0;
  let expanded = false;
  let familyExpanded = false;
  let pinned = false;
  let expandProgress = 0;
  let familyProgress = 0;
  let touchPress = null;
  let cardRect = null;
  let needRows = [];
  let familyTree = null;

  cardHit.on("pointerdown", (pointer, _localX, _localY, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    if (!expanded || expandProgress < 0.95 || !personId) return;
    const screenPoint = pointerScreenPoint(pointer);
    const row = needRows.find((candidate) => pointInRect(screenPoint, candidate.rect));
    if (!row) return;
    const value = needValueFromTrackPointerX(row.x, row.width, screenPoint.x);
    const result = setPersonNeed(personId, row.id, value);
    if (result?.mutated) onPersistentMutation(result);
    render();
  });

  const onPointerMove = (pointer) => {
    if (touchPress && Math.hypot(pointer.x - touchPress.startX, pointer.y - touchPress.startY) >= TOUCH_MOVE_CANCEL_PX) {
      touchPress.cancelled = true;
    }
  };

  const onPointerDown = (pointer) => {
    if (!isCoarsePointer()) return;
    const screenPoint = pointerScreenPoint(pointer);
    if (cardRect && pointInRect(screenPoint, cardRect)) return;
    const worldPoint = pointerWorldPoint(pointer, scene.cameras.main);
    const binding = findBindingAt(worldPoint);
    if (!binding) {
      clearInspection();
      return;
    }
    touchPress = {
      personId: binding.personId,
      startX: pointer.x,
      startY: pointer.y,
      elapsedMs: 0,
      cancelled: false,
      needsExpanded: false,
      familyExpanded: false,
    };
  };

  const onPointerUp = () => {
    if (!touchPress) return;
    if (!touchPress.cancelled && !touchPress.needsExpanded) selectPerson(touchPress.personId, { pinExpanded: false });
    touchPress = null;
  };

  const onPointerCancel = () => { touchPress = null; };
  scene.input.on("pointermove", onPointerMove);
  scene.input.on("pointerdown", onPointerDown);
  scene.input.on("pointerup", onPointerUp);
  scene.input.on("pointerupoutside", onPointerUp);
  scene.input.on("pointercancel", onPointerCancel);

  function update(deltaMs) {
    if (destroyed) return;
    const delta = Math.max(0, Number(deltaMs) || 0);
    if (isCoarsePointer()) updateTouch(delta);
    else updateDesktop(delta);
    const target = expanded ? 1 : 0;
    const step = delta / NPC_CARD_EXPAND_MS;
    expandProgress = target
      ? Math.min(1, expandProgress + step)
      : Math.max(0, expandProgress - step);
    const familyTarget = familyExpanded ? 1 : 0;
    const familyStep = delta / NPC_FAMILY_EXPAND_MS;
    familyProgress = familyTarget
      ? Math.min(1, familyProgress + familyStep)
      : Math.max(0, familyProgress - familyStep);
    if (!personId && expandProgress === 0 && familyProgress === 0) hide();
    else render();
  }

  function updateDesktop(deltaMs) {
    if (pinned && personId) return;
    const pointer = scene.input.activePointer;
    const worldPoint = pointerWorldPoint(pointer, scene.cameras.main);
    const binding = findBindingAt(worldPoint);
    const overCurrentCard = personId && cardRect && pointInRect(pointerScreenPoint(pointer), cardRect);
    if (binding?.personId && binding.personId !== personId) {
      selectPerson(binding.personId);
      return;
    }
    if (!personId) return;
    if (!binding && !overCurrentCard) {
      leaveElapsedMs += deltaMs;
      if (leaveElapsedMs >= NPC_CARD_LEAVE_GRACE_MS) clearInspection();
      return;
    }
    leaveElapsedMs = 0;
    hoverElapsedMs += deltaMs;
    if (hoverElapsedMs >= NPC_HOVER_EXPAND_MS) expanded = true;
    if (hoverElapsedMs >= NPC_HOVER_FAMILY_MS) familyExpanded = true;
  }

  function updateTouch(deltaMs) {
    if (!touchPress || touchPress.cancelled) return;
    touchPress.elapsedMs += deltaMs;
    if (!touchPress.needsExpanded && touchPress.elapsedMs >= NPC_HOVER_EXPAND_MS) {
      touchPress.needsExpanded = true;
      selectPerson(touchPress.personId, { pinExpanded: true });
      hoverElapsedMs = touchPress.elapsedMs;
    }
    if (touchPress.needsExpanded && !touchPress.familyExpanded && touchPress.elapsedMs >= NPC_HOVER_FAMILY_MS) {
      touchPress.familyExpanded = true;
      familyExpanded = true;
      hoverElapsedMs = touchPress.elapsedMs;
      render();
    }
  }

  function selectPerson(nextPersonId, { pinExpanded = false } = {}) {
    if (!nextPersonId) {
      clearInspection();
      return false;
    }
    const exists = getPerson(nextPersonId);
    if (!exists) {
      clearInspection();
      return false;
    }
    if (personId !== nextPersonId) {
      expandProgress = 0;
      familyProgress = 0;
    }
    personId = nextPersonId;
    pinned = pinExpanded;
    leaveElapsedMs = 0;
    hoverElapsedMs = pinExpanded ? NPC_HOVER_EXPAND_MS : 0;
    expanded = pinExpanded;
    familyExpanded = false;
    render();
    return true;
  }

  function clearInspection() {
    personId = null;
    hoverElapsedMs = 0;
    leaveElapsedMs = 0;
    expanded = false;
    familyExpanded = false;
    pinned = false;
    touchPress = null;
    familyTree = null;
    if (expandProgress === 0 && familyProgress === 0) hide();
  }

  function findBindingAt(point) {
    return activeBindings()
      .filter((binding) => point.x >= binding.position.x - ACTOR_HIT.halfWidth
        && point.x <= binding.position.x + ACTOR_HIT.halfWidth
        && point.y >= binding.position.y + ACTOR_HIT.top
        && point.y <= binding.position.y + ACTOR_HIT.bottom)
      .sort((a, b) => Math.abs(point.x - a.position.x) - Math.abs(point.x - b.position.x))[0] ?? null;
  }

  function activeBindings() {
    return (getActivePersonBindings() ?? []).filter((binding) => binding?.personId
      && Number.isFinite(binding?.position?.x)
      && Number.isFinite(binding?.position?.y));
  }

  function currentBinding() {
    return activeBindings().find((binding) => binding.personId === personId) ?? null;
  }

  function render() {
    const binding = currentBinding();
    const person = personId ? getPerson(personId) : null;
    if (!binding || !person) {
      clearInspection();
      return;
    }
    const height = Math.round(CARD.compactHeight + (CARD.expandedHeight - CARD.compactHeight) * easeOut(expandProgress));
    const width = Math.round(CARD.width + CARD.familyWidth * easeOut(familyProgress));
    cardRect = resolveCardRect(scene.cameras.main, binding.position, width, height);
    graphics.clear().setVisible(true);
    graphics.fillStyle(0x171724, 0.96).fillRoundedRect(cardRect.x, cardRect.y, cardRect.width, cardRect.height, 2);
    graphics.lineStyle(1, 0xb39a6a, 0.95).strokeRoundedRect(cardRect.x + 0.5, cardRect.y + 0.5, cardRect.width - 1, cardRect.height - 1, 2);
    setManagedTextStyle(nameText, scene, { fontSize: "7px", color: "#fff2c1" })
      .setText(person.displayName)
      .setPosition(cardRect.x + 5, cardRect.y + 3)
      .setVisible(true);
    const rowsAlpha = Math.max(0, Math.min(1, (expandProgress - 0.8) / 0.2));
    const panelGeometry = createNeedsPanelGeometry(
      cardRect.x + NEEDS_PANEL_OFFSET.x,
      cardRect.y + NEEDS_PANEL_OFFSET.y,
    );
    needRows = drawNeedsPanel(graphics, {
      geometry: panelGeometry,
      values: person.needs,
      alpha: rowsAlpha,
    }).map((row) => ({
      id: row.id,
      value: Math.min(100, Math.max(0, Number(person.needs?.[row.id]) || 0)),
      x: row.track.x,
      y: row.track.y,
      width: row.track.width,
      height: row.track.height,
      rect: row.rect,
    }));

    const familyAlpha = Math.max(0, Math.min(1, (familyProgress - 0.72) / 0.28));
    familyTree = familyProgress > 0 ? createDisplayFamilyTree(getPerson, personId) : null;
    if (familyTree && familyAlpha > 0) drawFamilyTree(familyTree, cardRect, familyAlpha);
    else hideFamilyTexts();

    cardHit.setPosition(cardRect.x, cardRect.y).setSize(cardRect.width, cardRect.height).setVisible(true);
    if (expanded && expandProgress >= 0.95) cardHit.setInteractive({ useHandCursor: true });
    else cardHit.disableInteractive();
  }

  function drawFamilyTree(tree, rect, alpha) {
    const panelX = rect.x + CARD.width;
    const title = scene.localization?.t?.("common:familyTree") ?? "FAMILY";
    familyTitleText
      .setText(title)
      .setPosition(panelX + 5, rect.y + 3)
      .setAlpha(alpha)
      .setVisible(true);

    const grandparentRects = Array.from({ length: 4 }, (_value, index) => ({
      x: panelX + 5 + index * 46,
      y: rect.y + 13,
      width: 41,
      height: 13,
    }));
    const parentRects = [
      { x: panelX + 18, y: rect.y + 39, width: 66, height: 14 },
      { x: panelX + 112, y: rect.y + 39, width: 66, height: 14 },
    ];
    const focusRect = { x: panelX + 61, y: rect.y + 64, width: 74, height: 14 };

    graphics.lineStyle(1, 0x7e725f, 0.6 * alpha);
    drawPairConnector(graphics, grandparentRects[0], grandparentRects[1], parentRects[0]);
    drawPairConnector(graphics, grandparentRects[2], grandparentRects[3], parentRects[1]);
    drawPairConnector(graphics, parentRects[0], parentRects[1], focusRect);

    const nodes = [...tree.grandparents, ...tree.parents, tree.focus];
    const rects = [...grandparentRects, ...parentRects, focusRect];
    nodes.forEach((node, index) => drawFamilyNode(node, rects[index], familyNodeTexts[index], alpha, index === nodes.length - 1));
  }

  function drawFamilyNode(node, rect, text, alpha, focus = false) {
    const fictional = Boolean(node?.fictional);
    const fillAlpha = (fictional ? 0.36 : focus ? 0.9 : 0.66) * alpha;
    graphics.fillStyle(focus ? 0x3a3328 : 0x242433, fillAlpha).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 2);
    graphics.lineStyle(1, focus ? 0xb39a6a : 0x766f66, (fictional ? 0.45 : 0.8) * alpha)
      .strokeRoundedRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1, 2);
    const color = fictional ? "#9e978c" : node?.lifeStatus === PERSON_LIFE_STATUSES.dead ? "#c9b7a0" : "#f2eadc";
    const prefix = !fictional && node?.lifeStatus === PERSON_LIFE_STATUSES.dead ? "†" : "";
    setManagedTextStyle(text, scene, { fontSize: "5px", color })
      .setText(`${prefix}${compactFamilyName(node?.displayName)}`)
      .setPosition(rect.x + 3, rect.y + 4)
      .setAlpha(alpha)
      .setVisible(true);
  }

  function hideFamilyTexts() {
    familyTitleText.setVisible(false);
    for (const text of familyNodeTexts) text.setVisible(false);
  }

  function hide() {
    cardRect = null;
    needRows = [];
    familyTree = null;
    graphics.clear().setVisible(false);
    nameText.setVisible(false);
    hideFamilyTexts();
    cardHit.disableInteractive().setVisible(false);
  }

  function forceExpanded(nextPersonId = personId) {
    if (!selectPerson(nextPersonId, { pinExpanded: true })) return false;
    expandProgress = 1;
    render();
    return true;
  }

  function forceFamilyExpanded(nextPersonId = personId) {
    if (!selectPerson(nextPersonId, { pinExpanded: true })) return false;
    hoverElapsedMs = NPC_HOVER_FAMILY_MS;
    expanded = true;
    familyExpanded = true;
    expandProgress = 1;
    familyProgress = 1;
    render();
    return true;
  }

  function setInspectedNeed(needId, value) {
    if (!personId || !NEED_IDS.includes(needId)) return { status: "not-inspecting", mutated: false };
    const result = setPersonNeed(personId, needId, value);
    if (result?.mutated) onPersistentMutation(result);
    render();
    return result;
  }

  return {
    update,
    inspectPerson: (nextPersonId) => selectPerson(nextPersonId),
    forceExpanded,
    forceFamilyExpanded,
    setInspectedNeed,
    getState: () => ({
      personId,
      displayName: personId ? getPerson(personId)?.displayName ?? null : null,
      expanded,
      familyExpanded,
      pinned,
      expandProgress,
      familyProgress,
      hoverElapsedMs,
      leaveElapsedMs,
      cardRect: cardRect ? { ...cardRect } : null,
      needs: needRows.map((row) => ({ ...row })),
      familyTree: familyTree ? cloneFamilyTree(familyTree) : null,
      coarsePointer: Boolean(isCoarsePointer()),
    }),
    isPointInHud(x, y) {
      return Boolean(cardRect && pointInRect({ x, y }, cardRect));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.input.off("pointermove", onPointerMove);
      scene.input.off("pointerdown", onPointerDown);
      scene.input.off("pointerup", onPointerUp);
      scene.input.off("pointerupoutside", onPointerUp);
      scene.input.off("pointercancel", onPointerCancel);
      graphics.destroy();
      nameText.destroy();
      familyTitleText.destroy();
      for (const text of familyNodeTexts) text.destroy();
      cardHit.destroy();
    },
  };
}

function drawPairConnector(graphics, left, right, child) {
  const leftX = left.x + left.width / 2;
  const rightX = right.x + right.width / 2;
  const childX = child.x + child.width / 2;
  const parentBottom = Math.max(left.y + left.height, right.y + right.height);
  const childTop = child.y;
  const midY = Math.round((parentBottom + childTop) / 2);
  graphics.lineBetween(leftX, left.y + left.height, leftX, midY);
  graphics.lineBetween(rightX, right.y + right.height, rightX, midY);
  graphics.lineBetween(leftX, midY, rightX, midY);
  graphics.lineBetween(childX, midY, childX, childTop);
}

function compactFamilyName(value) {
  const text = String(value ?? "?").trim() || "?";
  return text.length <= 10 ? text : `${text.slice(0, 9)}…`;
}

function cloneFamilyTree(tree) {
  return {
    focus: { ...tree.focus },
    parents: tree.parents.map((node) => ({ ...node })),
    grandparents: tree.grandparents.map((node) => ({ ...node })),
    partner: tree.partner ? { ...tree.partner } : null,
    children: tree.children.map((node) => ({ ...node })),
  };
}

function pointerWorldPoint(pointer, camera) {
  const projected = camera?.getWorldPoint?.(Number(pointer?.x), Number(pointer?.y));
  return {
    x: Number(projected?.x ?? pointer?.worldX ?? pointer?.x ?? Number.NaN),
    y: Number(projected?.y ?? pointer?.worldY ?? pointer?.y ?? Number.NaN),
  };
}

function pointerScreenPoint(pointer) {
  return {
    x: Number(pointer?.x ?? Number.NaN) / PRESENTATION_DENSITY,
    y: Number(pointer?.y ?? Number.NaN) / PRESENTATION_DENSITY,
  };
}

function resolveCardRect(camera, actorPosition, width, height) {
  const view = camera?.worldView ?? { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT };
  const left = Number(view.x ?? view.left ?? 0);
  const top = Number(view.y ?? view.top ?? 0);
  const zoom = (Number(camera?.zoom) || 1) / PRESENTATION_DENSITY;
  const actorX = Number(camera?.x || 0) / PRESENTATION_DENSITY + (actorPosition.x - left) * zoom;
  const actorY = Number(camera?.y || 0) / PRESENTATION_DENSITY + (actorPosition.y - top) * zoom;
  const x = clamp(Math.round(actorX - CARD.width / 2), CARD.margin, GAME_WIDTH - width - CARD.margin);
  const aboveY = Math.round(actorY - ACTOR_VISUAL_WORLD_HEIGHT * zoom - height - CARD.margin);
  const belowY = Math.round(actorY + 8 * zoom);
  const y = aboveY >= CARD.margin ? aboveY : clamp(belowY, CARD.margin, GAME_HEIGHT - height - CARD.margin);
  return { x, y, width, height };
}

function pointInRect(point, rect) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
    && point.x >= rect.x && point.x <= rect.x + rect.width
    && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function easeOut(value) {
  const t = Math.min(1, Math.max(0, value));
  return 1 - (1 - t) ** 3;
}
