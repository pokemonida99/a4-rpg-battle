import * as R from '../../js/rules.js';
const mk = (stage, seed = 3) => { const run = R.newRun(R.mulberry(seed), 'kui', 'draft'); for (const h of ['kevin', 'mi', 'heilun']) R.join(run, h); const fl = R.MAP.findIndex(f => f.some(nd => (nd.pool || []).includes(stage))), nd = R.MAP[fl].find(nd => (nd.pool || []).includes(stage)); run.alt[nd.stage] = stage; run.floor = fl; run.node = nd; const s = R.newState(run); R.startRound(s); return s; };
const ok = (c, m) => console.log((c ? 'OK  ' : 'BAD ') + m); let s, r, m;
// 大媽：招式一半、普攻照常、預估一致
s = mk('crowd_a'); m = Object.keys(s.kind).find(k => s.kind[k] === 'auntie'); s.rand = () => .5;
{ const pvA = R.preview(s, 'kui', m), pvS = R.preview(s, 'kui', m, 'draft'), pvD = R.preview(s, 'kui', 'ma', 'draft'); ok(pvS * 2 === pvD || Math.abs(pvS * 2 - pvD) <= 1, `大媽 招式預估 ${pvS}，小兵 ${pvD}，普攻 ${pvA}`);
  const h0 = s.hp[m]; r = R.doAttack(s, 'kui', m); ok(!r.hits[0].dull && Math.abs(r.hits[0].v - pvA) < pvA * .6, `大媽 普攻 ${r.hits[0].v}`); r = R.doSkill(s, 'kui', 'draft', m); ok(r.hits.every(h => h.dull), `大媽 招式 ${r.hits.map(h => h.v)} 標記 dull`); ok(!s.inSkill, 'inSkill 有關掉'); }
// 阿北：被打中 → 普攻減半 → 行動後散；用招式不受影響；阿北倒下也散
s = mk('crowd_s'); m = Object.keys(s.kind).find(k => s.kind[k] === 'smoker'); s.rand = () => .5;
{ r = R.enemyTurn(s, m); const who = r.hits[0].dst; ok(r.hits[0].smoke && R.smoked(s, who), `阿北打中 ${who}，嗆到`); const pv0 = R.preview(s, who, 'ma'); r = R.doAttack(s, who, 'ma'); ok(r.smoked && !R.smoked(s, who), `嗆到的普攻 ${r.hits[0].v}（預估 ${pv0}），打完散了`); const pv1 = R.preview(s, who, 'ma'); ok(pv1 === pv0 * 2 || Math.abs(pv1 - pv0 * 2) <= 1, `散了之後預估 ${pv1}`);
  r = R.enemyTurn(s, m); const w2 = r.hits[0].dst; s.hp[m] = 0; ok(!R.smoked(s, w2), '阿北倒下，煙散'); }
// 豬腦：大招威力
s = mk('pig'); s.rand = () => .5;
{ ok(R.bragPow(s) === 1.5, `豬腦 滿底氣 ${R.bragPow(s)}`); while (!s.charging) { r = R.enemyTurn(s, 'boss'); } ok(r.kind === 'charge', '豬腦蓄力'); R.doAttack(s, 'kui', 'boss'); R.doAttack(s, 'kui', 'boss'); ok(Math.abs(R.bragPow(s) - (.5 + s.shield / 7)) < 1e-9 && s.shield <= 5, `削兩點 → ${R.bragPow(s).toFixed(2)}，意圖 ${JSON.stringify(R.intent(s, 'boss'))}`);
  for (let i = 0; i < 5; i++) R.doAttack(s, 'kui', 'boss'); ok(s.broken && R.bragPow(s) === .5, `削到理虧 → ${R.bragPow(s)}`); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'stunned' && s.charging && R.bragPow(s) === .5, `理虧後底氣回滿，威力還是 ${R.bragPow(s)}`); const hp0 = s.hp.kui; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossUlt' && r.pow === .5, `大招 pow ${r.pow}，小葵 −${hp0 - s.hp.kui}（滿威力基準 ${R.BOSS_ULT.kui}）`); }
// 猴子：蓄力指定、打倒落空；沒小兵先叫一隻
s = mk('monkey'); s.rand = () => .5;
{ while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(r.kind === 'charge' && r.proj && !r.called, `猴子蓄力，專案 ${r.proj}`); ok(R.intent(s, 'boss').proj === r.proj && !R.intent(s, 'boss').lost, '意圖有 proj'); const p = r.proj; s.hp[p] = 1; const a = R.doAttack(s, 'kui', p); ok(a.hits[0].kill && a.hits[0].projDown, '打倒專案 projDown'); ok(R.intent(s, 'boss').lost, '意圖 lost'); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'ultMiss' && !s.charging && s.proj === null, `大招落空 ${r.kind}`);
  for (const x of R.MINIONS) s.hp[x] = 0; while (!s.charging) r = R.enemyTurn(s, 'boss'); ok(r.kind === 'charge' && r.called && r.proj === r.called && s.hp[r.called] > 0, `沒小兵先叫 ${r.called}`); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossUlt', `專案活著 → ${r.kind}`); }
// 鸚鵡：附議、落空
s = mk('parrot'); s.rand = () => .5;
{ const e = s.echo, it = R.intent(s, 'boss'); ok(e && it.kind === 'echo' && it.echo === e, `鸚鵡附議 ${e}（${s.kind[e]}）意圖 ${JSON.stringify(it)}`); r = R.enemyTurn(s, 'boss'); ok(r.echo === e && (r.kind === 'bossAtk' || r.kind === 'foeHeal'), `附議結果 ${r.kind} ${JSON.stringify((r.hits || [])[0] || { v: r.v, dst: r.dst })}`);
  const e2 = s.echo; ok(e2, `下一次附議 ${e2}`); s.hp[e2] = 0; ok(R.intent(s, 'boss').lost, '意圖 lost'); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'echoMiss', `落空 ${r.kind}`);
  for (const x of R.MINIONS) s.hp[x] = 0; s.echo = null; s.bossTurns = 0; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossAtk' && !r.echo, `沒小兵 → 自己打 ${r.kind}`);
  s = mk('parrot', 11); s.rand = () => .5; const it2 = Object.keys(s.kind).find(k => s.kind[k] === 'intern'); s.echo = it2; s.hp.boss -= 9000; const iv = R.intent(s, 'boss'); r = R.enemyTurn(s, 'boss'); ok(iv.act === 'heal' && r.kind === 'foeHeal' && r.dst === 'boss', `附議實習生 → 補血 ${r.v}`); }
// 存檔帶著 alt；舊存檔沒有 alt 也讀得回來
{ const run = R.newRun(R.mulberry(5), 'kui', null); R.prepare(run); const sv = R.saveRun(run), back = R.loadRun(JSON.parse(JSON.stringify(sv)), R.mulberry(1)); ok(back && JSON.stringify(back.run.alt) === JSON.stringify(run.alt), `存檔 alt ${JSON.stringify(run.alt)}`); const old = JSON.parse(JSON.stringify(sv)); delete old.alt; const b2 = R.loadRun(old, R.mulberry(1)); ok(b2 && Object.keys(b2.run.alt).length === 0 && R.stageOf(b2.run, R.MAP[5][0]) === 'chief', '舊存檔沒有 alt → 打原本那一場'); ok(R.loadRun({ ...sv, alt: { chief: 'boss' } }) === null, '亂填的 alt 會作廢'); }
