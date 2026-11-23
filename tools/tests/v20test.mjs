import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); };
const mk = (af, stage = 'audit') => { const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'heilun']) R.join(run, h); run.alt = {}; const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage)); run.floor = fl; run.node = R.MAP[fl].find(nd => nd.stage === stage); for (let q = 0; q < fl; q++) run.path[q] = 0; run.affix = { [fl]: af }; const s = R.newState(run); R.startRound(s); s.rand = () => .5; return s; };
let s, r;
{ const base = mk(null).constructor; }
{ const a = mk('late'), b = mk('rush'); ok(Math.round(R.STAT.boss.atk) > 0 && a.affix === 'late', '詞綴記在戰鬥狀態'); const atkLate = (mk('late'), R.STAT.boss.atk), atkNone = (mk('rush'), R.STAT.boss.atk); ok(Math.abs(atkLate / atkNone - 1.2) < .01, `加班中：頭目攻擊 ${atkNone} → ${atkLate}`); }
s = mk('armor'); ok(s.fward.boss === 600 && s.fward.ma === 600, '公文護體：全體 600 護盾');
s = mk('rush'); ok(s.queue[0] === 'ma' || s.queue[0] === 'mb', `急件插隊：${s.queue[0]} 先動`);
s = mk('toxic'); s.plan.ma = 'kui'; r = R.enemyTurn(s, 'ma'); ok(s.hpoison.kui && r.hits[0].hex === '中毒', '帶毒附件：小兵打中會中毒');
s = mk('crunch'); ok(R.rage(s) === 1, '連夜趕件：前兩回合正常'); s.round = 3; ok(R.rage(s) === 1.25, '第三回合 ×1.25');
s = mk(null); s.round = 12; ok(R.rage(s) === 1, '第 12 回合還沒懲罰'); s.round = 15; ok(Math.abs(R.rage(s) - 1.3) < 1e-9, '第 15 回合 ×1.3');
// 獎勵
s = mk('late'); s.hp.boss = 0; s.over = 'win'; { const n0 = s.run.picks.length; R.endStage(s, s.run); ok(s.run.picks.length === n0 + 1 && /強化/.test(s.run.lastReward), `打贏：${s.run.lastReward}`); }
s = mk('armor'); s.over = 'win'; R.endStage(s, s.run); ok(s.run.plus.length === 1 && /升級成＋/.test(s.run.lastReward), s.run.lastReward);
// 防禦加速
s = mk(null); R.doDefend(s, 'kevin'); ok(s.quick.kevin, '防禦後記下來'); R.startRound(s); { const iK = s.queue.indexOf('kevin'); ok(iK >= 0 && !s.quick.kevin, `下回合 Kevin 排第 ${iK + 1}（速度 142×1.2＝170，還是比 180 的小兵慢）`); }
// 套裝
{ const run = R.newRun(R.mulberry(1), 'kui', 'draft'); for (const k of ['cutter', 'thermos']) R.applyUpgrade(run, k); ok(!R.setOn(run, '火力') && R.tagCount(run, '火力') === 2, '火力 2／3'); R.applyUpgrade(run, 'redpen'); ok(R.setOn(run, '火力'), '火力湊齊'); for (const k of ['tabs', 'carbon', 'notebook']) R.applyUpgrade(run, k); ok(R.skCost(run, 'kui', R.SKILLS.kui[0]) === Math.ceil(20 * .9 * 1.2), `技巧套裝＋紅筆：先出一版 SP ${R.skCost(run, 'kui', R.SKILLS.kui[0])}`); }
// 下一場戰鬥的加成
{ const run = R.newRun(R.mulberry(1), 'kui', 'draft'); R.prepare(run); R.applyEvent(run, 'general_chair_repair', 1); ok(run.next && run.next.ward === 300, '事件：下一場先上 300 護盾'); const sv = R.loadRun(JSON.parse(JSON.stringify(R.saveRun(run)))); ok(sv.run.next.ward === 300, '存檔帶著'); const s2 = R.newState(run); ok(s2.ward.kui === 300 && run.next === null, '進場就用掉'); }
// 事件抽選：地圖專屬
{ let tw = 0, hell = 0; for (let i = 0; i < 60; i++) { const run = R.newRun(R.mulberry(i + 1), 'kui', 'draft', 'office'); run.floor = 4; R.prepare(run); const k = run.events[4]; if (R.EVENTS[k].map) tw++; } ok(tw === 0, '一般行程不會抽到別張地圖的專屬事件'); for (let i = 0; i < 60; i++) { const run = R.newRun(R.mulberry(i + 1), 'kui', 'draft', 'hell'); run.floor = 2; R.prepare(run); const k = run.events[2]; if (R.EVENTS[k].map === 'hell') hell++; if (R.EVENTS[k].map === 'taiwan') ok(false, '地獄抽到台灣事件'); } ok(hell > 5, `地獄分公司 60 次裡抽到專屬事件 ${hell} 次`); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
