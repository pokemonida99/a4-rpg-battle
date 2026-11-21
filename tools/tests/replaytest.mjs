// 戰鬥中存檔的基礎：同一顆亂數種子＋同樣的指令，重演出來的戰鬥要一模一樣（v0.28.0）
import * as R from '../../js/rules.js';
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('✗ ' + m); } };
const snap = s => JSON.stringify({ hp: s.hp, sp: s.sp, mo: s.mo, round: s.round, queue: s.queue, shield: s.shield, over: s.over, burn: s.burn, ward: s.ward, items: s.items, charging: s.charging, plan: s.plan, front: R.FRONT.slice(), roster: s.run.roster });
const setup = (map, floor, team, seed) => { const run = R.newRun(R.mulberry(seed), 'kui', 'draft', map); for (const h of team) R.join(run, h); R.prepare(run); run.floor = floor; for (let k = 0; k < floor; k++) run.path[k] = 0; R.prepare(run); const nd = R.enterNode(run, R.MAP[floor].findIndex(n => n.type === 'battle')); const base = JSON.stringify(R.saveRun(run, { pend: 'battle', bseed: seed * 7919 })); return { run, base, bseed: seed * 7919 }; };
// 跑一場：有 log 就照 log 重演，沒有就亂按（合法的指令裡隨機挑）。stopAt＝做到第幾個指令就停
function play(run, bseed, log, stopAt, pick) { run.rand = R.mulberry(bseed); const s = R.newState(run); let n = 0, guard = 0;
  while (!s.over && guard++ < 60) { R.startRound(s); while (s.queue.length && !s.over) { const id = s.queue.shift(); if (!R.beginTurn(s, id)) continue;
      if (!R.HEROES.includes(id)) { (R.isPet(id) ? R.petTurn(s, id) : R.enemyTurn(s, id)); continue; } if (n >= stopAt) { s.queue.unshift(id); return s; }
      let r; if (log) { ok(log[n][1] === id, `第 ${n} 筆輪到的人不一樣（${log[n][1]}／${id}）`); r = R.redo(s, log[n]); ok(!!r, `第 ${n} 筆重演失敗 ${JSON.stringify(log[n])}`); if (!r) return s; }
      else { const foes = R.foes(s), opts = []; if (id === 'vivi') opts.push(() => R.doCheer(s)); else { opts.push(() => R.doAttack(s, id, foes[Math.floor(pick() * foes.length)]), () => R.doDefend(s, id)); for (const sk of R.SKILLS[id]) if (R.knows(s, id, sk.key) && R.skillOk(s, id, sk)) opts.push(() => R.doSkill(s, id, sk.key, sk.target === 'foe' ? foes[Math.floor(pick() * foes.length)] : sk.target === 'ally' ? R.allyTargets(s, id, sk)[0] : undefined)); if (R.canUlt(s, id)) opts.push(() => R.doUlt(s, id)); for (const U of R.unitesOf(id)) if (R.uniteOk(s, id, U)) opts.push(() => R.doUnite(s, id, U.key, U.target === 'foe' ? foes[0] : undefined)); if (R.bench(s).length) opts.push(() => R.doSwap(s, id, R.bench(s)[0])); if (s.items.tea > 0 && R.itemsLeft(s) > 0) opts.push(() => R.doItem(s, id, 'tea', id)); }
        r = opts[Math.floor(pick() * opts.length)](); }
      n++; } }
  return s; }
let total = 0;
for (const [map, floor, team] of [['office', 5, ['kevin', 'mi', 'jie', 'qiang', 'xu']], ['taiwan', 6, ['cha', 'qiang', 'wu', 'yan']], ['hell', 8, ['zhe', 'an', 'fairy', 'senpai', 'you']], ['mirror', 9, ['kevin', 'mi', 'jie']], ['taiwan', 11, ['kevin', 'mi', 'jie', 'heilun', 'vivi']]])
  for (let seed = 1; seed <= 12; seed++) { const A = setup(map, floor, team, seed), pick = R.mulberry(seed * 13 + 1), stop = 4 + seed * 3; const s1 = play(A.run, A.bseed, null, stop, pick), log = s1.cmdLog.slice(), a = snap(s1);
    const back = R.loadRun({ ...JSON.parse(A.base), blog: log }, Math.random); ok(back && back.pend === 'battle' && back.bseed === A.bseed && back.blog.length === log.length, `${map} ${seed} 讀檔`); if (!back) continue;
    const s2 = play(back.run, back.bseed, back.blog, log.length, null), b = snap(s2); total++; ok(a === b, `${map} 第 ${floor + 1} 站 種子 ${seed}：重演 ${log.length} 個指令後狀態不一樣\n   原本 ${a.slice(0, 300)}\n   重演 ${b.slice(0, 300)}`); }
ok(R.loadRun({ ...JSON.parse(setup('office', 5, ['kevin'], 3).base), bseed: 'x' }, Math.random) === null, '壞掉的戰鬥存檔要作廢');
console.log(bad ? `有 ${bad} 項沒過` : `全部通過（${total} 場重演一致）`); process.exit(bad ? 1 : 0);
