import { BUILD_ASSET_GROUPS } from "./buildAssetCatalog.js";
import { drawBed } from "./debrisRuntime.js";
import { drawFacility } from "./facilityPreviewVisuals.js";
import { HUD_DEPTH } from "./hud.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";
import { GAME_HEIGHT, TILE_SIZE } from "./worldConfig.js";

const PANEL = Object.freeze({
  x: 4,
  y: 4,
  width: 140,
  height: GAME_HEIGHT - 8,
  contentTop: 30,
  contentBottom: GAME_HEIGHT - 8,
});
const PANEL_DEPTH = HUD_DEPTH + 20;
const OPEN_BUTTON = Object.freeze({
  x: 4,
  y: GAME_HEIGHT - 24,
  size: 20,
});
const CLOSE_BUTTON = Object.freeze({
  x: PANEL.x + PANEL.width - 22,
  y: PANEL.y + 4,
  size: 16,
});
const PANEL_DRAG_THRESHOLD = 6;
const PANEL_INERTIA_FRICTION = 0.004;

export const BUILD_GRID = Object.freeze({
  step: TILE_SIZE,
  color: 0x42ff75,
  alpha: 0.1,
  lineWidth: 1,
});

export function shouldToggleBuildMode(event) {
  return !event?.repeat;
}

export function snapBuildPoint(point) {
  return {
    x: Math.floor(point.x / TILE_SIZE) * TILE_SIZE,
    y: Math.floor(point.y / TILE_SIZE) * TILE_SIZE,
  };
}

export function snapBuildSurfacePoint(point) {
  return {
    x: Math.round(point.x / TILE_SIZE) * TILE_SIZE,
    y: Math.round(point.y / TILE_SIZE) * TILE_SIZE,
  };
}

export function snapBuildWallEdge(point) {
  const cellX = Math.floor(point.x / TILE_SIZE) * TILE_SIZE;
  const cellY = Math.floor(point.y / TILE_SIZE) * TILE_SIZE;
  const offsetX = point.x - cellX;
  const offsetY = point.y - cellY;
  const distanceToVertical = Math.min(offsetX, TILE_SIZE - offsetX);
  const distanceToHorizontal = Math.min(offsetY, TILE_SIZE - offsetY);
  if (distanceToVertical <= distanceToHorizontal) {
    return {
      x: offsetX < TILE_SIZE / 2 ? cellX : cellX + TILE_SIZE,
      y: cellY,
      orientation: "vertical",
    };
  }
  return {
    x: cellX,
    y: offsetY < TILE_SIZE / 2 ? cellY : cellY + TILE_SIZE,
    orientation: "horizontal",
  };
}

export function snapBuildWallDragPoint(point, axis) {
  if (axis.orientation === "vertical") {
    return {
      x: axis.x,
      y: Math.round(point.y / TILE_SIZE) * TILE_SIZE,
    };
  }
  return {
    x: Math.round(point.x / TILE_SIZE) * TILE_SIZE,
    y: axis.y,
  };
}

export function getBuildWallDragAxis(start, current) {
  if (Math.abs(current.y - start.y) >= Math.abs(current.x - start.x)) {
    return {
      x: Math.round(start.x / TILE_SIZE) * TILE_SIZE,
      y: Math.round(start.y / TILE_SIZE) * TILE_SIZE,
      orientation: "vertical",
    };
  }
  return {
    x: Math.round(start.x / TILE_SIZE) * TILE_SIZE,
    y: Math.round(start.y / TILE_SIZE) * TILE_SIZE,
    orientation: "horizontal",
  };
}

export function getBuildDragPoints(from, to) {
  const startX = Math.round(from.x / TILE_SIZE);
  const startY = Math.round(from.y / TILE_SIZE);
  const endX = Math.round(to.x / TILE_SIZE);
  const endY = Math.round(to.y / TILE_SIZE);
  const points = [];
  let x = startX;
  let y = startY;
  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);
  const stepX = startX < endX ? 1 : -1;
  const stepY = startY < endY ? 1 : -1;
  let error = dx - dy;
  while (x !== endX || y !== endY) {
    const twiceError = error * 2;
    if (twiceError > -dy) {
      error -= dy;
      x += stepX;
    }
    if (twiceError < dx) {
      error += dx;
      y += stepY;
    }
    const point = { ...to, x: x * TILE_SIZE, y: y * TILE_SIZE };
    if ("rawX" in to) {
      point.rawX = point.x;
      point.rawY = point.y;
    }
    points.push(point);
  }
  return points;
}

export class BuildModeRuntime {
  constructor(scene, {
    localization,
    worldBounds,
    onModeChange = () => {},
    onPlace = () => ({ status: "ignored" }),
    onDemolish = () => ({ status: "ignored" }),
    onPreview = () => {},
    onPreviewClear = () => {},
    onDemolitionPreview = () => {},
    onActionBegin = () => {},
    onActionEnd = () => {},
    onUndo = () => {},
  } = {}) {
    this.scene = scene;
    this.localization = localization;
    this.worldBounds = worldBounds;
    this.onModeChange = onModeChange;
    this.onPlace = onPlace;
    this.onDemolish = onDemolish;
    this.onPreview = onPreview;
    this.onPreviewClear = onPreviewClear;
    this.onDemolitionPreview = onDemolitionPreview;
    this.onActionBegin = onActionBegin;
    this.onActionEnd = onActionEnd;
    this.onUndo = onUndo;
    this.active = false;
    this.selectedId = BUILD_ASSET_GROUPS[0].items[0].id;
    this.objects = [];
    this.scrollOffset = 0;
    this.drag = null;
    this.panelDrag = null;
    this.scrollVelocity = 0;
    this.actionOpen = false;
    this.grid = scene.add.graphics().setDepth(8990).setVisible(false);
    this.drawGrid();
    this.createLibrary();
    this.createToggleButtons();
    this.onTab = (event) => {
      if (!shouldToggleBuildMode(event)) return;
      event?.preventDefault?.();
      this.toggle();
    };
    this.onWorldPointer = (pointer) => {
      if (this.beginPanelDrag(pointer)) return;
      this.beginPointerDrag(pointer);
    };
    this.onPointerMove = (pointer) => {
      if (this.panelDrag) this.continuePanelDrag(pointer);
      else if (this.drag) this.continuePointerDrag(pointer);
      else this.updateHoverPreview(pointer);
    };
    this.onPointerUp = (pointer) => {
      if (this.panelDrag) this.endPanelDrag(pointer);
      else this.endPointerDrag(pointer);
    };
    this.onPointerCancel = () => this.cancelPanelDrag();
    this.onSceneUpdate = (_time, delta) => this.updateScrollInertia(delta);
    this.onUndoKey = (event) => {
      if (!this.active || this.actionOpen || event?.repeat || (!event?.ctrlKey && !event?.metaKey)) return;
      event?.preventDefault?.();
      this.onUndo();
    };
    this.onWheel = (_pointer, _objects, _deltaX, deltaY) => {
      if (!this.active || !deltaY) return;
      this.setScrollOffset(this.scrollOffset + Math.sign(deltaY) * 32);
    };
    scene.input.keyboard.on("keydown-TAB", this.onTab);
    scene.input.keyboard.on("keydown-Z", this.onUndoKey);
    scene.input.on("pointerdown", this.onWorldPointer);
    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("pointerup", this.onPointerUp);
    scene.input.on("pointerupoutside", this.onPointerUp);
    scene.input.on("pointercancel", this.onPointerCancel);
    scene.input.on("wheel", this.onWheel);
    scene.events?.on?.("update", this.onSceneUpdate);
    this.unsubscribe = localization?.subscribe?.(() => this.renderLibrary());
  }

  createToggleButtons() {
    this.openButton = this.scene.add.graphics().setDepth(PANEL_DEPTH + 4).setScrollFactor(0);
    this.openButton
      .fillStyle(0x171724, 0.92)
      .fillRect(OPEN_BUTTON.x, OPEN_BUTTON.y, OPEN_BUTTON.size, OPEN_BUTTON.size)
      .lineStyle(1, 0xb39a6a, 1)
      .strokeRect(OPEN_BUTTON.x + 0.5, OPEN_BUTTON.y + 0.5, OPEN_BUTTON.size - 1, OPEN_BUTTON.size - 1)
      .fillStyle(0xb39a6a, 1)
      .fillRect(OPEN_BUTTON.x + 5, OPEN_BUTTON.y + 9, 10, 2)
      .fillRect(OPEN_BUTTON.x + 9, OPEN_BUTTON.y + 5, 2, 10);
    this.openButtonHit = this.scene.add.zone(
      OPEN_BUTTON.x,
      OPEN_BUTTON.y,
      OPEN_BUTTON.size,
      OPEN_BUTTON.size,
    ).setOrigin(0).setScrollFactor(0).setDepth(PANEL_DEPTH + 5).setInteractive();
    this.openButtonHit.on("pointerdown", () => this.setActive(true));

    this.closeButton = this.scene.add.graphics().setDepth(PANEL_DEPTH + 4).setScrollFactor(0).setVisible(false);
    this.closeButton
      .lineStyle(1, 0xb39a6a, 1)
      .strokeRect(CLOSE_BUTTON.x + 0.5, CLOSE_BUTTON.y + 0.5, CLOSE_BUTTON.size - 1, CLOSE_BUTTON.size - 1)
      .lineBetween(CLOSE_BUTTON.x + 4, CLOSE_BUTTON.y + 4, CLOSE_BUTTON.x + 12, CLOSE_BUTTON.y + 12)
      .lineBetween(CLOSE_BUTTON.x + 12, CLOSE_BUTTON.y + 4, CLOSE_BUTTON.x + 4, CLOSE_BUTTON.y + 12);
    this.closeButtonHit = this.scene.add.zone(
      CLOSE_BUTTON.x,
      CLOSE_BUTTON.y,
      CLOSE_BUTTON.size,
      CLOSE_BUTTON.size,
    ).setOrigin(0).setScrollFactor(0).setDepth(PANEL_DEPTH + 5).setVisible(false);
    this.closeButtonHit.on("pointerdown", () => this.setActive(false));
  }

  drawGrid() {
    const { left, top, right, bottom } = this.worldBounds;
    this.grid.clear().lineStyle(BUILD_GRID.lineWidth, BUILD_GRID.color, BUILD_GRID.alpha);
    for (let x = left; x <= right; x += BUILD_GRID.step) this.grid.lineBetween(x, top, x, bottom);
    for (let y = top; y <= bottom; y += BUILD_GRID.step) this.grid.lineBetween(left, y, right, y);
  }

  createLibrary() {
    this.panel = this.scene.add.graphics().setDepth(PANEL_DEPTH).setScrollFactor(0).setVisible(false);
    this.selection = this.scene.add.graphics().setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);
    this.title = this.addText(8, 8, "", 7, false);
    let contentY = PANEL.contentTop;
    for (const group of BUILD_ASSET_GROUPS) {
      const groupLabel = this.addText(8, contentY, "", 7, true);
      groupLabel.buildLabelKey = group.labelKey;
      contentY += 10;
      for (const item of group.items) {
        const x = 10;
        const thumbnail = this.createThumbnail(item, x, contentY);
        const label = this.addText(x + 20, contentY + 4, "", 7, true);
        label.buildLabelKey = item.labelKey;
        const hit = this.scene.add.zone(x, contentY, 124, 18)
          .setOrigin(0)
          .setDepth(PANEL_DEPTH + 3)
          .setScrollFactor(0);
        hit.disableInteractive();
        hit.on("pointerdown", () => {});
        this.objects.push({
          type: "item",
          item,
          thumbnail,
          label,
          hit,
          x,
          baseY: contentY,
        });
        contentY += 18;
      }
      contentY += 4;
    }
    this.contentHeight = contentY - PANEL.contentTop;
    this.maxScrollOffset = Math.max(0, contentY - PANEL.contentBottom);
    this.renderLibrary();
  }

  createThumbnail(item, x, y) {
    if (item.textureKey) {
      return this.scene.add.image(x, y, item.textureKey, item.frame)
        .setOrigin(0)
        .setDepth(PANEL_DEPTH + 1)
        .setScrollFactor(0)
        .setVisible(false);
    }
    const graphics = this.scene.add.graphics()
      .setPosition(x, y)
      .setDepth(PANEL_DEPTH + 1)
      .setScrollFactor(0)
      .setVisible(false);
    if (item.icon === "bed") drawBed(graphics);
    else if (["shower", "toilet", "table"].includes(item.icon)) {
      drawFacility(graphics, item.icon);
      graphics.setScale(0.5);
    } else {
      graphics.fillStyle(0xd9c18f, 1).fillRect(2, 2, 12, 3).fillRect(7, 1, 3, 14);
      graphics.fillStyle(0xb54f45, 1).fillRect(1, 6, 14, 3);
    }
    return graphics;
  }

  addText(x, y, text, fontSize, scrolls) {
    const object = createManagedText(this.scene, x, y, text, {
      fontFamily: this.localization.getLocale().fontKey,
      fontSize: `${fontSize}px`,
      color: "#f2eadc",
      wordWrap: { width: 112 },
    }).setDepth(PANEL_DEPTH + 2).setScrollFactor(0).setVisible(false);
    this.objects.push({ type: "text", object, baseY: y, scrolls });
    return object;
  }

  setScrollOffset(value) {
    this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, Math.round(value)));
    this.renderLibrary();
  }

  isPanelContentPoint(pointer) {
    return this.active
      && pointer.x >= PANEL.x && pointer.x <= PANEL.x + PANEL.width
      && pointer.y >= PANEL.contentTop && pointer.y <= PANEL.contentBottom;
  }

  getPanelItemAt(x, y) {
    return this.objects.find((entry) => entry.type === "item"
      && y >= entry.baseY - this.scrollOffset
      && y < entry.baseY - this.scrollOffset + 18
      && x >= entry.x && x <= entry.x + 124);
  }

  beginPanelDrag(pointer) {
    if (!this.isPanelContentPoint(pointer)) return false;
    this.scrollVelocity = 0;
    this.panelDrag = {
      pointerId: pointer.id,
      startY: pointer.y,
      lastY: pointer.y,
      lastTime: Number(pointer.event?.timeStamp ?? Date.now()),
      moved: false,
      item: this.getPanelItemAt(pointer.x, pointer.y),
    };
    return true;
  }

  continuePanelDrag(pointer) {
    if (pointer.id !== this.panelDrag.pointerId) return;
    const now = Number(pointer.event?.timeStamp ?? Date.now());
    const deltaY = pointer.y - this.panelDrag.lastY;
    const elapsed = Math.max(1, now - this.panelDrag.lastTime);
    if (Math.abs(pointer.y - this.panelDrag.startY) >= PANEL_DRAG_THRESHOLD) this.panelDrag.moved = true;
    if (this.panelDrag.moved) {
      this.setScrollOffset(this.scrollOffset - deltaY);
      this.scrollVelocity = -deltaY / elapsed;
    }
    this.panelDrag.lastY = pointer.y;
    this.panelDrag.lastTime = now;
  }

  endPanelDrag(pointer) {
    if (pointer.id !== this.panelDrag.pointerId) return;
    const { moved, item } = this.panelDrag;
    this.panelDrag = null;
    if (!moved && item) {
      this.onPreviewClear();
      this.selectedId = item.item.id;
      this.renderLibrary();
    }
  }

  cancelPanelDrag() {
    this.panelDrag = null;
    this.scrollVelocity = 0;
  }

  updateScrollInertia(delta) {
    if (this.panelDrag || Math.abs(this.scrollVelocity) < 0.001) return;
    const next = this.scrollOffset + this.scrollVelocity * delta;
    const clamped = Math.max(0, Math.min(this.maxScrollOffset, next));
    this.setScrollOffset(clamped);
    this.scrollVelocity *= Math.max(0, 1 - PANEL_INERTIA_FRICTION * delta);
    if (clamped !== next || Math.abs(this.scrollVelocity) < 0.001) this.scrollVelocity = 0;
  }

  renderLibrary() {
    this.panel.clear();
    this.selection.clear();
    if (!this.active) return;
    this.panel.fillStyle(0x171724, 0.96).fillRect(PANEL.x, PANEL.y, PANEL.width, PANEL.height);
    this.panel.lineStyle(1, 0xd9c18f, 0.9).strokeRect(PANEL.x + 0.5, PANEL.y + 0.5, PANEL.width - 1, PANEL.height - 1);
    if (this.scrollOffset > 0) this.panel.fillStyle(0xf2eadc, 0.9).fillTriangle(134, 10, 130, 16, 138, 16);
    if (this.scrollOffset < this.maxScrollOffset) this.panel.fillStyle(0xf2eadc, 0.9).fillTriangle(130, 164, 138, 164, 134, 170);
    setManagedTextStyle(this.title, this.scene, {
      fontFamily: this.localization.getLocale().fontKey,
      fontSize: "7px",
      color: "#f2eadc",
    }).setText(this.localization.t("hud:buildMode.title")).setVisible(true);

    for (const entry of this.objects) {
      if (entry.type === "text") {
        if (entry.object === this.title) continue;
        const y = entry.scrolls ? entry.baseY - this.scrollOffset : entry.baseY;
        const visible = this.isContentVisible(y, entry.object.height || 7);
        entry.object.setPosition(Math.trunc(entry.object.x), Math.trunc(y)).setVisible(visible);
        if (visible && entry.object.buildLabelKey) {
          entry.object.setText(this.localization.t(entry.object.buildLabelKey));
        }
        continue;
      }
      const y = entry.baseY - this.scrollOffset;
      const visible = this.isContentVisible(y, 18);
      entry.thumbnail.setPosition(entry.x, y).setVisible(visible);
      entry.label.setPosition(entry.x + 20, y + 4).setVisible(visible);
      if (visible) {
        entry.label.setText(this.localization.t(entry.item.labelKey));
        entry.hit.setPosition(entry.x, y).setInteractive({ useHandCursor: true });
      } else {
        entry.hit.disableInteractive();
      }
      if (visible && entry.item.id === this.selectedId) {
        this.selection.lineStyle(1, 0x42ff75, 1)
          .strokeRect(entry.x - 1.5, y - 1.5, 124, 20);
      }
    }
  }

  isContentVisible(y, height) {
    return y >= PANEL.contentTop && y + height <= PANEL.contentBottom;
  }

  getSelectedItem() {
    return BUILD_ASSET_GROUPS
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === this.selectedId);
  }

  getActionPoint(pointer, item, demolitionType = null, wallAxis = null) {
    const raw = {
      x: Number(pointer.worldX ?? pointer.x),
      y: Number(pointer.worldY ?? pointer.y),
    };
    let snapped;
    if (wallAxis) snapped = snapBuildWallDragPoint(raw, wallAxis);
    else if (item.placement === "wall") snapped = snapBuildSurfacePoint(raw);
    else if (demolitionType === "wall") snapped = snapBuildWallEdge(raw);
    else if (item.placement === "tile" || item.placement === "carpet") snapped = snapBuildSurfacePoint(raw);
    else snapped = snapBuildPoint(raw);
    return { ...snapped, rawX: raw.x, rawY: raw.y };
  }

  beginPointerDrag(pointer) {
    if (!this.active || pointer.x < PANEL.x + PANEL.width) return;
    const item = this.getSelectedItem();
    if (!item) return;
    const point = this.getActionPoint(pointer, item);
    this.actionOpen = true;
    this.onActionBegin(item.mode === "demolish" ? "demolish" : "place");
    if (item.mode === "demolish") {
      this.onPreviewClear();
      const result = this.onDemolish(point, null);
      this.drag = result?.status === "removed"
        ? { mode: "demolish", demolitionType: result.type, lastPoint: point }
        : null;
      return;
    }
    if (item.placement === "wall" && item.dragPaint) {
      this.drag = {
        mode: "place",
        item,
        lastPoint: null,
        wallAxis: null,
        startRaw: { x: point.rawX, y: point.rawY },
        pendingPoint: point,
        points: [point],
      };
      this.onPreview(item, this.drag.points);
      return;
    }
    this.drag = {
      mode: "place",
      item,
      lastPoint: point,
      wallAxis: null,
      points: [point],
    };
    this.onPreview(item, this.drag.points);
  }

  continuePointerDrag(pointer) {
    if (!this.active || !pointer.isDown || !this.drag || pointer.x < PANEL.x + PANEL.width) return;
    const item = this.drag.item ?? this.getSelectedItem();
    if (this.drag.mode === "demolish") {
      const point = this.getActionPoint(pointer, item, this.drag.demolitionType, this.drag.wallAxis);
      const sameWallAxis = point.orientation && point.orientation === this.drag.lastPoint.orientation;
      const points = point.orientation && !sameWallAxis
        ? [point]
        : getBuildDragPoints(this.drag.lastPoint, point);
      for (const dragPoint of points) this.onDemolish(dragPoint, this.drag.demolitionType);
      this.drag.lastPoint = point;
      return;
    }
    if (!item.dragPaint) return;
    if (item.placement === "wall" && !this.drag.wallAxis) {
      const raw = {
        x: Number(pointer.worldX ?? pointer.x),
        y: Number(pointer.worldY ?? pointer.y),
      };
      const deltaX = raw.x - this.drag.startRaw.x;
      const deltaY = raw.y - this.drag.startRaw.y;
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < TILE_SIZE / 4) return;
      this.drag.wallAxis = getBuildWallDragAxis(this.drag.startRaw, raw);
      const startPoint = {
        ...snapBuildWallDragPoint(this.drag.startRaw, this.drag.wallAxis),
        rawX: this.drag.startRaw.x,
        rawY: this.drag.startRaw.y,
      };
      this.drag.lastPoint = startPoint;
      this.drag.points = [startPoint];
    }
    const point = this.getActionPoint(pointer, item, this.drag.demolitionType, this.drag.wallAxis);
    if (item.placement === "wall") {
      this.drag.points = [
        this.drag.lastPoint,
        ...getBuildDragPoints(this.drag.lastPoint, point),
      ];
      this.onPreview(item, this.drag.points);
      return;
    }
    const sameWallAxis = point.orientation && point.orientation === this.drag.lastPoint.orientation;
    const points = point.orientation && !sameWallAxis
      ? [point]
      : getBuildDragPoints(this.drag.lastPoint, point);
    for (const dragPoint of points) {
      if (!this.drag.points.some((candidate) => candidate.x === dragPoint.x && candidate.y === dragPoint.y)) {
        this.drag.points.push(dragPoint);
      }
    }
    this.drag.lastPoint = point;
    this.onPreview(item, this.drag.points);
  }

  endPointerDrag() {
    if (this.drag?.mode === "place") {
      if (this.drag.item.placement === "wall") {
        if (this.drag.wallAxis && this.drag.points.length > 1) {
          for (let index = 1; index < this.drag.points.length; index += 1) {
            this.onPlace(this.drag.item, this.drag.points[index], {
              gesture: "drag",
              previousPoint: this.drag.points[index - 1],
            });
          }
        } else {
          this.onPlace(this.drag.item, this.drag.points[0], { gesture: "click" });
        }
      } else {
        for (const point of this.drag.points) this.onPlace(this.drag.item, point, { gesture: "drag" });
      }
    }
    this.drag = null;
    if (this.actionOpen) {
      this.actionOpen = false;
      this.onActionEnd();
    }
    this.onPreviewClear();
  }

  updateHoverPreview(pointer) {
    if (!this.active || pointer.x < PANEL.x + PANEL.width) {
      this.onPreviewClear();
      return;
    }
    const item = this.getSelectedItem();
    if (!item) return;
    const point = this.getActionPoint(pointer, item);
    if (item.mode === "demolish") {
      this.onPreviewClear();
      this.onDemolitionPreview(point);
      return;
    }
    this.onPreviewClear();
    this.onPreview(item, [point]);
  }

  setActive(value) {
    const next = Boolean(value);
    if (next === this.active) return;
    this.active = next;
    this.grid.setVisible(next);
    this.panel.setVisible(next);
    this.selection.setVisible(next);
    this.openButton.setVisible(!next);
    this.closeButton.setVisible(next);
    this.openButtonHit.setVisible(!next);
    this.closeButtonHit.setVisible(next);
    if (next) {
      this.openButtonHit.disableInteractive();
      this.closeButtonHit.setInteractive();
    } else {
      this.closeButtonHit.disableInteractive();
      this.openButtonHit.setInteractive();
    }
    if (!next) {
      this.drag = null;
      this.cancelPanelDrag();
      if (this.actionOpen) {
        this.actionOpen = false;
        this.onActionEnd();
      }
      this.onPreviewClear();
      for (const entry of this.objects) {
        if (entry.type === "text") entry.object.setVisible(false);
        else {
          entry.thumbnail.setVisible(false);
          entry.label.setVisible(false);
          entry.hit.disableInteractive();
        }
      }
    }
    this.onModeChange(next);
    this.renderLibrary();
  }

  toggle() {
    this.setActive(!this.active);
    return this.active;
  }

  isActive() {
    return this.active;
  }

  getState() {
    return {
      active: this.active,
      selectedId: this.selectedId,
      scrollOffset: this.scrollOffset,
      maxScrollOffset: this.maxScrollOffset,
      grid: BUILD_GRID,
      groupIds: BUILD_ASSET_GROUPS.map((group) => group.id),
    };
  }

  destroy() {
    this.onPreviewClear();
    this.scene.input.keyboard.off("keydown-TAB", this.onTab);
    this.scene.input.keyboard.off("keydown-Z", this.onUndoKey);
    this.scene.input.off("pointerdown", this.onWorldPointer);
    this.scene.input.off("pointermove", this.onPointerMove);
    this.scene.input.off("pointerup", this.onPointerUp);
    this.scene.input.off("pointerupoutside", this.onPointerUp);
    this.scene.input.off("pointercancel", this.onPointerCancel);
    this.scene.input.off("wheel", this.onWheel);
    this.scene.events?.off?.("update", this.onSceneUpdate);
    this.unsubscribe?.();
    this.grid.destroy();
    this.panel.destroy();
    this.selection.destroy();
    this.openButton.destroy();
    this.openButtonHit.destroy();
    this.closeButton.destroy();
    this.closeButtonHit.destroy();
    for (const entry of this.objects) {
      if (entry.type === "text") entry.object.destroy();
      else {
        entry.thumbnail.destroy();
        entry.hit.destroy();
      }
    }
    this.objects = [];
  }
}

export function createBuildModeRuntime(scene, options) {
  return new BuildModeRuntime(scene, options);
}
