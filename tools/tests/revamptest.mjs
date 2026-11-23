// 11/24 系統改版：新道具、核心強化、過關三格獎勵。node tools/tests/revamptest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const mk = (picks = [], job = null) => { const run = R.newRun(R.mulberry(11), 'kui', 'draft', 'office', 0, job); for (const h of ['kevin', 'mi', 'jie', 'heilun']) R.join(run, h); for (const k of picks) R.applyUpgrade(run, k); R.prepare(run); return run; };
const fight = (run, stage = 'chief') => { const f = R.MAP.findIndex(fl => fl.some(nd => nd.stage === stage || (nd.pool || []).includes(stage))); run.floor = f; run.node = R.MAP[f].find(nd => nd.stage === stage || (nd.pool || []).includes(stage)); if (run.node.pool) run.alt[run.node.stage] = stage; const s = R.newState(run); R.startRound(s); return s; };
const minion = s => R.MINIONS.find(m => R.alive(s, m));
// 道具：每一種都用得出來
for (const k of Object.keys(R.ITEMS)) { const run = mk(); run.items[k] = 1; const s = fight(run); s.hp.kevin = 1500; s.sp.kevin = 10; if (R.ITEMS[k].revive) s.hp.kevin = 0; const t = R.itemTargets(s, k, 'kui');
  ok(t.length > 0, `${k} 有對象`); let r; try { r = R.doItem(s, 'kui', k, t[0] === 'all' ? null : R.ITEMS[k].aim === 'foe' ? (t.includes('boss') && !R.guarded(s) ? 'boss' : t[0]) : t.includes('kevin') ? 'kevin' : t[0]); } catch (e) { ok(false, `${k} 出錯 ${e.message}`); continue; } ok(r && r.kind === 'item' && s.items[k] === 0, `${k} 用掉了`); }
{ const s = fight(mk()), m = minion(s), hp = s.hp[m]; R.doItem(s, 'kui', 'stapler', m); ok(s.hp[m] < hp, '訂書機打得到人'); }
{ const s = fight(mk()); s.items.notice = 1; const m = minion(s); R.doItem(s, 'kui', 'notice', m); ok(s.stun[m], '散會通知：小兵暈眩'); }
{ const s = fight(mk(), 'crowd'); s.items.highlighter = 1; R.doItem(s, 'kui', 'highlighter', null); ok(R.foes(s).every(f => s.mark[f] > 0), '螢光筆：全體標記'); }
{ const run = mk(); const s = fight(run, 'chief'); for (const m of R.MINIONS) s.hp[m] = 0; s.items.stamp = 1; const sh = s.shield; R.doItem(s, 'kui', 'stamp', 'boss'); ok(s.shield === sh - 1 && s.mark.boss > 0, '主管紅章：頭目標記、底氣 -1'); }
{ const s = fight(mk()); s.items.poncho = 1; s.ward = {}; R.doItem(s, 'kui', 'poncho', null); ok(R.FRONT.filter(h => R.alive(s, h)).every(h => s.ward[h] >= 600), '輕便雨衣：前排護盾'); }
{ const s = fight(mk()); s.items.tonic = 1; s.mo = 10; R.doItem(s, 'kui', 'tonic', null); ok(s.mo >= 35, '提神飲料：氣勢 +25'); }
// 核心強化
{ const s = fight(mk(['express'])); const q0 = s.queue.length, r = R.doItem(s, 'kui', 'tea', 'kui'); ok(r.quick && s.queue[0] === 'kui' && s.freeTurn === 'kui', '急件快遞：用完道具接著再動'); ok(R.beginTurn(s, 'kui') && !s.freeTurn, '快用之後的行動不會重設'); s.items.tea = 2; const r2 = R.doItem(s, 'kui', 'tea', 'kevin'); ok(!r2.quick, '每場只有第一件'); }
{ const s = fight(mk(['relay'])); s.sp.mi = 0; const m = minion(s); const r = R.doAttack(s, 'kui', m); ok((r.fxs || []).some(x => x.t === 'sp' && x.why === '茶水間接力'), '茶水間接力：普攻後別人回 SP'); }
{ const s = fight(mk(['notes'])); const m = minion(s), r = R.doAttack(s, 'kui', m); ok(!R.alive(s, m) || s.mark[m] > 0, '小組共筆：普攻標記'); }
{ const s = fight(mk(['nap'])); s.ward = {}; R.doDefend(s, 'kevin'); ok(s.ward.kevin >= 500 && s.guardian === 'kevin' && s.lunch.kevin, '午休守門員：防禦得到護盾、吸引攻擊'); R.startRound(s); R.beginTurn(s, 'kevin'); const m = minion(s), r = R.doAttack(s, 'kevin', m); ok(r.nap || !R.alive(s, m), '下一次普攻多打一下'); }
{ const s = fight(mk(['rota'])); s.hp.mi = 500; const r = R.doDefend(s, 'kevin'); ok((r.fxs || []).some(x => x.t === 'heal' && x.dst === 'mi'), '公假輪休：防禦幫血最少的人回血'); }
{ const s = fight(mk(['cosign'])); s.L && (s.L.firm = false); const sh = s.shield; R.doSkill(s, 'kui', 'deadline', 'boss'); }
{ const s = fight(mk(['seal'])); s.shield = 1; s.broken = false; for (const m of R.MINIONS) s.hp[m] = 0; const r = R.doAttack(s, 'jie', 'boss'); if (s.broken) { ok(s.sealed, '議程封存：理虧後記下'); const sk = R.SKILLS.kui.find(k => k.key === 'draft'); ok(R.spCost(s, 'kui', sk) === Math.ceil(R.skCost(s.run, 'kui', sk) * .5), '下一招 SP 半價'); } }
{ const s = fight(mk(['drill'])); const m = minion(s), r = R.doSkill(s, 'jie', 'burn', m); ok(!R.alive(s, m) || (r.hits || []).some(h => h.drill), '火災演習：灼燒時追加火傷'); }
{ const run = mk(['shift']); R.join(run, 'qiang'); const s = fight(run); const sub = R.bench(s)[0]; if (sub) { const r = R.doSwap(s, 'kevin', sub); ok((r.fxs || []).some(x => x.t === 'ward' && x.v === 600), '輪班表：換上來的人得到護盾'); } }
// 過關三格獎勵
{ const run = mk(); run.floor = 1; run.node = R.MAP[1][0]; run.path[0] = 0; run.path[1] = 0; const rw = R.offerReward(run); ok(rw.opts.length === 3 && new Set(rw.opts.map(o => o.t === 'up' ? 'up' : o.t === 'items' ? 'items' : 'grow')).size === 3, `一般戰三格不同類別（${rw.opts.map(o => o.t)}）`);
  const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run, { pend: 'upgrade' }))), R.mulberry(1)); ok(back && JSON.stringify(back.run.reward) === JSON.stringify(rw), '三格存檔讀回來一樣'); const c = run.coin; R.applyReward(run, -1); ok(run.coin === c + rw.skip, '都不要：領額度'); }
{ let core = 0; for (let i = 0; i < 20; i++) { const run = R.newRun(R.mulberry(100 + i), 'kui', 'draft'); R.join(run, 'kevin'); run.node = { tag: '頭目' }; run.floor = 5; const rw = R.offerReward(run); if (rw.opts.some(o => o.t === 'up' && R.UPGRADES[o.key].tier === 3)) core++; } ok(core === 20, `頭目一定給核心（${core}/20）`); }
{ const run = mk(); run.node = { type: 'gift' }; run.floor = 2; const rw = R.offerReward(run), tg = rw.opts.map(o => R.UP_TAG[o.key]); ok(rw.opts.length === 3 && new Set(tg).size === 3 && rw.opts.filter(o => R.UPGRADES[o.key].tier === 3).length <= 1, `福委會三個不同標籤、最多一個核心（${tg}）`); }
ok(!Object.keys(R.UPGRADES).some(k => R.UPGRADES[k].old && R.upOk(mk(), k)), '退休的強化不會再出現');
// GPT 第三輪：組合包、核心搭檔補給、職位交接包、戰前加簽
{ let named = 0; for (let i = 0; i < 40; i++) { const r = R.newRun(R.mulberry(50 + i), 'kui', 'draft'); r.floor = 1; r.node = R.MAP[1][0]; r.path = [0, 0]; const o = R.offerReward(r).opts.find(o => o.t === 'items'); if (o && o.name) { named++; ok(R.PACKS.some(P => P.name === o.name && P.items.every(k => o.items[k] === 1)), `組合包內容對：${o.name}`); } } ok(named >= 8 && named <= 32, `組合包大約一半（${named}/40）`); }
{ const run = mk(); const n = run.items.warmer || 0; R.applyUpgrade(run, 'drill'); ok(run.items.warmer === n + 1, '火災演習附暖暖包'); }
ok(mk([], 'fire').items.notice === 1 && mk([], 'risk').items.poncho === 1 && mk([], 'buyer').items.highlighter === 1, '職位交接包');
{ const run = mk(); run.coin = 100; ok(R.buy(run, 'sign', 'down') && !R.shopOk(run, 'sign', 'mo'), '戰前加簽：買一張、不能累積'); const back = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run))), R.mulberry(2)); ok(back && back.run.next && back.run.next.sign === 'down', '加簽存檔讀回來還在'); const s = fight(run); ok(R.foes(s).every(f => s.atkDown[f] > 0) && !run.next, '稽核加簽：開場敵人降攻，用掉了'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
