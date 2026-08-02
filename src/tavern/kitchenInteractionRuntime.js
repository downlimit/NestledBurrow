import {
  COOKING_STEP_TYPES,
  craftLemonade,
  interactServingTable,
  repairStove,
  takeStarterLemons,
} from "./cookingDomain.js";

export function createKitchenInteractionRuntime({
  sessionState,
  facilityRuntime,
  cookingRuntime,
  localization,
  getSelectedItem = () => null,
  onInventoryGain = () => {},
  onPersistentMutation = () => {},
  showMessage = () => {},
  playEffect = () => {},
} = {}) {
  function handleFacility(facility) {
    if (!facility) return { status: "ignored", mutated: false };
    const { kitchen, farm, inventory } = sessionState.gameplay;
    let result;
    if (facility.facilityType === "cutting-table") {
      result = cookingRuntime.start(COOKING_STEP_TYPES.preparation);
    } else if (facility.facilityType === "gas-stove") {
      result = kitchen.stoveRepaired
        ? cookingRuntime.start(COOKING_STEP_TYPES.frying)
        : repairStove(sessionState.gameplay);
    } else if (facility.facilityType === "juicer") {
      result = craftLemonade(kitchen, farm, inventory);
    } else if (facility.facilityType === "lemon-sack") {
      result = takeStarterLemons(kitchen, inventory);
    } else if (facility.facilityType === "serving-table") {
      result = interactServingTable(kitchen, inventory, facility.id, getSelectedItem()?.id ?? null);
    } else {
      return { status: "ignored", mutated: false };
    }

    let transientMessageShown = false;
    if (result.status === "repair-missing") {
      const labels = result.missing.map((category) => localization.t(`hud:interaction.repairCategory.${category}`));
      showMessage(localization.t("hud:interaction.repairMissing", { categories: labels.join(", ") }), { literalText: true });
      transientMessageShown = true;
    } else if (result.messageKey) {
      showMessage(result.messageKey);
      transientMessageShown = true;
    }
    const presentedResult = transientMessageShown ? { ...result, transientMessageShown: true } : result;
    if (!result.mutated) return presentedResult;
    if (result.inventory?.plan) onInventoryGain(result.inventory);
    const effect = result.status === "stove-repaired" ? "build-place"
      : result.status === "lemonade-crafted" ? "guest-happy"
        : result.status === "item-served" ? "dish-serve"
          : result.status === "item-taken" ? "dish-take"
            : result.status.includes("lemon") ? "pickup" : null;
    if (effect) playEffect(effect);
    facilityRuntime.syncKitchenVisuals();
    onPersistentMutation(result);
    return presentedResult;
  }

  return { handleFacility };
}
