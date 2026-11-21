// 玩法影片 ②　總體介紹（約一分鐘）：選路線與主角 → 開場對話 → 行程表 → 第一場戰鬥 → 過關獎勵 → 招募 → 福利社 → 隊伍與道具。node tools/howto/overview.mjs
import path from 'node:path'; import { open, ROOT } from './lib.mjs';
const A = await open('overview', 'seed=9&routes'), log = async s => console.log(s, '｜', (await A.where()).slice(0, 90));
const pick = '__game.phase === "pick" && !!__game.menu', hub = '__game.phase === "hub" && !!__game.menu && __game.menu.kind === "hub"', cmd = '(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || !!__game.state.over', talk = '__game.phase === "pick" && __game.menu && !!__game.menu.talk';
await A.boot('window.__game && __game.phase === "title" && __game.zones.some(z => z.big)'); await A.run(.5, false);
// 片頭：疊在標題畫面上
await A.big('上班旅人', ['不想上班的回合制冒險', '一分鐘看完怎麼玩'], 3.4, 'A4不想上班 製作'); await A.run(3.5);
await A.tag('玩法 ②　怎麼玩'); await A.ev(() => { __ov.tagX = 960; __ov.tagY = 18; });
// 選路線、主角、第一招
await A.tapZone('z => z.big'); await A.boot(pick); await A.run(.3, false); await log('路線');
await A.cap('選一條路線、一位主角，一個人出發', 4.6, 880); await A.run(1.5); await A.tapItem('一般行程'); await A.run(1.3); await A.tapItem('小葵'); await A.run(1.2); await A.tapItem('全部一起改'); await A.run(.6); await log('選完');
// 行程開場的卡片、開場對話
await A.until(pick, true, 6); await A.run(1.2); await A.tapItem('出發'); await A.until(talk, true, 5); await A.run(1.8); await A.tap(960, 500); await A.run(1.8); await A.tap(960, 500); await A.run(1.6); await A.tapItem('跳過'); await A.until(hub, true, 5); await log('行程表');
// 行程表
await A.ev(() => { __ov.tagX = 960; __ov.tagY = 14; }); await A.cap('照行程表一站一站走；遇到岔路自己選', 4, 620); await A.run(2.6); await A.tapItem('出發'); await A.run(.6);
await A.until(cmd, false, 40); await A.ev(() => { __ov.tagX = 752; __ov.tagY = 34; }); await A.run(.3, false); await log('戰鬥');
// 第一場戰鬥：小葵普攻 → 阿傑放招式 →（鏡頭外把小兵打到殘血）→ 小葵全體招式收掉
const actor = () => A.ev(() => __game.actor), foe = () => A.ev(() => ['ma', 'mb', 'mc', 'md'].find(m => __game.state.hp[m] > 0) || 'boss'), gone = x => `__game.actor !== ${JSON.stringify(x)} || !!__game.state.over`;
let did = { atk: false, skill: false };
for (let k = 0; k < 12; k++) { await A.until(cmd, false, 40); if (await A.ev(() => !!__game.state.over)) break; const x = await actor();
  if (!did.atk) { did.atk = true; await A.cap('回合制戰鬥：攻擊、招式、奧義輪流下指令', 4.2); await A.run(1.4); await A.tapItem('攻擊'); await A.run(.5); await A.tapUnit(await foe()); await A.until(gone(x), true, 10); await A.run(.3); continue; }
  if (!did.skill && x === 'jie') { did.skill = true; await A.run(.6); await A.tapItem('技能'); await A.run(.7); await A.tapItem('怒火另存新檔'); await A.run(.5); await A.tapUnit(await foe()); await A.until(gone(x), true, 10); await A.run(.3); await A.ev(() => { const s = __game.state; for (const m of ['ma', 'mb']) if (s.hp[m] > 0) s.hp[m] = 1; }); continue; }
  if (did.skill && x === 'kui') { await A.run(.5); await A.tapItem('技能'); await A.run(.7); await A.tapItem('全部一起改'); await A.until('!!__game.state.over', true, 10); break; }
  await A.ev(() => { const g = __game; g.press(g.menu.items.findIndex(m => m.label === '防禦')); }); await A.run(.4, false); }
await log('打完'); await A.until(`${pick}`, true, 14); await A.ev(() => { __ov.tagX = 960; __ov.tagY = 14; });
// 陪打的人離隊（對話）→ 過關獎勵
if (await A.ev(() => !!(__game.menu && __game.menu.talk))) { await A.run(1.7); await A.tap(960, 500); await A.until(`${pick} && !__game.menu.talk`, true, 5); }
await A.cap('打贏：三個強化挑一個，還會拿到報帳額度', 4, 880); await A.run(2.4); await A.tapIdx(0); await A.until(hub, true, 6); await log('獎勵後');
// 招募
await A.ev(() => { __game.run.coin = 300; }); await A.cap('路上招募同事：最多帶六個人，四人上場', 4.4, 620); await A.run(1.6); await A.tapItem('出發'); await A.until(pick, true, 6); await A.run(1.8); await A.tapIdx(0); await A.until(`${talk} || ${hub}`, true, 5);
if (await A.ev(() => !!(__game.menu && __game.menu.talk))) { await A.run(1.9); await A.tap(960, 500); await A.until(hub, true, 5); } await log('招募後');
// 福利社
await A.cap('錢拿去福利社：買道具、調人、強化全隊', 4.6, 620); await A.run(1.5); await A.tapItem('福利社'); await A.until(pick, true, 4); await A.run(1.6); await A.tapItem('珍珠奶茶'); await A.run(1.5); await A.tapItem('回行程表'); await A.until(hub, true, 4);
// 隊伍與道具
await A.cap('隊伍、道具、圖鑑隨時能看；進度會自動存', 4, 940); await A.run(.9); await A.tapItem('隊伍與道具'); await A.run(2.8); await log('隊伍頁');
// 片尾
await A.ev(() => { __ov.tag = ''; }); await A.end('上班旅人', ['四條路線・十六位同事・通關還有二週目', '免費・不用登入・手機直接玩'], 3.8, 'A4不想上班 製作'); await A.run(3.9);
await A.finish(path.join(ROOT, 'out/howto/上班旅人_玩法2_怎麼玩.mp4'), 'bgm/map');
