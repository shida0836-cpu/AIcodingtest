const assert = require("assert");
const {
  createState,
  applyChange,
  getTier,
  getShopPriceMultiplier,
  getForestEncounterBias
} = require("../faction-reputation.js");

function testReputationTierThresholds() {
  const rep = createState();
  applyChange(rep, "vila", 45);
  assert.strictEqual(getTier(rep.vila), "trusted", "vila deveria ficar trusted");
  applyChange(rep, "selva", -50);
  assert.strictEqual(getTier(rep.selva), "hostile", "selva deveria ficar hostile");
}

function testShopPriceMultiplierChanges() {
  const rep = createState();
  assert.strictEqual(getShopPriceMultiplier(rep), 1, "multiplier base deve ser 1");
  applyChange(rep, "vila", 40);
  assert.strictEqual(getShopPriceMultiplier(rep), 0.85, "trusted deveria baratear loja");
  applyChange(rep, "vila", -100);
  assert.strictEqual(getShopPriceMultiplier(rep), 1.25, "hostile deveria encarecer loja");
}

function testForestBiasChanges() {
  const rep = createState();
  assert.strictEqual(getForestEncounterBias(rep), 0, "bias neutro deve ser 0");
  applyChange(rep, "selva", 60);
  assert.strictEqual(getForestEncounterBias(rep), -1, "trusted deve reduzir encontros");
  applyChange(rep, "selva", -160);
  assert.strictEqual(getForestEncounterBias(rep), 1, "hostile deve aumentar encontros");
}

function run() {
  testReputationTierThresholds();
  testShopPriceMultiplierChanges();
  testForestBiasChanges();
  console.log("faction reputation tests: ok");
}

run();
