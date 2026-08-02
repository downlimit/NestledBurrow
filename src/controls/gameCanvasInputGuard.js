export function createGameCanvasInputGuard(canvas) {
  const preventContextMenu = (event) => event?.preventDefault?.();
  canvas?.addEventListener?.("contextmenu", preventContextMenu);

  return {
    destroy() {
      canvas?.removeEventListener?.("contextmenu", preventContextMenu);
    },
  };
}
