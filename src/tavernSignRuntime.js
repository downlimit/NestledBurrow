import { TAVERN_SIGN, TAVERN_SIGN_ASSET, TAVERN_SIGN_KIND } from "./guestConfig.js";
import { worldDepthFromAnchorY } from "./buildWorldGeometry.js";

export function createTavernSignRuntime(scene, { getTavernOpen, worldLayout }) {
  const sprite = scene.add.sprite(TAVERN_SIGN.position.x, TAVERN_SIGN.position.y, TAVERN_SIGN_ASSET.key, 1)
    .setOrigin(0.5, 1)
    .setDepth(worldDepthFromAnchorY(TAVERN_SIGN.position.y, TAVERN_SIGN.id));
  const collider = {
    left: TAVERN_SIGN.position.x - 5,
    right: TAVERN_SIGN.position.x + 5,
    top: TAVERN_SIGN.position.y - 9,
    bottom: TAVERN_SIGN.position.y + 1,
  };
  worldLayout?.setWorldObjectCollider?.(TAVERN_SIGN.id, collider, "facility:tavern-sign");

  function draw() {
    sprite.setFrame(getTavernOpen() ? 0 : 1);
  }
  draw();

  return {
    getInteractionDefinitions() {
      return [{
        id: TAVERN_SIGN.id,
        entityId: TAVERN_SIGN.entityId,
        roomId: "world",
        kind: TAVERN_SIGN_KIND,
        position: TAVERN_SIGN.interactionPosition,
        radius: 34,
        priority: 30,
        requiresFacing: false,
        facingDotThreshold: -1,
        prompt: getTavernOpen() ? "hud:interaction.closeTavern" : "hud:interaction.openTavern",
        payload: {},
      }];
    },
    sync: draw,
    getState: () => ({ open: Boolean(getTavernOpen()), ...TAVERN_SIGN }),
    destroy: () => {
      sprite.destroy();
      worldLayout?.clearWorldObjectCollider?.(TAVERN_SIGN.id);
    },
  };
}
