// 玩法影片 ①　超級化（約一分鐘）。node tools/howto/super.mjs
import path from 'node:path'; import { open, ROOT } from './lib.mjs';
const A = await open('super', 'seed=9&map=office&cycle=2&stage=chief&team=qiang,jie,mi');
const cmd = '(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || !!__game.state.over';
await A.boot('window.__game && __game.phase === "title" && __game.zones.some(z => z.big)');
{ const z = await A.ev(() => { const z = __game.zones.find(z => z.big); return [z.x + (z.w || 0) / 2, z.y + (z.h || 0) / 2]; }); await A.page.mouse.click(z[0], z[1]); }
await A.boot('__game.phase === "pick" && __game.menu'); await A.ev(() => __game.press(0)); await A.run(.5, false); await A.boot('__game.phase === "pick" && __game.menu && /第一招/.test(__game.menu.title || "")'); await A.ev(() => __game.press(0));
await A.boot('__game.phase === "hub" && __game.menu'); await A.run(.6, false);
await A.ev(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await A.run(.4, false); await A.ev(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
await A.until(cmd, false, 60); await A.run(.3, false);
const setMo = v => A.evArg(v => { const g = __game; g.state.mo = v; g.S.mo.push({ t: g.now + .1, v }); }, v), actor = () => A.ev(() => __game.actor), over = () => A.ev(() => !!__game.state.over);
const foe = () => A.ev(() => { const g = __game, s = g.state; return ['ma', 'mb', 'mc', 'md'].find(m => s.hp[m] > 0) || 'boss'; });
await setMo(86); await A.run(.4, false);

// 片頭
await A.tag('玩法 ①　超級化'); await A.big('超級化', ['氣勢滿了，就變身', '二週目開放'], 3.4, '上班旅人　玩法介紹'); await A.run(3.5);
// 第一個人：普通攻擊，把氣勢打滿
{ const x = await actor(); await A.cap('攻擊、放招式，都會累積上方的「氣勢」', 3.4); await A.run(1.3); await A.tapItem('攻擊'); await A.run(.5); await A.tapUnit(await foe()); await A.run(.5); await setMo(100); await A.until(`__game.actor !== ${JSON.stringify(x)} || !!__game.state.over`, true, 12); await A.run(.5); }
const after = { qiang: ['三回合內，打出去的傷害 ×2', async () => { await A.tapItem('攻擊'); await A.run(.5); await A.tapUnit(await foe()); }], kui: ['變身不用掉行動\n剩下的氣勢剛好接一招奧義', async () => { await A.tapItem('奧義'); }], jie: ['變身後招式不花 SP，HP 也回滿', async () => { await A.tapItem('技能'); await A.run(.7); await A.tapItem('副本給你主管'); }] };
let n = 0;
for (let k = 0; k < 40 && n < 3; k++) { await A.until(cmd, false, 60); if (await over()) break; const x = await actor(), can = await A.ev(() => __game.menu.items.some(m => m.label === '超級化' && !m.off));
  if (!can || !after[x]) { await A.ev(() => { const g = __game, i = g.menu.items.findIndex(m => m.label === '防禦' || m.label === '應援'); g.press(i); }); await A.run(.4, false); continue; }
  if (n === 0) { await A.cap('氣勢滿 100：指令多了一顆「超級化」', 3); await A.run(1.6); } else await A.run(.5);
  await A.tapItem('超級化'); await A.run(.4); await A.until(cmd, true, 12);      // 變身影片
  await A.cap(after[x][0], 3.4); await A.run(1.5); await after[x][1](); await A.run(.5); n++; if (n < 3) await setMo(100);
  await A.until(`__game.actor !== ${JSON.stringify(x)} || !!__game.state.over`, true, 14); await A.run(.6); }
await A.cap('小葵、阿傑、阿強、老油條、學姊、阿哲、小安\n每人每場可以變一次', 3.4); await A.run(3.5);
await A.end('上班旅人', ['通關一次，二週目就能「超級化」', '免費・不用登入・手機直接玩'], 3.8, 'A4不想上班 製作'); await A.run(3.9);
await A.finish(path.join(ROOT, 'out/howto/上班旅人_玩法1_超級化.mp4'));
