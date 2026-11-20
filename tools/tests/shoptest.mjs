import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); };
for (const map of ['office', 'taiwan', 'hell', 'mirror']) { const run = R.newRun(R.mulberry(4), 'kui', 'draft', map); const f = R.MAP.findIndex(fl => fl.some(nd => nd.type === 'shop')); ok(f > 0, `${map} 有採買站（第 ${f + 1} 站）`); }
{ const run = R.newRun(R.mulberry(4), 'kui', 'draft', 'office'); R.join(run, 'kevin'); run.floor = 6; run.node = R.MAP[6][2]; run.path = [0, 0, 0, 0, 0, 0]; run.coin = 200; const st = R.shopStock(run); ok(st.relic && R.UPGRADES[st.relic], `賣的小物：${R.UPGRADES[st.relic].name}`);
  ok(R.buy(run, 'relic') && run.picks.includes(st.relic) && run.coin === 130, '買小物 −70'); ok(!R.buy(run, 'relic'), '同一樣不能買兩次'); const t0 = run.items.tea; ok(R.buy(run, 'supply') && run.items.tea === t0 + 1 && run.coin === 85, '買補給包 −45'); const tr = R.offerTrain(run); ok(R.buy(run, 'train', tr[0]) && R.isPlus(run, tr[0][0], tr[0][1]) && run.coin === 25, '買特訓 −60'); 
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run)))); ok(back && back.run.coin === 25 && back.run.shop[6].sold.length === 3, '存檔帶著額度和買過的東西'); }
{ const run = R.newRun(R.mulberry(4), 'kui', 'draft', 'office'); run.node = R.MAP[0][0]; const s = R.newState(run); s.over = 'win'; R.endStage(s, run); ok(run.coin === 40 && run.lastCoin === 40, '打贏一般戰鬥 +40'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
