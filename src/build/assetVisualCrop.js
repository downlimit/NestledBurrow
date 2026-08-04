import { normalizeVisualCropInsets } from "./assetProfiles.js";

function imageSize(image) {
  const frame = image?.frame;
  const width = Number(frame?.realWidth ?? frame?.width ?? image?.width ?? image?.displayWidth);
  const height = Number(frame?.realHeight ?? frame?.height ?? image?.height ?? image?.displayHeight);
  return {
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 0,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 0,
  };
}

function imageBounds(image) {
  const size = imageSize(image);
  return {
    left: Number(image?.x) || 0,
    top: Number(image?.y) || 0,
    right: (Number(image?.x) || 0) + size.width,
    bottom: (Number(image?.y) || 0) + size.height,
  };
}

export function getVisualCropSourceBounds(target) {
  if (target?.spriteImage) {
    const size = imageSize(target.spriteImage);
    return size.width && size.height
      ? Object.freeze({ left: 0, top: 0, right: size.width, bottom: size.height })
      : null;
  }
  const children = target?.spriteContainer?.list ?? [];
  const bounds = children.map(imageBounds).filter((entry) => entry.right > entry.left && entry.bottom > entry.top);
  if (!bounds.length) return null;
  return Object.freeze({
    left: Math.min(...bounds.map((entry) => entry.left)),
    top: Math.min(...bounds.map((entry) => entry.top)),
    right: Math.max(...bounds.map((entry) => entry.right)),
    bottom: Math.max(...bounds.map((entry) => entry.bottom)),
  });
}

export function cropVisibleBounds(sourceBounds, insets) {
  const normalized = normalizeVisualCropInsets(insets);
  const left = Math.min(sourceBounds.right - 1, sourceBounds.left + normalized.left);
  const right = Math.max(left + 1, sourceBounds.right - normalized.right);
  const top = Math.min(sourceBounds.bottom - 1, sourceBounds.top + normalized.top);
  const bottom = Math.max(top + 1, sourceBounds.bottom - normalized.bottom);
  return Object.freeze({ left, right, top, bottom });
}

export function cropInsetsFromVisibleBounds(sourceBounds, visibleBounds) {
  return normalizeVisualCropInsets({
    left: visibleBounds.left - sourceBounds.left,
    right: sourceBounds.right - visibleBounds.right,
    top: visibleBounds.top - sourceBounds.top,
    bottom: sourceBounds.bottom - visibleBounds.bottom,
  });
}

function cropSignature(insets) {
  return `${insets.left},${insets.right},${insets.top},${insets.bottom}`;
}

export function applyVisualCrop(target, insets = {}) {
  const sourceBounds = getVisualCropSourceBounds(target);
  if (!sourceBounds) return Object.freeze({ supported: false, sourceBounds: null, visibleBounds: null });
  const normalized = normalizeVisualCropInsets(insets);
  const signature = cropSignature(normalized);
  const visibleBounds = cropVisibleBounds(sourceBounds, normalized);
  if (target.__nestledBurrowCropSignature === signature) {
    return Object.freeze({ supported: true, sourceBounds, visibleBounds });
  }

  if (target.spriteImage) {
    const image = target.spriteImage;
    if (normalized.left || normalized.right || normalized.top || normalized.bottom) {
      image.setCrop?.(
        visibleBounds.left,
        visibleBounds.top,
        visibleBounds.right - visibleBounds.left,
        visibleBounds.bottom - visibleBounds.top,
      );
    } else {
      image.resetCrop?.();
    }
  } else {
    for (const image of target.spriteContainer?.list ?? []) {
      const childBounds = imageBounds(image);
      const intersection = {
        left: Math.max(visibleBounds.left, childBounds.left),
        right: Math.min(visibleBounds.right, childBounds.right),
        top: Math.max(visibleBounds.top, childBounds.top),
        bottom: Math.min(visibleBounds.bottom, childBounds.bottom),
      };
      const visible = intersection.right > intersection.left && intersection.bottom > intersection.top;
      image.setVisible?.(visible);
      if (!visible) continue;
      const full = intersection.left === childBounds.left
        && intersection.right === childBounds.right
        && intersection.top === childBounds.top
        && intersection.bottom === childBounds.bottom;
      if (full) image.resetCrop?.();
      else image.setCrop?.(
        intersection.left - childBounds.left,
        intersection.top - childBounds.top,
        intersection.right - intersection.left,
        intersection.bottom - intersection.top,
      );
    }
  }
  target.__nestledBurrowCropSignature = signature;
  return Object.freeze({ supported: true, sourceBounds, visibleBounds });
}
