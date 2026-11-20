import * as R from '../../js/rules.js';
const mk = (stage, ot) => { const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office', ot); for (const h of ['kevin', 'mi', 'heilun']) R.join(run, h); const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage)); run.floor = fl; run.node = R.MAP[fl].find(nd => nd.stage === stage); run.alt = {}; for (let q = 0; q < fl; q++) run.path[q] = 0; const s = R.newState(run); R.startRound(s); s.rand = () => .5; return s; };
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); }; let s, r;
s = mk('crowd', 5); ok(s.run.ot === 5 && R.MINIONS.every(m => s.fward[m] === 600), `等級 5：小兵開場護盾 ${s.fward.ma}`); ok(s.queue[0] === 'mc' && s.events.some(e => e.kind === 'rush'), `急件插隊：${s.queue[0]}（信差）最先動`);
s.hp.kui = 500; R.doItem(s, 'kui', 'tea', 'kui'); s.hp.kui = 500; R.doItem(s, 'mi', 'tea', 'kui'); s.hp.kui = 500; ok(R.itemsLeft(s) === 0 && R.itemTargets(s, 'tea').length === 0, '道具用兩次就不能再用');
{ const run = s.run; run.hp.kui = 100; const v0 = run.hp.kui; R.rest(run); ok(run.hp.kui === v0 + Math.round(R.STAT.kui.hp * .25), '休息只回兩成五'); }
s = mk('audit', 5); for (const m of R.MINIONS) s.hp[m] = 0; s.shield = 1; R.doAttack(s, 'kui', 'boss'); ok(s.broken, '第一次理虧'); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'stunned', '第一次會取消行動'); s.shield = 1; R.doAttack(s, 'kui', 'boss'); ok(s.broken, '第二次理虧'); r = R.enemyTurn(s, 'boss'); ok(r.kind !== 'stunned' && r.ignored && !s.broken && s.shield === R.STAT.boss.shield, `第二次不取消（${r.kind}），底氣回滿`);
s = mk('audit', 0); ok(!s.fward.ma && R.itemsLeft(s) === 99, '等級 0 沒有額外規則');
{ const run = R.newRun(R.mulberry(2), 'kui', null, 'office', 3), back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run)))); ok(back && back.run.ot === 3, '存檔帶著加班等級'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
