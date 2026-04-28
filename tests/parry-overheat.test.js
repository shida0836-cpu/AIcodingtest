const assert = require("assert");
const {
  createState,
  addPerfectParryHeat,
  canUseOverheatStrike,
  consumeOverheatStrike,
  tickOverheat
} = require("../parry-overheat.js");

function testHeatGainAndSpecialUnlock() {
  const state = createState();
  addPerfectParryHeat(state);
  addPerfectParryHeat(state);
  assert.strictEqual(state.heat, 60, "deve acumular 60 de calor");
  assert.strictEqual(canUseOverheatStrike(state), true, "special deve habilitar com 60 de calor");
}

function testOverheatPenaltyTrigger() {
  const state = createState();
  addPerfectParryHeat(state);
  addPerfectParryHeat(state);
  addPerfectParryHeat(state);
  const result = addPerfectParryHeat(state);
  assert.strictEqual(result.overheated, true, "deve ativar overheat ao passar do limite");
  assert.strictEqual(state.overheatedTurns, 2, "penalidade deve durar 2 turnos");
}

function testSpecialConsumesHeat() {
  const state = createState();
  addPerfectParryHeat(state);
  addPerfectParryHeat(state);
  assert.strictEqual(consumeOverheatStrike(state), true, "deve consumir quando houver calor");
  assert.strictEqual(state.heat, 0, "consumo deve reduzir calor");
  assert.strictEqual(tickOverheat(state), false, "sem overheat ativo");
}

function run() {
  testHeatGainAndSpecialUnlock();
  testOverheatPenaltyTrigger();
  testSpecialConsumesHeat();
  console.log("parry overheat tests: ok");
}

run();
