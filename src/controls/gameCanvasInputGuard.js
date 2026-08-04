const BROWSER_PASSTHROUGH_CODES = new Set(["F11"]);

export function shouldPreventGameBrowserShortcut(event) {
  if (!event || BROWSER_PASSTHROUGH_CODES.has(String(event.code ?? event.key ?? ""))) return false;
  return !isEditableTarget(event.target);
}

export function createGameCanvasInputGuard(canvas, {
  windowRef = globalThis.window,
} = {}) {
  const preventContextMenu = (event) => event?.preventDefault?.();
  const preventBrowserShortcut = (event) => {
    if (shouldPreventGameBrowserShortcut(event)) event.preventDefault?.();
  };

  canvas?.addEventListener?.("contextmenu", preventContextMenu);
  // Bubble after Phaser: the game consumes the key first, then the browser default is cancelled.
  windowRef?.addEventListener?.("keydown", preventBrowserShortcut);
  windowRef?.addEventListener?.("keyup", preventBrowserShortcut);

  return {
    destroy() {
      canvas?.removeEventListener?.("contextmenu", preventContextMenu);
      windowRef?.removeEventListener?.("keydown", preventBrowserShortcut);
      windowRef?.removeEventListener?.("keyup", preventBrowserShortcut);
    },
  };
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
