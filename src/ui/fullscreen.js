export function isFullscreenSupported(element) {
  return Boolean(element?.requestFullscreen);
}

export function isFullscreenActive(documentRef = document, element = null) {
  if (!documentRef?.fullscreenElement) return false;
  return element ? documentRef.fullscreenElement === element : true;
}

export async function toggleFullscreen({ documentRef = document, element } = {}) {
  if (!isFullscreenSupported(element)) return false;

  try {
    if (isFullscreenActive(documentRef, element)) {
      if (documentRef.exitFullscreen) await documentRef.exitFullscreen();
      return false;
    }

    await element.requestFullscreen();
    return true;
  } catch {
    return isFullscreenActive(documentRef, element);
  }
}
