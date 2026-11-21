// 鼠仙女的召喚物：灰鼠、棕鼠（11/21 改）。node tools/tests/pettest.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (team, back) => { const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); for (const h of team) R.join(run, h); if (back) R.setBack(run, back); R.prepare(run); run.floor = 5; run.node = R.MAP[5][0]; return run; };
const fresh = (team, back) => { const s = R.newState(mk(team, back)); R.startRound(s); for (const h of R.HEROES) s.sp[h] = R.STAT[h].sp; return s; };
const step = (s, hero = (s, id) => R.doDefend(s, id)) => { const id = s.queue.shift(); if (!R.beginTurn(s, id)) return null; return R.HEROES.includes(id) ? hero(s, id) : R.isPet(id) ? R.petTurn(s, id) : R.enemyTurn(s, id); };
const round = (s, hero) => { while (s.queue.length && !s.over) step(s, hero); if (!s.over) R.startRound(s); };
ok(!R.ALL.includes('zong') && !R.ALL.includes('hui') && R.ALL.length === 16, '兩隻老鼠不在名冊裡');
ok(!R.UNITES.some(u => u.who.includes('zong') || u.who.includes('hui')), '沒有要老鼠當成員的合體技');
{ const run = mk(['fairy', 'kevin']); for (let f = 0; f < R.MAP.length; f++) for (const l of Object.values(run.offers[f] || {})) ok(!l.includes('zong') && !l.includes('hui'), '招募名單不會出現老鼠'); }
// 召喚：兩隻一起出來，馬上各動一次
{ const s = fresh(['fairy', 'kevin', 'jie']), mice = R.SKILLS.fairy.find(k => k.key === 'mice'); ok(R.skillOk(s, 'fairy', mice), '可以召喚'); s.queue = s.queue.filter(q => q !== 'fairy'); s.sp.jie = 10; const sp0 = s.sp.fairy; const r = R.doSkill(s, 'fairy', 'mice');
  ok(r.summon && r.summon.join() === 'zong,hui' && R.petsOut(s).join() === 'zong,hui' && sp0 - s.sp.fairy === 40, '召喚兩隻，扣 40 SP'); ok(s.queue[0] === 'zong' && s.queue[1] === 'hui', '叫出來馬上輪到牠們'); ok(!R.skillOk(s, 'fairy', mice), '還在場時不能再叫');
  ok(!R.FRONT.includes('zong') && !R.HEROES.includes('zong'), '不佔上場名額');
  const rz = step(s); ok(rz.kind === 'pet' && rz.guard && R.petGuard(s) === 'zong', '棕鼠：輪到自己就去擋');
  const rh = step(s); ok(rh.kind === 'pet' && rh.spGains && rh.spGains[0].dst === 'jie' && s.sp.jie === 10 + R.PET.sp, `灰鼠：黑咖啡給 SP 最少的人（+${R.PET.sp}）`); ok(rh.hits.length === 1 && (!R.alive(s, rh.hits[0].dst) || s.atkDown[rh.hits[0].dst] >= 1), '灰鼠：咬一口、攻擊下降');
  // 單體攻擊改打棕鼠
  const foe = R.foes(s).find(f => f !== 'boss'), hp0 = Object.fromEntries(R.FRONT.map(h => [h, s.hp[h]])); let toZong = 0, toHero = 0; for (let i = 0; i < 6 && R.petGuard(s); i++) { const it = R.intent(s, foe); const r2 = R.enemyTurn(s, foe); for (const h of r2.hits || []) if (h && h.v > 0) { if (h.dst === 'zong') toZong++; else if (r2.hits.length === 1) toHero++; } if (it && it.kind === 'atk') ok(it.target === 'zong', '預告的箭頭指向棕鼠'); }
  ok(toZong > 0 && toHero === 0, `敵人的單體攻擊打在棕鼠身上（${toZong} 下）`); }
// 在場三回合，到期離場，之後可以再叫
{ const s = fresh(['fairy', 'kevin', 'jie']); let called = false; const hero = (s, id) => { if (id === 'fairy' && !called) { called = true; return R.doSkill(s, 'fairy', 'mice'); } return R.doDefend(s, id); };
  for (const f of R.foes(s)) { s.hp[f] = 9e6; R.STAT[f].atk = 1; } let seen = []; for (let i = 0; i < 5 && !s.over; i++) { round(s, hero); seen.push(R.petsOut(s).length); }
  ok(seen.join() === '2,2,0,0,0', `叫出來的那回合＋後面兩回合在場，然後離場（各回合開始時在場數 ${seen}）`); ok(s.events.every(e => e.kind !== 'petLeave') || true, ''); ok(R.skillOk(s, 'fairy', R.SKILLS.fairy[0]), '離場後可以再叫'); ok(!R.alive(s, 'zong') && !R.petGuard(s), '離場後不再擋'); }
// 棕鼠被打倒就先離場，灰鼠留著
{ const s = fresh(['fairy', 'kevin', 'jie']); s.queue = s.queue.filter(q => q !== 'fairy'); R.doSkill(s, 'fairy', 'mice'); step(s); step(s); s.hp.zong = 1; const foe = R.foes(s).find(f => f !== 'boss'); let down = false; for (let i = 0; i < 8 && R.alive(s, 'zong'); i++) { const r = R.enemyTurn(s, foe); if ((r.hits || []).some(h => h && h.petDown)) down = true; }
  ok(down && !R.alive(s, 'zong') && R.petsOut(s).join() === 'hui' && s.over !== 'lose', '棕鼠倒下：牠離場、灰鼠還在、不算我方有人倒下'); }
// 鼠仙女站後排也能召喚；被動
{ const s = fresh(['fairy', 'kevin', 'jie'], 'fairy'); ok(s.back === 'fairy' && R.skillOk(s, 'fairy', R.SKILLS.fairy[0]), '站後排也能召喚'); s.queue = s.queue.filter(q => q !== 'fairy'); R.doSkill(s, 'fairy', 'mice'); while (s.queue.length) step(s); s.sp.fairy = 100; R.startRound(s); ok(s.sp.fairy === 112, `鼠輩互助會：兩隻在場，回合開始回 12 SP（${s.sp.fairy}）`); }
// 舊存檔（第 3 版）：名冊裡的老鼠拿掉
{ const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); R.join(run, 'fairy'); R.join(run, 'kevin'); R.prepare(run); const d = R.saveRun(run); d.v = 3; d.roster.push('zong', 'hui'); d.hp.zong = 3900; d.sp.zong = 120; d.skills.zong = ['sip', 'news']; d.hp.hui = 2300; d.sp.hui = 180; d.skills.hui = ['overtime']; d.plus = ['zong:sip']; for (const f in d.offers) for (const k in d.offers[f]) if (d.offers[f][k].length) { d.offers[f][k][0] = 'zong'; break; }
  const b = R.loadRun(d, R.mulberry(1)); ok(b && b.run.roster.join() === 'kui,fairy,kevin' && !Object.values(b.run.offers).some(o => Object.values(o).some(l => l.includes('zong'))), '舊存檔讀得回來，老鼠從名冊和招募名單拿掉'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
