// 試玩版數值模擬：node tools/sim.mjs [場數=500]
// 四種打法 × 三種走法各跑幾百輪肉鴿路線（rules.js 的 MAP），看通關率與走到哪一站。
// 目標：會想的打法幾乎都能通關、一般玩家六七成、只按攻擊過得了第一關但過不了頭目；一輪大約 15～20 回合。
// 試數值：S2HP=30000 S3HP=60000 S3ATK=950 node tools/sim.mjs
import { newRun, newState, endStage, enterNode, advance, rest, offerUpgrades, applyUpgrade, startRound, beginTurn, alive, guarded, canUlt, doAttack, doDefend, doCheer, doItem, doUlt, doSkill, enemyTurn, mulberry, STAT, STAGES, MAP, FRONT, HEROES, MINIONS, MO } from '../js/rules.js';

const E = process.env;
if (E.S2HP) STAGES.chief.boss.hp = +E.S2HP; if (E.S2ATK) STAGES.chief.boss.atk = +E.S2ATK; if (E.S3HP) STAGES.boss.boss.hp = +E.S3HP; if (E.S3ATK) STAGES.boss.boss.atk = +E.S3ATK; if (E.S1HP) STAGES.crowd.minion.hp = +E.S1HP; if (E.NHP) STAGES.night.minion.hp = +E.NHP; if (E.NATK) STAGES.night.minion.atk = +E.NATK;
if (E.S2ULT) for (const k in STAGES.chief.boss.ult) STAGES.chief.boss.ult[k] = Math.round(STAGES.chief.boss.ult[k] * +E.S2ULT); if (E.S3ULT) for (const k in STAGES.boss.boss.ult) STAGES.boss.boss.ult[k] = Math.round(STAGES.boss.boss.ult[k] * +E.S3ULT);

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
// 走一輪行程表。route：'safe' 能休息就休息、'greedy' 都選戰鬥或福利、'auto' 血少才休息
function playRun(policy, seed, route = 'auto') {
  const run = newRun(mulberry(seed)), rounds = [], pick = () => { const offer = offerUpgrades(run), order = PICK[policy]; applyUpgrade(run, order ? [...offer].sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : offer[0]); };
  for (; run.floor < MAP.length;) { const opts = MAP[run.floor], hpK = FRONT.reduce((a, h) => a + run.hp[h] / STAT[h].hp, 0) / 4; let i = 0;
    if (opts.length > 1) i = route === 'safe' ? 0 : route === 'greedy' ? 1 : hpK < .62 ? 0 : 1;
    const nd = enterNode(run, i);
    if (nd.type === 'rest') rest(run); else if (nd.type === 'gift') pick();
    else { const s = battle(policy, run); rounds.push(s.round); if (s.over !== 'win') return { win: false, floor: run.floor, rounds }; endStage(s, run); if (run.floor < MAP.length - 1) pick(); }
    advance(run); }
  return { win: true, floor: MAP.length, rounds };
}
const N = +(process.argv[2] || 500);
for (const route of ['auto', 'safe', 'greedy']) { console.log(`── 路線：${{ auto: '血少才休息', safe: '都選茶水間', greedy: '都不休息' }[route]}`);
  for (const p of Object.keys(POLICY)) { let win = 0, total = 0; const reach = MAP.map(() => 0);
    for (let i = 0; i < N; i++) { const r = playRun(p, i * 7919 + 13, route); if (r.win) { win++; total += r.rounds.reduce((a, b) => a + b, 0); } for (let k = 0; k < r.floor; k++) reach[k]++; }
    console.log(`${p.padEnd(6)} 通關 ${(win / N * 100).toFixed(0).padStart(3)}%　走過各站的比例 ${reach.map(v => (v / N * 100).toFixed(0) + '%').join(' → ')}　通關的平均總回合 ${(total / Math.max(1, win)).toFixed(1)}`); } }
