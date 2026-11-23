import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); };
for (const map of ['office', 'taiwan', 'hell', 'mirror']) { const run = R.newRun(R.mulberry(4), 'kui', 'draft', map); const f = R.MAP.findIndex(fl => fl.some(nd => nd.type === 'shop')); ok(f > 0, `${map} 有採買站（第 ${f + 1} 站）`); }
{ const run = R.newRun(R.mulberry(4), 'kui', 'draft', 'office'); R.join(run, 'kevin'); run.floor = 6; run.node = R.MAP[6][2]; run.path = [0, 0, 0, 0, 0, 0]; run.coin = 300; const st = R.shopStock(run); ok(st.up2 && R.UPGRADES[st.up2], `賣的進階強化：${R.UPGRADES[st.up2].name}`);
  ok(R.buy(run, 'up2') && run.picks.includes(st.up2) && run.coin === 210, '買進階強化 −90'); ok(!R.buy(run, 'up2'), '同一樣不能買兩次'); const tr = R.offerTrain(run); ok(R.buy(run, 'train', tr[0]) && R.isPlus(run, tr[0][0], tr[0][1]) && run.coin === 165, '買特訓 −45');
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run)))); ok(back && back.run.coin === 165 && back.run.shop[6].sold.length === 2, '存檔帶著額度和買過的東西'); }
{ const run = R.newRun(R.mulberry(4), 'kui', 'draft', 'office'); run.node = R.MAP[0][0]; const s = R.newState(run); s.over = 'win'; R.endStage(s, run); ok(run.coin === 40 && run.lastCoin === 40, '打贏一般戰鬥 +40'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
