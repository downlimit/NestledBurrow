import { addInventoryItem, createInventoryItem } from "../inventory/inventoryDomain.js";
import { getResourceProfile } from "../resources/resourceDomain.js";
import { drawResourceVisual } from "../resources/resourceVisuals.js";
import { HUD_COLORS, HUD_DEPTH } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import {
  createWildAtollArenaNodes,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  WILD_ATOLL_ARENAS,
} from "./wildAtollDomain.js";
import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
} from "./worldConfig.js";

const NEST_PHASE = "nest";
const INTERACTION_RADIUS = 27;
const NEST_ATOLL_ENTRANCE = Object.freeze({ x: 11 * TILE_SIZE, y: 6 * TILE_SIZE });
const NEST_RETURN_SPAWN = Object.freeze({ x: 11 * TILE_SIZE, y: 9 * TILE_SIZE });
const SOUTH_SPAWN = Object.freeze({ x: 11 * TILE_SIZE, y: 14 * TILE_SIZE });
const NORTH_SPAWN = Object.freeze({ x: 11 * TILE_SIZE, y: 8 * TILE_SIZE });
const TITLE_Y = 112;
const PROMPT_RECT = Object.freeze({ x: 56, y: 130, width: 208, height: 20 });

export function createWildAtollRuntime(scene, {
  localization,
  getGameplayState = () => scene.sessionState?.gameplay ?? null,
  getPlayerCharacter = () => scene.playerCharacter ?? null,
  getWorldLayout = () => scene.worldLayout ?? null,
  getWorldId = () => scene.sessionState?.currentWorldId ?? null,
  renderHud = () => scene.gameHud?.render?.(),
  notifyInventoryGain = (result) => scene.gameHud?.notifyInventoryGain?.(result),
  spawnWorldItems = (itemId, quantity, origin) => scene.gameHud?.spawnWorldItems?.(itemId, quantity, origin),
  showMessage = (keyOrText, options) => scene.gameHud?.showTransientMessage?.(keyOrText, options),
  saveSession = () => scene.saveSession?.(),
  playEffect = (type) => scene.audioRuntime?.playEffect?.(type),
} = {}) {
  const promptBackground = scene.add.graphics().setDepth(HUD_DEPTH + 34).setScrollFactor(0).setVisible(false);
  const promptText = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 35).setScrollFactor(0).setVisible(false);
  const promptZone = scene.add.zone(PROMPT_RECT.x, PROMPT_RECT.y, PROMPT_RECT.width, PROMPT_RECT.height)
    .setOrigin(0)
    .setDepth(HUD_DEPTH + 36)
    .setScrollFactor(0)
    .disableInteractive();
  const titleText = createManagedText(scene, 0, TITLE_Y, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 20).setScrollFactor(0).setVisible(false);

  let mountedInNest = false;
  let runActive = false;
  let runSeed = "";
  let arenaId = NEST_PHASE;
  let candidate = null;
  let arenaVisuals = [];
  let activeNodeVisuals = new Map();
  let runNodes = new Map();
  let destroyed = false;
  let runSerial = 0;

  function mountNestEntrance() {
    mountedInNest = true;
    runActive = false;
    arenaId = NEST_PHASE;
    candidate = null;
    clearArenaPresentation();
    arenaVisuals.push(...createCave(scene, NEST_ATOLL_ENTRANCE.x, NEST_ATOLL_ENTRANCE.y));
    titleText.setVisible(false);
  }

  function unmountNest() {
    mountedInNest = false;
    runActive = false;
    arenaId = NEST_PHASE;
    candidate = null;
    runNodes.clear();
    clearArenaPresentation();
    renderPrompt();
    titleText.setVisible(false);
  }

  function beginRun() {
    runActive = true;
    runSerial += 1;
    runSeed = `${Date.now()}-${runSerial}`;
    runNodes = new Map();
    renderArena(WILD_ATOLL_ARENAS.edge, "south");
    showMessage("hud:atoll.arrival");
  }

  function leaveRun() {
    runActive = false;
    arenaId = NEST_PHASE;
    candidate = null;
    runNodes.clear();
    clearArenaPresentation();
    arenaVisuals.push(...createCave(scene, NEST_ATOLL_ENTRANCE.x, NEST_ATOLL_ENTRANCE.y));
    titleText.setVisible(false);
    setPlayerPosition(NEST_RETURN_SPAWN);
    showMessage("hud:atoll.leftRun");
  }

  function renderArena(nextArenaId, entrySide) {
    arenaId = nextArenaId;
    candidate = null;
    clearArenaPresentation();
    const definition = getWildAtollArenaDefinition(arenaId);
    const nodes = nodesForArena(arenaId);
    for (const node of nodes) {
      if (!node.cleared) createNodeVisual(node);
    }
    for (const exit of definition.exits) createExitVisual(exit);
    setTitle(definition.titleKey);
    setPlayerPosition(entrySide === "north" ? NORTH_SPAWN : SOUTH_SPAWN);
  }

  function nodesForArena(id) {
    if (!runNodes.has(id)) runNodes.set(id, createWildAtollArenaNodes(runSeed, id));
    return runNodes.get(id);
  }

  function clearArenaPresentation() {
    const layout = getWorldLayout();
    for (const node of activeNodeVisuals.values()) layout?.clearWorldObjectCollider?.(node.colliderId);
    activeNodeVisuals.clear();
    for (const object of arenaVisuals) object.destroy?.();
    arenaVisuals = [];
  }

  function createExitVisual(exit) {
    const point = getWildAtollExitPoint(exit.direction, TILE_SIZE);
    if (exit.cave) {
      arenaVisuals.push(...createCave(scene, point.x, point.y - TILE_SIZE));
      return;
    }
    const marker = scene.add.graphics()
      .setPosition(point.x - 10, point.y - 4)
      .setDepth(555 + point.y);
    marker.fillStyle(0x263b31, 0.92).fillRect(0, 0, 20, 8);
    marker.fillStyle(0x89b58b, 0.72).fillRect(2, 2, 16, 4);
    marker.fillStyle(0xd8cfaa, 0.75).fillRect(8, 1, 4, 6);
    arenaVisuals.push(marker);
  }

  function createNodeVisual(node) {
    const x = node.tileX * TILE_SIZE;
    const y = node.tileY * TILE_SIZE;
    const graphics = scene.add.graphics().setPosition(x, y).setDepth(560 + y + TILE_SIZE);
    drawNode(graphics, node);
    const colliderId = `${node.id}-${runSerial}`;
    getWorldLayout()?.setWorldObjectCollider?.(colliderId, {
      left: x + 2,
      top: y + 5,
      right: x + 14,
      bottom: y + 15,
    }, `atoll:${node.kind}`, { atollResource: true, nodeId: node.id });
    const entry = { node, graphics, colliderId, x: x + 8, y: y + 9 };
    activeNodeVisuals.set(node.id, entry);
    arenaVisuals.push(graphics);
  }

  function drawNode(graphics, node) {
    graphics.clear().setScale?.(1);
    if (node.kind === "berry") {
      drawBerryBush(graphics);
      return;
    }
    drawResourceVisual(graphics, getResourceProfile(node.profileId), node.progress);
  }

  function activateCandidate() {
    if (!candidate) return false;
    if (candidate.kind === "enter") {
      beginRun();
      return true;
    }
    if (candidate.kind === "resource") {
      workResource(candidate.nodeId);
      return true;
    }
    if (candidate.kind === "exit") {
      activateExit(candidate.exit);
      return true;
    }
    return false;
  }

  function activateExit(exit) {
    if (exit.target === "nest") {
      leaveRun();
      return;
    }
    const entrySide = exit.direction === "south" ? "north" : "south";
    renderArena(exit.target, entrySide);
  }

  function workResource(nodeId) {
    const visual = activeNodeVisuals.get(nodeId);
    const node = visual?.node;
    if (!node || node.cleared) return;
    const selectedItem = scene.gameHud?.getSelectedInventoryItem?.() ?? null;
    if (node.requiredTool && selectedItem?.id !== node.requiredTool) {
      showMessage(node.requiredTool === "axe" ? "hud:atoll.needAxe" : "hud:atoll.needPickaxe");
      return;
    }
    if (node.requiredTool) {
      const preview = scene.needsRuntime?.canPerformPhysicalAction?.(node.requiredTool);
      if (preview?.allowed === false) {
        showMessage("hud:interaction.notEnoughEnergy");
        return;
      }
      const spent = scene.needsRuntime?.recordPhysicalAction?.(node.requiredTool);
      if (spent?.mutated === false) {
        showMessage("hud:interaction.notEnoughEnergy");
        return;
      }
      node.progress = Math.min(1, node.progress + 1 / node.hp);
      playEffect(node.requiredTool === "axe" ? "chop" : "mine");
      scene.syncPlayerEnergyTarget?.();
      renderHud();
      saveSession();
      if (node.progress < 1) {
        drawNode(visual.graphics, node);
        return;
      }
    } else {
      node.progress = 1;
      playEffect("inventory-change");
    }
    clearResourceNode(node, visual);
  }

  function clearResourceNode(node, visual) {
    node.cleared = true;
    getWorldLayout()?.clearWorldObjectCollider?.(visual.colliderId);
    activeNodeVisuals.delete(node.id);
    visual.graphics.destroy();
    arenaVisuals = arenaVisuals.filter((object) => object !== visual.graphics);
    const gameplay = getGameplayState();
    const result = addInventoryItem(gameplay.inventory, createInventoryItem(node.itemId, 1));
    if (result.mutated) {
      notifyInventoryGain(result);
      renderHud();
      saveSession();
      return;
    }
    spawnWorldItems(node.itemId, 1, { x: visual.x, y: visual.y });
  }

  function onAction(actionId) {
    if (!mountedInNest || destroyed || actionId !== "space") return;
    if (candidate && activateCandidate()) scene.suppressNextInteract = true;
  }

  function onKeyboard(event) {
    if (event?.repeat || isEditableTarget(event?.target) || event.code !== "Space") return;
    onAction("space");
  }

  function update() {
    if (destroyed) return;
    const inNest = getWorldId() === "nest";
    if (inNest && !mountedInNest) mountNestEntrance();
    else if (!inNest && mountedInNest) unmountNest();
    if (!mountedInNest) return;
    candidate = findCandidate();
    renderPrompt();
  }

  function findCandidate() {
    const position = getPlayerCharacter()?.motor?.position;
    if (!position) return null;
    if (!runActive) {
      const distance = Math.hypot(NEST_ATOLL_ENTRANCE.x - position.x, NEST_ATOLL_ENTRANCE.y - position.y);
      return distance <= INTERACTION_RADIUS
        ? { kind: "enter", id: "enter", labelKey: "hud:atoll.promptEnter", distance }
        : null;
    }
    const definition = getWildAtollArenaDefinition(arenaId);
    const exits = definition.exits.map((exit) => {
      const point = getWildAtollExitPoint(exit.direction, TILE_SIZE);
      return {
        kind: "exit",
        id: `exit:${exit.id}`,
        exit,
        labelKey: exit.promptKey,
        distance: Math.hypot(point.x - position.x, point.y - position.y),
      };
    });
    const resources = [...activeNodeVisuals.values()].map((entry) => ({
      kind: "resource",
      id: `resource:${entry.node.id}`,
      nodeId: entry.node.id,
      labelKey: entry.node.promptKey,
      distance: Math.hypot(entry.x - position.x, entry.y - position.y),
    }));
    return [...exits, ...resources]
      .filter((entry) => entry.distance <= INTERACTION_RADIUS)
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  }

  function renderPrompt() {
    const visible = mountedInNest && Boolean(candidate);
    promptBackground.clear().setVisible(visible);
    promptText.setVisible(visible);
    if (!visible) {
      promptZone.disableInteractive();
      return;
    }
    const value = localization.t(candidate.labelKey);
    setManagedTextStyle(promptText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value);
    const width = Math.min(PROMPT_RECT.width, Math.max(96, Math.ceil(promptText.width) + 16));
    const x = Math.round((320 - width) / 2);
    promptBackground
      .fillStyle(HUD_COLORS.panel, 0.94).fillRect(x, PROMPT_RECT.y, width, PROMPT_RECT.height)
      .lineStyle(1, HUD_COLORS.border, 0.95).strokeRect(x + 0.5, PROMPT_RECT.y + 0.5, width - 1, PROMPT_RECT.height - 1);
    promptText.setPosition(Math.round((320 - promptText.width) / 2), PROMPT_RECT.y + 5);
    promptZone.setPosition(x, PROMPT_RECT.y).setSize(width, PROMPT_RECT.height).setInteractive({ useHandCursor: true });
  }

  function setTitle(key) {
    const value = localization.t(key);
    setManagedTextStyle(titleText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value).setPosition(Math.round((320 - titleText.width) / 2), TITLE_Y).setVisible(true);
  }

  function setPlayerPosition(point) {
    const player = getPlayerCharacter();
    if (!player?.motor) return;
    player.motor.position = { x: point.x, y: point.y };
    player.motor.movement.velocity.x = 0;
    player.motor.movement.velocity.y = 0;
    scene.cameraRuntime?.reset?.(player.motor.position);
  }

  promptZone.on("pointerdown", (pointer, _x, _y, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    if (candidate && activateCandidate()) scene.suppressNextInteract = true;
  });
  globalThis.window?.addEventListener?.("keydown", onKeyboard);
  scene.events.on("update", update);
  const unsubscribe = localization?.subscribe?.(() => {
    if (runActive) setTitle(getWildAtollArenaDefinition(arenaId).titleKey);
    renderPrompt();
  });

  update();

  return {
    getState: () => ({
      mountedInNest,
      active: runActive,
      runSeed,
      arenaId,
      candidateId: candidate?.id ?? null,
      remainingNodes: runActive ? nodesForArena(arenaId).filter((node) => !node.cleared).length : 0,
    }),
    startArena(nextArenaId, { seed = `${Date.now()}` } = {}) {
      if (!mountedInNest) mountNestEntrance();
      runActive = true;
      runSeed = String(seed);
      runNodes = new Map();
      renderArena(nextArenaId, "south");
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unmountNest();
      unsubscribe?.();
      scene.events.off("update", update);
      globalThis.window?.removeEventListener?.("keydown", onKeyboard);
      promptZone.destroy();
      promptBackground.destroy();
      promptText.destroy();
      titleText.destroy();
    },
  };
}

function createCave(scene, centerX, topY) {
  const left = centerX - TILE_SIZE;
  const parts = [
    [0, 0, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.transport.topLeft],
    [1, 0, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.transport.topRight],
    [0, 1, OUTDOOR_TEXTURE_KEY, OUTDOOR_FRAMES.transport.entranceLeft],
    [1, 1, OUTDOOR_TEXTURE_KEY, OUTDOOR_FRAMES.transport.entranceRight],
  ];
  return parts.map(([x, y, textureKey, frame]) => scene.add.image(
    left + x * TILE_SIZE,
    topY + y * TILE_SIZE,
    textureKey,
    frame,
  ).setOrigin(0).setDepth(560 + topY + 2 * TILE_SIZE));
}

function drawBerryBush(graphics) {
  graphics.fillStyle(0x234526, 1).fillRect(3, 7, 11, 7).fillRect(5, 4, 7, 9);
  graphics.fillStyle(0x3f7040, 1).fillRect(2, 8, 4, 4).fillRect(10, 6, 5, 5).fillRect(6, 3, 5, 4);
  graphics.fillStyle(0x7954a8, 1).fillRect(5, 8, 2, 2).fillRect(10, 10, 2, 2).fillRect(8, 5, 2, 2);
  graphics.fillStyle(0xb99ad8, 1).fillRect(5, 8, 1, 1).fillRect(10, 10, 1, 1).fillRect(8, 5, 1, 1);
  graphics.fillStyle(0x5b3824, 1).fillRect(8, 13, 2, 3);
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
