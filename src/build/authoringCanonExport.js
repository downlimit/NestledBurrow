import {
  AUTHORING_CANON_FILENAME,
  createAuthoringBackupSource,
  createLiveAuthoringCanon,
} from "./authoringBackup.js";

const CANON_EXPORT_BUTTON = Symbol("nestledBurrowAuthoringCanonExportButton");

function downloadText(documentRef, filename, source) {
  if (typeof Blob !== "function" || typeof globalThis.URL?.createObjectURL !== "function") {
    throw new Error("Browser download is unavailable");
  }
  const url = globalThis.URL.createObjectURL(new Blob([source], { type: "application/json" }));
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  documentRef.body.append(anchor);
  anchor.click?.();
  anchor.remove?.();
  globalThis.URL.revokeObjectURL?.(url);
}

function objectCount(layout) {
  return (layout?.buildObjects?.length ?? 0)
    + (layout?.facilities?.length ?? 0)
    + (layout?.furniture?.length ?? 0)
    + (layout?.beds?.length ?? 0);
}

export function installAuthoringCanonExport(panel, scene) {
  if (!panel?.panel || !scene || panel[CANON_EXPORT_BUTTON]) return panel?.[CANON_EXPORT_BUTTON] ?? null;
  const documentRef = panel.documentRef ?? globalThis.document;
  const actions = panel.panel.querySelector?.(".movement-debug-actions") ?? panel.panel;
  const button = documentRef.createElement("button");
  button.type = "button";
  button.textContent = "Сохранить и выгрузить канон объектов";
  button.title = "Сохраняет текущие коллайдеры, пивоты, визуальные оффсеты, crop, направления взаимодействия и расстановку всех объектов в один JSON-файл";
  button.addEventListener("click", async () => {
    button.disabled = true;
    panel.setAuthoringStatus?.("Фиксация и выгрузка полного канона объектов…");
    try {
      panel.onColliderDraftConfirm?.();
      const canon = createLiveAuthoringCanon(scene, panel.storage);
      downloadText(documentRef, AUTHORING_CANON_FILENAME, createAuthoringBackupSource(canon));
      panel.setAuthoringStatus?.(
        `Канон объектов сохранён и выгружен: ${objectCount(canon.startingLayout)} объектов, ${Object.keys(canon.assetProfiles).length} профилей`,
      );
    } catch (error) {
      console.warn("Authoring canon export failed", error);
      panel.setAuthoringStatus?.("Не удалось сохранить и выгрузить канон объектов", true);
    } finally {
      button.disabled = false;
    }
  });
  actions.prepend?.(button);
  if (!button.parentNode) actions.append(button);
  Object.defineProperty(panel, CANON_EXPORT_BUTTON, { value: button });
  scene.events?.once?.("shutdown", () => button.remove?.());
  return button;
}
