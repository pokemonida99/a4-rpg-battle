// 數值模擬：node tools/sim.mjs [輪數=400]
// 從阿傑或小葵一個人出發，照行程表（rules.js 的 MAP）走完一輪：沿路招募、救援、休息、選強化。
// 三種打法 × 兩個起始角色，看通關率、倒在哪一站、通關時隊伍幾個人。
// 目標：會想的打法大多能通關、一般玩家五到七成、只按攻擊過不了頭目。
// 試數值：BOSSHP=70000 CHIEFHP=40000 S1=.34 node tools/sim.mjs
// 指定某一站打哪一種組合（平常每一輪隨機抽）：ALT=chief:parrot,audit:pig,crowd:crowd_a,night:night_s node tools/sim.mjs
import { newRun, newState, endStage, enterNode, advance, prepare, rest, join, offerUpgrades, applyUpgrade, startRound, beginTurn, alive, guarded, canUlt, knows, doAttack, doDefend, doCheer, doItem, doUlt, doSkill, enemyTurn, mulberry, EVENTS, eventOk, applyEvent,
  TUNE, STAT, STAGES, MAP, MAPS, SCALE, SKILLS, ROLE, FRONT, HEROES, MINIONS, KINDS, smoked, reachable, weakOf, allyTargets, skillOk, unitesOf, uniteOk, doUnite, offerTrain, applyTrain, supply } from '../js/rules.js';

const E = process.env; for (const k of Object.keys(TUNE)) if (E['T_' + k.toUpperCase()]) TUNE[k] = +E['T_' + k.toUpperCase()];      // 試整體難度：T_HP=1.2 T_ATK=1.1 T_BHP=1.3 T_BATK=1.1 T_ULT=1.2
if (E.BOSSHP) STAGES.boss.boss.hp = +E.BOSSHP; if (E.BOSSULT) STAGES.boss.boss.ult = +E.BOSSULT; if (E.CYCLE) STAGES.boss.boss.cycle = +E.CYCLE; if (E.SPD2 !== undefined) STAGES.boss.boss.spd2 = +E.SPD2; if (E.BOSSATK) STAGES.boss.boss.atk = +E.BOSSATK; if (E.CHIEFHP) STAGES.chief.boss.hp = +E.CHIEFHP; if (E.CHIEFATK) STAGES.chief.boss.atk = +E.CHIEFATK;
for (const n of [1, 2, 3]) { if (E['S' + n]) SCALE[n][0] = +E['S' + n]; if (E['A' + n]) SCALE[n][1] = +E['A' + n]; }

const lowest = s => FRONT.filter(h => alive(s, h)).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0];
const weakMinion = s => MINIONS.filter(m => alive(s, m)).sort((a, b) => s.hp[a] - s.hp[b])[0];
// 會想的打法：先打會補血的實習生，重甲兵留到最後
const PRIO = { intern: 0, smoker: 0, courier: 1, drone: 1, knight: 2, auntie: 2 }, prio = k => PRIO[KINDS[k].like || k] ?? 1, smartMinion = s => MINIONS.filter(m => alive(s, m)).sort((a, b) => prio(s.kind[a]) - prio(s.kind[b]) || s.hp[a] - s.hp[b])[0];
// 猴子的臨時專案（畫面上寫明「打倒他，大招就落空」）一般玩家也會去打；鸚鵡附議的那隻只有會想的打法會優先處理
const projT = s => s.charging && s.proj && alive(s, s.proj) ? s.proj : null, echoT = s => !s.charging && !s.broken && s.echo && alive(s, s.echo) ? s.echo : null;
const target = (s, wm = weakMinion) => (wm === smartMinion || s.round % 3 ? projT(s) : null) || (wm === smartMinion && echoT(s)) || (guarded(s) || !alive(s, 'boss') ? wm(s) : null) || (alive(s, 'boss') ? 'boss' : wm(s));
const can = (s, id, key, keep = 0) => knows(s, id, key) && s.sp[id] - SKILLS[id].find(k => k.key === key).sp >= keep;
const POLICY = {
  // 會想的打法：看到蓄力會擋、血少補血、每個人的招式都會用、留 SP 放奧義
  smart(s, id) {
    const hurt = FRONT.filter(h => alive(s, h) && s.hp[h] / STAT[h].hp < .5), dead = FRONT.filter(h => !alive(s, h)), nMin = MINIONS.filter(m => alive(s, m)).length, boss = alive(s, 'boss'), t = target(s, smartMinion);
    const keep = s.mo >= 26 ? STAT[id].cost : 0, covered = s.aegis || s.bulwark || s.meeting || s.friends || s.endure > 0, me = s.hp[id] / STAT[id].hp;
    if (dead.length && s.items.bento) return doItem(s, id, 'bento', dead[0]);
    if (s.charging && s.wok) { if (s.wok === id) return doDefend(s, id); }      // 背鍋的人防禦，其他人照打（大招只打背鍋的）
    else if (s.charging && !covered && canUlt(s, id) && ['kevin', 'qiang', 'yan', 'cha'].includes(id)) return doUlt(s, id);
    if (s.sign > 0 && boss && !guarded(s) && !['mi', 'xu', 'vivi'].includes(id) && me > .4) return doAttack(s, id, 'boss');      // 不夜城：先用普攻把招牌打熄
    if (id === 'mi') { if (hurt.length >= 2 && canUlt(s, id)) return doUlt(s, id); if (hurt.length >= 2 && can(s, id, 'soothe', keep)) return doSkill(s, id, 'soothe'); if (hurt.length && can(s, id, 'mend', keep)) return doSkill(s, id, 'mend', lowest(s)); }
    if (hurt.length && s.items.tea && (id === 'mi' || id === 'vivi' || me < .4 || FRONT.length === 1)) return doItem(s, id, 'tea', lowest(s));
    if (id === 'vivi') return canUlt(s, id) && !guarded(s) && boss ? doUlt(s, id) : doCheer(s);
    if (s.charging && !s.wok && !covered && me < .7) return doDefend(s, id);
    if (canUlt(s, id) && ['kui', 'jie', 'heilun'].includes(id) && (boss || nMin >= 2)) return doUlt(s, id);
    if (canUlt(s, id) && id === 'senpai' && (s.evidence >= 2 || s.broken)) return doUlt(s, id);
    if (t !== 'boss' && KINDS[s.kind[t]].dull && nMin < 2 && !smoked(s, id) && !['mi', 'xu', 'kevin', 'qiang', 'cha'].includes(id)) return doAttack(s, id, t);      // 大媽：招式只有一半，用普攻打
    if (id === 'kui') { if (nMin >= 2 && can(s, id, 'sweep', keep)) return doSkill(s, id, 'sweep'); if (can(s, id, 'draft', keep)) return doSkill(s, id, 'draft', t); if (me < .5 && can(s, id, 'counter', keep)) return doSkill(s, id, 'counter'); }
    if (id === 'jie') { if (nMin >= 2 && can(s, id, 'barrage', keep)) return doSkill(s, id, 'barrage'); if (boss && !guarded(s) && !(s.atkDown.boss > 0) && can(s, id, 'freeze', keep)) return doSkill(s, id, 'freeze', 'boss'); if (!(s.burn[t] > 0) && can(s, id, 'burn', keep)) return doSkill(s, id, 'burn', t); }
    if (id === 'kevin') { if (!s.taunt && can(s, id, 'taunt', keep)) return doSkill(s, id, 'taunt'); }
    if (id === 'qiang') { if (s.duty >= 2 && can(s, id, 'box', keep)) return doSkill(s, id, 'box', t); if (!s.carry && can(s, id, 'carry', keep)) return doSkill(s, id, 'carry'); }
    if (id === 'yan') { if (s.charging && boss && s.queue.includes('boss') && can(s, id, 'delay', 0)) return doSkill(s, id, 'delay', 'boss'); if (!Object.values(s.atkDown).some(v => v > 0) && can(s, id, 'lock', keep)) return doSkill(s, id, 'lock'); }
    if (id === 'heilun') { if (!(s.mark[t] > 0) && can(s, id, 'mark', keep)) return doSkill(s, id, 'mark', t); if (can(s, id, 'deal', keep)) return doSkill(s, id, 'deal', t); }
    if (id === 'cha') { if (!s.dodge && can(s, id, 'chat', keep)) return doSkill(s, id, 'chat'); }
    if (id === 'senpai') { if (s.broken && boss && can(s, id, 'expose', keep)) return doSkill(s, id, 'expose', 'boss'); if (s.evidence < 3 && can(s, id, 'probe', keep)) return doSkill(s, id, 'probe', t); }
    if (id === 'fairy') { if (dead.length && canUlt(s, id)) return doUlt(s, id); if (can(s, id, 'mice', keep) && !guarded(s)) return doSkill(s, id, 'mice'); }
    if (id === 'xu') { if (hurt.length >= 2 && canUlt(s, id)) return doUlt(s, id); if (hurt.length && can(s, id, 'mix', keep)) return doSkill(s, id, 'mix', lowest(s)); const dry = FRONT.filter(h => h !== id && alive(s, h) && s.sp[h] < STAT[h].cost)[0]; if (dry && can(s, id, 'transfer', keep)) return doSkill(s, id, 'transfer', dry); }
    if (id === 'wu') { const best = FRONT.filter(h => h !== id && alive(s, h)).sort((a, b) => STAT[b].atk - STAT[a].atk)[0]; if (canUlt(s, id) && FRONT.filter(h => alive(s, h)).length >= 3) return doUlt(s, id); if (!s.atkUp && can(s, id, 'dance', keep)) return doSkill(s, id, 'dance'); if (best && can(s, id, 'encore', keep)) return doSkill(s, id, 'encore', best); }
    if (id === 'you') { if (canUlt(s, id) && boss) return doUlt(s, id); if (guarded(s) && boss && can(s, id, 'backdoor', keep)) return doSkill(s, id, 'backdoor', 'boss'); if (s.sp[id] < 60 && !s.evade[id]) return doSkill(s, id, 'slack'); }
    if (id === 'zong') { if (s.charging && !covered && canUlt(s, id)) return doUlt(s, id); if (me < .5 && can(s, id, 'sip', 0)) return doSkill(s, id, 'sip'); if (can(s, id, 'news', keep)) return doSkill(s, id, 'news', t); }
    if (id === 'hui') { if (canUlt(s, id) && (boss || nMin >= 2)) return doUlt(s, id); if (s.overtime < 4 && can(s, id, 'overtime', keep)) return doSkill(s, id, 'overtime', t); if (me > .6 && can(s, id, 'allnight', keep)) return doSkill(s, id, 'allnight', t); }
    // 合體技：打得到頭目（或小兵很多）而且放得出來就放；補血型的等有人受傷
    { const U = unitesOf(id).find(U => uniteOk(s, id, U) && U.who.every((h, q) => s.sp[h] - U.sp[q] >= (s.mo >= 26 ? 0 : 0)) && (U.type ? (boss && !guarded(s)) || nMin >= 2 : hurt.length >= 2 || U.key === 'u_mc')); if (U) return doUnite(s, id, U.key, U.target === 'foe' ? t : undefined); }
    // 新招式：打得到弱點的攻擊招式優先；有人受傷就用護盾、回復類
    { const mine = SKILLS[id].filter(k => k.fx && knows(s, id, k.key) && s.sp[id] - k.sp >= keep && skillOk(s, id, k)), dmg = mine.filter(k => k.type), sup = mine.filter(k => !k.type), wk = dmg.find(k => weakOf(s, t).includes(k.type));
      if (wk) return doSkill(s, id, wk.key, t);
      if (sup.length && (hurt.length || (s.charging && !covered))) { const k = sup[0], pool = k.target === 'ally' ? allyTargets(s, id, k) : []; return doSkill(s, id, k.key, k.target === 'ally' ? (pool.includes(lowest(s)) ? lowest(s) : pool[0]) : undefined); }
      if (dmg.length && !weakOf(s, t).includes(SKILLS[id][0].type) && s.rand() < .5) return doSkill(s, id, dmg[0].key, t); }
    if (s.sp[id] < STAT[id].cost && s.items.coffee && s.mo >= 38) return doItem(s, id, 'coffee', id);
    return doAttack(s, id, t);
  },
  // 一般玩家：奧義亮了就放，有人快倒才補血，看到蓄力坦會擋；偶爾用招式
  casual(s, id) {
    const low = FRONT.filter(h => alive(s, h) && s.hp[h] / STAT[h].hp < .4), t = target(s);
    if (s.charging && s.wok === id && s.round % 4) return doDefend(s, id);      // 畫面上寫明「防禦就彈回去」，一般玩家大多會照做
    if (s.charging && !s.wok && canUlt(s, id) && ['kevin', 'qiang'].includes(id)) return doUlt(s, id);
    if (id === 'mi' && low.length) { if (canUlt(s, id) && low.length >= 2) return doUlt(s, id); if (can(s, id, 'mend')) return doSkill(s, id, 'mend', lowest(s)); }
    if (low.length && s.items.tea && (id === 'mi' || id === 'vivi' || FRONT.length <= 2)) return doItem(s, id, 'tea', lowest(s));
    if (id === 'vivi') return canUlt(s, id) && !guarded(s) && alive(s, 'boss') ? doUlt(s, id) : doCheer(s);
    if (canUlt(s, id) && !['kevin', 'qiang', 'mi', 'yan', 'cha'].includes(id)) return doUlt(s, id);
    if (s.rand() < .35) { const ks = SKILLS[id].filter(k => knows(s, id, k.key) && s.sp[id] >= k.sp && (k.target === 'foe' || k.target === 'all')), k = ks[Math.floor(s.rand() * ks.length)]; if (k) return doSkill(s, id, k.key, t); }
    return doAttack(s, id, t);
  },
  // 只按攻擊（Vivi 只應援）
  mash(s, id) { return id === 'vivi' ? doCheer(s) : doAttack(s, id, target(s)); },
};
const PICK = ['raise', 'weakpoint', 'tabs', 'leave', 'chair', 'cutter', 'redpen', 'thermos', 'firstaid', 'partition', 'bell', 'applause', 'notebook', 'tempo', 'blanket', 'snackdrawer', 'cheatsheet', 'countdown', 'mug', 'carbon', 'fridge', 'ember', 'riposte', 'dossier', 'crunch', 'bounty', 'learn', 'coffee', 'drinks', 'morale', 'bento'];
function battle(policy, run) {
  const s = newState(run); let guard = 0;
  while (!s.over && guard++ < 80) { startRound(s); while (s.queue.length && !s.over) { const id = s.queue.shift(); if (!beginTurn(s, id)) continue; if (HEROES.includes(id)) POLICY[policy](s, id); else enemyTurn(s, id); } }
  return s;
}
function playRun(policy, seed, starter, map = 'office') {
  const rand = mulberry(seed), run = newRun(rand, starter, SKILLS[starter][Math.floor(rand() * 3)].key, map, +(E.OT || 0)); prepare(run);      // OT=3 試加班等級
  if (E.ALT && map === 'office') for (const kv of E.ALT.split(',')) { const [k, v] = kv.split(':'); if (STAGES[v]) run.alt[k] = v; }
  const pick = () => { const offer = offerUpgrades(run); applyUpgrade(run, policy === 'smart' ? [...offer].sort((a, b) => PICK.indexOf(a) - PICK.indexOf(b))[0] : offer[0]); };
  const MAP = MAPS[map]; while (run.floor < MAP.length) { const opts = MAP[run.floor], ok = reachable(run), off = run.offers[run.floor] || {}, hpK = run.roster.filter(h => h !== 'vivi').reduce((a, h) => a + run.hp[h] / STAT[h].hp, 0) / run.roster.filter(h => h !== 'vivi').length; let i = 0;
    i = ok[0]; if (ok.length > 1) { const rec = ok.find(k => (opts[k].type === 'recruit' || opts[k].rescue) && off[k]), rst = ok.find(k => opts[k].type === 'rest'), gift = ok.find(k => opts[k].type === 'gift'); i = policy === 'mash' ? ok[0] : rst != null && hpK < .55 ? rst : rec != null && run.roster.length < 4 ? rec : ok[ok.length === 3 ? (seed + run.floor) % 3 : ok.length - 1]; }      /* 三條支線的地圖：每一輪走的路不一樣 */
    const nd = enterNode(run, i);
    if (nd.type === 'rest') { const tr = offerTrain(run); if (policy !== 'mash' && tr.length && hpK > (policy === 'smart' ? .8 : .9)) applyTrain(run, tr[0][0], tr[0][1]); else rest(run); } else if (nd.type === 'gift') pick(); else if (nd.type === 'supply') supply(run, nd); else if (nd.type === 'train') { const tr = offerTrain(run); if (tr.length) applyTrain(run, tr[0][0], tr[0][1]); }
    else if (nd.type === 'event') { const key = run.events[run.floor], os = EVENTS[key].opts.map((o, k) => k).filter(k => eventOk(run, key, k)), want = hpK < .6 ? 'heal' : 'buff'; applyEvent(run, key, policy === 'smart' ? os.find(k => EVENTS[key].opts[k].kind === want) ?? os[0] : policy === 'casual' ? os[Math.floor(rand() * os.length)] : os[0]); }
    else if (nd.type === 'recruit') { const c = off[i] || []; if (c.length) join(run, policy === 'smart' ? c.find(id => ROLE[id] === '補') || c.find(id => ROLE[id] === '坦') || c[0] : c[0]); }
    else { const s = battle(policy, run); if (s.over !== 'win') return { win: false, floor: run.floor, size: run.roster.length }; endStage(s, run); if (run.floor < MAP.length - 1) pick(); }
    advance(run); }
  return { win: true, floor: MAP.length, size: run.roster.length, rounds: run.rounds };
}
const N = +(process.argv[2] || 400);
for (const map of (E.MAP || 'office,taiwan,hell,mirror').split(',')) for (const starter of ['kui', 'jie']) { const MAP = MAPS[map]; console.log(`── ${{ mirror: '鏡像內戰', taiwan: '台灣篇', hell: '地獄分公司' }[map] || '一般行程'}　起始角色：${starter === 'kui' ? '小葵' : '阿傑'}`);
  for (const p of Object.keys(POLICY)) { let win = 0, rounds = 0, size = 0; const died = MAP.map(() => 0);
    for (let i = 0; i < N; i++) { const r = playRun(p, i * 7919 + 13, starter, map); if (r.win) { win++; rounds += r.rounds; size += r.size; } else died[r.floor]++; }
    console.log(`${p.padEnd(6)} 通關 ${(win / N * 100).toFixed(0).padStart(3)}%　倒在各站的比例 ${died.map(v => (v / N * 100).toFixed(0)).join(' ')}　通關平均 ${(rounds / Math.max(1, win)).toFixed(1)} 回合、隊伍 ${(size / Math.max(1, win)).toFixed(1)} 人`); } }
// ---------- 存檔自我檢查：每一站存檔再讀回來要一模一樣；壞掉或版本不對的存檔要作廢 ----------
{ const R2 = await import('../js/rules.js'); let n = 0, bad = 0; const strip = r => JSON.stringify(R2.saveRun(r));
  for (let seed = 1; seed <= 40; seed++) { const rand = mulberry(seed * 31 + 5), run = newRun(rand, seed % 2 ? 'kui' : 'jie', null); prepare(run);
    while (run.floor < MAP.length - 1) { const fl = MAP[run.floor], i = Math.floor(rand() * fl.length), nd = enterNode(run, i), off = run.offers[run.floor] || {};
      if (nd.type === 'rest') rest(run); else if (nd.type === 'gift') applyUpgrade(run, offerUpgrades(run)[0]); else if (nd.type === 'event') R2.applyEvent(run, run.events[run.floor], 0); else if (nd.type === 'recruit') { if ((off[i] || []).length) join(run, off[i][0]); }
      else { for (const id of run.roster) run.hp[id] = Math.max(1, Math.round(STAT[id].hp * rand())); const who = nd.rescue && off[i]; if (who) join(run, who[0]); applyUpgrade(run, offerUpgrades(run)[Math.floor(rand() * 3)]); }
      advance(run); const hpMax = Object.fromEntries(run.roster.map(id => [id, STAT[id].hp])), a = strip(run), back = R2.loadRun(JSON.parse(a), rand); n++;
      if (!back || strip(back.run) !== a || run.roster.some(id => STAT[id].hp !== hpMax[id])) { bad++; console.log('存檔讀回來不一樣', seed, run.floor); } } }
  const good = R2.saveRun(newRun(Math.random, 'kui', null)), broke = [{ ...good, v: 99 }, { ...good, v: 0 }, { ...good, roster: ['nobody'] }, { ...good, floor: 99 }, { ...good, picks: ['zzz'] }, { ...good, hp: {} }, { ...good, items: { tea: -1 } }, { ...good, pend: 'upgrade' }, null, 'x', {}];
  const leak = broke.filter(b => R2.loadRun(b) !== null).length;
  // 舊版存檔（v1：還沒有事件站，行程表 8 站）要能轉成現在的格式：停在舊的第 6 站（福委會／獵頭）→ 新的第 7 站
  { const run = newRun(mulberry(9), 'kui', null); join(run, 'kevin'); const old = R2.saveRun(run); delete old.events; Object.assign(old, { v: 1, floor: 5, path: [0, 0, 0, 1, 0], offers: { 5: { 1: ['mi', 'xu'] } } }); const back = R2.loadRun(old, mulberry(9));
    if (!back || back.run.floor !== 6 || back.run.path.join() !== '0,0,0,1,0,0' || (back.run.offers[6] || {})[1]?.join() !== 'mi,xu' || MAP[back.run.floor][1].type !== 'recruit') /* v1 的第 6 站在兩次插層之後還是第 7 站（第二次插在它後面） */ { bad++; console.log('v1 存檔轉換失敗', back && back.run.floor, back && back.run.path); } }
  console.log(`── 存檔檢查：${n} 次存讀${bad ? `，${bad} 次不一致` : '全部一致'}；${broke.length} 種壞檔${leak ? `有 ${leak} 種沒擋下來` : '全部作廢'}`); if (bad || leak) process.exitCode = 1; }
