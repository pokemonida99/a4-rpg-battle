// 職位（v0.25.0）的規則檢查
import * as R from '../../js/rules.js';
const mul = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const mk = (job, map = 'office') => { const run = R.newRun(mul(7), 'kui', 'draft', map, 0, job); R.prepare(run); return run; };
// 開局效果
ok(mk('edu').skills.kui.length === R.SKILLS.kui.length, '教育委員：主角會全部招式');
ok(mk(null).skills.kui.length === 2, '沒職位：主角兩招');
ok(mk('buyer').coin === 60, '採購主任：開局 60 點');
ok(mk('host').moStart === mk(null).moStart + 20, '會議主持：開場氣勢 +20');
{ const r = mk('hr'); ok(r.roster.length === 2 && Math.abs(r.def - 1.05) < 1e-9 && !r.roster.includes('vivi'), '人資專員：多一人、受傷 +5%'); }
ok(R.offerUpgrades(mk('edu')).length === 2 && R.offerUpgrades(mk(null)).length === 3, '教育委員：獎勵二選一');
ok(R.skCost(mk('host'), 'kui', R.SKILLS.kui[0]) === Math.ceil(R.SKILLS.kui[0].sp * 1.1), '會議主持：招式 SP +10%');
// 三張給選、沒採買站的地圖不出採購
for (const mp of Object.keys(R.MAPS)) { const shop = R.MAPS[mp].some(fl => fl.some(nd => nd.type === 'shop')); for (let i = 0; i < 40; i++) { const o = R.offerJobs(mul(i), mp); ok(o.length === 3 && new Set(o).size === 3 && (shop || !o.includes('buyer')), mp + '：三個不重複，沒採買站就不出採購主任'); } }
ok([...Array(40)].some((_, i) => R.offerJobs(mul(i), 'office').includes('buyer')), '一般行程會出採購主任');
// 存檔讀回
for (const j of [null, ...Object.keys(R.JOBS)]) { const run = mk(j), back = R.loadRun(R.saveRun(run), mul(1)); ok(back && back.run.job === j && back.run.def === run.def && back.run.moStart === run.moStart && back.run.coin === run.coin && back.run.roster.join() === run.roster.join(), '存檔讀回 ' + j); }
ok(R.loadRun({ ...R.saveRun(mk('fire')), job: 'zzz' }, mul(1)).run.job === null, '不認得的職位當成沒有');
// 戰鬥：同一顆亂數種子比傷害
const hit = (job, round, basic) => { const run = mk(job); const s = R.newState(run); R.startRound(s); for (let k = 1; k < round; k++) R.startRound(s); const t = R.foes(s)[0]; s.rand = () => .5; const r = basic ? R.doAttack(s, 'kui', t) : R.doSkill(s, 'kui', 'draft', t); return r.hits[0]; };
{ const a = hit(null, 1, true), b = hit('fire', 1, true), c = hit('fire', 3, true), d = hit('risk', 1, true), e = hit('welfare', 2, true);
  ok(Math.abs(b.v / a.v - 1.3) < .02 || b.wk !== a.wk, `救火組長第一回合 +30%（${a.v} → ${b.v}）`); ok(Math.abs(c.v / hit(null, 3, true).v - .85) < .02, '救火組長第三回合普攻 -15%'); ok(Math.abs(d.v / a.v - .8) < .02, '風控專員第一回合 -20%'); ok(Math.abs(e.v / hit(null, 2, true).v - .92) < .02, '福利委員 -8%'); }
{ const a = hit(null, 2, true), w = hit('window', 2, true); ok(Math.abs(w.v / a.v - (a.wk ? 1.1 : .9)) < .02, `專案窗口：弱點 +10%／其他 -10%（wk=${!!a.wk}）`); }
// 防禦：風控專員多回 SP、得到護盾
{ const run = mk('risk'), s = R.newState(run); R.startRound(s); s.sp.kui = 0; const r = R.doDefend(s, 'kui'); ok(r.spGain === 30 && s.ward.kui === 300, `風控專員防禦：SP +30、護盾 300（${r.spGain}／${s.ward.kui}）`); }
{ const run = mk('duty'), s = R.newState(run); R.startRound(s); const r = R.doAttack(s, 'kui', R.foes(s)[0]); ok(s.ward.kui === Math.round(180 * 1.35), `值班主任：小葵普攻護盾 180 → ${s.ward.kui}`); }
{ const heal = job => { const run = mk(job), s = R.newState(run); R.startRound(s); s.hp.kui = 100; return R.doItem(s, 'kui', 'tea', 'kui').heal; }; ok(heal('welfare') === Math.min(2600, R.STAT.kui.hp - 100) && heal('duty') === 1600 && heal(null) === 2000, `回復量：福利 ${heal('welfare')}、值班 ${heal('duty')}、一般 ${heal(null)}`); }
// 休息站與額度
{ const a = mk(null), b = mk('buyer'); a.hp.kui = b.hp.kui = 1; ok(R.rest(b) < R.rest(a), '採購主任：休息回得比較少'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
