// 候補區與復活（11/21）：倒下自動換候補、候補每回合回三分之一、復活救得到候補、小米／許許／Vivi 的復活招、阿傑的招式帶攻擊下降。node tools/tests/benchtest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (team, back) => { const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office'); for (const h of team) R.join(run, h); if (back) R.setBack(run, back); R.prepare(run); run.alt = {}; run.floor = 5; run.node = R.MAP[5][0]; run.path = [0, 0, 0, 0, 0]; return run; };
const fresh = (team, back, pre) => { const run = mk(team, back); if (pre) pre(run); const s = R.newState(run); R.startRound(s); s.rand = () => .5; for (const h of R.HEROES) s.sp[h] = R.STAT[h].sp; return s; };
const SIX = ['kevin', 'mi', 'jie', 'qiang', 'xu'], sk = (id, key) => R.SKILLS[id].find(k => k.key === key), pct = (id, k) => Math.round(R.STAT[id].hp * k);
const hitTill = (s, f) => { for (let i = 0; i < 6; i++) { const r = R.enemyTurn(s, f); if (r.hits && r.hits.some(h => h && h.v > 0)) return r; } return null; };

// 倒下自動換候補
{ const s = fresh(SIX); ok(R.FRONT.join() === 'kui,kevin,mi,jie' && R.bench(s).join() === 'qiang,xu', `上場 ${R.FRONT}；候補 ${R.bench(s)}`);
  s.hp.kui = 0; s.plan.ma = 'kui'; const out = R.autoSub(s);
  ok(out.length === 1 && out[0].id === 'kui' && out[0].sub === 'qiang' && R.FRONT[0] === 'qiang' && R.HEROES[0] === 'qiang', '小葵倒下，阿強自動補上同一個位置');
  ok(s.run.hp.kui === 0 && R.bench(s).join() === 'xu' && R.benchDown(s).join() === 'kui' && s.run.roster.join() === 'qiang,kevin,mi,jie,kui,xu', `小葵倒在候補區；名冊 ${s.run.roster}`);
  ok(!s.queue.includes('kui') && !s.queue.includes('qiang') && s.plan.ma === 'qiang', '這回合阿強還不行動；敵人改瞄準他');
  ok(R.autoSub(s).length === 0, '沒人倒下就不換');
  s.queue = []; R.startRound(s); ok(s.queue.includes('qiang') && !s.queue.includes('kui'), '下一回合阿強會行動');
  s.hp.kevin = 0; ok(R.beginTurn(s, 'ma') && R.FRONT.includes('xu') && !R.FRONT.includes('kevin'), '輪到下一個人之前，規則自己會把候補換上來（模擬器不用另外叫）');
  s.hp.mi = 0; ok(R.autoSub(s).length === 0 && R.FRONT.includes('mi'), '候補沒人站著：倒下的人留在場上'); }

// 前排全倒但候補還有人：不算輸
{ const s = fresh(SIX); for (const h of ['kevin', 'mi', 'jie']) s.hp[h] = 0; s.hp.kui = 1; s.ward.kui = 0; s.plan.ma = 'kui'; const r = hitTill(s, 'ma');
  ok(r && s.hp.kui === 0 && !s.over, '前排四個都倒了，候補還有兩個人：還沒輸'); const out = R.autoSub(s);
  ok(out.length === 2 && R.FRONT.filter(h => R.alive(s, h)).join() === 'qiang,xu', `候補兩個人補上來：${R.FRONT}`);
  s.hp.qiang = 0; s.hp.xu = 1; s.ward.xu = 0; s.defend.xu = false; s.plan.ma = 'xu'; hitTill(s, 'ma'); ok(s.over === 'lose', '候補也倒光了才算輸'); }

// 候補每回合回三分之一，三回合全滿；倒下的不回
{ const s = fresh(SIX, null, run => { run.hp.qiang = 1; run.sp.qiang = 0; run.hp.xu = 0; }); const run = s.run, t = Math.ceil(R.STAT.qiang.hp / 3);
  ok(run.hp.qiang === 1 + t && run.sp.qiang === Math.ceil(R.STAT.qiang.sp / 3) && s.events.some(e => e.kind === 'bench' && e.who.includes('qiang')), '候補的阿強第一回合回了三分之一 HP 與 SP');
  s.queue = []; R.startRound(s); s.queue = []; R.startRound(s); ok(run.hp.qiang === R.STAT.qiang.hp && run.sp.qiang === R.STAT.qiang.sp, '三回合全滿');
  ok(run.hp.xu === 0 && R.benchDown(s).includes('xu'), '倒在候補區的許許不會自己回');
  s.queue = []; R.startRound(s); ok(!s.events.some(e => e.kind === 'bench'), '都滿了就沒有回復事件'); }

// 小米、許許的復活招
{ const s = fresh(SIX), rc = sk('mi', 'recall'); ok(rc && R.knows(s, 'mi', 'recall') && !R.skillOk(s, 'mi', rc), '小米會「幫您重新接通」；沒人倒下時用不了');
  s.hp.kui = 0; R.autoSub(s); ok(R.skillOk(s, 'mi', rc) && R.allyTargets(s, 'mi', rc).join() === 'kui', '小葵倒在候補區：可以選他');
  const r = R.doSkill(s, 'mi', 'recall', 'kui'); ok(s.run.hp.kui === pct('kui', .4) && r.heals[0].revive && r.heals[0].bench && R.bench(s).includes('kui') && !R.benchDown(s).length, '候補區的小葵以四成 HP 復活，回到可以換上來的名單');
  s.hp.jie = 0; R.autoSub(s); ok(R.FRONT.includes('kui') && s.hp.kui === pct('kui', .4) && R.benchDown(s).join() === 'jie', '阿傑倒下：剛救起來的小葵照名冊順序補上'); }
{ const s = fresh(['kevin', 'xu', 'jie', 'qiang', 'mi']), wk = sk('xu', 'wakeup'); s.hp.jie = 0; R.autoSub(s); const r2 = R.doSkill(s, 'xu', 'wakeup', 'jie'); ok(s.run.hp.jie === pct('jie', .3) && r2.heals[0].bench, '許許「這帖提神的」：三成 HP 復活'); ok(wk.sp < sk('mi', 'recall').sp, '許許的比較省 SP、回得比較少'); }
// 場上倒下的人（沒有候補可換）也救得到；重演認得
{ const s = fresh(['kevin', 'mi', 'jie']); s.hp.jie = 0; R.autoSub(s); ok(R.FRONT.includes('jie'), '沒有候補：阿傑留在場上'); const n = s.cmdLog.length, r = R.doSkill(s, 'mi', 'recall', 'jie');
  ok(s.hp.jie === pct('jie', .4) && r.heals[0].revive && !r.heals[0].bench, '場上的阿傑四成 HP 復活'); s.hp.jie = 0; s.sp.mi = R.STAT.mi.sp; const e = s.cmdLog[n]; ok(R.redo(s, e) && s.hp.jie === pct('jie', .4), '重演同一個指令也行'); }
// 候補被救起來之後，會補上場上倒著的位置
{ const s = fresh(['kevin', 'mi', 'jie', 'qiang']); s.hp.kui = 0; R.autoSub(s); s.hp.qiang = 0; R.autoSub(s); ok(R.FRONT[0] === 'qiang' && !R.alive(s, 'qiang') && R.benchDown(s).join() === 'kui', '阿強補上又倒下，候補沒人了');
  ok(R.allyTargets(s, 'mi', sk('mi', 'recall')).join() === 'qiang,kui', '場上的阿強、候補的小葵都能選'); R.doSkill(s, 'mi', 'recall', 'kui'); const out = R.autoSub(s); ok(out.length === 1 && out[0].sub === 'kui' && R.FRONT[0] === 'kui', '救起候補的小葵，他自動補回場上'); }

// Vivi 的復活招
{ const s = fresh(['kevin', 'jie', 'vivi']), rh = sk('vivi', 'rehire'); ok(s.back === 'vivi' && rh && R.knows(s, 'vivi', 'rehire') && !R.skillOk(s, 'vivi', rh), 'Vivi 會「誰准你下班的」；沒人倒下時用不了');
  ok(R.SKILLS.vivi.filter(k => R.backOk('vivi', k.key)).length === 1 && !R.skillOk(s, 'vivi', sk('vivi', 'treat')), 'Vivi 在場上還是只有這一招技能');
  s.hp.jie = 0; ok(R.skillOk(s, 'vivi', rh), '阿傑倒下：可以用'); const sp0 = s.sp.vivi; R.doSkill(s, 'vivi', 'rehire', 'jie'); ok(s.hp.jie === pct('jie', .5) && s.sp.vivi === sp0 - rh.sp, `五成 HP 復活，花 ${rh.sp} SP`); }

// 雞排便當、鼠仙女奧義也救得到候補；打完倒在候補的人也站起來
{ const s = fresh(SIX); s.hp.kui = 0; R.autoSub(s); ok(R.itemTargets(s, 'bento').join() === 'kui', '雞排便當可以給候補區的小葵'); const r = R.doItem(s, 'kevin', 'bento', 'kui'); ok(r.revive && r.bench && s.run.hp.kui === pct('kui', .5) && r.hp === s.run.hp.kui, '候補的小葵五成 HP 復活'); }
{ const s = fresh(['kevin', 'fairy', 'jie', 'qiang']); s.hp.kui = 0; R.autoSub(s); s.hp.jie = 0; s.mo = 100; const r = R.doUlt(s, 'fairy'); ok(s.run.hp.kui === pct('kui', .3) && s.hp.jie === pct('jie', .3) && r.heals.some(h => h.dst === 'kui' && h.bench), '鼠仙女奧義：場上的阿傑、候補的小葵都站起來'); }
{ const s = fresh(SIX); s.hp.kui = 0; R.autoSub(s); s.over = 'win'; R.endStage(s, s.run); ok(s.run.hp.kui === pct('kui', .25), '打贏之後，倒在候補的小葵回到兩成五'); }

// 阿傑：三招都順便降攻；不會把比較強的冰凍蓋掉
{ const s = fresh(['kevin', 'mi', 'jie']); for (const k of ['freeze', 'sanitize', 'escalate']) if (!s.run.skills.jie.includes(k)) s.run.skills.jie.push(k); const f = 'ma';
  R.doSkill(s, 'jie', 'burn', f); ok(s.atkDown[f] === 1 && s.downK[f] === .15 && s.burn[f] > 0, '怒火另存新檔：灼燒＋攻擊下降一成五');
  s.sp.jie = R.STAT.jie.sp; s.hp[f] = 30000; R.doSkill(s, 'jie', 'freeze', f); ok(s.atkDown[f] === 2 && s.downK[f] === .3, '冰凍：兩次、三成'); R.doAttack(s, 'jie', f); ok(s.atkDown[f] === 2 && s.downK[f] === .3, '普攻的一成不會把冰凍的三成蓋掉');
  const s2 = fresh(['kevin', 'mi', 'jie']); s2.run.skills.jie.push('escalate', 'sanitize'); const r = R.doSkill(s2, 'jie', 'escalate'); ok(r.down && r.down.length && r.down.every(x => s2.atkDown[x] >= 1 && s2.downK[x] >= .15), '副本給你主管：打到的都攻擊下降');
  s2.sp.jie = R.STAT.jie.sp; const t = R.foes(s2).find(x => x !== 'boss') || 'boss'; s2.atkDown[t] = 0; s2.downK[t] = 0; const r3 = R.doSkill(s2, 'jie', 'sanitize', t); ok(!R.alive(s2, t) || (r3.down && s2.atkDown[t] === 1), '先把風險洗乾淨：也帶攻擊下降'); }

// 舊存檔補上新招式
{ const run = mk(['mi', 'xu', 'vivi']); const d = R.saveRun(run); d.v = 4; for (const id of ['mi', 'xu', 'vivi']) d.skills[id] = d.skills[id].filter(k => !Object.values(R.REVIVE_SKILLS).includes(k)); const back = R.loadRun(JSON.parse(JSON.stringify(d)), R.mulberry(3));
  ok(back && back.run.skills.mi.includes('recall') && back.run.skills.xu.includes('wakeup') && back.run.skills.vivi.includes('rehire'), '第 4 版的存檔讀進來，小米、許許、Vivi 都補上復活招'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
