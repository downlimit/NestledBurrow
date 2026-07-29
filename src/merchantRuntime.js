import { FARMING_FRAMES, FARMING_TEXTURE_KEY } from "./farmingConfig.js";
import { LEMONADE_FRAMES, LEMONADE_TEXTURE_KEY } from "./lemonadeConfig.js";
import { purchaseSeed, SEED_OFFERS } from "./merchantDomain.js";
import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "./hud.js";
import { SEED_MERCHANT_INTERACTION_KIND } from "./interactionConfig.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";

export const SEED_MERCHANT_PANEL = Object.freeze({ x: 66, y: 43, width: 176, height: 107 });
export const SEED_MERCHANT_BUY_BUTTONS = Object.freeze([
  Object.freeze({ itemId: "potato-seed", x: 76, y: 108, width: 74, height: 25 }),
  Object.freeze({ itemId: "lemon-seed", x: 158, y: 108, width: 74, height: 25 }),
]);
export const SEED_MERCHANT_BUY_BUTTON = SEED_MERCHANT_BUY_BUTTONS[0];

export function createMerchantRuntime(scene, {
  sessionState,
  localization,
  onActiveChange = () => {},
  onPersistentMutation = () => {},
  onInventoryGain = () => {},
  playEffect = () => {},
} = {}) {
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 30).setScrollFactor(0).setVisible(false);
  const images = [
    scene.add.image(0, 0, FARMING_TEXTURE_KEY, FARMING_FRAMES.potatoSeeds),
    scene.add.image(0, 0, LEMONADE_TEXTURE_KEY, LEMONADE_FRAMES["lemon-seeds"]),
  ].map((image) => image.setDepth(HUD_DEPTH + 31).setScrollFactor(0).setVisible(false));
  const title = createText(scene);
  const balance = createText(scene);
  const status = createText(scene, { color: "#efbd79" });
  const exitLabel = createText(scene);
  const offerLabels = SEED_MERCHANT_BUY_BUTTONS.map(() => createText(scene, { fontSize: "7px" }));
  const buyLabels = SEED_MERCHANT_BUY_BUTTONS.map(() => createText(scene, { fontSize: "7px" }));
  const hits = SEED_MERCHANT_BUY_BUTTONS.map((button) => scene.add.zone(button.x, button.y, button.width, button.height)
    .setOrigin(0).setDepth(HUD_DEPTH + 32).setScrollFactor(0).disableInteractive());
  let active = false;
  let suppressed = false;
  let lastStatus = null;
  let destroyed = false;

  function visible() {
    return active && !suppressed && !destroyed;
  }

  function render() {
    const show = visible();
    graphics.clear().setVisible(show);
    images.forEach((image) => image.setVisible(show));
    for (const text of [title, balance, status, exitLabel, ...offerLabels, ...buyLabels]) text.setVisible(false);
    if (!show) {
      hits.forEach((hit) => hit.disableInteractive());
      return;
    }
    graphics.fillStyle(HUD_COLORS.panel, 0.98)
      .fillRect(SEED_MERCHANT_PANEL.x, SEED_MERCHANT_PANEL.y, SEED_MERCHANT_PANEL.width, SEED_MERCHANT_PANEL.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(SEED_MERCHANT_PANEL.x + 0.5, SEED_MERCHANT_PANEL.y + 0.5, SEED_MERCHANT_PANEL.width - 1, SEED_MERCHANT_PANEL.height - 1);
    style(title, scene).setText(localization.t("hud:merchant.title")).setVisible(true);
    title.setPosition(Math.round(SEED_MERCHANT_PANEL.x + (SEED_MERCHANT_PANEL.width - title.width) / 2), 48);
    const detail = lastStatus && lastStatus !== "purchased"
      ? localization.t(`hud:merchant.${lastStatus}`)
      : localization.t("hud:merchant.balance", { count: sessionState.gameplay.coins });
    const detailTarget = lastStatus && lastStatus !== "purchased" ? status : balance;
    style(detailTarget, scene, {
      fontSize: "7px",
      color: lastStatus && lastStatus !== "purchased" ? "#efbd79" : "#f2eadc",
    }).setText(detail).setVisible(true);
    detailTarget.setPosition(
      Math.round(SEED_MERCHANT_PANEL.x + (SEED_MERCHANT_PANEL.width - detailTarget.width) / 2),
      64,
    );
    SEED_MERCHANT_BUY_BUTTONS.forEach((button, index) => {
      images[index].setPosition(button.x + button.width / 2, 82);
      graphics.fillStyle(HUD_COLORS.shadow, 0.9).fillRect(button.x, button.y, button.width, button.height);
      graphics.lineStyle(1, HUD_COLORS.light, 0.75).strokeRect(button.x + 0.5, button.y + 0.5, button.width - 1, button.height - 1);
      style(offerLabels[index], scene, { fontSize: "7px" })
        .setText(localization.t(`hud:merchant.${button.itemId}`))
        .setVisible(true);
      offerLabels[index].setPosition(
        Math.round(button.x + (button.width - offerLabels[index].width) / 2),
        93,
      );
      style(buyLabels[index], scene, { fontSize: "7px" })
        .setText(localization.t("hud:merchant.buyPrice", { count: SEED_OFFERS[button.itemId] }))
        .setVisible(true);
      buyLabels[index].setPosition(
        Math.round(button.x + (button.width - buyLabels[index].width) / 2),
        button.y + 7,
      );
      hits[index].setInteractive({ useHandCursor: true });
    });
    style(exitLabel, scene, { fontSize: "7px", color: "#b9c5d8" }).setText(localization.t("hud:merchant.exit"))
      .setVisible(true);
    exitLabel.setPosition(
      Math.round(SEED_MERCHANT_PANEL.x + (SEED_MERCHANT_PANEL.width - exitLabel.width) / 2),
      138,
    );
  }

  function purchase(itemId) {
    const result = purchaseSeed(sessionState.gameplay, itemId);
    lastStatus = result.status;
    if (result.mutated) {
      playEffect("purchase");
      onInventoryGain(result.inventory);
      onPersistentMutation(result);
    }
    render();
    return result;
  }

  hits.forEach((hit, index) => hit.on("pointerdown", (pointer, _x, _y, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    if (visible()) purchase(SEED_MERCHANT_BUY_BUTTONS[index].itemId);
  }));
  const unsubscribe = localization?.subscribe?.(render);

  function setActive(value) {
    const next = Boolean(value);
    if (active === next) return render();
    active = next;
    lastStatus = null;
    playEffect(active ? "menu-open" : "menu-close");
    render();
    onActiveChange(active);
  }

  return {
    handleInteraction(candidate) {
      if (candidate?.kind !== SEED_MERCHANT_INTERACTION_KIND) return { status: "ignored", mutated: false };
      setActive(!active);
      return { status: active ? "merchant-opened" : "merchant-closed", mutated: false };
    },
    updateCandidate(candidate) {
      if (!active || candidate?.entityId === "seed-merchant") return;
      const player = scene.characterSystem?.getSnapshot?.(sessionState.playerId);
      const merchant = scene.characterSystem?.getSnapshot?.("seed-merchant");
      if (player?.position && merchant?.position
        && Math.hypot(player.position.x - merchant.position.x, player.position.y - merchant.position.y) <= 30) return;
      setActive(false);
    },
    purchase,
    close() { setActive(false); },
    setSuppressed(value) { suppressed = Boolean(value); render(); },
    isActive: () => active && !destroyed,
    isVisible: () => visible(),
    isPointInHud(x, y) { return visible() && isPointInRect(x, y, SEED_MERCHANT_PANEL); },
    getState: () => ({
      active: active && !destroyed,
      visible: visible(),
      status: lastStatus,
      coins: sessionState.gameplay.coins,
      panel: SEED_MERCHANT_PANEL,
      buyButton: SEED_MERCHANT_BUY_BUTTON,
      buyButtons: SEED_MERCHANT_BUY_BUTTONS,
      labels: {
        title: title.text,
        balance: balance.text,
        status: status.text,
        offers: offerLabels.map((label) => label.text),
        buys: buyLabels.map((label) => label.text),
        exit: exitLabel.text,
      },
      labelRects: {
        title: textRect(title),
        balance: textRect(balance.visible ? balance : status),
        offers: offerLabels.map(textRect),
        buys: buyLabels.map(textRect),
        exit: textRect(exitLabel),
      },
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      hits.forEach((hit) => hit.destroy());
      graphics.destroy();
      images.forEach((image) => image.destroy());
      for (const text of [title, balance, status, exitLabel, ...offerLabels, ...buyLabels]) text.destroy();
    },
  };
}

function createText(scene, extra = {}) {
  return createManagedText(scene, 0, 0, "", { fontSize: "9px", color: "#f2eadc", ...extra })
    .setDepth(HUD_DEPTH + 31).setScrollFactor(0).setVisible(false);
}

function style(text, scene, extra = {}) {
  return setManagedTextStyle(text, scene, {
    fontFamily: scene.localization?.getLocale?.().fontKey ?? "sans-serif",
    fontSize: "9px",
    color: "#f2eadc",
    ...extra,
  });
}

function textRect(text) {
  return {
    x: text.x,
    y: text.y,
    width: text.width,
    height: text.height,
  };
}
