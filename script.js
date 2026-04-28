class Creature {
  constructor(name, hp, str, spd, dfc, sta, lvl, wep = null) {
    this.name = name;
    this.hp = hp;
    this.maxhp = hp;
    this.str = str;
    this.maxstr = str;
    this.spd = spd;
    this.maxspd = spd;
    this.dfc = dfc;
    this.maxdfc = dfc;
    this.dfcup = false;
    this.sta = sta;
    this.maxsta = sta;
    this.lvl = lvl;
    this.xp = 0;
    this.xpToNext = lvl * 10;
    this.wep = wep;
  }

  gainXp(amount, state, log) {
    this.xp += amount;
    log(`+${amount} XP recebido.`);

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.lvl += 1;
      state.statsPoint += 15;
      log(`${this.name} subiu para o nivel ${this.lvl}! +15 pontos de status.`);
      this.xpToNext = Math.floor(this.xpToNext * 1.5);
    }
  }
}

class Weapon {
  constructor(name, dano, type, buff) {
    this.name = name;
    this.dano = dano;
    this.type = type;
    this.buff = buff;

    if (type === "espada") this.buff += 3;
    if (type === "machado") this.buff += 5;
    if (type === "arco") this.buff += 6;
    if (type === "magia") this.buff += 8;
  }
}

const $ = (id) => document.getElementById(id);

const state = {
  player: null,
  demonho: new Creature("Zack, o Frio e calculista(2022)", 50, 50, 50, 50, 50, 250, null),
  statsPoint: 10,
  gold: 20,
  passos: 0,
  localAtual: "Vilarejo",
  progressoLocal: 0,
  battle: false,
  inimigo: null,
  xpReward: 0,
  goldReward: 0,
  chance: 2,
  difficulty: AdaptiveDifficulty.createTracker(6),
  parry: ParryOverheat.createState(),
  reputation: FactionReputation.createState(),
  shrine: {
    cooldown: 0,
    activeTurns: 0,
    active: false,
    lastOfferCost: 0
  },
  loot: {
    lastDrops: [],
    rarityWeights: [
      { key: "Comum", weight: 52, damageMult: 1, buffDelta: 0, css: "common" },
      { key: "Incomum", weight: 28, damageMult: 1.18, buffDelta: 1, css: "uncommon" },
      { key: "Raro", weight: 14, damageMult: 1.38, buffDelta: 2, css: "rare" },
      { key: "Epico", weight: 6, damageMult: 1.62, buffDelta: 3, css: "epic" }
    ]
  },
  market: {
    baseline: 1,
    min: 0.75,
    max: 1.85,
    demandByItem: {},
    driftPerStep: 0.04,
    lastSignals: []
  },
  enemyEvolution: {
    playerActionHistory: [],
    actionCount: {
      attack: 0,
      defend: 0,
      overheat: 0
    },
    activeTag: null,
    tagTurnsLeft: 0
  },
  hdef: false,
  inventories: new Map(),
  shopStock: [
    new Weapon("Espada de Ferro", 6, "espada", 2),
    new Weapon("Espada Encantada", 10, "espada", 8),
    new Weapon("Machado de Ferro", 9, "machado", 2),
    new Weapon("Arco de Ferro", 5, "arco", 7),
    new Weapon("Bola de Fogo", 8, "magia", 4)
  ]
};

const locais = {
  Vilarejo: {
    descricao: "Um vilarejo calmo com uma loja no centro.",
    norte: "Floresta",
    leste: "Loja da Vila",
    passosNecessarios: 5
  },
  "Loja da Vila": {
    descricao: "Uma loja pequena, com armas penduradas nas paredes.",
    oeste: "Vilarejo",
    eventos: ["loja"],
    passosNecessarios: 1
  },
  Floresta: {
    descricao: "Uma floresta escura, barulhos estranhos ecoam entre as arvores...",
    sul: "Vilarejo",
    leste: "Ruinas Antigas",
    eventos: ["monstro"],
    passosNecessarios: 200
  },
  "Ruinas Antigas": {
    descricao: "Ruinas esquecidas de uma civilizacao antiga.",
    oeste: "Floresta",
    norte: "Portao do Castelo",
    leste: "Santuario Esquecido",
    eventos: ["monstro"],
    passosNecessarios: 20
  },
  "Santuario Esquecido": {
    descricao: "Runas antigas brilham em silencio. O poder cobra um preco.",
    oeste: "Ruinas Antigas",
    eventos: ["santuario"],
    passosNecessarios: 1
  },
  "Portao do Castelo": {
    descricao: "Voce sente uma presenca poderosa atras dos portoes.",
    eventos: ["chefe"],
    passosNecessarios: 1
  }
};

function log(message, cls = "") {
  const item = document.createElement("div");
  item.className = `log-item ${cls}`.trim();
  item.innerHTML = message;
  $("log").prepend(item);
}

function getInventory(name) {
  if (!state.inventories.has(name)) state.inventories.set(name, []);
  return state.inventories.get(name);
}

function renderStatus() {
  const p = state.player;
  const wepName = p.wep ? p.wep.name : "Nenhuma";
  const pulse =
    state.difficulty.tier > 0 ? "Alta" : state.difficulty.tier < 0 ? "Suave" : "Normal";
  $("status-panel").innerHTML = `
    <div><strong>${p.name}</strong> (Nivel ${p.lvl})</div>
    <div>HP: ${p.hp}/${p.maxhp}</div>
    <div>Forca: ${p.str}</div>
    <div>Velocidade: ${p.spd}</div>
    <div>Defesa: ${p.dfc}</div>
    <div>Stamina: ${p.sta}/${p.maxsta}</div>
    <div>XP: ${p.xp}/${p.xpToNext}</div>
    <div>Pontos de status: ${state.statsPoint}</div>
    <div>Ouro: ${state.gold}</div>
    <div>Arma: ${wepName}</div>
    <div>Pulso de dificuldade: ${pulse}</div>
    <div>Calor de Parry: ${state.parry.heat}/${state.parry.maxHeat}</div>
    <div>Overheat: ${state.parry.overheatedTurns > 0 ? `Ativo (${state.parry.overheatedTurns} turno)` : "Nao"}</div>
    <div>Pacto do Santuario: ${state.shrine.active ? `Ativo (${state.shrine.activeTurns} turno)` : "Inativo"}</div>
    <div>Ultimo loot: ${state.loot.lastDrops[0] ? `${state.loot.lastDrops[0].displayName} (${state.loot.lastDrops[0].rarity})` : "Nenhum"}</div>
  `;
}

function formatRep(value) {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function renderFactions() {
  const vila = state.reputation.vila;
  const selva = state.reputation.selva;
  const vilaTier = FactionReputation.getTier(vila);
  const selvaTier = FactionReputation.getTier(selva);
  const shopMult = FactionReputation.getShopPriceMultiplier(state.reputation);
  const shopHint = `${Math.round(shopMult * 100)}%`;
  const panel = $("faction-panel");
  if (!panel) return;
  panel.innerHTML = `
    <h3>Reputacao de Faccoes</h3>
    <ul class="rep-list">
      <li>Vila: <strong>${formatRep(vila)}</strong> (${vilaTier})</li>
      <li>Selva: <strong>${formatRep(selva)}</strong> (${selvaTier})</li>
    </ul>
    <div>Preco na loja: ${shopHint} do valor base.</div>
  `;
}

function renderCombatHud() {
  const tags = $("battle-tags");
  const hint = $("battle-hint");
  if (!tags || !hint) return;

  const pulse =
    state.difficulty.tier > 0 ? "Dificuldade alta" : state.difficulty.tier < 0 ? "Dificuldade suave" : "Dificuldade normal";
  const overheat =
    state.parry.overheatedTurns > 0 ? `Overheat ativo (${state.parry.overheatedTurns} turno)` : "Overheat inativo";
  const repBias = FactionReputation.getForestEncounterBias(state.reputation);
  const encounter =
    repBias > 0 ? "Selva hostil: mais encontros" : repBias < 0 ? "Selva aliada: menos encontros" : "Selva neutra";
  const shrineState =
    state.shrine.active
      ? `Pacto ativo (${state.shrine.activeTurns} turno)`
      : state.shrine.cooldown > 0
        ? `Santuario em recarga (${state.shrine.cooldown} passos)`
        : "Santuario pronto";
  const lootState = state.loot.lastDrops[0]
    ? `Loot: ${state.loot.lastDrops[0].rarity}`
    : "Loot: sem drop recente";
  const marketState = getMarketPulseLabel();

  tags.innerHTML = `
    <span class="tag">${pulse}</span>
    <span class="tag warn">${overheat}</span>
    <span class="tag good">${encounter}</span>
    <span class="tag shrine">${shrineState}</span>
    <span class="tag loot">${lootState}</span>
    <span class="tag market">${marketState}</span>
  `;

  hint.textContent = state.battle
    ? "Combate ativo: reaja entre ataque, defesa e overheat."
    : "Explore para encontrar inimigos e ganhar reputacao.";

  const marketHint = $("market-hint");
  if (marketHint) marketHint.textContent = `Mercado: ${marketState}.`;
}

function renderEnemyAdaptation() {
  const hint = $("adaptation-hint");
  const tags = $("adaptation-tags");
  if (!hint || !tags) return;

  const evo = state.enemyEvolution;
  const active = evo.activeTag;
  const atk = evo.actionCount.attack;
  const def = evo.actionCount.defend;
  const ovh = evo.actionCount.overheat;

  hint.textContent = active
    ? `Inimigo aprendeu ${active.label.toLowerCase()} por ${evo.tagTurnsLeft} turno(s).`
    : "Sem contra-estrategia ativa. Varie suas acoes para evitar leitura.";

  tags.innerHTML = `
    <span class="adapt-tag">Ataques seguidos: ${atk}</span>
    <span class="adapt-tag">Defesas seguidas: ${def}</span>
    <span class="adapt-tag">Overheat seguido: ${ovh}</span>
    <span class="adapt-tag counter">${active ? `Counter ativo: ${active.label}` : "Counter ativo: nenhum"}</span>
  `;
}

function shiftReputation(faction, delta, reason) {
  const change = FactionReputation.applyChange(state.reputation, faction, delta);
  const tierChanged = FactionReputation.getTier(change.prev) !== change.tier;
  log(`${reason} Reputacao (${faction}) ${formatRep(delta)}.`, delta >= 0 ? "good" : "bad");

  if (!tierChanged) return;
  if (change.tier === "trusted") log(`A faccao ${faction} agora confia em voce.`, "good");
  if (change.tier === "hostile") log(`A faccao ${faction} agora esta hostil contra voce.`, "bad");
  if (change.tier === "neutral") log(`A faccao ${faction} voltou ao estado neutro.`, "warn");
}

function renderLocation() {
  const local = locais[state.localAtual];
  const passosN = local.passosNecessarios ?? 3;
  $("location-panel").innerHTML = `
    <div><strong>${state.localAtual}</strong></div>
    <div>${local.descricao}</div>
    <div>Exploracao: ${state.progressoLocal}/${passosN}</div>
  `;

  const exitsPanel = $("exits-panel");
  exitsPanel.innerHTML = "";
  const dirs = ["norte", "sul", "leste", "oeste"];

  dirs.forEach((dir) => {
    if (!local[dir]) return;
    const btn = document.createElement("button");
    btn.textContent = `${dir} -> ${local[dir]}`;
    btn.disabled = state.progressoLocal < passosN || state.battle;
    btn.onclick = () => moveToDirection(dir);
    exitsPanel.appendChild(btn);
  });
}

function renderInventory() {
  const panel = $("inventory-panel");
  const inv = getInventory(state.player.name);
  panel.innerHTML = "<h3>Inventario</h3>";

  if (inv.length === 0) {
    panel.innerHTML += "<p>Sem itens.</p>";
    return;
  }

  inv.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "row";
    const rarity = item.rarity ? `<em class="rarity ${item.rarityClass || "common"}">${item.rarity}</em>` : "";
    const affix = item.affixLabel ? `<small>${item.affixLabel}</small>` : "";
    row.innerHTML = `<span>${idx + 1}. ${item.name} ${rarity} ${affix} (dano ${item.dano})</span>`;
    const b = document.createElement("button");
    b.textContent = "Equipar";
    b.onclick = () => equipItem(idx);
    row.appendChild(b);
    const sell = document.createElement("button");
    sell.textContent = "Vender";
    sell.onclick = () => sellItem(idx);
    row.appendChild(sell);
    panel.appendChild(row);
  });
}

function renderLootFeed() {
  const panel = $("loot-panel");
  if (!panel) return;
  if (state.loot.lastDrops.length === 0) {
    panel.innerHTML = "<h3>Loot recente</h3><p>Nenhum drop registrado.</p>";
    return;
  }

  panel.innerHTML = "<h3>Loot recente</h3>";
  state.loot.lastDrops.forEach((drop, idx) => {
    const item = document.createElement("div");
    item.className = "loot-item";
    item.innerHTML = `
      <span><strong>${idx + 1}.</strong> ${drop.displayName}</span>
      <span class="rarity ${drop.rarityClass}">${drop.rarity}</span>
      <small>${drop.affixLabel}</small>
    `;
    panel.appendChild(item);
  });
}

function renderShop() {
  const panel = $("shop-panel");
  panel.innerHTML = "<h3>Loja</h3>";
  const mult = FactionReputation.getShopPriceMultiplier(state.reputation);
  const trendWrap = document.createElement("div");
  trendWrap.className = "shop-trend-wrap";
  trendWrap.innerHTML = `<small>${getMarketSummary()}</small>`;
  panel.appendChild(trendWrap);

  state.shopStock.forEach((item, idx) => {
    const surge = getSurgeMultiplier(item.name);
    const preco = Math.max(1, Math.floor(item.dano * 2 * mult * surge));
    const row = document.createElement("div");
    row.className = "row";
    const trend = getDemandTrend(item.name);
    row.innerHTML =
      `<span>${idx + 1}. ${item.name} | dano ${item.dano} | preco ${preco} ` +
      `<em class="price-badge ${trend.cls}">${trend.label}</em></span>`;
    const b = document.createElement("button");
    b.textContent = "Comprar";
    b.onclick = () => buyItem(idx);
    row.appendChild(b);
    panel.appendChild(row);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ensureDemandKey(itemName) {
  if (typeof state.market.demandByItem[itemName] !== "number") {
    state.market.demandByItem[itemName] = state.market.baseline;
  }
  return state.market.demandByItem[itemName];
}

function getSurgeMultiplier(itemName) {
  return clamp(ensureDemandKey(itemName), state.market.min, state.market.max);
}

function updateDemand(itemName, delta) {
  const current = ensureDemandKey(itemName);
  const next = clamp(current + delta, state.market.min, state.market.max);
  state.market.demandByItem[itemName] = next;
  state.market.lastSignals.unshift({ itemName, delta, next });
  state.market.lastSignals = state.market.lastSignals.slice(0, 6);
}

function coolDownMarket() {
  const keys = Object.keys(state.market.demandByItem);
  if (keys.length === 0) return;
  keys.forEach((key) => {
    const current = state.market.demandByItem[key];
    const toward = current > state.market.baseline ? -state.market.driftPerStep : state.market.driftPerStep;
    const next = current + toward;
    if ((toward < 0 && next < state.market.baseline) || (toward > 0 && next > state.market.baseline)) {
      state.market.demandByItem[key] = state.market.baseline;
      return;
    }
    state.market.demandByItem[key] = clamp(next, state.market.min, state.market.max);
  });
}

function getDemandTrend(itemName) {
  const m = getSurgeMultiplier(itemName);
  if (m >= 1.3) return { label: `Aquecido ${Math.round(m * 100)}%`, cls: "hot" };
  if (m <= 0.9) return { label: `Oferta ${Math.round(m * 100)}%`, cls: "cool" };
  return { label: `Estavel ${Math.round(m * 100)}%`, cls: "stable" };
}

function getMarketPulseLabel() {
  const vals = Object.values(state.market.demandByItem);
  if (vals.length === 0) return "Mercado estavel";
  const avg = vals.reduce((acc, cur) => acc + cur, 0) / vals.length;
  if (avg >= 1.25) return "Mercado aquecido";
  if (avg <= 0.9) return "Mercado em oferta";
  return "Mercado estavel";
}

function getMarketSummary() {
  const last = state.market.lastSignals[0];
  if (!last) return "Precos reagem a compra/venda e esfriam com exploracao.";
  const verb = last.delta > 0 ? "subiu" : "caiu";
  return `${last.itemName} ${verb}. Tendencia atual ${Math.round(last.next * 100)}%.`;
}

function renderShrine() {
  const panel = $("shrine-panel");
  if (!panel) return;
  const p = state.player;
  const hpCost = Math.max(1, Math.floor(p.maxhp * 0.25));
  const canOffer = state.shrine.cooldown <= 0 && !state.shrine.active && p.hp > hpCost;
  const status = state.shrine.active
    ? `Pacto ativo por ${state.shrine.activeTurns} turno(s) de combate.`
    : state.shrine.cooldown > 0
      ? `Recarga em ${state.shrine.cooldown} passo(s).`
      : "Pronto para oferta.";

  panel.innerHTML = `
    <h3>Santuario de Risco</h3>
    <p>Oferte <strong>${hpCost} HP</strong> para ganhar +4 Forca e +3 Velocidade por 6 turnos, mas perder 2 Defesa no periodo.</p>
    <p>${status}</p>
  `;
  const btn = document.createElement("button");
  btn.id = "shrine-offer-btn";
  btn.textContent = "Fazer oferta";
  btn.disabled = !canOffer;
  btn.onclick = offerShrinePact;
  panel.appendChild(btn);
}

function showInventory(show) {
  $("inventory-panel").classList.toggle("hidden", !show);
  if (show) renderInventory();
}

function showShop(show) {
  $("shop-panel").classList.toggle("hidden", !show);
  if (show) renderShop();
}

function showShrine(show) {
  $("shrine-panel").classList.toggle("hidden", !show);
  if (show) renderShrine();
}

function toggleStatusMenu() {
  const panel = $("status-menu");
  const btn = $("toggle-status-btn");
  if (!panel || !btn) return;
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !opening);
  btn.textContent = opening ? "Fechar status" : "Abrir status";
  btn.setAttribute("aria-expanded", opening ? "true" : "false");
}

function maybeRandomFlavor() {
  const chance = rand(1, 5);
  if (chance === 1) log("Voce sente o vento soprar entre as arvores...");
  if (chance === 2) log("Um galho estala sob seus pes. Algo te observava?");
  if (chance === 3) {
    const item = ["pedaco de pano rasgado", "moeda velha", "pocao quebrada"][rand(0, 2)];
    log(`Voce encontrou ${item} no chao... mas parece inutil.`);
  }
  if (chance === 4) log("Um vulto passa rapidamente... nada acontece.");
}

function move() {
  if (state.battle) return;

  const local = locais[state.localAtual];
  const passosN = local.passosNecessarios ?? 3;

  if (state.progressoLocal < passosN) {
    state.progressoLocal += 1;
    state.passos += 1;
    coolDownMarket();
    tickShrineCooldown();
    maybeRandomFlavor();
    checkEvent(state.localAtual);
  } else {
    log("Essa area ja foi bem explorada. Escolha uma saida.");
  }

  renderAll();
}

function moveToDirection(dir) {
  if (state.battle) return;
  const local = locais[state.localAtual];
  if (!local[dir]) {
    log("Caminho bloqueado ou inexistente.", "bad");
    return;
  }

  state.localAtual = local[dir];
  state.progressoLocal = 0;
  showShop(false);
  showShrine(false);
  log(`Voce foi para ${state.localAtual}.`, "good");
  checkEvent(state.localAtual);
  renderAll();
}

function checkEvent(nomeLocal) {
  const local = locais[nomeLocal];
  if (!local.eventos) return;

  for (const ev of local.eventos) {
    if (ev === "loja") {
      log("Voce entrou na loja da vila.", "warn");
      showShop(true);
      continue;
    }

    if (ev === "monstro") {
      const forestBias = FactionReputation.getForestEncounterBias(state.reputation);
      const encounterRoll = rand(1, 2 + (forestBias < 0 ? 1 : 0));
      const triggered = forestBias > 0 ? encounterRoll <= 2 : encounterRoll === 1;
      if (!triggered) continue;
      const tmon = rand(1, 3);
      state.inimigo = criarMonstro(tmon);
      AdaptiveDifficulty.applyEnemyScaling(state.inimigo, state.difficulty.tier);
      state.xpReward = Math.max(3, Math.floor(state.inimigo.lvl / 2));
      state.goldReward = Math.max(1, Math.floor(state.inimigo.lvl / 3));
      startBattle(`Um monstro apareceu: ${state.inimigo.name}!`);
      continue;
    }

    if (ev === "santuario") {
      log("Voce encontrou o Santuario de Risco e Recompensa.", "warn");
      showShrine(true);
      continue;
    }

    if (ev === "chefe") {
      state.inimigo = new Creature(
        state.demonho.name,
        state.demonho.maxhp,
        state.demonho.maxstr,
        state.demonho.maxspd,
        state.demonho.maxdfc,
        state.demonho.maxsta,
        state.demonho.lvl,
        null
      );
      AdaptiveDifficulty.applyEnemyScaling(state.inimigo, state.difficulty.tier);
      state.xpReward = 100;
      state.goldReward = 100;
      startBattle("Zack, o Frio e Calculista apareceu!");
    }
  }
}

function startBattle(message) {
  state.battle = true;
  state.enemyEvolution.actionCount.attack = 0;
  state.enemyEvolution.actionCount.defend = 0;
  state.enemyEvolution.actionCount.overheat = 0;
  $("combat-controls").classList.remove("hidden");
  log(message, "warn");
  updateCombatButtons();
  mostrarStatusCombate();
}

function endBattle() {
  state.battle = false;
  state.inimigo = null;
  $("combat-controls").classList.add("hidden");
  updateCombatButtons();
}

function updateCombatButtons() {
  const btn = $("overheat-btn");
  if (!btn) return;
  btn.disabled = !state.battle || !ParryOverheat.canUseOverheatStrike(state.parry);
}

function mostrarStatusCombate() {
  if (!state.inimigo) return;
  const p = state.player;
  const i = state.inimigo;
  log(
    `<strong>${p.name}</strong> HP ${p.hp}/${p.maxhp} | STA ${p.sta}/${p.maxsta} <br/>` +
      `<strong>${i.name}</strong> HP ${i.hp}/${i.maxhp} | STA ${i.sta}/${i.maxsta}`
  );
}

function cdamage(attacker, defender) {
  const base = attacker.str - Math.floor(defender.dfc / 2.5);
  const bonus = attacker.spd / 4 + attacker.lvl / 3;
  return Math.max(Math.floor(base + bonus), 1);
}

function defesa(atacante, defendendo) {
  const damage = cdamage(atacante, defendendo);
  defendendo.sta = Math.min(defendendo.maxsta, defendendo.sta + 2);
  return damage <= defendendo.dfc && state.chance !== 1 && atacante.spd >= defendendo.spd;
}

function ataque(alvo, atacante) {
  if (atacante.sta <= 0) {
    log(`${atacante.name} esta cansado demais para atacar.`, "bad");
    return;
  }

  let damage = cdamage(atacante, alvo);

  if (alvo.spd > atacante.spd && state.chance === 1) {
    log(`${alvo.name} esquivou-se!`, "good");
    damage = 0;
  }

  if (alvo.dfcup) {
    if (alvo.fullDef) {
      log(`${alvo.name} defendeu completamente.`, "good");
      damage = 0;
    } else {
      damage = Math.max(1, Math.floor(damage - alvo.dfc / 1.5));
      log(`${alvo.name} defendeu parcialmente.`, "warn");
    }
  }

  alvo.hp = Math.max(0, alvo.hp - damage);
  atacante.sta = Math.max(0, atacante.sta - 2);
  log(`${atacante.name} atacou ${alvo.name} e causou ${damage} de dano.`);
  mostrarStatusCombate();
}

function fuga(jogador, inimigo) {
  if (jogador.spd >= inimigo.spd) {
    log("Voce escapou.", "good");
    return true;
  }
  log("Muito lento para fugir.", "bad");
  return false;
}

function playerTurn(action) {
  if (!state.battle || !state.inimigo) return;

  const p = state.player;
  const i = state.inimigo;
  if (state.parry.overheatedTurns > 0) {
    p.sta = Math.max(0, p.sta - 3);
    log("Overheat drenou sua stamina em 3 pontos.", "bad");
    if (ParryOverheat.tickOverheat(state.parry) && state.parry.overheatedTurns === 0) {
      log("Seu corpo esfriou e a penalidade de overheat terminou.", "good");
    }
  }
  state.chance = p.spd >= i.spd * 1.5 || p.spd * 1.5 <= i.spd ? rand(1, 2) : rand(1, 3);
  trackPlayerPattern(action);

  if (action === "attack") {
    p.dfcup = false;
    p.fullDef = false;
    ataque(i, p);
  }

  if (action === "defend") {
    p.dfcup = true;
    p.fullDef = defesa(i, p);
    log("Voce entrou em postura defensiva.", "good");
    mostrarStatusCombate();
  }

  if (action === "flee") {
    if (fuga(p, i)) {
      endBattle();
      renderAll();
      return;
    }
  }

  if (action === "overheat") {
    if (!ParryOverheat.consumeOverheatStrike(state.parry)) {
      log("Calor insuficiente para Golpe de Overheat.", "bad");
      renderAll();
      return;
    }
    p.dfcup = false;
    p.fullDef = false;
    const damage = Math.max(1, Math.floor(cdamage(p, i) * 1.6 + p.spd / 3));
    i.hp = Math.max(0, i.hp - damage);
    p.sta = Math.max(0, p.sta - 4);
    log(`Golpe de Overheat acertou ${i.name} causando ${damage} de dano!`, "warn");
    mostrarStatusCombate();
  }

  if (checkBattleEnd()) return;
  enemyTurn();
  checkBattleEnd();
  tickShrineCombatTurn();
  updateCombatButtons();
  renderAll();
}

function enemyTurn() {
  if (!state.inimigo || !state.battle) return;
  const p = state.player;
  const i = state.inimigo;

  i.dfcup = false;
  i.fullDef = false;

  if (Math.random() < 0.5) {
    if (p.dfcup) {
      const speedDiff = p.spd - i.spd;
      const perfectParryChance = Math.max(0.2, Math.min(0.55, 0.35 + speedDiff / 100));
      if (Math.random() < perfectParryChance) {
        const parry = ParryOverheat.addPerfectParryHeat(state.parry);
        p.fullDef = true;
        log("Parry perfeito! Nenhum dano recebido e calor acumulado.", "good");
        if (parry.overheated) {
          p.hp = Math.max(1, p.hp - 2);
          p.sta = Math.max(0, p.sta - 2);
          log("Voce excedeu o limite de calor e entrou em overheat.", "bad");
        }
        updateCombatButtons();
        mostrarStatusCombate();
        return;
      }
    }
    ataque(p, i);
  } else {
    i.dfcup = true;
    i.fullDef = defesa(p, i);
    log(`${i.name} se defendeu.`, "warn");
  }
  tickEvolutionTag();
}

function checkBattleEnd() {
  const p = state.player;
  const i = state.inimigo;
  if (!i) return true;

  if (p.hp <= 0) {
    log("Voce perdeu! Recuperando para continuar...", "bad");
    const adapt = AdaptiveDifficulty.pushResult(state.difficulty, "loss");
    if (adapt && adapt.message) log(adapt.message, "warn");
    p.hp = p.maxhp;
    p.sta = p.maxsta;
    clearEnemyEvolutionTag();
    endBattle();
    return true;
  }

  if (i.hp <= 0) {
    log("Voce venceu!", "good");
    const adapt = AdaptiveDifficulty.pushResult(state.difficulty, "win");
    if (adapt && adapt.message) log(adapt.message, "warn");
    p.gainXp(state.xpReward, state, log);
    state.gold += state.goldReward;
    maybeDropAffixLoot();
    shiftReputation("vila", 4, "Monstro derrotado.");
    shiftReputation("selva", -3, "Criaturas da selva reagiram.");

    p.hp = p.maxhp;
    p.sta = p.maxsta;
    p.dfcup = false;

    if (state.passos >= 300) {
      log("Venceu o jogo!", "good");
    }

    clearEnemyEvolutionTag();
    endBattle();
    return true;
  }

  return false;
}

function trackPlayerPattern(action) {
  const valid = ["attack", "defend", "overheat"];
  if (!valid.includes(action)) return;
  const evo = state.enemyEvolution;
  evo.playerActionHistory.push(action);
  evo.playerActionHistory = evo.playerActionHistory.slice(-5);

  valid.forEach((key) => {
    if (key === action) {
      evo.actionCount[key] += 1;
      return;
    }
    evo.actionCount[key] = 0;
  });

  maybeApplyEvolutionTag(action);
}

function maybeApplyEvolutionTag(action) {
  const evo = state.enemyEvolution;
  if (!state.inimigo || !state.battle) return;
  if (evo.actionCount[action] < 2) return;

  const nextKey = action === "attack" ? "brace" : action === "defend" ? "rupture" : "coolhead";
  if (evo.activeTag && evo.activeTag.key === nextKey) {
    evo.tagTurnsLeft = 3;
    return;
  }
  if (evo.activeTag) clearEnemyEvolutionTag();

  if (action === "attack") {
    evo.activeTag = { key: "brace", label: "Blindagem Reativa" };
    evo.tagTurnsLeft = 3;
    state.inimigo.dfc += 2;
    state.inimigo.maxdfc += 2;
    log(`${state.inimigo.name} leu seu padrao ofensivo e ganhou blindagem temporaria.`, "warn");
  } else if (action === "defend") {
    evo.activeTag = { key: "rupture", label: "Ruptura de Guarda" };
    evo.tagTurnsLeft = 2;
    state.inimigo.spd += 2;
    state.inimigo.maxspd += 2;
    log(`${state.inimigo.name} se adaptou a sua defesa e ficou mais rapido.`, "warn");
  } else if (action === "overheat") {
    evo.activeTag = { key: "coolhead", label: "Cabeca Fria" };
    evo.tagTurnsLeft = 2;
    state.inimigo.dfc += 1;
    state.inimigo.maxdfc += 1;
    state.inimigo.str += 1;
    state.inimigo.maxstr += 1;
    log(`${state.inimigo.name} antecipou seu overheat e reforcou postura de contra-ataque.`, "warn");
  }
}

function tickEvolutionTag() {
  const evo = state.enemyEvolution;
  if (!evo.activeTag || evo.tagTurnsLeft <= 0) return;
  evo.tagTurnsLeft -= 1;
  if (evo.tagTurnsLeft <= 0) clearEnemyEvolutionTag();
}

function clearEnemyEvolutionTag() {
  const evo = state.enemyEvolution;
  if (!state.inimigo || !evo.activeTag) {
    evo.activeTag = null;
    evo.tagTurnsLeft = 0;
    return;
  }

  if (evo.activeTag.key === "brace") {
    state.inimigo.dfc = Math.max(1, state.inimigo.dfc - 2);
    state.inimigo.maxdfc = Math.max(1, state.inimigo.maxdfc - 2);
  } else if (evo.activeTag.key === "rupture") {
    state.inimigo.spd = Math.max(1, state.inimigo.spd - 2);
    state.inimigo.maxspd = Math.max(1, state.inimigo.maxspd - 2);
  } else if (evo.activeTag.key === "coolhead") {
    state.inimigo.dfc = Math.max(1, state.inimigo.dfc - 1);
    state.inimigo.maxdfc = Math.max(1, state.inimigo.maxdfc - 1);
    state.inimigo.str = Math.max(1, state.inimigo.str - 1);
    state.inimigo.maxstr = Math.max(1, state.inimigo.maxstr - 1);
  }

  log("A contra-estrategia do inimigo expirou.", "good");
  evo.activeTag = null;
  evo.tagTurnsLeft = 0;
}

function equipItem(index) {
  const inv = getInventory(state.player.name);
  const item = inv[index];
  if (!item) return;

  if (state.player.wep) removeWeaponStats(state.player, state.player.wep);
  state.player.wep = item;
  applyWeaponStats(state.player, item);
  inv.splice(index, 1);

  log(`Arma equipada: ${item.name}.`, "good");
  renderAll();
}

function applyWeaponStats(target, wep) {
  target.str += wep.dano;
  target.maxstr += wep.dano;

  if (wep.type === "espada") {
    target.spd += wep.buff;
    target.maxspd += wep.buff;
  } else if (wep.type === "machado") {
    target.hp += wep.buff;
    target.maxhp += wep.buff;
    target.spd -= Math.floor(wep.buff / 2);
    target.maxspd -= Math.floor(wep.buff / 2);
  } else if (wep.type === "arco") {
    target.dfc += wep.buff;
    target.maxdfc += wep.buff;
  } else if (wep.type === "magia") {
    const bonus = Math.floor(wep.buff / 2);
    target.sta += bonus;
    target.maxsta += bonus;
  }
}

function removeWeaponStats(target, wep) {
  target.str -= wep.dano;
  target.maxstr -= wep.dano;

  if (wep.type === "espada") {
    target.spd -= wep.buff;
    target.maxspd -= wep.buff;
  } else if (wep.type === "machado") {
    target.maxhp -= wep.buff;
    target.hp = Math.min(target.hp, target.maxhp);
    target.spd += Math.floor(wep.buff / 2);
    target.maxspd += Math.floor(wep.buff / 2);
  } else if (wep.type === "arco") {
    target.dfc -= wep.buff;
    target.maxdfc -= wep.buff;
  } else if (wep.type === "magia") {
    const bonus = Math.floor(wep.buff / 2);
    target.maxsta -= bonus;
    target.sta = Math.min(target.sta, target.maxsta);
  }
}

function buyItem(idx) {
  const item = state.shopStock[idx];
  if (!item) return;

  const mult = FactionReputation.getShopPriceMultiplier(state.reputation);
  const surge = getSurgeMultiplier(item.name);
  const preco = Math.max(1, Math.floor(item.dano * 2 * mult * surge));
  if (state.gold < preco) {
    log("Pobre demais para comprar.", "bad");
    return;
  }

  state.gold -= preco;
  getInventory(state.player.name).push(createAffixWeapon(item, { forcedRarity: "Comum" }));
  updateDemand(item.name, 0.16);
  log(`Comprou ${item.name} por ${preco} ouro.`, "good");
  shiftReputation("vila", 2, "Compra concluida.");
  renderAll();
}

function sellItem(index) {
  const inv = getInventory(state.player.name);
  const item = inv[index];
  if (!item) return;
  if (state.player.wep && state.player.wep.displayName === item.displayName) {
    log("Nao e possivel vender a arma equipada.", "bad");
    return;
  }
  const mult = FactionReputation.getShopPriceMultiplier(state.reputation);
  const surge = getSurgeMultiplier(item.name.split(" - ")[0]);
  const sellPrice = Math.max(1, Math.floor((item.dano * mult * surge) / 1.45));
  inv.splice(index, 1);
  state.gold += sellPrice;
  updateDemand(item.name.split(" - ")[0], -0.12);
  log(`Vendeu ${item.name} por ${sellPrice} ouro.`, "warn");
  shiftReputation("vila", 1, "Venda para a vila.");
  renderAll();
}

function pickRarity() {
  const total = state.loot.rarityWeights.reduce((acc, item) => acc + item.weight, 0);
  let roll = rand(1, total);
  for (const entry of state.loot.rarityWeights) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return state.loot.rarityWeights[0];
}

function rollAffix(type) {
  const table = {
    espada: [
      { label: "Corte Cruel", damage: 2, buff: 0 },
      { label: "Passo Afiado", damage: 1, buff: 1 }
    ],
    machado: [
      { label: "Impacto Brutal", damage: 3, buff: 0 },
      { label: "Peso de Guerra", damage: 2, buff: 1 }
    ],
    arco: [
      { label: "Mirada Certeira", damage: 1, buff: 2 },
      { label: "Arco de Cacada", damage: 2, buff: 1 }
    ],
    magia: [
      { label: "Runa Volatil", damage: 2, buff: 1 },
      { label: "Canal Arcano", damage: 1, buff: 2 }
    ]
  };
  const options = table[type] || [{ label: "Forja Simples", damage: 0, buff: 0 }];
  return options[rand(0, options.length - 1)];
}

function createAffixWeapon(baseWeapon, options = {}) {
  const rarity = options.forcedRarity
    ? state.loot.rarityWeights.find((entry) => entry.key === options.forcedRarity) || state.loot.rarityWeights[0]
    : pickRarity();
  const affix = rollAffix(baseWeapon.type);
  const damage = Math.max(1, Math.floor(baseWeapon.dano * rarity.damageMult) + affix.damage);
  const buff = Math.max(0, baseWeapon.buff + rarity.buffDelta + affix.buff);
  const displayName = `${baseWeapon.name} - ${affix.label}`;
  return {
    ...baseWeapon,
    name: displayName,
    dano: damage,
    buff,
    rarity: rarity.key,
    rarityClass: rarity.css,
    affixLabel: `Afixo: ${affix.label} | dano +${affix.damage} | bonus +${affix.buff}`,
    displayName
  };
}

function maybeDropAffixLoot() {
  const base = state.shopStock[rand(0, state.shopStock.length - 1)];
  const dropped = createAffixWeapon(base);
  getInventory(state.player.name).push(dropped);
  state.loot.lastDrops.unshift(dropped);
  state.loot.lastDrops = state.loot.lastDrops.slice(0, 4);
  log(`Drop encontrado: ${dropped.displayName} [${dropped.rarity}]`, "good");
}

function upgradeStat() {
  const p = state.player;
  const stat = $("upgrade-stat").value;
  const amount = Number($("upgrade-amount").value);

  if (!Number.isInteger(amount) || amount <= 0) {
    log("Digite uma quantidade valida de pontos.", "bad");
    return;
  }

  if (amount > state.statsPoint) {
    log("Voce nao tem pontos suficientes.", "bad");
    return;
  }

  p[stat] += amount;

  if (stat === "maxhp") p.hp += amount;
  if (stat === "maxstr") p.str += amount;
  if (stat === "maxspd") p.spd += amount;
  if (stat === "maxdfc") p.dfc += amount;
  if (stat === "maxsta") p.sta += amount;

  state.statsPoint -= amount;
  log(`Status ${stat} evoluido em +${amount}.`, "good");
  renderAll();
}

function criarMonstro(id) {
  const tipos = ["Goblin", "Lobo", "Orc"];
  const base = [
    [1, 1, 2, 1, 1],
    [2, 2, 3, 2, 2],
    [3, 3, 1, 2, 2]
  ];

  const tipo = tipos[id - 1];
  const [mhp, ms, msp, md, msta] = base[id - 1];
  const bonus = Math.max(1, state.player.lvl + rand(-2, 2));

  const p = [
    Math.floor((rand(2, 8) * mhp + bonus) / 1.7),
    Math.floor((rand(3, 6) * ms + bonus) / 1.7),
    Math.floor((rand(2, 6) * msp + bonus) / 1.7),
    Math.floor((rand(1, 4) * md + bonus) / 1.7),
    Math.floor((rand(1, 5) * msta + bonus) / 1.7)
  ];

  return new Creature(tipo, p[0], p[1], p[2], p[3], p[4], bonus, null);
}

function renderAll() {
  renderStatus();
  renderFactions();
  renderCombatHud();
  renderEnemyAdaptation();
  renderLocation();
  renderInventory();
  renderShop();
  renderShrine();
  renderLootFeed();
  updateCombatButtons();
}

function offerShrinePact() {
  const p = state.player;
  if (!p) return;
  const hpCost = Math.max(1, Math.floor(p.maxhp * 0.25));
  if (state.shrine.cooldown > 0) {
    log("O santuario ainda esta em recarga.", "bad");
    return;
  }
  if (state.shrine.active) {
    log("O pacto atual ainda esta ativo.", "bad");
    return;
  }
  if (p.hp <= hpCost) {
    log("Seu HP esta baixo demais para pagar o preco do santuario.", "bad");
    return;
  }

  p.hp = Math.max(1, p.hp - hpCost);
  p.str += 4;
  p.maxstr += 4;
  p.spd += 3;
  p.maxspd += 3;
  p.dfc -= 2;
  p.maxdfc -= 2;
  state.shrine.active = true;
  state.shrine.activeTurns = 6;
  state.shrine.cooldown = 45;
  state.shrine.lastOfferCost = hpCost;
  log("Pacto selado: poder aumentado, defesa reduzida. Use com cuidado.", "warn");
  renderAll();
}

function clearShrinePact() {
  const p = state.player;
  if (!p || !state.shrine.active) return;
  p.str = Math.max(1, p.str - 4);
  p.maxstr = Math.max(1, p.maxstr - 4);
  p.spd = Math.max(1, p.spd - 3);
  p.maxspd = Math.max(1, p.maxspd - 3);
  p.dfc += 2;
  p.maxdfc += 2;
  p.hp = Math.min(p.hp, p.maxhp);
  p.sta = Math.min(p.sta, p.maxsta);
  state.shrine.active = false;
  state.shrine.activeTurns = 0;
  log("O poder do santuario terminou e seus atributos voltaram ao normal.", "warn");
}

function tickShrineCombatTurn() {
  if (!state.shrine.active || state.shrine.activeTurns <= 0 || !state.battle) return;
  state.shrine.activeTurns -= 1;
  if (state.shrine.activeTurns <= 0) clearShrinePact();
}

function tickShrineCooldown() {
  if (state.shrine.cooldown > 0) state.shrine.cooldown -= 1;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function startGame() {
  const name = $("player-name").value.trim() || "Heroina";
  state.player = new Creature(name, 5, 5, 5, 5, 5, 1, null);

  getInventory(state.player.name);
  getInventory("vilajero");
  state.shopStock.forEach((item) => ensureDemandKey(item.name));

  $("start-screen").classList.add("hidden");
  $("game-screen").classList.remove("hidden");

  log("Explicacao basica: treine seus status para nao apanhar.");
  log("No combate: atacar, defender e fugir.");
  log("Sua reputacao com Vila e Selva altera precos e risco de encontros.");
  renderAll();
}

$("start-btn").addEventListener("click", startGame);
$("walk-btn").addEventListener("click", () => {
  showInventory(false);
  showShop(false);
  move();
});
$("inventory-btn").addEventListener("click", () => {
  showShop(false);
  showShrine(false);
  showInventory(true);
});
$("toggle-status-btn").addEventListener("click", toggleStatusMenu);
$("upgrade-btn").addEventListener("click", upgradeStat);

$("attack-btn").addEventListener("click", () => playerTurn("attack"));
$("defend-btn").addEventListener("click", () => playerTurn("defend"));
$("flee-btn").addEventListener("click", () => playerTurn("flee"));
$("overheat-btn").addEventListener("click", () => playerTurn("overheat"));
