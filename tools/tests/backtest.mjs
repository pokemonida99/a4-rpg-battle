// 後排（v0.32.0）：前排最多四人＋後排一人；Vivi 只有應援與奧義；鼠仙女、小蝶、茶茶可以站後排，站後排只能用輔助招式
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const mk = (team, back) => { const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); for (const h of team) R.join(run, h); if (back !== undefined) R.setBack(run, back); R.prepare(run); run.floor = 5; run.node = R.MAP[5][0]; return run; };
// 誰上場
{ const run = mk(['kevin', 'jie', 'mi', 'vivi', 'qiang']); ok(R.backOf(run) === 'vivi' && R.active(run).join() === 'kui,kevin,jie,mi,vivi', `有 Vivi：四個前排＋她在後排（${R.active(run)}）`); const s = R.newState(run); ok(R.FRONT.join() === 'kui,kevin,jie,mi' && s.back === 'vivi' && R.bench(s).join() === 'qiang', '前排四人、候補阿強'); }
{ const run = mk(['vivi', 'kevin']); ok(R.active(run).join() === 'kui,kevin,vivi', 'Vivi 排第二也不佔前排'); }
{ const run = mk(['kevin', 'wu', 'jie', 'mi', 'qiang']); ok(R.backOf(run) === null && R.active(run).join() === 'kui,kevin,wu,jie', '沒指定後排：小蝶照順序站前排'); ok(R.setBack(run, 'wu') && R.backOf(run) === 'wu' && R.active(run).join() === 'kui,kevin,jie,mi,wu', `小蝶站後排，前排遞補（${R.active(run)}）`); ok(!R.setBack(run, 'kevin') && !R.setBack(run, 'kui'), 'Kevin、主角不能站後排'); ok(R.setBack(run, null) && R.backOf(run) === null, '回前排');
  const r0 = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); R.join(r0, 'wu'); R.setBack(r0, 'wu'); R.prepare(r0); const b = R.loadRun(R.saveRun(r0), R.mulberry(1)); ok(b && b.run.back === 'wu' && R.backOf(b.run) === 'wu', '存檔記得誰站後排'); }
{ const run = mk(['kevin', 'wu', 'vivi', 'jie'], 'wu'); ok(R.backOf(run) === 'wu' && !R.active(run).includes('vivi'), '指定小蝶站後排時，Vivi 不上場'); const s = R.newState(run); ok(!R.bench(s).includes('vivi'), 'Vivi 也不能換上前排'); ok(R.setBack(run, null) && R.backOf(run) === 'vivi', '小蝶回前排 → Vivi 自動站回後排'); }
// 戰鬥：後排不會被打、不能攻擊、只能用輔助招式
{ const run = mk(['kevin', 'wu', 'jie', 'mi'], 'wu'), s = R.newState(run); R.startRound(s); ok(!R.FRONT.includes('wu') && R.HEROES.includes('wu'), '小蝶在場但不在前排');
  const sk = k => R.SKILLS.wu.find(x => x.key === k); ok(R.skillOk(s, 'wu', sk('encore')) && R.skillOk(s, 'wu', sk('dance')) && !R.skillOk(s, 'wu', sk('spotlight')), '後排：安可、熱舞可以，攻擊招不行');
  ok(R.redo(s, ['a', 'wu', R.foes(s)[0]]) === null, '後排不能普攻'); const mo0 = s.mo, r = R.doCheer(s, 'wu'); ok(r.id === 'wu' && s.mo > mo0, '後排可以應援');
  let hitWu = 0; for (let k = 0; k < 40; k++) { for (const f of R.foes(s)) { const r2 = R.enemyTurn(s, f); for (const h of r2.hits || []) if (h && h.dst === 'wu') hitWu++; } for (const h of R.FRONT) s.hp[h] = R.STAT[h].hp; s.over = null; } ok(hitWu === 0, '敵人打不到後排');
  for (const h of R.FRONT) s.hp[h] = 0; R.enemyTurn(s, R.foes(s)[0]); ok(s.over === 'lose' || R.FRONT.every(h => s.hp[h] <= 0), '前排全倒就輸（後排還站著也一樣）'); }
// Vivi：沒有招式可用，只有應援和奧義
{ const run = mk(['kevin', 'vivi']), s = R.newState(run); R.startRound(s); ok(R.SKILLS.vivi.every(k => !R.skillOk(s, 'vivi', k)), 'Vivi 的招式都不能用'); s.mo = 100; s.sp.vivi = 999; ok(R.canUlt(s, 'vivi'), 'Vivi 可以放奧義'); ok(R.doCheer(s).id === 'vivi', 'Vivi 可以應援'); }
// 站前排的小蝶跟以前一樣
{ const run = mk(['kevin', 'wu']), s = R.newState(run); R.startRound(s); ok(R.FRONT.includes('wu') && R.skillOk(s, 'wu', R.SKILLS.wu.find(x => x.key === 'spotlight')), '前排的小蝶可以用攻擊招'); }
// 合體技：後排的人不出手——要她打的合體技放不了，純支援的可以；Vivi 的核准由黑輪去打，可以
{ let run = mk(['jie', 'fairy', 'kevin'], 'fairy'), s = R.newState(run); R.startRound(s); const U = k => R.UNITES.find(x => x.key === k); for (const h of R.HEROES) s.sp[h] = 999; ok(R.uniteBack(s, U('u_rebuild')) && !R.uniteOk(s, 'jie', U('u_rebuild')), '鼠仙女站後排：要她出手的合體技放不了');
  run = mk(['jie', 'fairy', 'kevin']); s = R.newState(run); R.startRound(s); for (const h of R.HEROES) s.sp[h] = 999; s.queue = R.HEROES.slice(); ok(R.uniteOk(s, 'jie', U('u_rebuild')), '鼠仙女站前排：放得了');
  run = mk(['wu', 'cha', 'kevin'], 'wu'); s = R.newState(run); R.startRound(s); for (const h of R.HEROES) s.sp[h] = 999; s.queue = R.HEROES.slice(); ok(R.uniteOk(s, 'cha', U('u_mc')), '小蝶站後排：純支援的合體技可以放'); const r = R.doUnite(s, 'cha', 'u_mc'); ok(s.up.kui === 3 && s.up.kevin === 3 && !s.up.wu && !s.up.cha, '　效果只給其他前排');
  run = mk(['heilun', 'vivi', 'kevin']); s = R.newState(run); R.startRound(s); for (const h of R.HEROES) s.sp[h] = 999; s.queue = R.HEROES.slice(); ok(s.back === 'vivi' && R.uniteOk(s, 'heilun', U('u_approve')), 'Vivi 的核准：黑輪出手，放得了'); }
// 後排幫忙回 SP：應援讓前排每人回 SP；小蝶的中場喝口水、鼠仙女的餅乾、茶茶的誇獎在後排都能用
{ const s = R.newState(mk(['kevin', 'jie', 'vivi'])); R.startRound(s); for (const h of R.FRONT) s.sp[h] = 20; const r = R.doCheer(s); ok(R.FRONT.every(h => s.sp[h] === 20 + R.CHEER_SP) && (r.fxs || []).filter(x => x.t === 'sp').length === R.FRONT.length, `Vivi 應援：前排每人 SP +${R.CHEER_SP}`); }
{ const s = R.newState(mk(['kevin', 'jie', 'wu'], 'wu')); R.startRound(s); for (const h of R.FRONT) s.sp[h] = 20; s.sp.wu = 280; const k = R.SKILLS.wu.find(x => x.key === 'cooldown'); ok(R.skillOk(s, 'wu', k), '小蝶在後排可以用中場喝口水'); R.doSkill(s, 'wu', 'cooldown'); ok(R.FRONT.every(h => s.sp[h] === 60), '　前排每人 SP +40'); }
{ for (const [id, key] of [['fairy', 'snacks'], ['cha', 'cheer']]) { const s = R.newState(mk(['kevin', 'jie', id], id)); R.startRound(s); ok(s.back === id && R.skillOk(s, id, R.SKILLS[id].find(x => x.key === key)), `${id} 在後排有回 SP 的招式（${key}）`); } }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
