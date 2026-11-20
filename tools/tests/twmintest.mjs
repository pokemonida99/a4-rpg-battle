// 台灣篇三種小兵自己的行為（v0.27.0）：值班兵結伴、叫號使過號、補給生打氣
import * as R from '../../js/rules.js';
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const mk = (stage, team = ['kevin', 'mi', 'jie']) => { const run = R.newRun(mul(5), 'kui', 'draft', 'taiwan'); for (const h of team) R.join(run, h); R.prepare(run); const f = R.MAP.findIndex(fl => fl.some(nd => nd.stage === stage || (nd.pool || []).includes(stage))); run.floor = f; run.node = R.MAP[f].find(nd => nd.stage === stage || (nd.pool || []).includes(stage)); if (run.node.pool) run.alt[run.node.stage] = stage; const s = R.newState(run); R.startRound(s); return s; };
const stagesWith = k => Object.entries(R.STAGES).filter(([n, st]) => n.startsWith('tw_') && [st.base, ...Object.values(st.kinds || {})].includes(k)).map(e => e[0]);
console.log('有值班兵的關卡', stagesWith('tw_drone').join(' '), '｜叫號使', stagesWith('tw_courier').join(' '), '｜補給生', stagesWith('tw_intern').join(' '));
// 結伴：同場每多一隻值班兵 +20%
{ const s = mk(stagesWith('tw_drone')[0]), ds = R.MINIONS.filter(m => s.kind[m] === 'tw_drone' && R.alive(s, m)); ok(ds.length >= 2, '這一關至少兩隻值班兵（' + ds.length + '）');
  if (ds.length >= 2) { const a = ds[0]; ok(R.packN(s, a) === ds.length - 1, 'packN＝其他值班兵數'); ok(R.intent(s, a).pack === ds.length - 1, '意圖帶 pack'); s.rand = () => .5; const r1 = R.enemyTurn(s, a); ok(r1.kind === 'foeAtk' && r1.pack === ds.length - 1, '行動結果帶 pack');
    const s2 = mk(stagesWith('tw_drone')[0]); for (const m of ds.slice(1)) s2.hp[m] = 0; s2.rand = () => .5; const r2 = R.enemyTurn(s2, a); ok(r2.pack === 0, '只剩一隻就沒有結伴'); const v1 = r1.hits[0].v + (r1.hits[0].ab || 0), v2 = r2.hits[0].v + (r2.hits[0].ab || 0); if (r1.hits[0].dst === r2.hits[0].dst && !r1.hits[0].miss && !r2.hits[0].miss) ok(Math.abs(v1 / v2 - (1 + .2 * (ds.length - 1))) < .06, `結伴傷害倍率（${v2} → ${v1}）`); } }
// 過號：被叫號使打中的人下回合排最後；解除異常可以清掉
{ const st = stagesWith('tw_courier')[0], s = mk(st), c = R.MINIONS.find(m => s.kind[m] === 'tw_courier'); ok(!!c, st + ' 有叫號使'); s.rand = () => .5; const r = R.enemyTurn(s, c), h = r.hits.find(x => x.v > 0);
  if (h) { ok(s.late[h.dst] && h.hex && h.hex.includes('過號'), '打中的人過號'); R.startRound(s); const heroes = s.queue.filter(q => R.HEROES.includes(q)); ok(s.queue.at(-1) === h.dst, `下回合排最後（${s.queue.join(',')}）`); ok(!s.late[h.dst], '過號只算一回合'); ok(s.events.some(e => e.kind === 'late'), '有 late 事件');
    const s3 = mk(st), c3 = R.MINIONS.find(m => s3.kind[m] === 'tw_courier'); s3.rand = () => .5; const r3 = R.enemyTurn(s3, c3), h3 = r3.hits.find(x => x.v > 0); ok(R.cleanse(s3, h3.dst) && !s3.late[h3.dst], '解除異常清掉過號'); } else ok(false, '叫號使沒打中人'); ok(R.intent(mk(st), c).late === true, '意圖帶 late'); }
// 打氣：補給生補小兵，那隻下次攻擊 ×1.3；補頭目不算
{ const st = stagesWith('tw_intern')[0], s = mk(st), it = R.MINIONS.find(m => s.kind[m] === 'tw_intern'), other = R.MINIONS.find(m => m !== it && R.alive(s, m)); ok(!!it && !!other, st + ' 有補給生和另一隻小兵');
  if (it && other) { s.hp[other] = Math.round(R.STAT[other].hp * .4); if (s.hp.boss > 0) s.hp.boss = R.STAT.boss.hp; ok(R.intent(s, it).kind === 'heal' && R.intent(s, it).hype, '意圖：補血＋打氣'); const r = R.enemyTurn(s, it); ok(r.kind === 'foeHeal' && r.hype && s.fup[other], '補到小兵 → 打氣'); ok(R.intent(s, other).hyped || R.intent(s, other).kind !== 'atk', '被打氣的意圖帶 hyped'); s.rand = () => .5; const r2 = R.enemyTurn(s, other); ok(r2.kind !== 'foeAtk' || (r2.hyped && !s.fup[other]), '打氣用掉一次'); } }
// 一般行程的社畜小兵不受影響
{ ok(!R.KINDS.drone.pack && !R.KINDS.courier.late && !R.KINDS.intern.hype, '原版小兵沒有新行為'); ok(R.KINDS.tw_drone.atk === .9, '值班兵單隻攻擊 0.9'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
