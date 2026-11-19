// 試玩版數值模擬：node tools/sim.mjs [場數=500]
// 四種打法各跑幾百輪「三關連打」，看通關率、各關的過關率與回合數。
// 目標：會想的打法幾乎都能通關、一般玩家六七成、只按攻擊過得了第一關但過不了頭目；一輪大約 15～20 回合。
// 試數值：S2HP=30000 S3HP=60000 S3ATK=950 node tools/sim.mjs
import { newRun, newState, endStage, offerUpgrades, applyUpgrade, startRound, beginTurn, alive, guarded, canUlt, doAttack, doDefend, doCheer, doItem, doUlt, doSkill, enemyTurn, mulberry, STAT, STAGES, FRONT, HEROES, MINIONS, MO } from '../js/rules.js';

const E = process.env;
if (E.S2HP) STAGES[1].boss.hp = +E.S2HP; if (E.S2ATK) STAGES[1].boss.atk = +E.S2ATK; if (E.S3HP) STAGES[2].boss.hp = +E.S3HP; if (E.S3ATK) STAGES[2].boss.atk = +E.S3ATK; if (E.S1HP) STAGES[0].minion.hp = +E.S1HP;
if (E.S2ULT) for (const k in STAGES[1].boss.ult) STAGES[1].boss.ult[k] = Math.round(STAGES[1].boss.ult[k] * +E.S2ULT); if (E.S3ULT) for (const k in STAGES[2].boss.ult) STAGES[2].boss.ult[k] = Math.round(STAGES[2].boss.ult[k] * +E.S3ULT);

const lowest = s => FRONT.filter(h => alive(s, h)).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0];
const weakMinion = s => MINIONS.filter(m => alive(s, m)).sort((a, b) => s.hp[a] - s.hp[b])[0];
const target = s => (guarded(s) || !alive(s, 'boss') ? weakMinion(s) : null) || (alive(s, 'boss') ? 'boss' : weakMinion(s));
const POLICY = {
  // 會想的打法：該清小兵就清、看到蓄力開鐵壁、血少補血、招式和奧義都會用
  smart(s, id) {
    const hurt = FRONT.filter(h => alive(s, h) && s.hp[h] / STAT[h].hp < .5), dead = FRONT.filter(h => !alive(s, h)), nMin = MINIONS.filter(m => alive(s, m)).length, boss = alive(s, 'boss');
    const spare = n => s.sp[id] - n >= (s.mo >= 26 ? STAT[id].cost : 0);      // 招式用完還要留得出奧義的 SP
    if (dead.length && s.items.bento) return doItem(s, id, 'bento', dead[0]);
    if (id === 'kevin') { if (s.charging && canUlt(s, id)) return doUlt(s, id); if (s.charging) return doDefend(s, id); if (!s.taunt && spare(16)) return doSkill(s, id, 'taunt'); return doAttack(s, id, target(s)); }
    if (id === 'mi') { if (hurt.length >= 2 && canUlt(s, id)) return doUlt(s, id); if (hurt.length >= 2 && spare(48)) return doSkill(s, id, 'soothe'); if (hurt.length && spare(36)) return doSkill(s, id, 'mend', lowest(s)); if (hurt.length && s.items.tea) return doItem(s, id, 'tea', lowest(s)); return doAttack(s, id, target(s)); }
    if (id === 'vivi') { if (canUlt(s, id) && !guarded(s) && boss) return doUlt(s, id); if (hurt.length && s.items.tea) return doItem(s, id, 'tea', lowest(s)); return doCheer(s); }
    if (s.charging && !s.aegis && s.hp[id] / STAT[id].hp < .7) return doDefend(s, id);
    if (canUlt(s, id) && (boss || nMin >= 2)) return doUlt(s, id);
    if (id === 'kui') { if (nMin >= 2 && spare(24)) return doSkill(s, id, 'sweep'); if (boss && !guarded(s) && spare(18)) return doSkill(s, id, 'retort', 'boss'); }
    if (id === 'jie') { if (nMin >= 2 && spare(40)) return doSkill(s, id, 'barrage'); if (boss && !guarded(s) && !(s.atkDown.boss > 0) && spare(50)) return doSkill(s, id, 'curse', 'boss'); }
    if (s.sp[id] < STAT[id].cost && s.items.coffee && s.mo >= 38) return doItem(s, id, 'coffee', id);
    return doAttack(s, id, target(s));
  },
  // 一般玩家：奧義亮了就放，有人快倒才想到補血，看到蓄力 Kevin 會擋；不太用招式
  casual(s, id) {
    const low = FRONT.filter(h => alive(s, h) && s.hp[h] / STAT[h].hp < .4);
    if (id === 'kevin' && s.charging) return canUlt(s, id) ? doUlt(s, id) : doDefend(s, id);
    if (id === 'mi' && low.length) { if (canUlt(s, id) && low.length >= 2) return doUlt(s, id); if (s.sp.mi >= 36) return doSkill(s, id, 'mend', lowest(s)); if (s.items.tea) return doItem(s, id, 'tea', lowest(s)); }
    if (id === 'vivi') { if (low.length && s.items.tea) return doItem(s, id, 'tea', lowest(s)); return canUlt(s, id) && !guarded(s) && alive(s, 'boss') ? doUlt(s, id) : doCheer(s); }
    if (canUlt(s, id) && id !== 'kevin' && id !== 'mi') return doUlt(s, id);
    return doAttack(s, id, target(s));
  },
  // 只會攻擊和放奧義，不補血不防禦
  rush(s, id) { if (canUlt(s, id)) return doUlt(s, id); return id === 'vivi' ? doCheer(s) : doAttack(s, id, target(s)); },
  // 只按攻擊（Vivi 只應援），而且不管護衛照打第一個目標
  mash(s, id) { return id === 'vivi' ? doCheer(s) : doAttack(s, id, target(s)); },
};
const PICK = { smart: ['raise', 'leave', 'chair', 'coffee', 'drinks', 'morale', 'bento'] };
function battle(policy, run) {
  const s = newState(run); let guard = 0;
  while (!s.over && guard++ < 80) { for (const id of startRound(s)) { if (s.over) break; if (!beginTurn(s, id)) continue; if (HEROES.includes(id)) POLICY[policy](s, id); else enemyTurn(s, id); } }
  return s;
}
function playRun(policy, seed) {
  const run = newRun(mulberry(seed)), rounds = [];
  for (let i = 0; i < STAGES.length; i++) { const s = battle(policy, run); rounds.push(s.round); if (s.over !== 'win') return { win: false, reached: i, rounds, down: 4 };
    const down = FRONT.filter(h => !alive(s, h)).length; endStage(s, run);
    if (i < STAGES.length - 1) { const offer = offerUpgrades(run), order = PICK[policy]; applyUpgrade(run, order ? [...offer].sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : offer[0]); }
    else return { win: true, reached: STAGES.length, rounds, down }; }
}
const N = +(process.argv[2] || 500);
for (const p of Object.keys(POLICY)) {
  let win = 0; const reach = STAGES.map(() => 0), rsum = STAGES.map(() => 0), rn = STAGES.map(() => 0); let total = 0;
  for (let i = 0; i < N; i++) { const r = playRun(p, i * 7919 + 13); if (r.win) { win++; total += r.rounds.reduce((a, b) => a + b, 0); } for (let k = 0; k < r.reached; k++) reach[k]++; r.rounds.forEach((v, k) => { if (k < r.reached) { rsum[k] += v; rn[k]++; } }); }
  console.log(`${p.padEnd(6)} 通關 ${(win / N * 100).toFixed(0).padStart(3)}%　過關率 ${reach.map((v, k) => `第${k + 1}關 ${(v / N * 100).toFixed(0)}%`).join('、')}　過關的平均回合 ${rsum.map((v, k) => (v / Math.max(1, rn[k])).toFixed(1)).join(' / ')}　通關總回合 ${(total / Math.max(1, win)).toFixed(1)}`);
}
