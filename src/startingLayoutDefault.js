import { TREES_TEXTURE_KEY } from "./worldConfig.js";

const TREE_ITEM = Object.freeze({
  id: "tree",
  placement: "tree",
  objectType: "plant",
  resourceProfileId: "tree-planted",
  labelKey: "hud:buildMode.assets.tree",
  textureKey: TREES_TEXTURE_KEY,
  frame: 0,
});

const TREE_POINTS = Object.freeze([
  [48, 304], [128, 304], [224, 304],
  [736, 304], [832, 304], [912, 304],
]);

export const STARTER_TREE_OBJECTS = Object.freeze(TREE_POINTS.map(([x, y], index) => Object.freeze({
  id: `starter-tree-${String(index + 1).padStart(2, "0")}`,
  kind: "plant",
  item: TREE_ITEM,
  point: Object.freeze({ x, y }),
  bounds: Object.freeze({ left: x, right: x + 48, top: y, bottom: y + 64 }),
  collider: true,
  colliderBounds: Object.freeze({ left: x + 16, right: x + 32, top: y + 48, bottom: y + 64 }),
  colliderGroup: "resource:tree-planted",
})));

// A browser-authored layout still replaces the hand-authored world. These
// starter plants are restored only while that layout is absent.
export default null;
