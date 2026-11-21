// 福利社（11/21）：買道具、抽同事、買素質 ＋1。node tools/tests/storetest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = () => { const run = R.newRun(R.mulberry(5), 'kui', 'draft', 'office'); R.join(run, 'kevin'); R.prepare(run); return run; };
{ const run = mk(); run.coin = 0; ok(!R.storeOk(run, 'tea') && R.storeBuy(run, 'tea') === null, '沒錢買不了');
  run.coin = 100; const n = run.items.tea, r = R.storeBuy(run, 'tea'); ok(r && r.item === 'tea' && run.items.tea === n + 1 && run.coin === 100 - R.STORE.tea, '買一杯珍珠奶茶');
  R.storeBuy(run, 'coffee'); ok(run.coin === 100 - R.STORE.tea - R.STORE.coffee, '再買黑咖啡，錢照扣'); }
{ const run = mk(); run.coin = 500; const n = run.roster.length, r = R.storeBuy(run, 'draw'); ok(r && r.joined && run.roster.length === n + 1 && run.roster.includes(r.joined) && r.joined !== 'vivi' && run.coin === 500 - R.STORE.draw, `抽到 ${r && r.joined}`);
  ok(run.hp[r.joined] === R.STAT[r.joined].hp && run.skills[r.joined].length > 0, '抽到的人滿血、帶著招式');
  while (run.roster.length < 6) R.join(run, R.drawPool(run)[0]); run.coin = 500; ok(R.storeOk(run, 'draw'), '名冊滿了也能調人'); const r2 = R.storeBuy(run, 'draw'); ok(r2 && r2.pend && run.drawPend === r2.pend && run.roster.length === 6 && run.coin === 500 - R.STORE.draw && !R.storeOk(run, 'draw'), `滿編：先付錢、調來 ${r2 && r2.pend}，還沒安排前不能再調`);
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run))), R.mulberry(5)); ok(back && back.run.drawPend === r2.pend, '還沒安排的人，存檔讀回來還在'); ok(R.storeSettle(run, run.starter) === null && run.drawPend, '不能讓主角回公司');
  const out = run.roster.find(h => h !== run.starter), r3 = R.storeSettle(run, out); ok(r3 && r3.joined === r2.pend && r3.gone === out && run.roster.includes(r2.pend) && !run.roster.includes(out) && run.roster.length === 6 && !run.drawPend, `${out} 回公司，${r2.pend} 加入`);
  run.coin = 500; const r4 = R.storeBuy(run, 'draw'), r5 = R.storeSettle(run, null); ok(r4.pend && r5.declined === r4.pend && !run.roster.includes(r4.pend) && !run.drawPend, '也可以讓新來的回去（錢不退）'); }
{ const run = mk(); run.coin = 2000; const h0 = R.STAT.kui.hp, s0 = R.STAT.kui.spd, cur = run.hp.kui; R.storeBuy(run, 'hp'); R.storeBuy(run, 'spd'); ok(R.STAT.kui.hp === Math.round(h0 * 1.06) && run.hp.kui === cur + (R.STAT.kui.hp - h0) && R.STAT.kui.spd === Math.round(s0 * 1.05), '體力 ＋1：HP 上限 ×1.06（現在的 HP 跟著加）；速度 ＋1：×1.05');
  const d = JSON.parse(JSON.stringify(R.saveRun(run))), back = R.loadRun(d, R.mulberry(5)); ok(back && R.STAT.kui.hp === Math.round(h0 * 1.06) && back.run.hp.kui === run.hp.kui && back.run.boost.hp === 1, '讀檔之後 HP 上限還是強化過的'); R.newRun(R.mulberry(5), 'kui', 'draft', 'office'); ok(R.STAT.kui.hp === h0 && R.STAT.kui.spd === s0, '開新的一趟會還原'); }
{ const run = mk(); run.coin = 2000; const a0 = run.atk, d0 = run.def, m0 = run.moStart; ok(R.boostPrice(run, 'atk') === 60, '第一級 60 點');
  R.storeBuy(run, 'atk'); ok(Math.abs(run.atk - a0 * 1.05) < 1e-9 && R.boostLv(run, 'atk') === 1 && R.boostPrice(run, 'atk') === 90 && run.coin === 1940, '攻擊 ＋1：攻擊力 ×1.05，下一級 90 點');
  R.storeBuy(run, 'def'); R.storeBuy(run, 'mo'); ok(Math.abs(run.def - d0 * .96) < 1e-9 && run.moStart === m0 + 6, '防禦、氣勢各 ＋1');
  for (let i = 0; i < 9; i++) R.storeBuy(run, 'atk'); ok(R.boostLv(run, 'atk') === R.BOOST_MAX && !R.storeOk(run, 'atk'), `攻擊最多 ＋${R.BOOST_MAX}`);
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run))), R.mulberry(5)); ok(back && back.run.boost.atk === R.BOOST_MAX && back.run.boost.def === 1 && Math.abs(back.run.atk - run.atk) < 1e-9 && back.run.coin === run.coin, '存檔讀回來，強化等級和錢都在'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
