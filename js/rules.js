// 試玩版的戰鬥規則（純邏輯，不碰畫面）：game.js 拿結果去演，tools/sim.js 拿它跑幾百場調數值。
// 規則摘要：
// ・每回合照速度排順序。輪到自己 BP +1（上限 5）；BP 滿 5 且 SP 夠才能放奧義，放完 BP 歸零。
// ・場上有小兵時魔王「護衛中」，打他傷害無效。
// ・魔王被打中護盾 -1（奧義 -2），歸零就 BREAK：下一次行動取消（蓄好的大招只是延後），期間受到的傷害 1.5 倍，之後護盾回滿。
// ・魔王一回合行動兩次；每五次行動的第四次蓄力，下一次行動放大招「無限改稿」打全體，放完如果場上沒小兵就再叫兩隻。
// ・Kevin 的奧義「鐵壁」：到他下一次行動前，敵人的攻擊全部由他承受三成五，其他人不受傷。
// ・防禦：到自己下一次行動前受傷減半，BP 多 +1。
// ・招式（SKILLS）：每人一兩招，只花 SP、不用 BP。
export const FRONT = ['kui', 'kevin', 'jie', 'mi'], HEROES = [...FRONT, 'vivi'], MINIONS = ['ma', 'mb'];
export const STAT = {
  kui: { hp: 2680, sp: 142, atk: 1250, spd: 356, cost: 60 }, kevin: { hp: 4860, sp: 118, atk: 780, spd: 142, cost: 50 },
  jie: { hp: 2140, sp: 388, atk: 1500, spd: 228, cost: 180 }, mi: { hp: 2320, sp: 356, atk: 950, spd: 264, cost: 160 },
  vivi: { hp: 9999, sp: 999, atk: 0, spd: 12, cost: 99 },
  boss: { hp: 70000, spd: 200, spd2: 100, atk: 1100, shield: 8, cycle: 5 }, ma: { hp: 3800, spd: 180, atk: 400 }, mb: { hp: 3800, spd: 170, atk: 400 },
};
export const BOSS_ULT = { kui: 1380, kevin: 1830, jie: 1260, mi: 1180 };      // 「無限改稿」對每個人的傷害
export const ITEMS = { tea: { name: '珍珠奶茶', n: 3, note: 'HP 回復 2000', hp: 2000 }, coffee: { name: '黑咖啡', n: 2, note: 'SP 回復 150', sp: 150 }, bento: { name: '雞排便當', n: 1, note: '倒下的同伴復活', revive: .5 } };
// 招式（技能）：不用 BP，只花 SP。target：foe 選一個敵人、all 敵方全體、ally 選一個同伴、party 我方前排、self 自己
export const SKILLS = {
  kui: [{ key: 'sweep', name: '橫掃千稿', sp: 24, note: '敵方全體', target: 'all', desc: '一刀掃過所有敵人。小兵多的時候很好用。' }, { key: 'retort', name: '直球吐槽', sp: 18, note: '單體重擊　護盾 -2', target: 'foe', desc: '對一個敵人用力吐槽，傷害高，還能多削魔王的護盾。' }],
  kevin: [{ key: 'taunt', name: '這個我來', sp: 16, note: '吸引攻擊　受傷減三成', target: 'self', desc: '到下次行動前，敵人的單體攻擊都打 Kevin，而且他受的傷害減三成。' }, { key: 'bash', name: '盾擊', sp: 20, note: '單體攻擊　自己進入防禦', target: 'foe', desc: '用盾牌撞一個敵人，同時擺好防禦姿勢（受傷減半）。' }],
  jie: [{ key: 'barrage', name: '暗影彈幕', sp: 40, note: '敵方全體', target: 'all', desc: '暗屬性魔法轟炸所有敵人。' }, { key: 'curse', name: '加班詛咒', sp: 50, note: '單體攻擊　攻擊力下降', target: 'foe', desc: '詛咒一個敵人：接下來四次行動的傷害減三成。' }],
  mi: [{ key: 'mend', name: '治癒專線', sp: 36, note: '單體回復 1500', target: 'ally', desc: '幫一個同伴回復 1500 HP。' }, { key: 'soothe', name: '安撫話術', sp: 48, note: '前排全體回復 700', target: 'party', desc: '前排全員各回復 700 HP。' }],
  vivi: [{ key: 'treat', name: '老闆請客', sp: 80, note: '前排全員 SP ＋60', target: 'party', desc: '請大家喝飲料，前排全員回復 60 SP。' }],
};
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export function newState(rand = Math.random) {
  const s = { rand, hp: {}, sp: {}, bp: {}, defend: {}, items: {}, round: 0, queue: [], shield: STAT.boss.shield, broken: false, charging: false, bossTurns: 0, aegis: false, taunt: false, atkDown: {}, atkUp: 0, summons: 0, over: null };
  for (const id in STAT) s.hp[id] = STAT[id].hp;
  for (const id of HEROES) { s.sp[id] = STAT[id].sp; s.bp[id] = id === 'vivi' ? 3 : 2; }
  for (const k in ITEMS) s.items[k] = ITEMS[k].n;
  return s;
}
export const alive = (s, id) => s.hp[id] > 0;
export const guarded = s => MINIONS.some(id => alive(s, id));
export const foes = s => ['boss', ...MINIONS].filter(id => alive(s, id));
const vary = (s, v, k = .08) => Math.round(v * (1 - k + s.rand() * 2 * k));
const check = s => { if (s.hp.boss <= 0) s.over = 'win'; else if (FRONT.every(id => !alive(s, id))) s.over = 'lose'; };

// 排這一回合的行動順序
// 魔王一回合行動兩次（一次快、一次慢，Kevin 剛好排在兩次中間）
export function startRound(s) { s.round++; if (s.atkUp > 0) s.atkUp--;
  const list = [...HEROES, 'boss', ...MINIONS].filter(id => alive(s, id)).map(id => [id, STAT[id].spd]); list.push(['boss', STAT.boss.spd2]);
  s.queue = list.sort((a, b) => b[1] - a[1]).map(x => x[0]); return s.queue; }
// 輪到某個人（回傳 false＝這個人已經倒了，跳過）
export function beginTurn(s, id) {
  if (!alive(s, id)) return false;
  if (HEROES.includes(id)) { s.defend[id] = false; if (id === 'kevin') { s.aegis = false; s.taunt = false; } s.bp[id] = Math.min(5, s.bp[id] + 1); }
  return true;
}
export const canUlt = (s, id) => s.bp[id] >= 5 && s.sp[id] >= STAT[id].cost;

// 打敵人：回傳一筆結果 { dst, v, guard, crit, kill, brk, hp, shield }
function hitFoe(s, src, dst, base, o = {}) {
  if (!alive(s, dst)) return null;
  if (dst === 'boss' && guarded(s)) return { src, dst, v: 0, guard: true, hp: s.hp.boss, shield: s.shield };
  const crit = !o.noCrit && s.rand() < .12; let v = vary(s, base) * (s.atkUp > 0 ? 1.5 : 1) * (crit ? 1.5 : 1) * (dst === 'boss' && s.broken ? 1.5 : 1); v = Math.round(v);
  s.hp[dst] = Math.max(0, s.hp[dst] - v); const r = { src, dst, v, crit, weak: true, kill: s.hp[dst] <= 0, hp: s.hp[dst] };
  if (dst === 'boss' && !s.broken && !r.kill) { s.shield = Math.max(0, s.shield - (o.sh ?? 1)); if (s.shield === 0) { s.broken = true; r.brk = true; } }      // BREAK 只讓他少動一次，蓄好的大招還是會放
  if (dst === 'boss') r.shield = s.shield; check(s); return r;
}
// 打我方：鐵壁在的時候全部轉給 Kevin；回傳 [{ dst, v, guard, kill, hp }]
function hitHeroes(s, src, list) {      // list：[[id, 傷害]]
  const out = [];
  if (s.aegis && alive(s, 'kevin')) { let sum = 0; for (const [id, v] of list) { if (!alive(s, id)) continue; sum += v; if (id !== 'kevin') out.push({ src, dst: id, v: 0, guard: true, hp: s.hp[id] }); }
    const v = Math.min(s.hp.kevin - 1, Math.round(sum * .35)); s.hp.kevin -= v; out.unshift({ src, dst: 'kevin', v, cover: true, hp: s.hp.kevin }); return out; }      // 鐵壁不會讓 Kevin 倒下
  if (s.taunt && list.length === 1 && alive(s, 'kevin')) list = [['kevin', list[0][1] * .7, list[0][0]]];      // 挑釁：單體攻擊改打 Kevin，傷害減三成
  for (const [id, raw, from] of list) { if (!alive(s, id)) continue; const v = Math.round(vary(s, raw) * (s.defend[id] ? .5 : 1)); if (from && from !== id) out.taunted = from; s.hp[id] = Math.max(0, s.hp[id] - v); out.push({ src, dst: id, v, def: !!s.defend[id], kill: s.hp[id] <= 0, hp: s.hp[id] }); }
  check(s); return out;
}

// ---------- 我方指令。都回傳 { kind, id, ... , hits:[…] } ----------
export function doAttack(s, id, target) { return { kind: 'attack', id, target, hits: [hitFoe(s, id, target, STAT[id].atk)].filter(Boolean) }; }
export function doDefend(s, id) { s.defend[id] = true; s.bp[id] = Math.min(5, s.bp[id] + 1); return { kind: 'defend', id }; }
export function doCheer(s) { for (const id of FRONT) if (alive(s, id)) s.bp[id] = Math.min(5, s.bp[id] + 2); return { kind: 'cheer', id: 'vivi', bp: { ...s.bp } }; }
export function itemTargets(s, key) { const it = ITEMS[key]; return HEROES.filter(id => it.revive ? FRONT.includes(id) && !alive(s, id) : alive(s, id) && (it.hp ? s.hp[id] < STAT[id].hp : s.sp[id] < STAT[id].sp)); }
export function doItem(s, id, key, target) {
  const it = ITEMS[key]; s.items[key]--; const r = { kind: 'item', id, key, target };
  if (it.hp) { r.heal = Math.min(it.hp, STAT[target].hp - s.hp[target]); s.hp[target] += r.heal; }
  if (it.sp) { r.spGain = Math.min(it.sp, STAT[target].sp - s.sp[target]); s.sp[target] += r.spGain; }
  if (it.revive) { r.revive = true; r.heal = Math.round(STAT[target].hp * it.revive); s.hp[target] = r.heal; s.bp[target] = 1; }
  r.hp = s.hp[target]; r.sp = s.sp[target]; return r;
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
  return r;
}
export function doUlt(s, id) {
  s.sp[id] -= STAT[id].cost; s.bp[id] = 0; const r = { kind: 'ult', id, sp: s.sp[id], hits: [] }, push = h => { if (h) r.hits.push(h); return h; };
  if (id === 'kui') {      // 吐槽一閃：每隻小兵兩刀；小兵清光的話最後一刀劈魔王
    for (const m of MINIONS) if (alive(s, m)) { push({ ...hitFoe(s, id, m, 1900, { noCrit: true }), stage: m }); if (alive(s, m)) push({ ...hitFoe(s, id, m, 2100, { noCrit: true }), stage: m }); }
    push({ ...(hitFoe(s, id, 'boss', 4400, { sh: 2 }) || {}), stage: 'boss' });
  } else if (id === 'jie') {      // 深淵死線：敵方全體
    for (const m of MINIONS) push(hitFoe(s, id, m, 2600, { noCrit: true })); push(hitFoe(s, id, 'boss', 6200, { sh: 1 })); if (alive(s, 'boss') && !r.hits.at(-1)?.guard) push(hitFoe(s, id, 'boss', 5200, { sh: 1, noCrit: true }));
  } else if (id === 'kevin') { s.aegis = true;
  } else if (id === 'mi') {      // 聖光專線：全員補滿，聖光打一個敵人（先打小兵）
    r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = STAT[h].hp - s.hp[h]; s.hp[h] = STAT[h].hp; return { dst: h, v, hp: s.hp[h] }; });
    push(hitFoe(s, id, MINIONS.find(m => alive(s, m)) || 'boss', 2000));
  } else if (id === 'vivi') {      // 皇家敕令：攻擊力提升三回合，全員總攻擊（先清小兵，再打魔王）
    s.atkUp = 3; for (const h of FRONT) if (alive(s, h)) { s.bp[h] = Math.min(5, s.bp[h] + 1); const t = (h === 'kui' || h === 'kevin') ? (MINIONS.find(m => alive(s, m)) || 'boss') : (guarded(s) ? MINIONS.find(m => alive(s, m)) : 'boss'); push({ ...hitFoe(s, h, t, STAT[h].atk * 1.6), by: h }); }
    if (alive(s, 'boss')) push({ ...hitFoe(s, id, guarded(s) ? MINIONS.find(m => alive(s, m)) : 'boss', guarded(s) ? 3000 : 7000, { sh: 2, noCrit: true }), by: 'vivi', final: true });
    r.bp = { ...s.bp };
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
    if (!s.over && !guarded(s)) { for (const m of MINIONS) s.hp[m] = STAT[m].hp; s.summons++; r.summon = true; } return r; }
  if (s.bossTurns % STAT.boss.cycle === STAT.boss.cycle - 1) { s.charging = true; return { kind: 'charge', id }; }
  return { kind: 'bossAtk', id, weak, hits: hitHeroes(s, id, [[pick(), STAT.boss.atk * k]]) };
}
