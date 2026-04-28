const assert = require("assert");
const {
  createTracker,
  pushResult,
  getEnemyModifiers,
  applyEnemyScaling
} = require("../adaptive-difficulty.js");

function testDifficultyGoesUpAfterGoodPerformance() {
  const tracker = createTracker(6);
  ["win", "win", "win", "loss", "win"].forEach((r) => pushResult(tracker, r));
  assert.strictEqual(tracker.tier, 1, "tier deveria subir para 1");
  const m = getEnemyModifiers(tracker.tier);
  assert.ok(m.hp > 1 && m.str > 1, "modificadores devem aumentar no tier alto");
}

function testDifficultyGoesDownAfterLossStreak() {
  const tracker = createTracker(6);
  ["loss", "loss", "loss", "win", "loss"].forEach((r) => pushResult(tracker, r));
  assert.strictEqual(tracker.tier, -1, "tier deveria cair para -1");
  const m = getEnemyModifiers(tracker.tier);
  assert.ok(m.hp < 1 && m.str < 1, "modificadores devem reduzir no tier baixo");
}

function testEnemyScalingChangesStats() {
  const enemy = {
    hp: 100,
    maxhp: 100,
    str: 20,
    maxstr: 20,
    spd: 10,
    maxspd: 10,
    dfc: 8,
    maxdfc: 8,
    sta: 12,
    maxsta: 12
  };

  applyEnemyScaling(enemy, 1);
  assert.ok(enemy.maxhp >= 114, "hp max deveria aumentar no tier alto");
  assert.ok(enemy.maxstr >= 22, "forca deveria aumentar no tier alto");
}

function run() {
  testDifficultyGoesUpAfterGoodPerformance();
  testDifficultyGoesDownAfterLossStreak();
  testEnemyScalingChangesStats();
  console.log("adaptive difficulty tests: ok");
}

run();
