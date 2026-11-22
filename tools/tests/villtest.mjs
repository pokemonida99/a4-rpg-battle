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
// ---- v0.48：一般行程六位頭目的新打法（design/boss2/README.md）與輔助小兵 ----
const ultOf = () => { let a; do { a = R.enemyTurn(s, 'boss'); } while (a.kind === 'stunned'); return a; }, toCharge = () => { let a; do { a = R.enemyTurn(s, 'boss'); } while (!s.charging && !s.over); return a; };
// 豬腦（搶功）：打倒小兵 → 攻擊 ＋20%、底氣 −2；放完大招歸零
s = mk('pig'); s.rand = () => .5;
{ ok(R.MINIONS.length === 3 && s.kind.mc === 'sup_office', `三隻小兵，第三隻是補給員（${R.MINIONS.map(x => s.kind[x])}）`); const sh0 = s.shield, x = R.MINIONS[0]; s.hp[x] = 1; r = R.doAttack(s, 'kui', x); ok(r.hits[0].kill && r.hits[0].credit === 1 && s.credit === 1 && s.shield === sh0 - 2 && r.hits[0].bossShield === s.shield && Math.abs(R.creditK(s) - 1.2) < 1e-9, `豬腦搶功 1 層，底氣 ${sh0} → ${s.shield}`);
  r = toCharge(); ok(r.kind === 'charge' && r.locks && r.locks.length === 3, '豬腦蓄力也出屬性鎖'); r = ultOf(); ok(r.kind === 'bossUlt' && r.creditOff === 1 && s.credit === 0, '放完大招，搶功歸零'); }
// 猴子（改需求）：每回合換一組弱點，第一個一定是我方打得出來的
s = mk('monkey');
{ const w1 = R.weakOf(s, 'boss').slice(), mine = [...new Set(R.FRONT.flatMap(h => R.typesOf(s, h)))]; ok(w1.length === 2 && w1[0] !== w1[1] && mine.includes(w1[0]) && s.events.some(e => e.kind === 'shift'), `猴子第一回合弱點 ${w1}（我方打得出 ${mine}）`); R.startRound(s); const w2 = R.weakOf(s, 'boss'); ok(w2.length === 2 && !w2.some(t => w1.includes(t)), `第二回合換成 ${w2}`);
  s.rand = () => .5; const who = R.FRONT.find(h => R.ATK_TYPE[h] === w2[0]) || R.FRONT.find(h => w2.includes(R.ATK_TYPE[h])); if (who) { r = R.doAttack(s, who, 'boss'); ok(r.hits[0].wk, `${who} 打中現在的弱點`); } r = toCharge(); ok(r.kind === 'charge' && !r.proj && r.locks, '猴子不再綁臨時專案'); }
// 鸚鵡（複誦）：上一個指令打中他的屬性，接下來只吃一半
s = mk('parrot'); s.rand = () => .5;
{ r = R.doAttack(s, 'kui', 'boss'); const v1 = r.hits[0].v; ok(!r.hits[0].mimic && R.mimicOf(s) === 'slash', `第一下 ${v1}，他學會斬`); const pv1 = R.preview(s, 'kui', 'boss'); r = R.doAttack(s, 'kui', 'boss'); ok(r.hits[0].mimic && Math.abs(r.hits[0].v * 2 - v1) <= 2, `同屬性第二下減半 ${r.hits[0].v}`); ok(Math.abs(pv1 * 1.3 - r.hits[0].v) <= 2, `預估也減半（${pv1}，弱點 ×1.3）`);
  r = R.doAttack(s, 'kevin', 'boss'); ok(!r.hits[0].mimic && R.mimicOf(s) === 'blunt', '換屬性不減半，改學打'); r = R.doAttack(s, 'kui', 'boss'); ok(!r.hits[0].mimic, '再回來用斬，不減半了'); ok(R.intent(s, 'boss').kind !== 'echo', '不再附議小兵'); }
// 甩鍋課長：鍋掛在誰身上大招就打誰；背鍋的人普攻打課長，鍋甩回去、大招落空
s = mk('chief'); s.rand = () => .5;
{ r = toCharge(); const w = s.wok, it = R.intent(s, 'boss'); ok(r.kind === 'charge' && R.FRONT.includes(w) && !r.locks && it.wok === w && it.wokPass, `課長蓄力，鍋在 ${w}`); const other = R.FRONT.find(h => h !== w); R.doAttack(s, other, 'boss'); ok(s.wok === w, '別人打課長，鍋不動'); const a = R.doAttack(s, w, 'ma'); ok(s.wok === w && !a.wokPass, '背鍋的人打小兵，鍋不動');
  const b = R.doAttack(s, w, 'boss'); ok(b.wokPass && s.wok === 'boss' && R.intent(s, 'boss').wokBack, '背鍋的人普攻打課長：鍋甩回去'); r = ultOf(); ok(r.kind === 'ultMiss' && r.wokBack && !s.charging, `大招落空（${r.kind}）`);
  r = toCharge(); const w2 = s.wok, hp0 = s.hp[w2], rest = R.FRONT.filter(h => h !== w2), o0 = rest.map(h => s.hp[h]); r = ultOf(); ok(r.kind === 'bossUlt' && r.single === w2 && s.hp[w2] < hp0 && rest.every((h, i) => s.hp[h] === o0[i]), `沒甩回去：大招只打 ${w2}`); ok(!R.STAGES.chief.boss.pot, '不再甩給小兵'); }
// 考績魔導士：大招把氣勢扣光
s = mk('audit'); s.rand = () => .5;
{ s.mo = 95; r = toCharge(); ok(R.intent(s, 'boss').drain, '意圖：扣光氣勢'); r = ultOf(); ok(r.kind === 'bossUlt' && r.moLoss === 95 && s.mo === 0, `考績大招扣光氣勢（−${r.moLoss}）`); }
// 奧客總經理：每回合貼客訴單，防禦撕掉，大招對每張單 ＋50%
{ const run = R.newRun(R.mulberry(3), 'kui', 'draft'); for (const h of ['kevin', 'mi', 'heilun']) R.join(run, h); run.floor = R.MAP.length - 1; run.node = R.MAP[run.floor][0]; s = R.newState(run); s.rand = () => .5; R.startRound(s);
  const t1 = R.FRONT.filter(h => R.ticketsOf(s, h)); ok(t1.length === 1 && !R.guarded(s) && s.kind.mc === 'sup_office', `總經理不護衛了；第一回合貼單給 ${t1}`); const w = t1[0]; r = R.doDefend(s, w); ok(r.ticketOff === 1 && !R.ticketsOf(s, w), '防禦一次撕掉'); R.beginTurn(s, w);
  R.startRound(s); R.startRound(s); ok(R.ticketsOf(s, w) === 2, `同一個人最多兩張（${R.ticketsOf(s, w)}）`); R.startRound(s); ok(R.ticketsOf(s, w) === 2 && R.FRONT.filter(h => R.ticketsOf(s, h)).length === 2, '滿了就貼別人');
  r = toCharge(); for (const h of R.FRONT) s.hp[h] = R.STAT[h].hp; ok(R.intent(s, 'boss').tickets === 2, '意圖：有客訴單'); r = ultOf(); const v2 = r.hits.find(h => h.dst === w).v; ok(r.kind === 'bossUlt' && r.tickets[w] === 2 && !R.ticketsOf(s, w), `大招算帳：${w} 兩張單 −${v2}`); r = toCharge(); for (const h of R.FRONT) s.hp[h] = R.STAT[h].hp; r = ultOf(); const v0 = r.hits.find(h => h.dst === w).v; ok(!r.tickets && Math.abs(v2 / v0 - 2) < .12, `沒單的時候 −${v0}（兩張單是 ${(v2 / v0).toFixed(2)} 倍）`); }
// 底氣要打中弱點才削得動（firm）：甩鍋課長怕火、打
s = mk('chief'); s.rand = () => .5;
{ const sh0 = s.shield; r = R.doAttack(s, 'kui', 'boss'); ok(s.L.firm && r.hits[0].firm && s.shield === sh0, `小葵的斬不是弱點：底氣不動（${sh0}→${s.shield}）`); r = R.doAttack(s, 'kevin', 'boss'); ok(r.hits[0].wk && !r.hits[0].firm && s.shield === sh0 - 2, `Kevin 的打是弱點：底氣 ${sh0}→${s.shield}`); ok(!R.STAGES.tw_pot.boss.firm && !R.STAGES.m_kevin.boss.firm, '還沒重新設計的頭目照舊'); }
// 輔助小兵：沒人受傷先打氣；有人受傷就補（不補自己）；頭目出手用掉打氣
s = mk('chief'); s.rand = () => .5;
{ let it = R.intent(s, 'mc'); r = R.enemyTurn(s, 'mc'); ok(it.kind === 'cheer' && r.kind === 'foeCheer' && s.fup.boss, '沒人受傷：幫頭目打氣'); s.hp.ma -= 1500; it = R.intent(s, 'mc'); r = R.enemyTurn(s, 'mc'); ok(it.kind === 'heal' && it.target === 'ma' && r.kind === 'foeHeal' && r.dst === 'ma' && r.v > 0, `頭目打過氣、有人受傷：補血 ${r.v}`);
  ok(R.intent(s, 'boss').hyped, '頭目的意圖帶著打氣'); r = R.enemyTurn(s, 'boss'); ok(r.kind === 'bossAtk' && r.cheered && !s.fup.boss, '頭目出手，打氣用掉'); s.hp.ma = R.STAT.ma.hp; s.hp.mc -= 300; r = R.enemyTurn(s, 'mc'); ok(r.kind === 'foeCheer', `只有自己受傷：不補自己，改打氣（${r.kind}）`); }
// 存檔帶著 alt；舊存檔沒有 alt 也讀得回來
{ const run = R.newRun(R.mulberry(5), 'kui', null); R.prepare(run); const sv = R.saveRun(run), back = R.loadRun(JSON.parse(JSON.stringify(sv)), R.mulberry(1)); ok(back && JSON.stringify(back.run.alt) === JSON.stringify(run.alt), `存檔 alt ${JSON.stringify(run.alt)}`); const old = JSON.parse(JSON.stringify(sv)); delete old.alt; const b2 = R.loadRun(old, R.mulberry(1)); ok(b2 && Object.keys(b2.run.alt).length === 0 && R.stageOf(b2.run, R.MAP[5][0]) === 'chief', '舊存檔沒有 alt → 打原本那一場'); ok(R.loadRun({ ...sv, alt: { chief: 'boss' } }) === null, '亂填的 alt 會作廢'); }
