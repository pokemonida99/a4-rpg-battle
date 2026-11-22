import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'OK  ' : 'BAD ') + m); };
const mk = (stage, map = 'office', team = ['jie', 'kevin', 'mi']) => { const run = R.newRun(R.mulberry(3), 'kui', 'draft', map); for (const h of team) R.join(run, h); run.alt = {}; const fl = R.MAP.findIndex(f => f.some(nd => nd.stage === stage)); run.floor = fl; run.node = R.MAP[fl].find(nd => nd.stage === stage); for (let q = 0; q < fl; q++) run.path[q] = 0; const s = R.newState(run); R.startRound(s); s.rand = () => .5; return s; };
let s, r;
// 連攜
s = mk('chief'); s.potUsed = true; r = R.doSkill(s, 'jie', 'burn', 'boss'); ok(s.burn.boss === 2, '先灼燒'); s.potUsed = true; r = R.doSkill(s, 'jie', 'freeze', 'boss'); ok(r.hits[0].combo === 'ice' && s.burn.boss === 0, `冰打灼燒中：急凍（${r.hits[0].v}），灼燒結束`);
s = mk('chief', 'office', ['heilun', 'jie', 'kevin']); r = R.doSkill(s, 'heilun', 'fineprint', 'ma'); ok(s.poison.ma.n === 3, '先中毒'); const hp0 = s.hp.ma; r = R.doSkill(s, 'jie', 'burn', 'ma'); ok(r.hits[0].combo === 'fire' && s.poison.ma.n === 0, '火打中毒中：引爆，中毒結束');
s = mk('chief', 'office', ['kevin', 'mi', 'jie']); r = R.doSkill(s, 'kevin', 'gavel', 'mb'); ok(s.stun.mb, '先暈眩'); r = R.doAttack(s, 'kevin', 'mb'); ok(r.hits[0].combo === 'blunt', '打屬性打暈眩中：追打');
s = mk('chief', 'office', ['mi', 'jie', 'kevin']); s.potUsed = true; R.doSkill(s, 'jie', 'freeze', 'boss'); const sh0 = s.shield; s.potUsed = true; r = R.doAttack(s, 'mi', 'boss'); ok(r.hits[0].combo === 'holy' && sh0 - s.shield === 1, `光打攻擊下降中：說教，底氣 ${sh0}→${s.shield}（v0.48 課長不怕光，只剩說教多削的那一點）`);
s = mk('chief', 'office', ['heilun', 'jie', 'kevin']); R.doSkill(s, 'heilun', 'mark', 'ma'); r = R.doAttack(s, 'jie', 'ma'); ok(r.hits[0].combo === 'dark', '暗打被標記的：落井下石');
// 第二階段
s = mk('boss'); s.hp.boss = Math.round(R.STAT.boss.hp * .49); const atk0 = R.STAT.boss.atk; ok(R.intent(s, 'boss').kind === 'phase2', '意圖預告變身'); for (const m of R.MINIONS) s.hp[m] = 0; r = R.enemyTurn(s, 'boss'); ok(r.kind === 'phase2' && r.summon && s.p2 && R.STAT.boss.cycle === 4 && R.STAT.boss.atk === Math.round(atk0 * 1.15), `第二階段：週期 ${R.STAT.boss.cycle}、攻擊 ${atk0}→${R.STAT.boss.atk}、叫回小兵`); r = R.enemyTurn(s, 'boss'); ok(r.kind !== 'phase2', '只變一次');
s = mk('tw_roof', 'taiwan'); ok(s.tier === 3 && !s.L.p2, '鐵皮處長：改成三層血，不再有第二階段（v0.49）');
s = mk('chief'); s.hp.boss = Math.round(R.STAT.boss.hp * .3); r = R.enemyTurn(s, 'boss'); ok(r.kind !== 'phase2', '中段頭目沒有第二階段');
console.log(bad ? `有 ${bad} 項沒過` : '全部通過');
