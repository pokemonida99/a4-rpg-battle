// 第一場的陪打（v0.31.0）：沒被選的主角陪第一場，打贏就離隊
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
for (const [st, g] of [['kui', 'jie'], ['jie', 'kui']]) { const run = R.newRun(R.mulberry(4), st, null, 'office'); ok(run.roster.length === 1, '不呼叫 addGuest 還是一個人'); ok(R.addGuest(run) === g && run.guest === g && run.roster.join() === `${st},${g}` && run.hp[g] === R.STAT[g].hp, `${st} 開局，${g} 陪打`); ok(R.addGuest(run) === null, '不會加第二次'); R.prepare(run);
  const back = R.loadRun(R.saveRun(run), R.mulberry(1)); ok(back && back.run.guest === g && back.run.roster.join() === run.roster.join(), '存檔讀回還在');
  R.enterNode(run, 0); const s = R.newState(run); R.startRound(s); ok(R.FRONT.includes(g) && R.FRONT.includes(st), '兩個人都上場'); const U = R.UNITES.find(u => u.who.includes('kui') && u.who.includes('jie')); ok(R.unitesOf(st).includes(U), '有合體技');
  for (const f of R.foes(s)) s.hp[f] = 0; s.over = 'win'; R.endStage(s, run); ok(run.guest === null && run.guestLeft === g && run.roster.join() === st && run.hp[g] === undefined && run.skills[g] === undefined, `打贏第一場 ${g} 離隊`);
  R.advance(run); R.prepare(run); const of = Object.values(run.offers[1] || {}).flat(); ok(of.length === 3 && !of.includes(st), `第二站照常三選一（${of}）`);
  const b2 = R.loadRun(R.saveRun(run), R.mulberry(1)); ok(b2 && b2.run.guest === null && b2.run.roster.join() === st, '離隊後存檔讀回');
  const run2 = R.newRun(R.mulberry(4), st, null, 'office'); run2.tally.fights = 1; ok(R.addGuest(run2) === null, '打過仗就不再陪'); const run3 = R.newRun(R.mulberry(4), st, null, 'office'); run3.floor = 3; ok(R.addGuest(run3) === null, '不是第一站不陪'); }
{ const run = R.newRun(R.mulberry(4), 'kui', null, 'office', 0, 'hr'); R.addGuest(run); ok(run.roster.length === 3 && run.roster.includes('jie'), '人資專員＋陪打＝三個人'); R.prepare(run); R.enterNode(run, 0); const s = R.newState(run); for (const f of R.foes(s)) s.hp[f] = 0; s.over = 'win'; R.endStage(s, run); ok(run.roster.length === 2 && !run.roster.includes('jie'), '打完剩主角和人資帶來的人'); }
console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); process.exit(bad ? 1 : 0);
