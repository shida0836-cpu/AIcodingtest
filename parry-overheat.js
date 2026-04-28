(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.ParryOverheat = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createState() {
    return {
      heat: 0,
      maxHeat: 100,
      specialCost: 60,
      overheatedTurns: 0
    };
  }

  function clampHeat(value) {
    return Math.max(0, Math.min(130, value));
  }

  function addPerfectParryHeat(parryState) {
    parryState.heat = clampHeat(parryState.heat + 30);
    if (parryState.heat > parryState.maxHeat && parryState.overheatedTurns === 0) {
      parryState.overheatedTurns = 2;
      return { overheated: true, turns: parryState.overheatedTurns };
    }
    return { overheated: false, turns: parryState.overheatedTurns };
  }

  function canUseOverheatStrike(parryState) {
    return parryState.heat >= parryState.specialCost;
  }

  function consumeOverheatStrike(parryState) {
    if (!canUseOverheatStrike(parryState)) return false;
    parryState.heat = clampHeat(parryState.heat - parryState.specialCost);
    return true;
  }

  function tickOverheat(parryState) {
    if (parryState.overheatedTurns <= 0) return false;
    parryState.overheatedTurns -= 1;
    return true;
  }

  return {
    createState,
    addPerfectParryHeat,
    canUseOverheatStrike,
    consumeOverheatStrike,
    tickOverheat
  };
});
