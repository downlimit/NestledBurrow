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
  windowRef?.addEventListener?.("keydown", preventBrowserShortcut, true);
  windowRef?.addEventListener?.("keyup", preventBrowserShortcut, true);

  return {
    destroy() {
      canvas?.removeEventListener?.("contextmenu", preventContextMenu);
      windowRef?.removeEventListener?.("keydown", preventBrowserShortcut, true);
      windowRef?.removeEventListener?.("keyup", preventBrowserShortcut, true);
    },
  };
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
