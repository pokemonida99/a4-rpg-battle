import * as R from '../../js/rules.js';
const mk = (stage, team, seed = 3) => { const run = R.newRun(R.mulberry(seed), 'kui', 'draft', 'office'); for (const h of team) R.join(run, h); const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage || (nd.pool || []).includes(stage))), nd = R.MAP[fl].find(nd => nd.stage === stage || (nd.pool || []).includes(stage)); if (nd.pool) run.alt[nd.stage] = stage; run.floor = fl; run.node = nd; for (let k = 0; k < fl; k++) run.path[k] = 0; run.skills.kui = R.SKILLS.kui.map(k => k.key); const s = R.newState(run); R.startRound(s); s.rand = () => .5; return s; };
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); }; let s, r;
// 每個人都有 4～5 招、被動、普攻附帶
for (const id of R.ALL) { const n = R.SKILLS[id].length; if (!(n >= (id === 'vivi' ? 3 : 4) && R.PASSIVE[id] && (id === 'vivi' || R.RIDER[id]))) ok(false, `${id} 招式 ${n}`); }
ok(new Set(Object.values(R.SKILLS).flat().map(k => k.key)).size === Object.values(R.SKILLS).flat().length, `招式代號不重複，共 ${Object.values(R.SKILLS).flat().length} 招`);
{ const run = R.newRun(R.mulberry(1), 'jie', 'burn'); ok(run.skills.jie.join() === 'burn,sanitize' && R.unlearned(run).length === 3, `阿傑開局兩招 ${run.skills.jie}，還有 ${R.unlearned(run).length} 招可學`); }
// 每一招都跑得動（對每種目標各放一次），不丟例外
for (const team of [['kevin', 'mi', 'jie'], ['yan', 'heilun', 'cha'], ['qiang', 'senpai', 'wu'], ['you', 'fairy', 'zhe'], ['an', 'xu', 'vivi']]) for (const id of ['kui', ...team]) for (const k of R.SKILLS[id]) { s = mk('chief', team); for (const h of R.FRONT) { s.hp[h] = Math.round(R.STAT[h].hp * .5); s.sp[h] = Math.round(R.STAT[h].sp * .5); } s.sp[id] = R.STAT[id].sp;
  try { const tg = k.target === 'foe' ? 'boss' : k.target === 'ally' ? R.allyTargets(s, id, k)[0] : undefined; if (k.target === 'ally' && !tg) continue; r = R.doSkill(s, id, k.key, tg); if (!(r.kind === 'skill' && Number.isFinite(s.sp[id]) && Number.isFinite(s.mo) && Object.values(s.hp).every(Number.isFinite))) ok(false, `${id}.${k.key} 結果怪怪的`); } catch (e) { ok(false, `${id}.${k.key} 丟例外：${e.message}`); } }
ok(true, '80 招各放一次沒有例外');
// 護盾
s = mk('intro', ['kevin', 'mi']); r = R.doSkill(s, 'kevin', 'cover'); ok(r.fxs.filter(x => x.t === 'ward').length >= 3 && s.ward.kui === 500 && s.ward.kevin === 500, `先過我這關：全員護盾 ${JSON.stringify(s.ward)}`);
{ const hp0 = s.hp.kui; s.plan.ma = 'kui'; r = R.enemyTurn(s, 'ma'); const h = r.hits[0]; ok(h.dst === 'kui' && h.ab > 0 && h.v === 0 && s.hp.kui === hp0 && s.ward.kui === 500 - h.ab, `小兵打小葵：護盾吸收 ${h.ab}，剩 ${s.ward.kui}`); R.beginTurn(s, 'kui'); ok(s.ward.kui === 0, '輪到自己時護盾消失'); }
// 普攻附帶與被動
s = mk('intro', ['kevin', 'mi']); r = R.doAttack(s, 'kui', 'ma'); ok(s.ward.kui === 180 && r.fxs.some(x => x.t === 'ward') && r.fxs.some(x => x.t === 'sp' && x.why) === (r.hits[0].wk && s.sp.kui < 142), `小葵普攻：護盾 180；打中弱點被動 ${JSON.stringify(r.fxs.map(x => x.t + (x.why || '')))}`);
s.hp.kevin = 2000; r = R.doAttack(s, 'kevin', 'ma'); ok(s.hp.kevin === 2180 && s.ward.kevin === 180, 'Kevin 普攻回 180、行動後護盾 180'); s.hp.kui = 1000; r = R.doAttack(s, 'mi', 'ma'); ok(s.hp.kui === 1180, '小米普攻幫最低血的人回 180');
// 中毒、再生、暈眩、攻擊提升
s = mk('chief', ['heilun', 'mi', 'kevin']); r = R.doSkill(s, 'heilun', 'fineprint', 'ma'); ok(s.poison.ma && s.poison.ma.n === 3, `中毒 ${JSON.stringify(s.poison.ma)}`); s.hp.kui = 500; r = R.doSkill(s, 'mi', 'followup', 'kui'); ok(s.regen.kui.n === 3 && s.ward.kui === 350, '再生＋護盾'); r = R.doSkill(s, 'kevin', 'gavel', 'mb'); ok(s.stun.mb === true, '暈眩小兵'); ok(R.intent(s, 'mb').kind === 'stun', '意圖顯示暈眩');
{ const hm = s.hp.ma, hk = s.hp.kui; R.startRound(s); ok(s.events.some(e => e.kind === 'poison' && e.dst === 'ma') && s.hp.ma < hm && s.events.some(e => e.kind === 'regen' && e.dst === 'kui') && s.hp.kui === hk + 350, '回合開始：中毒扣血、再生回血'); r = R.enemyTurn(s, 'mb'); ok(r.kind === 'foeStun', '暈眩的小兵跳過行動'); r = R.enemyTurn(s, 'mb'); ok(r.kind === 'foeAtk', '下一次正常'); }
{ const sh0 = s.shield; s.potUsed = true; r = R.doSkill(s, 'kevin', 'gavel', 'boss'); ok(sh0 - s.shield >= 2, `暈眩打頭目改成多削底氣（${sh0}→${s.shield}；v0.48 課長的底氣沒打中弱點的那一點不算，剩招式多削的兩點）`); }
s = mk('intro', ['cha', 'mi']); r = R.doSkill(s, 'cha', 'cheer', 'kui'); ok(s.up.kui === 2, '攻擊提升兩次'); const p0 = R.preview(s, 'kui', 'ma'); r = R.doAttack(s, 'kui', 'ma'); ok(s.up.kui === 1 && r.hits[0].v === Math.round(1250 * 1.25 * 1.3), `提升後普攻 ${r.hits[0].v}（預估 ${p0}，另有弱點）`);
// 吸引攻擊（小蝶、棕鼠）
s = mk('intro', ['wu', 'an']); r = R.doSkill(s, 'an', 'wetfloor'); ok(s.guardian === 'an' && s.ward.an === 600, '小安吸引＋護盾'); s.plan.mb = 'kui'; ok(R.intent(s, 'mb').target === 'an', '意圖改指向小安'); r = R.enemyTurn(s, 'mb'); ok(r.hits[0].dst === 'an' && r.hits.taunted === 'kui', '真的打小安'); R.beginTurn(s, 'an'); ok(s.guardian === null, '輪到自己就結束');
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
