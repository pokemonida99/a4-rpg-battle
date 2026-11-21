// 週目（11/21）：二週目 ×1.8 多帶一位；三週目 ×2.5 多帶一位＋Vivi。node tools/tests/cycletest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (cycle, carry) => { const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office', 0, null, cycle, carry); R.prepare(run); return run; };
ok(R.CYCLE_K.join() === '1,1.8,2.5' && R.CYCLE_MAX === 3, '倍率 1、1.8、2.5');
{ const r1 = mk(1, ['kevin']); ok(r1.cycle === 1 && r1.roster.join() === 'kui' && R.addGuest(r1) === 'jie', '一週目：一個人出發，有人陪打第一場，不帶同事'); }
{ const r2 = mk(2, ['kevin']); ok(r2.cycle === 2 && r2.roster.join() === 'kui,kevin' && r2.carry.join() === 'kevin' && R.addGuest(r2) === null, '二週目：多帶一位，沒有陪打'); ok(r2.skills.kevin.length === R.SKILLS.kevin.length, '帶來的同事招式都會'); }
{ const r3 = mk(3, ['mi']); ok(r3.roster.join() === 'kui,mi,vivi' && r3.carry.join() === 'mi,vivi' && R.backOf(r3) === 'vivi', '三週目：多帶一位加 Vivi（站後排）'); }
{ const r = mk(2, ['kui']); ok(r.roster.join() === 'kui', '不能帶主角自己'); const q = mk(2, ['nobody', 'zong', 'vivi', 'an']); ok(q.roster.join() === 'kui,an', '名單裡不合格的跳過，只帶一位'); const z = mk(9, []); ok(z.cycle === 3, '週目上限 3'); }
// 敵人的血與攻擊
{ const stat = cycle => { const run = mk(cycle, ['kevin']); run.roster = ['kui', 'kevin']; run.floor = 9; run.node = R.MAP[9][0]; const s = R.newState(run); return { hp: s.hp.boss, atk: R.STAT.boss.atk, m: R.STAT.ma.hp }; }, a = stat(1), b = stat(2), c = stat(3);
  ok(Math.abs(b.hp / a.hp - 1.8) < .01 && Math.abs(b.atk / a.atk - 1.8) < .01 && Math.abs(b.m / a.m - 1.8) < .01, `二週目 ×1.8（頭目血 ${a.hp} → ${b.hp}）`); ok(Math.abs(c.hp / a.hp - 2.5) < .01 && Math.abs(c.atk / a.atk - 2.5) < .01, `三週目 ×2.5（${c.hp}）`); }
// 二週目起：開局道具加倍、普攻與防禦回的 SP 加倍
{ const r1 = mk(1, []), r2 = mk(2, ['kevin']), r3 = mk(3, ['kevin']); ok(Object.keys(R.ITEMS).every(k => r1.items[k] === R.ITEMS[k].n && r2.items[k] === R.ITEMS[k].n * 2 && r3.items[k] === R.ITEMS[k].n * 2), `道具：一週目 ${Object.values(r1.items)}、二週目 ${Object.values(r2.items)}`);
  const gain = cycle => { const run = mk(cycle, ['kevin']); run.roster = ['kui', 'kevin']; run.floor = 2; run.node = R.MAP[2][0]; const s = R.newState(run); R.startRound(s); s.sp.kui = 0; s.sp.kevin = 0; for (const f of R.foes(s)) s.hp[f] = 9e6; const a = R.doAttack(s, 'kui', R.foes(s)[0]).spGain, d = R.doDefend(s, 'kevin').spGain; return [a, d]; }, g1 = gain(1), g2 = gain(2), g3 = gain(3);
  ok(g2[0] === g1[0] * 2 && g2[1] === g1[1] * 2 && g3[0] === g2[0] && g3[1] === g2[1], `SP 回復：普攻 ${g1[0]} → ${g2[0]}、防禦 ${g1[1]} → ${g2[1]}`); }
// 存檔
{ const run = mk(3, ['mi']), b = R.loadRun(R.saveRun(run), R.mulberry(1)); ok(b && b.run.cycle === 3 && b.run.roster.join() === 'kui,mi,vivi' && b.run.carry.join() === 'mi,vivi', '存檔記得週目'); const old = R.saveRun(mk(1, [])); delete old.cycle; delete old.carry; const o = R.loadRun(old, R.mulberry(1)); ok(o && o.run.cycle === 1, '沒有週目欄位的舊存檔當一週目'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
