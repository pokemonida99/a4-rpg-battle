import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); };
const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'jie', 'qiang', 'xu']) R.join(run, h); run.alt = {}; run.floor = 5; run.node = R.MAP[5][0]; run.path = [0, 0, 0, 0, 0]; run.hp.qiang = 3000;
const s = R.newState(run); R.startRound(s); s.rand = () => .5;
ok(R.HEROES.join() === 'kui,kevin,mi,jie' && R.bench(s).join() === 'qiang,xu', `上場 ${R.HEROES}；候補 ${R.bench(s)}`);
s.hp.kui = 300; s.ward.kui = 200; s.plan.ma = 'kui'; const q0 = s.queue.filter(x => x === 'kui').length;
const r = R.doSwap(s, 'kui', 'qiang');
ok(r && r.kind === 'swap' && R.HEROES.join() === 'qiang,kevin,mi,jie' && R.FRONT[0] === 'qiang', `換人後上場 ${R.HEROES}`);
const third = id => Math.ceil(R.STAT[id].hp / R.BENCH_ROUNDS), q1 = Math.min(R.STAT.qiang.hp, 3000 + third('qiang'));      // 候補每回合回三分之一：阿強在候補過了第一回合的開頭
ok(run.hp.kui === 300 && s.hp.qiang === q1 && run.roster.join() === 'qiang,kevin,mi,jie,kui,xu', `小葵帶著 300 HP 下場；名冊 ${run.roster}`);
ok(s.plan.ma === 'qiang' && !s.ward.kui && !s.queue.includes('kui'), '敵人改瞄準阿強；小葵的護盾清掉、這回合不再行動');
ok(R.BOSS_ULT.qiang > 0 && R.bench(s).join() === 'kui,xu', `頭目大招對阿強 ${R.BOSS_ULT.qiang}；候補 ${R.bench(s)}`);
const r2 = R.enemyTurn(s, 'ma'); ok(r2.hits[0].dst === 'qiang', '小兵真的打阿強');
R.startRound(s); ok(s.queue.includes('qiang') && !s.queue.includes('kui'), '下一回合阿強會行動');
s.over = 'win'; R.endStage(s, run); ok(run.hp.kui === 300 + third('kui') && run.hp.qiang > 0 && R.active(run).includes('qiang') && !R.active(run).includes('kui'), '打完：小葵留在候補，只多了候補一回合回的血（過關的回復不算候補）');
const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run)))); ok(back && back.run.roster[0] === 'qiang', '存檔照新的順序');
ok(R.doSwap(s, 'vivi', 'kui') === null, 'Vivi 不能換');
// v0.30：每回合第一次換人不用掉行動（換上來的人排到最前面接著動）；同一回合第二次才用掉行動
{ const run2 = R.newRun(R.mulberry(8), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'jie', 'qiang', 'xu']) R.join(run2, h); R.prepare(run2); run2.floor = 5; run2.node = R.MAP[5][0]; const s2 = R.newState(run2); R.startRound(s2);
  const first = s2.queue.find(q => R.FRONT.includes(q)); s2.queue = s2.queue.filter(q => q !== first); R.beginTurn(s2, first); const mo0 = s2.mo, a = R.doSwap(s2, first, 'qiang');
  ok(a && a.free && s2.queue[0] === 'qiang' && s2.mo === mo0, `第一次換人免費：阿強排最前面（${s2.queue.slice(0, 3)}）`);
  const nx = s2.queue.shift(); R.beginTurn(s2, nx); const b = R.doSwap(s2, 'qiang', 'xu'); ok(b && !b.free && !s2.queue.includes('xu'), '同一回合第二次換人要用掉行動');
  R.startRound(s2); const who = s2.queue.find(q => R.FRONT.includes(q)); s2.queue = s2.queue.filter(q => q !== who); R.beginTurn(s2, who); const c = R.doSwap(s2, who, R.bench(s2)[0]); ok(c && c.free, '下一回合又可以免費換一次'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
