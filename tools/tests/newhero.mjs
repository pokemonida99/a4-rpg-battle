// 11/21 新同事：阿哲（實習槍兵）、小安（工安衛士）。node tools/tests/newhero.mjs
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('BAD', m); } };
const mk = (team, floor = 5) => { const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); for (const h of team) R.join(run, h); R.prepare(run); run.floor = floor; run.node = R.MAP[floor][0]; return run; };
const fresh = (team, floor) => { const s = R.newState(mk(team, floor)); R.startRound(s); for (const h of R.HEROES) s.sp[h] = 999; s.queue = R.HEROES.slice(); return s; };
ok(R.ALL.includes('zhe') && R.ALL.includes('an') && R.ROLE.zhe === '輸出' && R.ROLE.an === '坦', '名冊與定位');
ok(R.STAT.zhe.atk < Math.min(R.STAT.senpai.atk, R.STAT.you.atk, R.STAT.hui.atk) && R.STAT.an.hp < Math.min(R.STAT.kevin.hp, R.STAT.qiang.hp, R.STAT.zong.hp), '能力值比同定位的人弱');
ok(R.zheK({ floor: 0 }) === 1 && Math.abs(R.zheK({ floor: 5 }) - 1.15) < 1e-9 && Math.abs(R.zheK({ floor: 20 }) - 1.36) < 1e-9, '邊做邊學：每站 +3%，最多 +36%');
{ const s = fresh(['zhe', 'an', 'kevin']); const t = R.foes(s).find(f => f !== 'boss') || 'boss'; const p0 = R.preview(s, 'zhe', t); s.run.floor = 0; const p1 = R.preview(s, 'zhe', t); ok(p0 > p1, `邊做邊學算進傷害預估 ${p1} → ${p0}`); }
{ const s = fresh(['zhe', 'an', 'kevin']), t = R.foes(s)[0]; const r = R.doAttack(s, 'zhe', t); ok(!R.alive(s, t) || s.burn[t] >= 1, '阿哲普攻：灼燒一回合'); }
{ const s = fresh(['zhe', 'an', 'kevin']), t = R.foes(s)[0]; s.hp[t] = 999999; R.doSkill(s, 'zhe', 'eager', t); ok(s.burn[t] === 2, '這個我可以：灼燒兩回合'); const sp = s.sp.kevin = 10; R.doSkill(s, 'zhe', 'errand'); ok(s.sp.kevin === 22 && s.evade.zhe, '我去買咖啡：全員 SP +12、自己閃避'); }
{ const s = fresh(['zhe', 'an', 'kevin']); s.mo = 100; for (const f of R.foes(s)) s.hp[f] = 999999; const r = R.doUlt(s, 'zhe'); ok(r.hits.length === 3 && r.hits.every(h => h.dst === r.hits[0].dst) && s.burn[r.hits[0].dst] === 3, `第一次獨立提案：三槍＋灼燒三回合（${r.hits.map(h => h.v)}）`); }
{ const s = fresh(['zhe', 'an', 'kevin']); R.doSkill(s, 'an', 'wetfloor'); ok(s.guardian === 'an' && s.ward.an >= 600, '小心地滑：吸引攻擊＋護盾'); s.hp.kui = 100; const r = R.doAttack(s, 'an', R.foes(s)[0]); ok(s.ward.kui === 200, '安全第一：行動後幫 HP 最低的同伴上 200 護盾'); }
{ const s = fresh(['zhe', 'an', 'kevin']); s.mo = 100; s.smoke.kui = 'ma'; const r = R.doUlt(s, 'an'); ok(R.FRONT.every(h => s.ward[h] >= 1400) && !s.smoke.kui && s.guardian === 'an', '全員戴好安全帽：全員護盾 1400、解除異常、吸引攻擊'); }
{ const s = fresh(['zhe', 'an', 'kevin']), U = R.UNITES.find(u => u.key === 'u_extinguish'); ok(R.uniteOk(s, 'zhe', U), '合體技放得了'); const r = R.doUnite(s, 'zhe', 'u_extinguish', R.foes(s)[0]); ok(r.hits.length === 2 && r.hits.every(h => h.type === 'ice') && R.FRONT.every(h => s.ward[h] >= 1000), '滅火器借我一下：兩下冰屬性＋全員護盾'); }
{ const run = R.newRun(R.mulberry(6), 'kui', 'draft', 'office'); R.join(run, 'zhe'); R.join(run, 'an'); R.prepare(run); const back = R.loadRun(R.saveRun(run), R.mulberry(1)); ok(back && back.run.roster.join() === run.roster.join(), '存檔讀得回來'); }
ok(R.KINDS.m_zhe && R.KINDS.m_an, '鏡像內戰有他們的鏡像');
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
