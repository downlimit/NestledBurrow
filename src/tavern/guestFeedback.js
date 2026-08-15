import { PLATED_DISH_ASSET } from "../facilities/facilityConfig.js";
import { LEMONADE_FRAMES, LEMONADE_TEXTURE_KEY } from "./lemonadeConfig.js";
import { createManagedText } from "../ui/textResolution.js";

export function createGuestFeedback(scene, character) {
  const marker = scene.add.graphics().setDepth(900);
  const reactionStyle = { fontSize: "7px", color: "#f7e7a1" };
  const reaction = createManagedText(scene, 0, 0, "", reactionStyle).setDepth(902).setVisible(false);
  const orderText = createManagedText(scene, 0, 0, "", {
    fontSize: "7px",
    color: "#fff2c1",
    align: "center",
    backgroundColor: "#241a20",
    padding: { x: 3, y: 2 },
  }).setDepth(904).setVisible(false);
  const reactionOutline = [[-1, 0], [1, 0], [0, -1], [0, 1]].map(([x, y]) => ({
    x,
    y,
    visual: createManagedText(scene, 0, 0, "", { ...reactionStyle, color: "#100b0e" })
      .setDepth(901).setAlpha(0.72).setVisible(false),
  }));
  const thumb = scene.add.graphics().setDepth(902).setVisible(false);
  drawPixelThumb(thumb);
  const carriedItem = scene.add.image(0, 0, PLATED_DISH_ASSET.key)
    .setDepth(901)
    .setVisible(false);
  let state = "";

  return {
    set(next) {
      const previousState = state;
      state = next;
      orderText.setVisible(false);
      if (state !== previousState && state === "open-reaction") scene.audioRuntime?.playEffect?.("guest-happy");
      else if (state !== previousState && ["closed-reaction", "order-failed"].includes(state)) scene.audioRuntime?.playEffect?.("guest-angry");
      const reactionText = state === "checking" ? "..."
        : state === "open-reaction" ? ":D"
          : ["closed-reaction", "order-failed"].includes(state) ? ":(" : "";
      const color = ["closed-reaction", "order-failed"].includes(state) ? "#ef8b78" : "#f7e7a1";
      reaction.setText(reactionText).setStyle({ color }).setVisible(Boolean(reactionText));
      for (const outline of reactionOutline) outline.visual.setText(reactionText).setVisible(Boolean(reactionText));
      thumb.setVisible(state === "meal-complete");
      if (state === "carrying-lemonade") {
        carriedItem.setTexture(LEMONADE_TEXTURE_KEY, LEMONADE_FRAMES.lemonade).setVisible(true);
      } else if (["carrying-dish", "eating"].includes(state)) {
        carriedItem.setTexture(PLATED_DISH_ASSET.key, 0).setVisible(true);
      } else {
        carriedItem.setVisible(false);
      }
    },
    setOrder({ displayName, itemLabel }) {
      state = "order";
      reaction.setVisible(false);
      for (const outline of reactionOutline) outline.visual.setVisible(false);
      thumb.setVisible(false);
      carriedItem.setVisible(false);
      orderText.setText(`${displayName}\n${itemLabel}`).setVisible(true);
    },
    update() {
      const position = character.motor.position;
      const anchorX = Math.round(position.x);
      const anchorY = Math.round(position.y - 25);
      const reactionX = anchorX - Math.floor(reaction.width / 2);
      const reactionY = anchorY - reaction.height;
      reaction.setPosition(reactionX, reactionY).setDepth(902 + Math.round(position.y));
      for (const outline of reactionOutline) outline.visual
        .setPosition(reactionX + outline.x, reactionY + outline.y)
        .setDepth(901 + Math.round(position.y));
      thumb.setPosition(anchorX - 4, anchorY - 8).setDepth(902 + Math.round(position.y));
      carriedItem.setPosition(anchorX, Math.round(position.y - 19)).setDepth(901 + Math.round(position.y));
      orderText.setPosition(
        Math.round(anchorX - orderText.width / 2),
        Math.round(anchorY - orderText.height - 2),
      ).setDepth(904 + Math.round(position.y));
      marker.clear();
      if (state === "eating") {
        marker.fillStyle(0x8bd17c, 1).fillRect(position.x - 2, position.y - 23, 4, 2);
      }
    },
    destroy() {
      marker.destroy();
      reaction.destroy();
      orderText.destroy();
      for (const outline of reactionOutline) outline.visual.destroy();
      thumb.destroy();
      carriedItem.destroy();
    },
  };
}

function drawPixelThumb(graphics) {
  graphics.fillStyle(0x100b0e, 0.72).fillRect(-1, 1, 8, 7);
  graphics.fillStyle(0xf7e7a1, 1).fillRect(0, 0, 2, 5).fillRect(2, 2, 4, 5).fillRect(5, 3, 2, 3);
}
