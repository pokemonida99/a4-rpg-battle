import * as R from '../../js/rules.js';
const mk = (stage, seed = 3) => { const run = R.newRun(R.mulberry(seed), 'kui', 'draft', 'taiwan'); for (const h of ['kevin', 'mi', 'heilun']) R.join(run, h); const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage)); run.floor = fl; run.node = R.MAP[fl].find(nd => nd.stage === stage); for (let k = 0; k < fl; k++) run.path[k] = 0; const s = R.newState(run); R.startRound(s); return s; };
const ok = (c, m) => console.log((c ? 'OK  ' : 'BAD ') + m); let s, r;
// 路線：三條支線、相鄰才換得過去
{ const run = R.newRun(R.mulberry(1), 'kui', null, 'taiwan'); R.prepare(run); ok(R.MAP.length === 12, '12 站'); R.enterNode(run, 0); R.advance(run); ok(R.reachable(run).join() === '0,1,2', '第 2 站三選一'); R.enterNode(run, 0); R.advance(run); ok(R.reachable(run).join() === '0,1', '走上路 → 下一層只能上、中'); R.enterNode(run, 1); R.advance(run); ok(R.reachable(run).join() === '0,1,2', '走中路 → 三條都行');
  const sv = R.saveRun(run), back = R.loadRun(JSON.parse(JSON.stringify(sv)), R.mulberry(2)); ok(back && back.run.map === 'taiwan' && back.run.floor === 3 && R.reachable(back.run).join() === '0,1,2', '台灣篇存檔讀得回來'); }
// 小兵換皮
s = mk('tw_plaza'); ok(s.kind.ma === 'tw_knight' && R.KINDS[s.kind.ma].armor === .5 && R.KINDS.tw_drone.name === '燈彩值班兵' && s.kind.md === 'tw_drone', `換皮小兵 ${Object.values(s.kind)}`);
// 背鍋
s = mk('tw_pot'); s.rand = () => .5;
{ while (!s.charging) r = R.enemyTurn(s, 'boss'); const w = r.wok; ok(r.kind === 'charge' && w && R.intent(s, 'boss').wok === w, `蓄力，鍋在 ${w}`); const hp0 = { ...s.hp }; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossUlt' && r.single === w && r.hits.length === 1 && r.hits[0].dst === w, `沒防禦：只打 ${w} −${hp0[w] - s.hp[w]}`);
  s.bossTurns = 1; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'charge', '再蓄力'); const w2 = r.wok, b0 = s.hp.boss; R.doDefend(s, w2); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'wokBack' && s.broken && s.hp.boss < b0 && s.hp[w2] > 0, `防禦：彈回去，頭目 −${b0 - s.hp.boss}，理虧`); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'stunned', '下一次行動取消'); }
// 服務費
s = mk('tw_night'); s.rand = () => .5;
{ ok(s.sign === 3, '招牌 3 格'); const sp0 = s.sp.kui; r = R.doSkill(s, 'kui', 'draft', 'boss'); ok(r.fee === 10 && sp0 - s.sp.kui === 30, `招式多扣 ${r.fee}`); for (let i = 0; i < 3; i++) r = R.doAttack(s, 'kevin', 'boss'); ok(s.sign === 0 && r.hits[0].sign === 0, '普攻三下打熄'); const sp1 = s.sp.kui; r = R.doSkill(s, 'kui', 'draft', 'boss'); ok(!r.fee && sp1 - s.sp.kui === 20, '熄了之後不加收'); while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(s.sign === 3 && r.sign === 3, '蓄力時重新點亮'); }
// 加蓋
s = mk('tw_roof'); s.rand = () => .5;
{ ok(s.layers === 1 && R.roofPow(s) === 1.1, '開場 1 層 110%'); r = R.enemyTurn(s, 'boss'); ok(s.layers === 2, '行動一次 +1 層'); r = R.doSkill(s, 'kui', 'draft', 'boss'); ok(s.layers === 1 && r.hits.filter(h => h.layerDown != null).length === 1, '一招（兩刀）只拆一層'); r = R.doAttack(s, 'kui', 'boss'); ok(s.layers === 1, '普攻不拆'); s.layers = 3; r = R.enemyTurn(s, 'boss'); ok(s.layers === 3, '最多三層'); while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(Math.abs(R.intent(s, 'boss').pow - 1.9) < 1e-9, `大招 ${R.intent(s, 'boss').pow.toFixed(2)}`); }
