(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.FactionReputation = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULTS = {
    vila: 0,
    selva: 0
  };

  function createState() {
    return { ...DEFAULTS };
  }

  function clamp(value) {
    return Math.max(-100, Math.min(100, value));
  }

  function getTier(value) {
    if (value >= 40) return "trusted";
    if (value <= -40) return "hostile";
    return "neutral";
  }

  function applyChange(repState, faction, delta) {
    const prev = repState[faction] ?? 0;
    const next = clamp(prev + delta);
    repState[faction] = next;
    return {
      faction,
      prev,
      next,
      tier: getTier(next)
    };
  }

  function getShopPriceMultiplier(repState) {
    const tier = getTier(repState.vila ?? 0);
    if (tier === "trusted") return 0.85;
    if (tier === "hostile") return 1.25;
    return 1;
  }

  function getForestEncounterBias(repState) {
    const tier = getTier(repState.selva ?? 0);
    if (tier === "trusted") return -1;
    if (tier === "hostile") return 1;
    return 0;
  }

  return {
    createState,
    applyChange,
    getTier,
    getShopPriceMultiplier,
    getForestEncounterBias
  };
});
