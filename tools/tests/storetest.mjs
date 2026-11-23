// 福利社與報帳處（11/24 改版：福利社只賣道具、原價、每站兩件；報帳處半價、稀有道具、強化、特訓、素質、調派）。node tools/tests/storetest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (job = null) => { const run = R.newRun(R.mulberry(5), 'kui', 'draft', 'office', 0, job); R.join(run, 'kevin'); R.prepare(run); return run; };
// 福利社
{ const run = mk(); run.coin = 0; ok(!R.storeOk(run, 'tea') && R.storeBuy(run, 'tea') === null, '沒錢買不了');
  run.coin = 200; const n = run.items.tea, r = R.storeBuy(run, 'tea'); ok(r && run.items.tea === n + 1 && run.coin === 200 - 25, '奶茶 25 點');
  const st = R.storeStock(run); ok(st.tac.length === 2 && st.tac.every(k => R.ITEMS[k].rare === 1), `這一站到貨兩款普通戰術道具（${st.tac}）`);
  ok(R.storeBuy(run, st.tac[0]) && run.items[st.tac[0]] === 1, '買到貨的道具'); ok(R.storeLeft(run) === 0 && !R.storeOk(run, 'coffee'), '每站最多兩件');
  run.floor++; ok(R.storeLeft(run) === 2 && R.storeOk(run, 'bento'), '下一站重新算'); R.storeBuy(run, 'bento'); run.floor++; ok(!R.storeOk(run, 'bento'), '便當每張地圖一個');
  ok(!R.storeList(run).some(k => R.ITEMS[k].rare >= 2 && k !== 'bento'), '福利社不賣稀有道具'); }
// 報帳處
{ const run = mk(); run.coin = 1000; const st = R.shopStock(run); ok(st.cheap.length === 2 && st.rare.length === 3 && st.up2 && st.up3, '報帳處貨架：兩格半價、三格稀有、進階、核心');
  ok(R.UPGRADES[st.up2].tier === 2 && R.UPGRADES[st.up3].tier === 3, '進階是進階、核心是核心');
  const k0 = st.cheap[0], p0 = R.shopPrice(run, 'cheap0'); ok(p0 === R.itemCost(run, k0, 'shop') && p0 <= Math.ceil((R.itemCost(run, k0, 'store') ?? 999) / 2) + (k0 === 'bento' ? 0 : 0), `${k0} 半價 ${p0}`);
  ok(R.buy(run, 'cheap0') && run.items[k0] >= 1 && !R.shopOk(run, 'cheap0'), '買過的格子不能再買');
  const c0 = run.coin; ok(R.buy(run, 'up3') && run.picks.includes(st.up3) && run.coin === c0 - 150, '核心 150 點');
  const old = st.up2; ok(R.buy(run, 'reroll', 'up2') && st.up2 !== old && st.rerolled && !R.shopOk(run, 'reroll', 'up2'), '換一格強化（一次）');
  ok(R.buy(run, 'boost', 'atk') && R.boostLv(run, 'atk') === 1 && !R.shopOk(run, 'boost', 'def'), '素質每次來買一項');
  const n = run.roster.length, d = R.buy(run, 'draw'); ok(d && d.joined && run.roster.length === n + 1, `內部調派：${d && d.joined}`);
  const tr = R.offerTrain(run)[0]; ok(R.buy(run, 'train', tr) && R.isPlus(run, tr[0], tr[1]), '特訓');
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run))), R.mulberry(5)); ok(back && JSON.stringify(back.run.shop) === JSON.stringify(run.shop), '報帳處的貨存檔讀回來一樣'); }
{ const run = mk('buyer'); run.coin = 500; const st = R.shopStock(run); ok(!R.shopOk(run, 'up2') && !R.shopOk(run, 'up3'), '採購主任：報帳處不能買強化'); ok(R.itemCost(run, 'tea', 'store') === Math.ceil(25 * .75), '採購主任：道具 75 折'); }
// 名冊滿了的調派
{ const run = mk(); while (run.roster.length < 6) R.join(run, R.drawPool(run)[0]); run.coin = 500; const r2 = R.buy(run, 'draw'); ok(r2 && r2.pend && run.drawPend === r2.pend && run.roster.length === 6, '名冊滿了：先調來再決定');
  const out = run.roster.find(h => h !== run.starter), r3 = R.storeSettle(run, out); ok(r3 && r3.joined === r2.pend && !run.roster.includes(out), `${out} 回公司，${r2.pend} 加入`); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
