// 玩法影片 ③　戰鬥（約一分鐘）：普攻與弱點 → 招式 → 合體技 → 奧義 → 換人 → 道具。node tools/howto/battle.mjs
import path from 'node:path'; import { open, ROOT } from './lib.mjs';
const A = await open('battle', 'seed=9&map=office&stage=chief&team=senpai,jie,kevin,mi,qiang'), log = async s => console.log(s, '｜', (await A.where()).slice(0, 110));
const cmd = '(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || !!__game.state.over';
await A.boot('window.__game && __game.phase === "title" && __game.zones.some(z => z.big)'); await A.tapZone('z => z.big', false);
await A.boot('__game.phase === "pick" && __game.menu'); await A.ev(() => __game.press(0)); await A.run(.5, false); await A.boot('__game.phase === "pick" && __game.menu && /拿手招/.test(__game.menu.title || "")'); await A.ev(() => __game.press(0));
await A.boot('__game.phase === "hub" && __game.menu'); await A.run(.6, false);
await A.ev(() => { const g = __game; g.run.skills.kui = ['draft', 'counter', 'sweep', 'deadline', 'backup']; const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await A.run(.4, false); await A.ev(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
await A.until(cmd, false, 60); await A.run(.3, false); await log('開打');
const actor = () => A.ev(() => __game.actor), over = () => A.ev(() => !!__game.state.over), foe = () => A.ev(() => ['ma', 'mb', 'mc', 'md'].find(m => __game.state.hp[m] > 0) || 'boss'), gone = x => `__game.actor !== ${JSON.stringify(x)} || !!__game.state.over`;
const has = lab => A.evArg(l => __game.menu.items.some(m => m.label === l && !m.off), lab), sub = lab => A.evArg(l => { const m = __game.menu.items.find(m => m.label === l); return m ? m.sub || '' : ''; }, lab);
const SK = { jie: '怒火另存新檔', kui: '先出一版', senpai: null, kevin: '盾擊' };

await A.tag('玩法 ③　戰鬥'); await A.big('戰鬥', ['回合制・四人上場', '看懂這幾件事就會打'], 3.4, '上班旅人　玩法介紹'); await A.run(3.5);
const did = { atk: 0, skill: 0, unite: 0, ult: 0, swap: 0, item: 0 }, left = () => Object.values(did).filter(v => !v).length;
for (let k = 0; k < 30 && left(); k++) { await A.until(cmd, false, 60); if (await over()) break; const x = await actor(); await log(`輪到 ${x}　還沒演 ${Object.keys(did).filter(q => !did[q]).join()}`);
  if (!did.atk) { did.atk = 1; await A.cap('普通攻擊會回 SP\n打中弱點，傷害多三成', 4.2); await A.run(1.5); await A.tapItem('攻擊'); await A.run(.6); await A.tapUnit(await foe()); await A.until(gone(x), true, 10); await A.run(.3); continue; }
  if (!did.unite && (await sub('技能')).startsWith('★')) { did.unite = 1; await A.cap('特定的夥伴同場，可以放「合體技」', 4); await A.run(1.4); await A.tapItem('技能'); await A.run(.9); await A.tapZone('(z, g) => g.menu && g.menu.items[z.i] && g.menu.items[z.i].unite && !z.off'); await A.run(.6); if (await A.ev(() => __game.menu && __game.menu.kind === 'target')) await A.tapUnit(await foe()); await A.until(`${cmd} || __game.phase === "anim" && __game.actor !== ${JSON.stringify(x)}`, true, 14); await A.run(.4); continue; }
  if (!did.skill && SK[x] && await has('技能')) { did.skill = 1; await A.cap('招式要花 SP，各有屬性和附加效果', 4); await A.run(1.4); await A.tapItem('技能'); await A.run(.9); await A.tapItem(SK[x]); await A.run(.6); if (await A.ev(() => __game.menu && __game.menu.kind === 'target')) await A.tapUnit(await foe()); await A.until(gone(x), true, 10); await A.run(.3); continue; }
  if (!did.ult && await has('奧義') && ['kui', 'jie', 'senpai'].includes(x)) { did.ult = 1; await A.cap('上方的「氣勢」到 40，就能放奧義', 4); await A.run(1.5); await A.tapItem('奧義'); await A.until(gone(x), true, 14); await A.run(.3); continue; }
  if (!did.swap && did.skill && await has('換人')) { did.swap = 1; await A.cap('輪到誰都能換候補上場\n每回合第一次換人不用掉行動', 4.4); await A.run(1.5); await A.tapItem('換人'); await A.run(.9); await A.tapIdx(0); await A.until(cmd, true, 8); await A.run(.4);
    await A.ev(() => { const g = __game, id = g.front.find(h => h !== g.actor && g.state.hp[h] > 0); g.state.hp[id] = Math.round(g.state.hp[id] * .28); g.S.hp[id].push({ t: g.now, v: g.state.hp[id] }); window.__hurt = id; });
    const y = await actor(); await A.ev(() => { const g = __game; g.press(g.menu.items.findIndex(m => m.label === '防禦')); }); await A.until(gone(y), false, 6); continue; }
  if (!did.item && did.swap && await has('道具')) { did.item = 1; await A.cap('血少就用道具：選了道具，直接點人', 4); await A.run(1.4); await A.tapItem('道具'); await A.run(.8); await A.tapItem('珍珠奶茶'); await A.run(.8); const t = await A.ev(() => (__game.menu.items.find(m => m.target === window.__hurt) || __game.menu.items[0]).target); await A.tapUnit(t); await A.until(gone(x), true, 8); await A.run(.3); continue; }
  await A.ev(() => { const g = __game; g.press(g.menu.items.findIndex(m => m.label === '防禦')); }); await A.run(.4, false); }
await log('演完'); await A.cap('候補每回合回三分之一 HP 和 SP\n前排倒下，候補會自動補上', 3.6); await A.run(3.7);
await A.ev(() => { __ov.tag = ''; }); await A.end('上班旅人', ['攻擊・招式・合體技・奧義・換人・道具', '免費・不用登入・手機直接玩'], 3.8, 'A4不想上班 製作'); await A.run(3.9);
await A.finish(path.join(ROOT, 'out/howto/上班旅人_玩法3_戰鬥.mp4'));
