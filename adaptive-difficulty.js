(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AdaptiveDifficulty = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function createTracker(windowSize) {
    return {
      windowSize: Math.max(3, windowSize || 6),
      history: [],
      tier: 0,
      streak: 0,
      lastReason: ""
    };
  }

  function computeTier(history) {
    if (!history.length) return 0;

    const wins = history.filter((item) => item === "win").length;
    const losses = history.length - wins;
    const ratio = wins / history.length;

    if (history.length >= 4 && ratio >= 0.75 && wins - losses >= 2) return 1;
    if (history.length >= 4 && ratio <= 0.25 && losses - wins >= 2) return -1;
    return 0;
  }

  function pushResult(tracker, result) {
    if (!tracker || (result !== "win" && result !== "loss")) return null;

    tracker.history.push(result);
    if (tracker.history.length > tracker.windowSize) {
      tracker.history.shift();
    }

    const prevTier = tracker.tier;
    const nextTier = computeTier(tracker.history);

    tracker.streak = result === "win" ? Math.max(0, tracker.streak) + 1 : Math.min(0, tracker.streak) - 1;
    tracker.tier = nextTier;

    let message = "";
    if (nextTier > prevTier) {
      message = "Os inimigos perceberam sua forca. A ameaca aumentou.";
      tracker.lastReason = "up";
    } else if (nextTier < prevTier) {
      message = "Voce respira fundo. A pressao diminuiu por enquanto.";
      tracker.lastReason = "down";
    }

    return {
      tier: tracker.tier,
      message: message,
      history: tracker.history.slice()
    };
  }

  function getEnemyModifiers(tier) {
    if (tier >= 1) {
      return { hp: 1.15, str: 1.1, spd: 1.05, dfc: 1.08, sta: 1.1 };
    }

    if (tier <= -1) {
      return { hp: 0.9, str: 0.88, spd: 0.92, dfc: 0.9, sta: 0.9 };
    }

    return { hp: 1, str: 1, spd: 1, dfc: 1, sta: 1 };
  }

  function applyEnemyScaling(enemy, tier) {
    const m = getEnemyModifiers(tier);
    enemy.maxhp = Math.max(1, Math.floor(enemy.maxhp * m.hp));
    enemy.hp = enemy.maxhp;
    enemy.maxstr = Math.max(1, Math.floor(enemy.maxstr * m.str));
    enemy.str = enemy.maxstr;
    enemy.maxspd = Math.max(1, Math.floor(enemy.maxspd * m.spd));
    enemy.spd = enemy.maxspd;
    enemy.maxdfc = Math.max(1, Math.floor(enemy.maxdfc * m.dfc));
    enemy.dfc = enemy.maxdfc;
    enemy.maxsta = Math.max(1, Math.floor(enemy.maxsta * m.sta));
    enemy.sta = enemy.maxsta;
    return enemy;
  }

  return {
    createTracker: createTracker,
    pushResult: pushResult,
    getEnemyModifiers: getEnemyModifiers,
    applyEnemyScaling: applyEnemyScaling
  };
});
