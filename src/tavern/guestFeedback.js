import {
  createActorOverheadPresentation,
  OVERHEAD_ACTIONS,
} from "./overheadPresentationRuntime.js";

export function createGuestFeedback(scene, character) {
  const overhead = createActorOverheadPresentation(scene, character);
  let state = "";

  function set(next, options = {}) {
    const previous = state;
    state = next;
    const preservesPendingOrder = ["moving", "waiting", "washing", "chilling", "talking"].includes(state);
    if (!preservesPendingOrder) {
      overhead.setOrderItem(null);
      overhead.setThought(null);
    }
    if (state !== previous && state === "open-reaction") scene.audioRuntime?.playEffect?.("guest-happy");
    else if (state !== previous && ["closed-reaction", "order-failed"].includes(state)) {
      scene.audioRuntime?.playEffect?.("guest-angry");
    }
    const action = state === "reading-menu" ? OVERHEAD_ACTIONS.readMenu
      : state === "order" ? OVERHEAD_ACTIONS.order
        : state === "eating" ? OVERHEAD_ACTIONS.eat
          : state === "drinking" || state === "carrying-lemonade" ? OVERHEAD_ACTIONS.drink
            : state === "talking" ? OVERHEAD_ACTIONS.talk
              : state === "washing" ? OVERHEAD_ACTIONS.wash
                : state === "chilling" ? OVERHEAD_ACTIONS.chill
                  : state === "paying" ? OVERHEAD_ACTIONS.paying
                    : ["satisfaction", "open-reaction", "closed-reaction", "order-failed"].includes(state)
                      ? OVERHEAD_ACTIONS.satisfaction
                      : null;
    const satisfactionTier = state === "open-reaction" ? 3
      : ["closed-reaction", "order-failed"].includes(state) ? 1
        : options.satisfactionTier;
    overhead.setAction(action, { ...options, satisfactionTier });
  }

  return Object.freeze({
    set,
    setOrder({ itemId, itemLabel, status, progress = null }) {
      if (status === "offered") set("order");
      else {
        state = "waiting";
        overhead.setAction(null);
        overhead.setOrderItem({ itemId, label: itemLabel, progress });
      }
    },
    setThought(intent) { overhead.setThought(intent); },
    setAction(action, options = {}) { overhead.setAction(action, options); },
    setProgress(value) { overhead.setProgress(value); },
    update(deltaMs = 0) {
      overhead.update(deltaMs);
    },
    getState: () => ({ state, ...overhead.getState() }),
    destroy() {
      overhead.destroy();
    },
  });
}
