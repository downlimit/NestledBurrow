export const DEFAULT_CAMERA_TUNING = Object.freeze({
  backPointFollowRate: 5,
  cameraLeadTransitionSeconds: 2,
});

export function normalizeCameraTuning(value = {}) {
  return {
    backPointFollowRate: clampNumber(value.backPointFollowRate, DEFAULT_CAMERA_TUNING.backPointFollowRate, 0.1, 20),
    cameraLeadTransitionSeconds: clampNumber(value.cameraLeadTransitionSeconds, DEFAULT_CAMERA_TUNING.cameraLeadTransitionSeconds, 0.1, 10),
  };
}

export function cameraFollowStep(state, {
  presentationPosition,
  speed,
  movingSpeedThreshold,
  deltaSeconds,
  maxPresentationSpeed = null,
  tuning = DEFAULT_CAMERA_TUNING,
}) {
  const config = normalizeCameraTuning(tuning);
  const delta = Math.min(0.1, Math.max(0, Number(deltaSeconds) || 0));
  const presentation = limitedPresentationPosition(
    state.presentation ?? presentationPosition,
    presentationPosition,
    maxPresentationSpeed,
    delta,
  );
  const alpha = 1 - Math.exp(-config.backPointFollowRate * delta);
  const back = {
    x: state.back.x + (presentation.x - state.back.x) * alpha,
    y: state.back.y + (presentation.y - state.back.y) * alpha,
  };
  const front = {
    x: presentation.x + (presentation.x - back.x),
    y: presentation.y + (presentation.y - back.y),
  };
  const moving = Number(speed) > Number(movingSpeedThreshold);
  const progressDelta = delta / config.cameraLeadTransitionSeconds;
  const progress = Math.min(1, Math.max(0, state.progress + (moving ? progressDelta : -progressDelta)));
  const weight = progress * progress * (3 - 2 * progress);
  const rawTarget = {
    x: back.x + (front.x - back.x) * weight,
    y: back.y + (front.y - back.y) * weight,
  };
  const target = limitedPresentationPosition(state.target ?? rawTarget, rawTarget, maxPresentationSpeed, delta);
  return { presentation, back, front, target, progress, moving };
}

function limitedPresentationPosition(previous, current, maxSpeed, deltaSeconds) {
  const speed = Number(maxSpeed);
  if (!(speed > 0) || !Number.isFinite(speed) || !(deltaSeconds > 0)) return { ...current };
  const deltaX = current.x - previous.x;
  const deltaY = current.y - previous.y;
  const distance = Math.hypot(deltaX, deltaY);
  const maximumDistance = speed * deltaSeconds;
  if (distance <= maximumDistance || distance < 0.0001) return { ...current };
  const scale = maximumDistance / distance;
  return { x: previous.x + deltaX * scale, y: previous.y + deltaY * scale };
}

export class CameraFollowRuntime {
  constructor(scene, { presentationPosition, tuning, movingSpeedThreshold }) {
    this.scene = scene;
    this.tuning = normalizeCameraTuning(tuning);
    this.movingSpeedThreshold = movingSpeedThreshold;
    this.followTarget = scene.add.zone(presentationPosition.x, presentationPosition.y, 1, 1);
    scene.cameras.main.startFollow(this.followTarget, true, 1, 1);
    this.reset(presentationPosition);
  }

  setTuning(tuning) {
    this.tuning = normalizeCameraTuning(tuning);
  }

  reset(presentationPosition) {
    this.state = {
      presentation: { ...presentationPosition },
      back: { ...presentationPosition },
      front: { ...presentationPosition },
      target: { ...presentationPosition },
      progress: 0,
      moving: false,
    };
    this.followTarget?.setPosition(presentationPosition.x, presentationPosition.y);
  }

  update({ presentationPosition, speed, deltaMs, maxPresentationSpeed = null }) {
    this.state = cameraFollowStep(this.state, {
      presentationPosition,
      speed,
      movingSpeedThreshold: this.movingSpeedThreshold,
      deltaSeconds: (Number(deltaMs) || 0) / 1000,
      maxPresentationSpeed,
      tuning: this.tuning,
    });
    this.followTarget.setPosition(this.state.target.x, this.state.target.y);
    return this.getState();
  }

  getState() {
    return {
      presentation: { ...this.state.presentation },
      back: { ...this.state.back },
      front: { ...this.state.front },
      target: { ...this.state.target },
      progress: this.state.progress,
      moving: this.state.moving,
    };
  }

  destroy() {
    this.scene?.cameras?.main?.stopFollow?.();
    this.followTarget?.destroy?.();
    this.followTarget = null;
    this.scene = null;
  }
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
