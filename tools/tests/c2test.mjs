import * as R from '../../js/rules.js';
const mk = (stage, map = 'office', team = ['kevin', 'mi', 'jie'], seed = 3) => { const run = R.newRun(R.mulberry(seed), 'kui', 'draft', map); for (const h of team) R.join(run, h); const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage || (nd.pool || []).includes(stage))), nd = R.MAP[fl].find(nd => nd.stage === stage || (nd.pool || []).includes(stage)); if (nd.pool) run.alt[nd.stage] = stage; run.floor = fl; run.node = nd; for (let k = 0; k < fl; k++) run.path[k] = 0; const s = R.newState(run); R.startRound(s); return s; };
const ok = (c, m) => console.log((c ? 'OK  ' : 'BAD ') + m); let s, r;
// 弱點：社畜小兵怕斬、火
s = mk('intro', 'office', []); s.rand = () => .5;
{ const m0 = s.mo; r = R.doAttack(s, 'kui', 'ma'); ok(r.hits[0].wk && r.hits[0].type === 'slash' && r.hits[0].v === Math.round(1250 * 1.3) && r.hits[0].wkMo === 6 && s.mo === m0 + 6 + R.MO.attack, `小葵斬小兵：弱點 ${r.hits[0].v}，氣勢 ${m0}→${s.mo}`); ok(r.spGain === 0 || r.spGain >= 0, `普攻回 SP ${r.spGain}`);
  s.sp.kui = 50; r = R.doAttack(s, 'kui', 'mb'); ok(r.spGain === 9, `小葵普攻回 ${r.spGain}（142×6%）`); s.sp.kui = 50; r = R.doDefend(s, 'kui'); ok(r.spGain === 10, '防禦回 10 SP'); }
// 一個指令只加一次氣勢、多削一次底氣
s = mk('boss', 'office'); s.rand = () => .5; for (const m of R.MINIONS) s.hp[m] = 0;
{ const sh0 = s.shield, m0 = s.mo; r = R.doSkill(s, 'kui', 'draft', 'boss'); ok(r.hits.length === 2 && r.hits.every(h => h.wk) && r.hits.filter(h => h.wkMo).length === 1 && sh0 - s.shield === 3, `先出一版打總經理（怕斬）：兩刀都弱點，氣勢只加一次，底氣 ${sh0}→${s.shield}`); }
// 屬性鎖
s = mk('boss', 'office'); s.rand = () => .5;
{ while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(r.kind === 'charge' && r.locks && r.locks.length === 3, `蓄力出鎖 ${r.locks}`); const L0 = s.locks.slice(), it = R.intent(s, 'boss'); ok(it.locks.length === 3 && it.lockN === 3, '意圖有鎖'); ok(!R.guarded(s), '總經理不再護衛（v0.48）');
  const who = t => ['kui', 'kevin', 'mi', 'jie'].find(h => R.ATK_TYPE[h] === t) ; const a = who(L0[0]); r = R.doAttack(s, a, 'boss'); ok(!r.hits[0].guard && r.hits[0].lock === 2, `打得到、也能拆鎖（${a} 用 ${L0[0]}）還剩 ${r.hits[0].lock}`); r = R.doAttack(s, a, 'boss'); ok(s.locks.length === (L0.filter(t => t === L0[0]).length > 1 ? 1 : 2), '同屬性再打不會多拆（除非鎖重複）');
  const hp0 = s.hp.kui; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossUlt' && r.opened >= 1 && Math.abs(r.pow - (1 - .25 * r.opened)) < 1e-9, `大招威力 ${r.pow}（拆 ${r.opened} 個）`); ok(s.locks === null, '放完鎖清掉'); }
// 全拆：取消＋理虧
s = mk('audit', 'office'); s.rand = () => .5;
{ while (!s.charging) r = R.enemyTurn(s, 'boss'); const L0 = s.locks.slice(); let last; for (const t of L0) { const h = ['kui', 'kevin', 'mi', 'jie'].find(h => R.ATK_TYPE[h] === t); if (h) last = R.doAttack(s, h, 'boss'); else { const [hh, sk] = [['jie', 'burn'], ['jie', 'freeze']].find(([x, k]) => R.SKILLS[x].find(q => q.key === k).type === t) || []; if (hh) last = R.doSkill(s, hh, sk, 'boss'); } }
  ok(!s.charging && s.broken && s.locks === null && last.hits.at(-1).lockAll, `鎖 ${L0} 全拆：大招取消、理虧`); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'stunned', '下一次行動取消'); r = R.enemyTurn(s, 'boss'); ok(r.kind !== 'bossUlt', `之後不會補放大招（${r.kind}）`); }
// 自己有蓄力機制的頭目不出鎖
s = mk('pig', 'office'); while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(!!r.locks && !!s.locks, '豬腦現在也出鎖（v0.48 不再灌水）');
// 再動一次的護欄
s = mk('intro', 'office', ['wu', 'kevin', 'mi']); s.rand = () => .5;
{ r = R.doSkill(s, 'wu', 'encore', 'kui'); ok(s.extra === 1 && s.bonus.kui === 1 && s.queue[0] === 'kui', '安可：小葵多動一次'); R.beginTurn(s, 'kui'); ok(s.onBonus === 'kui', '這一次是送的'); R.beginTurn(s, 'kui'); ok(s.onBonus === null, '下一次是自己的'); s.extra = 3; ok(!R.skillOk(s, 'wu', R.SKILLS.wu[0]), '一回合最多多動 3 次'); }
