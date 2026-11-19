// 試玩版數值模擬：node tools/sim.js [場數=500]
// 用三種打法各跑幾百場，看勝率與回合數。目標：會想的打法大多能贏、亂打會輸、一場大約 6～9 回合。
import { BOSS_ULT } from '../js/rules.js';
import { newState, startRound, beginTurn, alive, guarded, canUlt, doAttack, doDefend, doCheer, doItem, doUlt, enemyTurn, itemTargets, mulberry, STAT, FRONT, HEROES, MINIONS, ITEMS } from '../js/rules.js';

const lowest = s => FRONT.filter(h => alive(s, h)).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0];
const target = s => MINIONS.filter(m => alive(s, m)).sort((a, b) => s.hp[a] - s.hp[b])[0] || 'boss';
const POLICY = {
  // 會想的打法：小兵優先、看到蓄力開鐵壁、血少補血、Vivi 先應援再總攻擊
  smart(s, id) {
    const hurt = FRONT.filter(h => alive(s, h) && s.hp[h] / STAT[h].hp < .5), dead = FRONT.filter(h => !alive(s, h));
    if (dead.length && s.items.bento) return doItem(s, id, 'bento', dead[0]);
    if (id === 'kevin') { if (s.charging && canUlt(s, id)) return doUlt(s, id); if (s.charging) return doDefend(s, id); return doAttack(s, id, target(s)); }
    if (id === 'mi') { if (hurt.length >= 2 && canUlt(s, id)) return doUlt(s, id); if (hurt.length && s.items.tea) return doItem(s, id, 'tea', lowest(s)); return doAttack(s, id, target(s)); }
    if (id === 'vivi') { if (canUlt(s, id) && !guarded(s)) return doUlt(s, id); if (hurt.length && s.items.tea) return doItem(s, id, 'tea', lowest(s)); return doCheer(s); }
    if (s.charging && !s.aegis && s.hp[id] / STAT[id].hp < .7) return doDefend(s, id);
    if (canUlt(s, id)) return doUlt(s, id);
    if (s.sp[id] < STAT[id].cost && s.items.coffee && s.bp[id] >= 4) return doItem(s, id, 'coffee', id);
    return doAttack(s, id, target(s));
  },
  // 只會攻擊和放奧義，不補血不防禦
  rush(s, id) { if (canUlt(s, id)) return doUlt(s, id); return id === 'vivi' ? doCheer(s) : doAttack(s, id, target(s)); },
  // 只按攻擊（Vivi 只應援）
  mash(s, id) { return id === 'vivi' ? doCheer(s) : doAttack(s, id, target(s)); },
};
function play(policy, seed) {
  const s = newState(mulberry(seed)); let guard = 0;
  while (!s.over && guard++ < 60) { for (const id of startRound(s)) { if (s.over) break; if (!beginTurn(s, id)) continue; if (HEROES.includes(id)) POLICY[policy](s, id); else enemyTurn(s, id); } }
  return s;
}
const N = +(process.argv[2] || 500);
// 試數值用：HP=95000 CYCLE=5 ULT=.85 ATK=1200 node tools/sim.mjs
if (process.env.HP) STAT.boss.hp = +process.env.HP; if (process.env.CYCLE) STAT.boss.cycle = +process.env.CYCLE; if (process.env.ATK) STAT.boss.atk = +process.env.ATK; if (process.env.SH) STAT.boss.shield = +process.env.SH;
if (process.env.ULT) for (const k in BOSS_ULT) BOSS_ULT[k] = Math.round(BOSS_ULT[k] * +process.env.ULT);
for (const p of Object.keys(POLICY)) {
  let win = 0, rounds = 0, down = 0, sum = 0; const hist = {};
  for (let i = 0; i < N; i++) { const s = play(p, i * 7919 + 13); if (s.over === 'win') { win++; rounds += s.round; hist[s.round] = (hist[s.round] || 0) + 1; } down += FRONT.filter(h => !alive(s, h)).length; sum += s.summons; }
  console.log(`${p.padEnd(6)} 勝率 ${(win / N * 100).toFixed(0).padStart(3)}%  贏的場次平均 ${(rounds / Math.max(1, win)).toFixed(1)} 回合  平均倒下 ${(down / N).toFixed(2)} 人  平均被召喚 ${(sum / N).toFixed(2)} 次  回合分布 ${JSON.stringify(hist)}`);
}
