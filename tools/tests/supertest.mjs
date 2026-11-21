// 超級化（11/21）：二週目才有、氣勢滿才能變、三回合、攻擊 ×2、受傷 ×0.7、速度 ×1.3、招式不花 SP、每人每場一次。node tools/tests/supertest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (team, cycle = 2) => { const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office', 0, null, cycle, []); for (const h of team) R.join(run, h); R.prepare(run); run.alt = {}; run.floor = 5; run.node = R.MAP[5][0]; run.path = [0, 0, 0, 0, 0]; return run; };
const fresh = (team, cycle) => { const s = R.newState(mk(team, cycle)); R.startRound(s); s.rand = () => .5; for (const h of R.HEROES) s.sp[h] = R.STAT[h].sp; return s; };
const next = s => { s.queue = []; R.startRound(s); };
ok(R.SUPERS.join() === 'kui,jie,qiang,you,senpai,zhe,an', `超級系列七個人：${R.SUPERS}`);
{ const s = fresh(['qiang', 'mi', 'an'], 1); s.mo = 100; ok(!R.superOpen(s.run) && !R.canSuper(s, 'kui'), '一週目沒有超級化'); }
{ const s = fresh(['qiang', 'mi', 'an']); s.mo = 99; ok(R.superOpen(s.run) && !R.canSuper(s, 'qiang'), '二週目：氣勢 99 還不行'); s.mo = 100; ok(R.canSuper(s, 'qiang') && R.canSuper(s, 'an') && !R.canSuper(s, 'mi'), '氣勢 100：阿強、小安可以，小米不在名單');
  const f = R.foes(s).find(x => x !== 'boss') || 'boss'; s.hp[f] = 1e6; const h0 = R.doAttack(s, 'qiang', f).hits[0].v; s.hp[f] = 1e6; s.mo = 100; s.queue = s.queue.filter(q => q !== 'qiang');
  const r = R.doSuper(s, 'qiang'); ok(r.kind === 'super' && s.mo === 100 - R.SUPER.cost && R.isSuper(s, 'qiang') && s.queue[0] === 'qiang' && s.hp.qiang === R.STAT.qiang.hp, `超級化：氣勢用掉 ${R.SUPER.cost}、HP 回滿、不用掉行動（接著輪到他）`);
  ok(!R.canSuper(s, 'qiang'), '已經是超級狀態，不能再變'); const h1 = R.doAttack(s, 'qiang', f).hits[0].v; ok(Math.abs(h1 / h0 - 2) < .02, `普攻傷害 ×2（${h0} → ${h1}）`);
  ok(Math.abs(R.preview(s, 'qiang', f) / h1 - 1) < .1, '傷害預估也算進去');
  const sk = R.SKILLS.qiang.find(k => s.run.skills.qiang.includes(k.key)); s.sp.qiang = 0; ok(R.spCost(s, 'qiang', sk) === 0 && R.skillOk(s, 'qiang', sk), '超級狀態招式不花 SP（SP 0 也能用）');
  next(s); ok(R.isSuper(s, 'qiang') && s.queue.indexOf('qiang') >= 0, '第二回合還在'); next(s); ok(R.isSuper(s, 'qiang'), '第三回合還在'); next(s); ok(!R.isSuper(s, 'qiang') && s.events.some(e => e.kind === 'superEnd' && e.who === 'qiang'), '第四回合開始時結束');
  s.mo = 100; ok(!R.canSuper(s, 'qiang') && R.canSuper(s, 'an'), '每人每場一次：阿強不能再變，小安還可以'); }
// 受傷 ×0.7、速度 ×1.3
{ const hit = sup => { const s = fresh(['qiang', 'mi', 'an']); s.mo = 100; if (sup) R.doSuper(s, 'qiang'); s.hp.qiang = R.STAT.qiang.hp; s.ward.qiang = 0; s.plan.ma = 'qiang'; for (let i = 0; i < 6; i++) { const r = R.enemyTurn(s, 'ma'), h = (r.hits || []).find(x => x && x.dst === 'qiang' && x.v > 0); if (h) return h.v; } return 0; };
  const a = hit(false), b = hit(true); ok(a > 0 && Math.abs(b / a - .7) < .03, `受到的傷害 ×0.7（${a} → ${b}）`); }
{ const s = fresh(['qiang', 'mi', 'an']); s.mo = 100; R.doSuper(s, 'an'); const before = fresh(['qiang', 'mi', 'an']); next(before); next(s); const pos = q => q.queue.indexOf('an'); ok(pos(s) <= pos(before), `速度變快，行動順序不會更後面（${pos(before)} → ${pos(s)}）`); }
// 倒下、換下場就結束；重演
{ const s = fresh(['qiang', 'mi', 'an', 'kevin', 'xu']); s.mo = 100; const n = s.cmdLog.length; R.doSuper(s, 'kui'); ok(s.cmdLog[n][0] === 'x', '指令有記錄'); s.hp.kui = 1; s.ward.kui = 0; s.plan.ma = 'kui'; for (let i = 0; i < 6 && s.hp.kui > 0; i++) R.enemyTurn(s, 'ma'); ok(s.hp.kui === 0 && !R.isSuper(s, 'kui'), '倒下就結束');
  const s2 = fresh(['qiang', 'mi', 'an', 'kevin', 'xu']); s2.mo = 100; R.doSuper(s2, 'qiang'); R.doSwap(s2, 'qiang', R.bench(s2)[0]); ok(!R.isSuper(s2, 'qiang'), '被換下場就結束');
  const s3 = fresh(['qiang', 'mi', 'an']); s3.mo = 100; ok(R.redo(s3, ['x', 'qiang']) && R.isSuper(s3, 'qiang') && R.redo(s3, ['x', 'qiang']) === null, '重演認得，不能重複變'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
