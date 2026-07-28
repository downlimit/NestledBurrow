import { FARMING_FRAMES, FARMING_TEXTURE_KEY } from "./farmingConfig.js";
import { purchasePotatoSeed } from "./merchantDomain.js";
import { HUD_COLORS, HUD_DEPTH, isPointInRect } from "./hud.js";
import { SEED_MERCHANT_INTERACTION_KIND } from "./interactionConfig.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";

export const SEED_MERCHANT_PANEL = Object.freeze({ x: 66, y: 58, width: 176, height: 88 });
export const SEED_MERCHANT_BUY_BUTTON = Object.freeze({ x: 80, y: 112, width: 148, height: 20 });

export function createMerchantRuntime(scene, {
  sessionState,
  localization,
  onActiveChange = () => {},
  onPersistentMutation = () => {},
  playEffect = () => {},
} = {}) {
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 30).setScrollFactor(0).setVisible(false);
  const seedImage = scene.add.image(SEED_MERCHANT_PANEL.x + 18, SEED_MERCHANT_PANEL.y + 30, FARMING_TEXTURE_KEY, FARMING_FRAMES.potatoSeeds)
    .setDepth(HUD_DEPTH + 31).setScrollFactor(0).setVisible(false);
  const title = createText(scene);
  const offer = createText(scene);
  const balance = createText(scene);
  const status = createText(scene, { color: "#efbd79" });
  const buyLabel = createText(scene);
  const exitLabel = createText(scene);
  const hit = scene.add.zone(SEED_MERCHANT_BUY_BUTTON.x, SEED_MERCHANT_BUY_BUTTON.y, SEED_MERCHANT_BUY_BUTTON.width, SEED_MERCHANT_BUY_BUTTON.height)
    .setOrigin(0).setDepth(HUD_DEPTH + 32).setScrollFactor(0).disableInteractive();
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
    seedImage.setVisible(show);
    for (const text of [title, offer, balance, status, buyLabel, exitLabel]) text.setVisible(false);
    if (!show) {
      hit.disableInteractive();
      return;
    }
    graphics.fillStyle(HUD_COLORS.panel, 0.98)
      .fillRect(SEED_MERCHANT_PANEL.x, SEED_MERCHANT_PANEL.y, SEED_MERCHANT_PANEL.width, SEED_MERCHANT_PANEL.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1)
      .strokeRect(SEED_MERCHANT_PANEL.x + 0.5, SEED_MERCHANT_PANEL.y + 0.5, SEED_MERCHANT_PANEL.width - 1, SEED_MERCHANT_PANEL.height - 1);
    graphics.fillStyle(HUD_COLORS.shadow, 0.9)
      .fillRect(SEED_MERCHANT_BUY_BUTTON.x, SEED_MERCHANT_BUY_BUTTON.y, SEED_MERCHANT_BUY_BUTTON.width, SEED_MERCHANT_BUY_BUTTON.height);
    graphics.lineStyle(1, HUD_COLORS.light, 0.75)
      .strokeRect(SEED_MERCHANT_BUY_BUTTON.x + 0.5, SEED_MERCHANT_BUY_BUTTON.y + 0.5, SEED_MERCHANT_BUY_BUTTON.width - 1, SEED_MERCHANT_BUY_BUTTON.height - 1);
    style(title, scene).setText(localization.t("hud:merchant.title")).setPosition(SEED_MERCHANT_PANEL.x + 8, SEED_MERCHANT_PANEL.y + 5).setVisible(true);
    style(offer, scene, { fontSize: "8px" }).setText(localization.t("hud:merchant.offer")).setPosition(SEED_MERCHANT_PANEL.x + 37, SEED_MERCHANT_PANEL.y + 20).setVisible(true);
    style(balance, scene, { fontSize: "8px" }).setText(localization.t("hud:merchant.balance", { count: sessionState.gameplay.coins }))
      .setPosition(SEED_MERCHANT_PANEL.x + 37, SEED_MERCHANT_PANEL.y + 32).setVisible(true);
    style(buyLabel, scene, { fontSize: "8px" }).setText(localization.t("hud:merchant.buy"))
      .setPosition(Math.round(SEED_MERCHANT_BUY_BUTTON.x + (SEED_MERCHANT_BUY_BUTTON.width - buyLabel.width) / 2), SEED_MERCHANT_BUY_BUTTON.y + 5).setVisible(true);
    style(exitLabel, scene, { fontSize: "7px", color: "#b9c5d8" }).setText(localization.t("hud:merchant.exit"))
      .setPosition(SEED_MERCHANT_PANEL.x + 8, SEED_MERCHANT_PANEL.y + 76).setVisible(true);
    if (lastStatus && lastStatus !== "purchased") {
      style(status, scene, { fontSize: "7px", color: "#efbd79" }).setText(localization.t(`hud:merchant.${lastStatus}`))
        .setPosition(SEED_MERCHANT_PANEL.x + 8, SEED_MERCHANT_PANEL.y + 43).setVisible(true);
    }
    hit.setInteractive({ useHandCursor: true });
  }

  function purchase() {
    const result = purchasePotatoSeed(sessionState.gameplay);
    lastStatus = result.status;
    if (result.mutated) { playEffect("purchase"); onPersistentMutation(result); }
    render();
    return result;
  }

  function onBuy(pointer, _x, _y, event) {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    if (visible()) purchase();
  }

  hit.on("pointerdown", onBuy);
  const unsubscribe = localization?.subscribe?.(render);

  function setActive(value) {
    const next = Boolean(value);
    if (active === next) {
      render();
      return;
    }
    active = next;
    lastStatus = null;
    playEffect(active ? "menu-open" : "menu-close");
    render();
    onActiveChange(active);
  }

  return {
    handleInteraction(candidate) {
      if (candidate?.kind !== SEED_MERCHANT_INTERACTION_KIND) return { status: "ignored", mutated: false };
      if (!active) {
        setActive(true);
        return { status: "merchant-opened", mutated: false };
      }
      setActive(false);
      return { status: "merchant-closed", mutated: false };
    },
    updateCandidate(candidate) {
      if (!active) return;
      if (candidate?.entityId === "seed-merchant") return;
      const player = scene.characterSystem?.getSnapshot?.(sessionState.playerId);
      const merchant = scene.characterSystem?.getSnapshot?.("seed-merchant");
      if (player?.position && merchant?.position
        && Math.hypot(player.position.x - merchant.position.x, player.position.y - merchant.position.y) <= 30) return;
      setActive(false);
    },
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
      labels: {
        title: localization.t("hud:merchant.title"),
        offer: localization.t("hud:merchant.offer"),
        buy: localization.t("hud:merchant.buy"),
      },
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      hit.off("pointerdown", onBuy);
      hit.destroy();
      graphics.destroy();
      seedImage.destroy();
      for (const text of [title, offer, balance, status, buyLabel, exitLabel]) text.destroy();
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
