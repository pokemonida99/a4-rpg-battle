// 招募機會（v0.28.0）：新的站、三個招募事件、名冊滿了換人
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const cnt = map => R.MAPS[map].reduce((n, fl) => n + (fl.some(nd => nd.type === 'recruit' || nd.rescue) ? 1 : 0), 0);
console.log('可以多帶人的站數（每層最多算一次）：', ['office', 'taiwan', 'hell', 'mirror'].map(m => `${m} ${cnt(m)}`).join('　'));
ok(cnt('office') >= 5 && cnt('mirror') >= 5 && cnt('hell') >= 5 && cnt('taiwan') >= 5, '每張地圖至少五層有招募或救援');
for (const m of Object.keys(R.MAPS)) for (const fl of R.MAPS[m]) for (const nd of fl) if (nd.type === 'battle') ok(R.STAGES[nd.stage] && (nd.pool || []).every(k => R.STAGES[k]), `${m} 的關卡 ${nd.stage} 有定義`);
// 名冊滿了換人
{ const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'jie', 'qiang', 'xu']) R.join(run, h); run.plus = ['xu:mix', 'kevin:taunt']; ok(R.swapOut(run) === 'xu', '換掉的是名冊最後一位');
  const gone = R.joinOrSwap(run, 'yan'); ok(gone === 'xu' && run.roster.join() === 'kui,kevin,mi,jie,qiang,yan' && run.hp.xu === undefined && run.hp.yan === R.STAT.yan.hp && !run.plus.includes('xu:mix') && run.plus.includes('kevin:taunt'), '許許換成小燕');
  run.roster = ['kevin', 'mi', 'jie', 'qiang', 'yan', 'kui']; ok(R.swapOut(run) === 'yan', '主角排最後也不會被換掉'); ok(R.joinOrSwap(run, 'kevin') === null, '已經在隊上的人不能再帶');
  const back = R.loadRun(R.saveRun(run), R.mulberry(1)); ok(back && back.run.roster.join() === run.roster.join(), '換人後存檔讀得回來'); }
{ const run = R.newRun(R.mulberry(3), 'kui', 'draft', 'office'); ok(R.swapOut(run) === '' && R.joinOrSwap(run, 'mi') === '' && run.roster.length === 2, '沒滿就直接加入'); }
// 名冊滿了，招募站還是有人選
{ const run = R.newRun(R.mulberry(4), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'jie', 'qiang', 'xu']) R.join(run, h); run.floor = 4; R.prepare(run); const i = R.MAP[4].findIndex(nd => nd.type === 'recruit'); ok(i >= 0 && (run.offers[4][i] || []).length === 3 && run.offers[4][i].every(id => !run.roster.includes(id)), '滿編時人力銀行還是給三個人選'); }
// 招募事件
for (const k of ['rec_elevator', 'rec_loan', 'rec_lunch']) { const run = R.newRun(R.mulberry(5), 'kui', 'draft', 'office'); ok(R.EVENTS[k] && R.EVENTS[k].recruit && R.eventOk(run, k, 0), k + ' 可以選'); const msg = R.applyEvent(run, k, 0); ok(run.roster.length === 2 && typeof msg === 'string' && msg.includes(R.NAME[run.roster[1]]), `${k} 帶了一個人：${msg}`);
  const full = R.newRun(R.mulberry(5), 'kui', 'draft', 'office'); for (const h of ['kevin', 'mi', 'jie', 'qiang', 'xu']) R.join(full, h); ok(!R.eventOk(full, k, 0) && R.eventOk(full, k, 1), k + ' 滿編時只能選另一個'); }
// 人少的時候事件比較常是招募事件
{ let rec = 0; for (let sd = 1; sd <= 300; sd++) { const run = R.newRun(R.mulberry(sd), 'kui', 'draft', 'office'); run.floor = 4; R.prepare(run); if (R.EVENTS[run.events[4]].recruit) rec++; } console.log(`人少時第五站的事件是招募事件的比例：${Math.round(rec / 3)}%`); ok(rec > 120 && rec < 200, '大約一半'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
