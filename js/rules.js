// 試玩版的戰鬥規則（純邏輯，不碰畫面）：game.js 拿結果去演，tools/sim.js 拿它跑幾百場調數值。
// 規則摘要：
// ・每回合照速度排順序。全隊共用一條「氣勢」（0～100）：攻擊、招式、防禦、道具、應援都會加，氣勢夠（MO.ult）且 SP 夠才能放奧義，放完扣掉。
// ・場上有小兵時魔王「護衛中」，打他傷害無效。
// ・魔王被打中護盾 -1（奧義 -2），歸零就 BREAK：下一次行動取消（蓄好的大招只是延後），期間受到的傷害 1.5 倍，之後護盾回滿。
// ・魔王一回合行動兩次；每五次行動的第四次蓄力，下一次行動放大招「無限改稿」打全體，放完如果場上沒小兵就再叫兩隻。
// ・Kevin 的奧義「鐵壁」：到他下一次行動前，敵人的攻擊全部由他承受三成五，其他人不受傷。
// ・防禦：到自己下一次行動前受傷減半，氣勢加得比攻擊多一點。
// ・招式（SKILLS）：每人一兩招，只花 SP、不用氣勢。
// ・三關連打（STAGES）：小兵教學戰 → 甩鍋課長 → 奧客總經理。過關後血補四成、SP 補一半、倒下的人站起來，再從三個強化裡選一個（UPGRADES）。
//   每一關的頭目共用 'boss' 這個位置（數值在進關時蓋到 STAT.boss），小兵名單 MINIONS 也跟著關卡換。
//   甩鍋課長沒有護衛，但每回合第一次被打會把傷害甩給小兵（pot）。
export const FRONT = ['kui', 'kevin', 'jie', 'mi'], HEROES = [...FRONT, 'vivi'], MINIONS = ['ma', 'mb'];
export const STAT = {
  kui: { hp: 2680, sp: 142, atk: 1250, spd: 356, cost: 60 }, kevin: { hp: 4860, sp: 118, atk: 780, spd: 142, cost: 50 },
  jie: { hp: 2140, sp: 388, atk: 1500, spd: 228, cost: 180 }, mi: { hp: 2320, sp: 356, atk: 950, spd: 264, cost: 160 },
  vivi: { hp: 9999, sp: 999, atk: 0, spd: 12, cost: 99 },
  boss: { hp: 64000, spd: 200, spd2: 100, atk: 1000, shield: 8, cycle: 5 }, ma: { hp: 3800, spd: 180, atk: 400 }, mb: { hp: 3800, spd: 170, atk: 400 }, mc: { hp: 3800, spd: 160, atk: 400 },
};
// 關卡。boss：這一關的頭目（沒有就是純小兵戰）；guard＝小兵在場時無敵；pot＝每回合第一次被打甩給小兵；ult＝大招對每個人的傷害；text＝招式名
export const STAGES = [
  { name: '加班大隊', sub: '先熱身一下', minions: ['ma', 'mb', 'mc'], minion: { hp: 4200, atk: 330 }, boss: null },
  { name: '甩鍋課長', sub: '這不是我的問題', minions: ['ma', 'mb'], minion: { hp: 3000, atk: 360 },
    boss: { id: 'chief', name: '甩鍋課長', hp: 48000, spd: 200, spd2: 0, atk: 950, shield: 5, cycle: 4, guard: false, pot: true, ult: { kui: 760, kevin: 1000, jie: 700, mi: 660 }, text: { charge: '蓄力　這不是我的問題', atk: '甩鍋', ult: '奧義　全體背鍋', summon: '召喚　找人背鍋' } } },
  { name: '奧客總經理', sub: '我要找你們主管', minions: ['ma', 'mb'], minion: { hp: 3800, atk: 400 },
    boss: { id: 'boss', name: '奧客總經理', hp: 78000, spd: 200, spd2: 100, atk: 1150, shield: 8, cycle: 5, guard: true, pot: false, ult: { kui: 1240, kevin: 1650, jie: 1130, mi: 1060 }, text: { charge: '蓄力　再改一版！', atk: '退件重擊', ult: '奧義　無限改稿', summon: '召喚　加班大隊' } } },
];
// 過關強化（三選一）
export const UPGRADES = {
  raise: { name: '加薪', desc: '全員攻擊力 ＋15%' }, leave: { name: '特休', desc: '全員 HP 上限 ＋20%，並且補滿' }, chair: { name: '人體工學椅', desc: '受到的傷害 －15%' },
  drinks: { name: '手搖飲團購', desc: '珍珠奶茶 ＋2' }, coffee: { name: '新咖啡機', desc: '黑咖啡 ＋2，全員 SP 補滿' }, morale: { name: '士氣大振', desc: '每場戰鬥開始時氣勢 ＋30' }, bento: { name: '加菜金', desc: '雞排便當 ＋1' },
};
const BASE = JSON.parse(JSON.stringify(STAT));
export let BOSS_ULT = { kui: 1240, kevin: 1650, jie: 1130, mi: 1060 };      // 頭目大招對每個人的傷害（進關時換成那一關的）
export const ITEMS = { tea: { name: '珍珠奶茶', n: 3, note: 'HP 回復 2000', hp: 2000 }, coffee: { name: '黑咖啡', n: 2, note: 'SP 回復 150', sp: 150 }, bento: { name: '雞排便當', n: 1, note: '倒下的同伴復活', revive: .5 } };
// 招式（技能）：不用 BP，只花 SP。target：foe 選一個敵人、all 敵方全體、ally 選一個同伴、party 我方前排、self 自己
export const SKILLS = {
  kui: [{ key: 'sweep', name: '橫掃千稿', sp: 24, note: '敵方全體', target: 'all', desc: '一刀掃過所有敵人。小兵多的時候很好用。' }, { key: 'retort', name: '直球吐槽', sp: 18, note: '單體重擊　護盾 -2', target: 'foe', desc: '對一個敵人用力吐槽，傷害高，還能多削魔王的護盾。' }],
  kevin: [{ key: 'taunt', name: '這個我來', sp: 16, note: '吸引攻擊　受傷減三成', target: 'self', desc: '到下次行動前，敵人的單體攻擊都打 Kevin，而且他受的傷害減三成。' }, { key: 'bash', name: '盾擊', sp: 20, note: '單體攻擊　自己進入防禦', target: 'foe', desc: '用盾牌撞一個敵人，同時擺好防禦姿勢（受傷減半）。' }],
  jie: [{ key: 'barrage', name: '暗影彈幕', sp: 40, note: '敵方全體', target: 'all', desc: '暗屬性魔法轟炸所有敵人。' }, { key: 'curse', name: '加班詛咒', sp: 50, note: '單體攻擊　攻擊力下降', target: 'foe', desc: '詛咒一個敵人：接下來四次行動的傷害減三成。' }],
  mi: [{ key: 'mend', name: '治癒專線', sp: 36, note: '單體回復 1500', target: 'ally', desc: '幫一個同伴回復 1500 HP。' }, { key: 'soothe', name: '安撫話術', sp: 48, note: '前排全體回復 700', target: 'party', desc: '前排全員各回復 700 HP。' }],
  vivi: [{ key: 'treat', name: '老闆請客', sp: 80, note: '前排全員 SP ＋60', target: 'party', desc: '請大家喝飲料，前排全員回復 60 SP。' }],
};
// 氣勢：起始值、放奧義要多少、各種行動加多少
export const MO = { start: 30, max: 100, ult: 40, attack: 14, skill: 14, defend: 16, item: 6, cheer: 35 };
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// 一輪遊戲（三關）的進度：打到第幾關、拿了哪些強化、帶到下一關的血與道具
export function newRun(rand = Math.random, stage = 0) { for (const id in BASE) Object.assign(STAT[id], BASE[id]); const run = { rand, stage, atk: 1, def: 1, moStart: MO.start, items: {}, hp: null, sp: null, picks: [], rounds: 0, summons: 0 }; for (const k in ITEMS) run.items[k] = ITEMS[k].n; return run; }
// 過關：把血和道具帶走，血補四成（倒下的人從四成站起來）、SP 補一半
export function endStage(s, run) { run.hp = {}; run.sp = {}; for (const id of HEROES) { run.hp[id] = Math.min(STAT[id].hp, Math.max(0, s.hp[id]) + Math.round(STAT[id].hp * .4)); run.sp[id] = Math.min(STAT[id].sp, s.sp[id] + Math.round(STAT[id].sp * .5)); }
  run.items = { ...s.items }; run.rounds += s.round; run.summons += s.summons; run.stage++; return run; }
export function offerUpgrades(run) { const pool = Object.keys(UPGRADES).filter(k => !(k === 'morale' && run.moStart > MO.start)); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(run.rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 3); }
export function applyUpgrade(run, key) { run.picks.push(key);
  if (key === 'raise') run.atk *= 1.15; else if (key === 'chair') run.def *= .85; else if (key === 'morale') run.moStart += 30; else if (key === 'drinks') run.items.tea += 2; else if (key === 'bento') run.items.bento += 1;
  else if (key === 'coffee') { run.items.coffee += 2; for (const id of HEROES) run.sp[id] = STAT[id].sp; }
  else if (key === 'leave') for (const id of FRONT) { STAT[id].hp = Math.round(STAT[id].hp * 1.2); run.hp[id] = STAT[id].hp; } }
// 進一關：把這一關的頭目與小兵數值蓋到 STAT，建立戰鬥狀態
export function newState(run = newRun()) {
  if (typeof run === 'function') run = newRun(run, STAGES.length - 1);      // 舊用法 newState(rand)：直接打最後一關
  const st = STAGES[run.stage], rand = run.rand; MINIONS.length = 0; MINIONS.push(...st.minions); for (const m of ['ma', 'mb', 'mc']) Object.assign(STAT[m], st.minion); if (st.boss) Object.assign(STAT.boss, st.boss); BOSS_ULT = st.boss?.ult || {};
  const s = { run, L: st.boss, hasBoss: !!st.boss, potUsed: false, rand, hp: {}, sp: {}, mo: run.moStart, defend: {}, items: {}, round: 0, queue: [], shield: STAT.boss.shield, broken: false, charging: false, bossTurns: 0, aegis: false, taunt: false, atkDown: {}, atkUp: 0, summons: 0, over: null };
  for (const id of HEROES) { s.hp[id] = run.hp ? run.hp[id] : STAT[id].hp; s.sp[id] = run.sp ? run.sp[id] : STAT[id].sp; }
  s.hp.boss = st.boss ? st.boss.hp : 0; for (const m of ['ma', 'mb', 'mc']) s.hp[m] = MINIONS.includes(m) ? STAT[m].hp : 0;
  s.items = { ...run.items };
  return s;
}
export const alive = (s, id) => s.hp[id] > 0;
export const guarded = s => !!(s.L && s.L.guard) && MINIONS.some(id => alive(s, id));
export const foes = s => ['boss', ...MINIONS].filter(id => alive(s, id));
const vary = (s, v, k = .08) => Math.round(v * (1 - k + s.rand() * 2 * k));
const check = s => { if (s.hasBoss ? s.hp.boss <= 0 : MINIONS.every(m => !alive(s, m))) s.over = 'win'; else if (FRONT.every(id => !alive(s, id))) s.over = 'lose'; };

// 排這一回合的行動順序
// 魔王一回合行動兩次（一次快、一次慢，Kevin 剛好排在兩次中間）
export function startRound(s) { s.round++; s.potUsed = false; if (s.atkUp > 0) s.atkUp--;
  const list = [...HEROES, 'boss', ...MINIONS].filter(id => alive(s, id)).map(id => [id, STAT[id].spd]); if (alive(s, 'boss') && STAT.boss.spd2) list.push(['boss', STAT.boss.spd2]);
  s.queue = list.sort((a, b) => b[1] - a[1]).map(x => x[0]); return s.queue; }
// 輪到某個人（回傳 false＝這個人已經倒了，跳過）
export function beginTurn(s, id) {
  if (!alive(s, id)) return false;
  if (HEROES.includes(id)) { s.defend[id] = false; if (id === 'kevin') { s.aegis = false; s.taunt = false; } }
  return true;
}
export const canUlt = (s, id) => s.mo >= MO.ult && s.sp[id] >= STAT[id].cost;
const gain = (s, n) => { s.mo = Math.max(0, Math.min(MO.max, s.mo + n)); return s.mo; };

// 打敵人：回傳一筆結果 { dst, v, guard, crit, kill, brk, hp, shield }
function hitFoe(s, src, dst, base, o = {}) {
  if (!alive(s, dst)) return null;
  if (dst === 'boss' && guarded(s)) return { src, dst, v: 0, guard: true, hp: s.hp.boss, shield: s.shield };
  if (dst === 'boss' && s.L.pot && !s.potUsed) { const m = MINIONS.find(x => alive(s, x)); if (m) { s.potUsed = true; return { ...hitFoe(s, src, m, base, o), pot: true }; } }      // 甩鍋：這回合第一下由小兵背
  const crit = !o.noCrit && s.rand() < .12; let v = vary(s, base) * s.run.atk * (s.atkUp > 0 ? 1.5 : 1) * (crit ? 1.5 : 1) * (dst === 'boss' && s.broken ? 1.5 : 1); v = Math.round(v);
  s.hp[dst] = Math.max(0, s.hp[dst] - v); const r = { src, dst, v, crit, weak: true, kill: s.hp[dst] <= 0, hp: s.hp[dst] };
  if (dst === 'boss' && !s.broken && !r.kill) { s.shield = Math.max(0, s.shield - (o.sh ?? 1)); if (s.shield === 0) { s.broken = true; r.brk = true; } }      // BREAK 只讓他少動一次，蓄好的大招還是會放
  if (dst === 'boss') r.shield = s.shield; check(s); return r;
}
// 打我方：鐵壁在的時候全部轉給 Kevin；回傳 [{ dst, v, guard, kill, hp }]
function hitHeroes(s, src, list) {      // list：[[id, 傷害]]
  const out = [];
  if (s.aegis && alive(s, 'kevin')) { let sum = 0; for (const [id, v] of list) { if (!alive(s, id)) continue; sum += v; if (id !== 'kevin') out.push({ src, dst: id, v: 0, guard: true, hp: s.hp[id] }); }
    const v = Math.min(s.hp.kevin - 1, Math.round(sum * .35 * s.run.def)); s.hp.kevin -= v; out.unshift({ src, dst: 'kevin', v, cover: true, hp: s.hp.kevin }); return out; }      // 鐵壁不會讓 Kevin 倒下
  if (s.taunt && list.length === 1 && alive(s, 'kevin')) list = [['kevin', list[0][1] * .7, list[0][0]]];      // 挑釁：單體攻擊改打 Kevin，傷害減三成
  for (const [id, raw, from] of list) { if (!alive(s, id)) continue; const v = Math.round(vary(s, raw) * s.run.def * (s.defend[id] ? .5 : 1)); if (from && from !== id) out.taunted = from; s.hp[id] = Math.max(0, s.hp[id] - v); out.push({ src, dst: id, v, def: !!s.defend[id], kill: s.hp[id] <= 0, hp: s.hp[id] }); }
  check(s); return out;
}

// ---------- 我方指令。都回傳 { kind, id, ... , hits:[…] } ----------
export function doAttack(s, id, target) { const hits = [hitFoe(s, id, target, STAT[id].atk)].filter(Boolean); return { kind: 'attack', id, target, hits, mo: gain(s, MO.attack) }; }
export function doDefend(s, id) { s.defend[id] = true; return { kind: 'defend', id, mo: gain(s, MO.defend) }; }
export function doCheer(s) { return { kind: 'cheer', id: 'vivi', mo: gain(s, MO.cheer) }; }
export function itemTargets(s, key) { const it = ITEMS[key]; return HEROES.filter(id => it.revive ? FRONT.includes(id) && !alive(s, id) : alive(s, id) && (it.hp ? s.hp[id] < STAT[id].hp : s.sp[id] < STAT[id].sp)); }
export function doItem(s, id, key, target) {
  const it = ITEMS[key]; s.items[key]--; const r = { kind: 'item', id, key, target };
  if (it.hp) { r.heal = Math.min(it.hp, STAT[target].hp - s.hp[target]); s.hp[target] += r.heal; }
  if (it.sp) { r.spGain = Math.min(it.sp, STAT[target].sp - s.sp[target]); s.sp[target] += r.spGain; }
  if (it.revive) { r.revive = true; r.heal = Math.round(STAT[target].hp * it.revive); s.hp[target] = r.heal; }
  r.hp = s.hp[target]; r.sp = s.sp[target]; r.mo = gain(s, MO.item); return r;
}
export const skillOk = (s, id, sk) => s.sp[id] >= sk.sp && (sk.target !== 'ally' || FRONT.some(h => alive(s, h) && s.hp[h] < STAT[h].hp));
export function doSkill(s, id, key, target) {
  const sk = SKILLS[id].find(x => x.key === key), atk = STAT[id].atk; s.sp[id] -= sk.sp; const r = { kind: 'skill', id, key, name: sk.name, target, sp: s.sp[id], hits: [] }, push = h => { if (h) r.hits.push(h); return h; };
  if (key === 'sweep') for (const f of [...MINIONS, 'boss']) push(hitFoe(s, id, f, atk * .75));
  else if (key === 'retort') push(hitFoe(s, id, target, atk * 1.5, { sh: 2 }));
  else if (key === 'taunt') s.taunt = true;
  else if (key === 'bash') { push(hitFoe(s, id, target, atk * 1.4)); s.defend.kevin = true; }
  else if (key === 'barrage') for (const f of [...MINIONS, 'boss']) push(hitFoe(s, id, f, atk * .8));
  else if (key === 'curse') { const h = push(hitFoe(s, id, target, atk)); if (h && !h.guard && !h.kill) { s.atkDown[target] = target === 'boss' ? 4 : 2; r.down = target; } }
  else if (key === 'mend') { const v = Math.min(1500, STAT[target].hp - s.hp[target]); s.hp[target] += v; r.heals = [{ dst: target, v, hp: s.hp[target] }]; }
  else if (key === 'soothe') r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(700, STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h] }; });
  else if (key === 'treat') r.spGains = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(60, STAT[h].sp - s.sp[h]); s.sp[h] += v; return { dst: h, v, sp: s.sp[h] }; });
  r.mo = gain(s, MO.skill); return r;
}
export function doUlt(s, id) {
  s.sp[id] -= STAT[id].cost; gain(s, -MO.ult); const r = { kind: 'ult', id, sp: s.sp[id], mo: s.mo, hits: [] }, push = h => { if (h) r.hits.push(h); return h; };
  if (id === 'kui') {      // 吐槽一閃：每隻小兵兩刀；小兵清光的話最後一刀劈魔王
    for (const m of MINIONS) if (alive(s, m)) { push({ ...hitFoe(s, id, m, 1900, { noCrit: true }), stage: m }); if (alive(s, m)) push({ ...hitFoe(s, id, m, 2100, { noCrit: true }), stage: m }); }
    { const hit = hitFoe(s, id, 'boss', 4400, { sh: 2 }); if (hit) push({ ...hit, stage: hit.pot ? hit.dst : 'boss' }); }
  } else if (id === 'jie') {      // 深淵死線：敵方全體
    for (const m of MINIONS) push(hitFoe(s, id, m, 2600, { noCrit: true })); push(hitFoe(s, id, 'boss', 6200, { sh: 1 })); if (alive(s, 'boss') && !r.hits.at(-1)?.guard) push(hitFoe(s, id, 'boss', 5200, { sh: 1, noCrit: true }));
  } else if (id === 'kevin') { s.aegis = true;
  } else if (id === 'mi') {      // 聖光專線：全員補滿，聖光打一個敵人（先打小兵）
    r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = STAT[h].hp - s.hp[h]; s.hp[h] = STAT[h].hp; return { dst: h, v, hp: s.hp[h] }; });
    push(hitFoe(s, id, MINIONS.find(m => alive(s, m)) || 'boss', 2000));
  } else if (id === 'vivi') {      // 皇家敕令：攻擊力提升三回合，全員總攻擊（先清小兵，再打魔王）
    s.atkUp = 3; const tgt = wantBoss => { const m = MINIONS.find(x => alive(s, x)); return wantBoss && alive(s, 'boss') && !guarded(s) ? 'boss' : m || (alive(s, 'boss') ? 'boss' : null); };
    for (const h of FRONT) if (alive(s, h)) { const t = tgt(h === 'jie' || h === 'mi'); if (t) { const hit = hitFoe(s, h, t, STAT[h].atk * 1.6); if (hit) push({ ...hit, by: h }); } }
    { const t = tgt(true); if (t) { const hit = hitFoe(s, id, t, t === 'boss' ? 7000 : 3000, { sh: 2, noCrit: true }); if (hit) push({ ...hit, by: 'vivi', final: true }); } }
  }
  return r;
}

// ---------- 敵人行動 ----------
export function enemyTurn(s, id) {
  const targets = FRONT.filter(h => alive(s, h)), pick = () => targets[Math.floor(s.rand() * targets.length)], weak = s.atkDown[id] > 0, k = weak ? .7 : 1; if (weak && !(id === 'boss' && s.broken)) s.atkDown[id]--;
  if (id !== 'boss') return { kind: 'foeAtk', id, weak, hits: hitHeroes(s, id, [[pick(), STAT[id].atk * k]]) };
  if (s.broken) { s.broken = false; s.shield = STAT.boss.shield; return { kind: 'stunned', id, shield: s.shield }; }
  s.bossTurns++;
  if (s.charging) { s.charging = false; const r = { kind: 'bossUlt', id, weak, hits: hitHeroes(s, id, targets.map(h => [h, BOSS_ULT[h] * k])), blocked: s.aegis && alive(s, 'kevin') };
    if (!s.over && !MINIONS.some(m => alive(s, m))) { for (const m of MINIONS) s.hp[m] = STAT[m].hp; s.summons++; r.summon = true; } return r; }
  if (s.bossTurns % STAT.boss.cycle === STAT.boss.cycle - 1) { s.charging = true; return { kind: 'charge', id }; }
  return { kind: 'bossAtk', id, weak, hits: hitHeroes(s, id, [[pick(), STAT.boss.atk * k]]) };
}
