import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../world/worldConfig.js";
import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";
import {
  isVenueOfferItemActive,
  setVenueOfferItemActive,
  toggleVenueOfferItem,
} from "./venueOfferDomain.js";

export const VENUE_MENU_PANEL_AREA = Object.freeze({ x: Math.round((GAME_WIDTH - 176) / 2), y: Math.round((GAME_HEIGHT - 134) / 2), width: 176, height: 134 });
export const VENUE_MENU_LIST_AREA = Object.freeze({ x: VENUE_MENU_PANEL_AREA.x + 12, y: VENUE_MENU_PANEL_AREA.y + 29, width: 152, height: 55 });
export const VENUE_MENU_VISIBLE_ROW_COUNT = 2;
const VENUE_MENU_ROW_HEIGHT = 25;
const VENUE_MENU_ROW_STEP = 30;
export const VENUE_MENU_ROW_AREAS = Object.freeze(Array.from(
  { length: VENUE_MENU_VISIBLE_ROW_COUNT },
  (_, slot) => Object.freeze({
    x: VENUE_MENU_LIST_AREA.x,
    y: VENUE_MENU_LIST_AREA.y + slot * VENUE_MENU_ROW_STEP,
    width: VENUE_MENU_LIST_AREA.width,
    height: VENUE_MENU_ROW_HEIGHT,
  }),
));
export const VENUE_MENU_ACTIVITY_AREA = Object.freeze({ x: VENUE_MENU_PANEL_AREA.x + 12, y: VENUE_MENU_PANEL_AREA.y + 93, width: 152, height: 28 });
const VENUE_MENU_SWITCH_AREA = Object.freeze({ x: VENUE_MENU_PANEL_AREA.x + 19, y: VENUE_MENU_PANEL_AREA.y + 100, width: 34, height: 14 });
const VENUE_MENU_SCREEN_AREA = Object.freeze({ x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT });
const MENU_SWIPE_THRESHOLD = 9;
const ITEM_LABEL_KEYS = Object.freeze({
  "fried-potato-dish": "hud:venueMenu.friedPotatoDish",
  lemonade: "hud:venueMenu.lemonade",
});

export function venueMenuMaxScrollIndex(itemCount) {
  return Math.max(0, Math.trunc(Number(itemCount) || 0) - VENUE_MENU_VISIBLE_ROW_COUNT);
}

export function clampVenueMenuScrollIndex(value, itemCount) {
  return Math.max(0, Math.min(venueMenuMaxScrollIndex(itemCount), Math.trunc(Number(value) || 0)));
}

export function venueMenuVisibleRows(itemIds, scrollIndex = 0) {
  const ids = Array.isArray(itemIds) ? itemIds : [];
  const firstIndex = clampVenueMenuScrollIndex(scrollIndex, ids.length);
  return VENUE_MENU_ROW_AREAS.flatMap((area, slot) => {
    const itemIndex = firstIndex + slot;
    const itemId = ids[itemIndex];
    return itemId ? [{ itemId, itemIndex, slot, area }] : [];
  });
}

export function createVenueMenuRuntime(scene, {
  sessionState,
  localization,
  onActiveChange = () => {},
  onPersistentMutation = () => {},
  playEffect = () => {},
  syncSign = () => {},
} = {}) {
  let active = false;
  let destroyed = false;
  let scrollIndex = 0;
  let listPointer = null;

  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 60).setScrollFactor(0).setVisible(false);
  const titleText = createText(scene, 10);
  const rowTexts = VENUE_MENU_ROW_AREAS.map(() => createText(scene, 8));
  const activityText = createText(scene, 7);
  const closeHintText = createText(scene, 6);
  const backdropHit = createZone(scene, VENUE_MENU_SCREEN_AREA, HUD_DEPTH + 61).disableInteractive();
  const panelHit = createZone(scene, VENUE_MENU_PANEL_AREA, HUD_DEPTH + 62).disableInteractive();
  const rowHits = VENUE_MENU_ROW_AREAS.map((area) => createZone(scene, area, HUD_DEPTH + 63).disableInteractive());
  const activityHit = createZone(scene, VENUE_MENU_ACTIVITY_AREA, HUD_DEPTH + 63).disableInteractive();

  const stop = (pointer, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
  };
  const onBackdropDown = (pointer, _x, _y, event) => {
    stop(pointer, event);
    close();
  };
  const onPanelDown = (pointer, _x, _y, event) => stop(pointer, event);
  const onActivityDown = (pointer, _x, _y, event) => {
    stop(pointer, event);
    toggleTavernActive();
  };
  const onCloseKeyDown = (event) => {
    if (!active || event?.repeat) return;
    event?.preventDefault?.();
    close();
  };
  const rowDownHandlers = rowHits.map((_zone, slot) => (pointer, _x, _y, event) => {
    stop(pointer, event);
    listPointer = {
      pointerId: pointer?.id ?? 0,
      slot,
      startY: Number(pointer?.y) || 0,
      currentY: Number(pointer?.y) || 0,
      moved: false,
    };
  });
  const onPointerMove = (pointer) => {
    if (!active || !listPointer || pointer?.id !== listPointer.pointerId || pointer?.isDown === false) return;
    listPointer.currentY = Number(pointer?.y) || listPointer.currentY;
    if (Math.abs(listPointer.currentY - listPointer.startY) >= MENU_SWIPE_THRESHOLD) listPointer.moved = true;
  };
  const onPointerUp = (pointer) => {
    if (!listPointer || pointer?.id !== listPointer.pointerId) return;
    const gesture = listPointer;
    listPointer = null;
    const endY = Number(pointer?.y);
    if (Number.isFinite(endY)) gesture.currentY = endY;
    if (gesture.moved) {
      scrollBy(gesture.startY > gesture.currentY ? 1 : -1);
      return;
    }
    const itemId = venueMenuVisibleRows(SELLABLE_ITEM_IDS, scrollIndex)
      .find(({ slot }) => slot === gesture.slot)?.itemId;
    if (itemId) toggleItem(itemId);
  };
  const onPointerCancel = () => {
    listPointer = null;
  };
  const onWheel = (pointer, _objects, _deltaX, deltaY) => {
    if (!active || !deltaY || !isPointInRect(pointer?.x, pointer?.y, VENUE_MENU_LIST_AREA)) return;
    scrollBy(Math.sign(deltaY));
  };

  backdropHit.on("pointerdown", onBackdropDown);
  panelHit.on("pointerdown", onPanelDown);
  activityHit.on("pointerdown", onActivityDown);
  rowHits.forEach((zone, index) => zone.on("pointerdown", rowDownHandlers[index]));
  scene.input.keyboard.on("keydown-ESC", onCloseKeyDown);
  scene.input.keyboard.on("keydown-SPACE", onCloseKeyDown);
  scene.input.on("pointermove", onPointerMove);
  scene.input.on("pointerup", onPointerUp);
  scene.input.on("pointerupoutside", onPointerUp);
  scene.input.on("pointercancel", onPointerCancel);
  scene.input.on("wheel", onWheel);
  const unsubscribe = localization.subscribe(render);

  function setActive(nextActive, { effect = true } = {}) {
    const next = Boolean(nextActive) && !destroyed;
    if (next === active) return false;
    active = next;
    listPointer = null;
    if (active) scrollIndex = 0;
    if (effect) playEffect(active ? "menu-open" : "menu-close");
    onActiveChange(active);
    render();
    return true;
  }

  function setScrollIndex(value) {
    const next = clampVenueMenuScrollIndex(value, SELLABLE_ITEM_IDS.length);
    if (next === scrollIndex) return false;
    scrollIndex = next;
    render();
    return true;
  }

  function scrollBy(direction) {
    return setScrollIndex(scrollIndex + Math.sign(Number(direction) || 0));
  }

  function open() {
    if (destroyed) return { status: "ignored", mutated: false };
    setActive(true);
    return { status: "menu-opened", mutated: false };
  }

  function close() {
    if (!active || destroyed) return { status: "menu-inactive", mutated: false };
    setActive(false);
    return { status: "menu-closed", mutated: false };
  }

  function handleSignInteraction() {
    if (destroyed) return { status: "ignored", mutated: false };
    return open();
  }

  function setItemActive(itemId, nextActive) {
    if (destroyed || sessionState.gameplay.tavernOpen) return { status: "locked-open", mutated: false };
    const result = setVenueOfferItemActive(sessionState.gameplay.venueOffer, itemId, Boolean(nextActive));
    if (result.mutated) onPersistentMutation({ ...result, status: "venue-offer-updated", itemId });
    render();
    return result;
  }

  function toggleItem(itemId) {
    if (!active || destroyed || sessionState.gameplay.tavernOpen) return { status: "locked", mutated: false };
    const result = toggleVenueOfferItem(sessionState.gameplay.venueOffer, itemId);
    if (result.mutated) {
      playEffect("menu-open");
      onPersistentMutation({ ...result, status: "venue-offer-updated", itemId });
    }
    render();
    return result;
  }

  function setTavernActive(nextActive) {
    if (!active || destroyed) return { status: "menu-inactive", mutated: false };
    const next = Boolean(nextActive);
    if (sessionState.gameplay.tavernOpen === next) {
      return { status: next ? "opened" : "closed", mutated: false };
    }
    sessionState.gameplay.tavernOpen = next;
    playEffect(next ? "tavern-open" : "tavern-close");
    syncSign();
    const result = { status: next ? "opened" : "closed", mutated: true };
    onPersistentMutation(result);
    render();
    return result;
  }

  function toggleTavernActive() {
    return setTavernActive(!sessionState.gameplay.tavernOpen);
  }

  function render() {
    graphics.clear().setVisible(active && !destroyed);
    for (const text of [titleText, ...rowTexts, activityText, closeHintText]) text.setVisible(false);
    const interactive = active && !destroyed;
    if (interactive) {
      backdropHit.setInteractive();
      panelHit.setInteractive();
      activityHit.setInteractive({ useHandCursor: true });
    } else {
      backdropHit.disableInteractive();
      panelHit.disableInteractive();
      activityHit.disableInteractive();
    }
    for (const zone of rowHits) {
      if (interactive) zone.setInteractive({ useHandCursor: !sessionState.gameplay.tavernOpen });
      else zone.disableInteractive();
    }
    if (!interactive) return;

    graphics.fillStyle(0x000000, 0.58).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(HUD_COLORS.panel, 0.98)
      .fillRect(VENUE_MENU_PANEL_AREA.x, VENUE_MENU_PANEL_AREA.y, VENUE_MENU_PANEL_AREA.width, VENUE_MENU_PANEL_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(VENUE_MENU_PANEL_AREA.x + 0.5, VENUE_MENU_PANEL_AREA.y + 0.5, VENUE_MENU_PANEL_AREA.width - 1, VENUE_MENU_PANEL_AREA.height - 1);
    setText(titleText, localization.t("hud:venueMenu.title"), 0, VENUE_MENU_PANEL_AREA.y + 9);
    titleText.setX(Math.round(VENUE_MENU_PANEL_AREA.x + (VENUE_MENU_PANEL_AREA.width - titleText.width) / 2));

    const visibleRows = venueMenuVisibleRows(SELLABLE_ITEM_IDS, scrollIndex);
    visibleRows.forEach(({ itemId, slot, area }) => {
      const enabled = isVenueOfferItemActive(sessionState.gameplay.venueOffer, itemId);
      graphics.fillStyle(HUD_COLORS.shadow, 0.72).fillRect(area.x, area.y, area.width, area.height);
      graphics.lineStyle(1, enabled ? 0x69d17d : HUD_COLORS.border, 1)
        .strokeRect(area.x + 0.5, area.y + 0.5, area.width - 1, area.height - 1)
        .strokeRect(area.x + 8.5, area.y + 7.5, 9, 9);
      if (enabled) graphics.fillStyle(0x69d17d, 1).fillRect(area.x + 11, area.y + 10, 5, 5);
      const labelKey = ITEM_LABEL_KEYS[itemId];
      setText(rowTexts[slot], labelKey ? localization.t(labelKey) : itemId, area.x + 25, area.y + 8);
      if (sessionState.gameplay.tavernOpen) {
        graphics.fillStyle(HUD_COLORS.panel, 0.52).fillRect(area.x, area.y, area.width, area.height);
        rowTexts[slot].setAlpha(0.48);
      } else {
        rowTexts[slot].setAlpha(1);
      }
    });
    const maxScrollIndex = venueMenuMaxScrollIndex(SELLABLE_ITEM_IDS.length);
    const scrollMarkerX = VENUE_MENU_PANEL_AREA.x + 169;
    if (scrollIndex > 0) graphics.fillStyle(HUD_COLORS.light, 0.9).fillTriangle(scrollMarkerX, VENUE_MENU_PANEL_AREA.y + 33, scrollMarkerX - 3, VENUE_MENU_PANEL_AREA.y + 38, scrollMarkerX + 3, VENUE_MENU_PANEL_AREA.y + 38);
    if (scrollIndex < maxScrollIndex) graphics.fillStyle(HUD_COLORS.light, 0.9).fillTriangle(scrollMarkerX - 3, VENUE_MENU_PANEL_AREA.y + 75, scrollMarkerX + 3, VENUE_MENU_PANEL_AREA.y + 75, scrollMarkerX, VENUE_MENU_PANEL_AREA.y + 80);

    const tavernActive = Boolean(sessionState.gameplay.tavernOpen);
    graphics.fillStyle(HUD_COLORS.shadow, 0.72)
      .fillRect(VENUE_MENU_ACTIVITY_AREA.x, VENUE_MENU_ACTIVITY_AREA.y, VENUE_MENU_ACTIVITY_AREA.width, VENUE_MENU_ACTIVITY_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(VENUE_MENU_ACTIVITY_AREA.x + 0.5, VENUE_MENU_ACTIVITY_AREA.y + 0.5, VENUE_MENU_ACTIVITY_AREA.width - 1, VENUE_MENU_ACTIVITY_AREA.height - 1);
    graphics.fillStyle(tavernActive ? 0x69d17d : HUD_COLORS.mid, 1)
      .fillRoundedRect(
        VENUE_MENU_SWITCH_AREA.x,
        VENUE_MENU_SWITCH_AREA.y,
        VENUE_MENU_SWITCH_AREA.width,
        VENUE_MENU_SWITCH_AREA.height,
        VENUE_MENU_SWITCH_AREA.height / 2,
      );
    graphics.lineStyle(1, tavernActive ? 0x8de69d : HUD_COLORS.border, 1)
      .strokeRoundedRect(
        VENUE_MENU_SWITCH_AREA.x + 0.5,
        VENUE_MENU_SWITCH_AREA.y + 0.5,
        VENUE_MENU_SWITCH_AREA.width - 1,
        VENUE_MENU_SWITCH_AREA.height - 1,
        (VENUE_MENU_SWITCH_AREA.height - 1) / 2,
      );
    graphics.fillStyle(tavernActive ? 0xf2eadc : 0xd9cfbf, 1)
      .fillCircle(tavernActive ? VENUE_MENU_SWITCH_AREA.x + 27 : VENUE_MENU_SWITCH_AREA.x + 7, VENUE_MENU_SWITCH_AREA.y + 7, 5);
    setText(
      activityText,
      localization.t(tavernActive ? "hud:venueMenu.active" : "hud:venueMenu.inactive"),
      VENUE_MENU_SWITCH_AREA.x + VENUE_MENU_SWITCH_AREA.width + 7,
      VENUE_MENU_ACTIVITY_AREA.y + 10,
    );
    setText(closeHintText, localization.t("hud:venueMenu.closeHint"), 0, VENUE_MENU_PANEL_AREA.y + VENUE_MENU_PANEL_AREA.height - 10, "#b9aa93");
    closeHintText.setX(Math.round(VENUE_MENU_PANEL_AREA.x + (VENUE_MENU_PANEL_AREA.width - closeHintText.width) / 2));
  }

  function setText(text, value, x, y, color = "#f2eadc") {
    setManagedTextStyle(text, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: `${text.__fontSize}px`,
      color,
    }).setText(value).setVisible(true).setPosition(x, y);
  }

  function createText(targetScene, fontSize) {
    const text = createManagedText(targetScene, 0, 0, "", {
      fontFamily: localization.getLocale().fontKey,
      fontSize: `${fontSize}px`,
      color: "#f2eadc",
    }).setDepth(HUD_DEPTH + 64).setScrollFactor(0).setVisible(false);
    text.__fontSize = fontSize;
    return text;
  }

  function createZone(targetScene, area, depth) {
    return targetScene.add.zone(area.x, area.y, area.width, area.height)
      .setOrigin(0)
      .setDepth(depth)
      .setScrollFactor(0);
  }

  render();
  return {
    open,
    close,
    setScrollIndex,
    scrollBy,
    setTavernActive,
    toggleTavernActive,
    handleSignInteraction,
    setItemActive,
    toggleItem,
    isActive: () => active && !destroyed,
    isPointInHud: (x, y) => active && isPointInRect(x, y, VENUE_MENU_SCREEN_AREA),
    getState: () => ({
      active: active && !destroyed,
      tavernActive: Boolean(sessionState.gameplay.tavernOpen),
      locked: Boolean(sessionState.gameplay.tavernOpen),
      foodItemIds: [...sessionState.gameplay.venueOffer.foodItemIds],
      panel: VENUE_MENU_PANEL_AREA,
      listArea: VENUE_MENU_LIST_AREA,
      rows: venueMenuVisibleRows(SELLABLE_ITEM_IDS, scrollIndex),
      scrollIndex,
      maxScrollIndex: venueMenuMaxScrollIndex(SELLABLE_ITEM_IDS.length),
      activityArea: VENUE_MENU_ACTIVITY_AREA,
    }),
    destroy() {
      if (destroyed) return;
      const wasActive = active;
      destroyed = true;
      active = false;
      listPointer = null;
      if (wasActive) onActiveChange(false);
      unsubscribe?.();
      scene.input.keyboard.off("keydown-ESC", onCloseKeyDown);
      scene.input.keyboard.off("keydown-SPACE", onCloseKeyDown);
      scene.input.off("pointermove", onPointerMove);
      scene.input.off("pointerup", onPointerUp);
      scene.input.off("pointerupoutside", onPointerUp);
      scene.input.off("pointercancel", onPointerCancel);
      scene.input.off("wheel", onWheel);
      backdropHit.off("pointerdown", onBackdropDown);
      panelHit.off("pointerdown", onPanelDown);
      activityHit.off("pointerdown", onActivityDown);
      rowHits.forEach((zone, index) => zone.off("pointerdown", rowDownHandlers[index]));
      for (const zone of [backdropHit, panelHit, ...rowHits, activityHit]) zone.destroy();
      graphics.destroy();
      for (const text of [titleText, ...rowTexts, activityText, closeHintText]) text.destroy();
    },
  };
}
