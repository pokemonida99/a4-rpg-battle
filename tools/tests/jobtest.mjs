// 職位（11/24 改版）的規則檢查：好處帶出打法、限制改變操作
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const mk = (job, map = 'office') => { const run = R.newRun(R.mulberry(7), 'kui', 'draft', map, 0, job); R.join(run, 'kevin'); R.join(run, 'mi'); R.prepare(run); return run; };
const fight = (job, stage = 'chief') => { const run = mk(job); const f = R.MAP.findIndex(fl => fl.some(nd => nd.stage === stage)); run.floor = f; run.node = R.MAP[f].find(nd => nd.stage === stage); const s = R.newState(run); R.startRound(s); return s; };
// 開局效果
{ const r = mk('edu'); ok(r.skills.kui.length === R.SKILLS.kui.length && r.plus.some(p => p.startsWith('kui:') && p !== 'kui:draft'), '教育委員：主角會全部招式，再升級一招'); }
ok(mk('buyer').coin === 50 && mk('staff').coin === 30, '採購主任 50 點、一般職員 30 點');
ok(mk('welfare').items.tea === mk(null).items.tea + 1 && mk('staff').items.tea === mk(null).items.tea + 1, '福利委員、一般職員多一杯奶茶');
ok(mk('host').moStart === mk(null).moStart + 20, '會議主持：開場氣勢 +20');
{ const r = R.newRun(R.mulberry(7), 'kui', 'draft', 'office', 0, 'hr'); ok(r.roster.length === 1 && R.hrOffer(r).length === 3 && R.rosterMax(r) === 5, '人資專員：開局三選一、名冊最多 5'); }
ok(!R.offerJobs(Math.random).some(j => j === 'duty' || j === 'staff') && R.offerJobs(Math.random).length === 3, '抽職位：不出舊的值班主任、一般職員另外放');
// 救火組長：第一招免 SP、＋40%；第一回合不能防禦、換人
{ const s = fight('fire'), sk = R.SKILLS.kui.find(k => k.key === 'draft'); ok(R.spCost(s, 'kui', sk) === 0, '救火組長：第一招 SP 0'); ok(R.doDefend(s, 'kui') === null && R.jobBlock(s, 'defend'), '救火組長：第一回合不能防禦');
  const sp0 = s.sp.kui, r = R.doSkill(s, 'kui', 'draft', R.foes(s).find(f => f !== 'boss')); ok(s.sp.kui === sp0 && r.fireFree, '真的沒花 SP'); ok(R.spCost(s, 'kui', sk) > 0, '第二招照常'); }
// 風控專員：第一個防禦的人 400 護盾、氣勢 +8；沒人帶護盾奧義貴 10
{ const s = fight('risk'); s.ward = {}; const c0 = R.ultCost(s), mo = s.mo, r = R.doDefend(s, 'kevin'); ok((r.fxs || []).some(x => x.t === 'ward' && x.v === 400) && s.mo >= mo + 8, '風控專員：防禦拿 400 護盾、氣勢 +8'); ok(c0 === R.ultMo(s.run) + 10 && R.ultCost(s) === R.ultMo(s.run), '沒人帶護盾時奧義 +10'); }
// 專案窗口：同一人不能連兩回合用同一招
{ const s = fight('window'); const t = R.foes(s).find(f => f !== 'boss'); R.doSkill(s, 'kui', 'draft', t); R.startRound(s); ok(R.skillBlock(s, 'kui', 'draft') && !R.skillOk(s, 'kui', R.SKILLS.kui.find(k => k.key === 'draft')), '專案窗口：上回合用過的招不能用'); R.startRound(s); ok(!R.skillBlock(s, 'kui', 'draft'), '隔一回合就可以'); }
// 會議主持：第一回合不能放奧義，第一次奧義後前排 SP +20
{ const s = fight('host'); s.mo = 100; ok(!R.canUlt(s, 'kui'), '會議主持：第一回合不能放奧義'); R.startRound(s); s.sp.kevin = 0; const r = R.doUlt(s, 'kui'); ok((r.fxs || []).some(x => x.t === 'sp' && x.dst === 'kevin' && x.v === 20), '第一次奧義後前排 SP +20'); }
// 福利委員：每回合第一次補血，被補的人得到 400 護盾；奶茶咖啡不能給自己
{ const s = fight('welfare'); s.hp.kevin = 1000; s.ward = {}; const r = R.doItem(s, 'mi', 'tea', 'kevin'); ok(s.ward.kevin === 400, '福利委員：補血附 400 護盾'); s.hp.mi = 100; ok(!R.itemTargets(s, 'tea', 'mi').includes('mi'), '福利委員：奶茶不能自己喝'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
