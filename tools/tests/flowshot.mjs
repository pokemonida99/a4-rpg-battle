// 開局流程與福利社的實機檢查，全部用真的觸控點（座標從 __game.zones 換算成螢幕）。用法：node tools/tests/flowshot.mjs [flow|again]
// flow：路線 → 主角 → 招式，每一頁點「回上一頁」再往前 → 開場對話 → 行程表 → 福利社（買道具、抽同事、素質強化）
// again：打輸的結案報告點「再挑戰一次」→ 不重新讀取、直接回到開局 → 進一場戰鬥確認正常
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms)); const MODE = process.argv[2] || 'flow';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [], log = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() === 404) errors.push('404 ' + r.url().split('/').slice(-2).join('/')); });
let loads = 0; page.on('load', () => loads++);
await page.goto(`http://localhost:4630/game.html?mute&routes&fast=2&seed=9&fresh=${Date.now()}`); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); const loads0 = loads;
const shot = n => page.screenshot({ path: path.join(OUT, `fl_${MODE}_${n}.jpg`), type: 'jpeg', quality: 84 });
const rect = () => page.evaluate(() => { const cv = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || document.querySelector('canvas'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const tapXY = async (cx, cy) => { const b = await rect(); await page.touchscreen.tap(b.l + cx / 1920 * b.w, b.t + cy / 1080 * b.h); await wait(650); };
// 點選單第 i 項（或符合條件的那一項）的區域正中間
const tapItem = async pick => { const z = await page.evaluate(src => { const g = __game, f = eval(src), i = g.menu ? g.menu.items.findIndex(f) : -1, z = g.zones.find(z => z.i === i && !z.big && !z.soft) || g.zones.find(z => z.i === i && !z.big); return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2, i } : null; }, pick.toString()); if (!z) return false; await tapXY(z.x, z.y); return true; };
const tapBig = async () => { const z = await page.evaluate(() => { const z = __game.zones.find(z => z.big); return z ? { x: z.x + (z.w || 0) / 2, y: z.y + (z.h || 0) / 2 } : null; }); if (!z) return false; await tapXY(z.x, z.y); return true; };
const where = () => page.evaluate(() => { const g = __game, m = g.menu; return `${g.phase}｜${m ? (m.talk ? '對話：' + m.talk.lines[m.talk.i].join('：') : (m.title || m.kind) + '｜' + m.items.map(x => x.label + (x.off ? '(×)' : '')).join(' ')) : '沒有選單'}`; });
const done = async () => { console.log(log.join('\n')); console.log(`整頁讀取次數（開始之後）：${loads - loads0}`); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close(); process.exit(0); };

await tapBig(); await page.waitForFunction('__game.phase === "pick" && __game.menu', { timeout: 20000 }); await wait(500);
if (MODE === 'flow') {
  log.push('① ' + await where()); await shot('1_route');
  await tapItem(x => x.label === '一般行程'); log.push('② 點一般行程 → ' + await where()); await shot('2_starter');
  await tapItem(x => x.nav); log.push('③ 點回上一頁 → ' + await where());
  await tapItem(x => x.nav); log.push('④ 再點回上一頁 → ' + await where()); await wait(400);
  await tapBig(); await page.waitForFunction('__game.phase === "pick" && __game.menu', { timeout: 20000 }); await wait(400); await tapItem(x => x.label === '一般行程'); await tapItem(x => x.label === '小葵'); log.push('⑤ 重新走到招式 → ' + await where()); await shot('3_skill');
  await tapItem(x => x.nav); log.push('⑥ 招式頁點回上一頁 → ' + await where()); await tapItem(x => x.label === '小葵'); await tapItem(x => !x.nav); log.push('⑦ 選第一招 → ' + await where());
  for (let k = 0; k < 12; k++) { const w = await where(); if (w.startsWith('hub')) break; if (w.includes('對話：')) { if (k < 3) await shot('4_talk' + k); log.push('   ' + w); await tapXY(960, 500); } else { await tapItem(x => !x.nav); } }
  log.push('⑧ ' + (await where()).slice(0, 60)); await shot('5_hub');
  await page.evaluate(() => { __game.run.coin = 600; }); await tapItem(x => x.storeBtn); log.push('⑨ 點福利社 → ' + await where()); await shot('6_store');
  await tapItem(x => x.label === '珍珠奶茶'); log.push('⑩ 買奶茶 → ' + await page.evaluate(() => `奶茶 ${__game.run.items.tea}　剩 ${__game.run.coin} 點`));
  await page.evaluate(() => { history.replaceState(null, '', location.href); }); await tapItem(x => x.label === '抽同事'); log.push('⑪ 抽同事 → ' + await where()); await shot('7_draw'); if ((await where()).includes('對話：')) await tapXY(960, 500); log.push('   名冊 ' + await page.evaluate(() => __game.run.roster.join()) + '｜' + (await where()).slice(0, 50));
  await tapItem(x => x.label === '素質強化'); log.push('⑫ 素質強化 → ' + await where()); await shot('8_boost'); await tapItem(x => x.label.startsWith('攻擊')); log.push('   買攻擊 → ' + await page.evaluate(() => `攻擊倍率 ${__game.run.atk.toFixed(3)}　剩 ${__game.run.coin} 點`) + '｜' + (await where()).slice(0, 70));
  await tapItem(x => x.label === '回福利社'); await tapItem(x => x.label === '回行程表'); log.push('⑬ 回行程表 → ' + (await where()).slice(0, 40)); await shot('9_hub_after');
  await done();
}
// again
await tapItem(x => x.label === '一般行程'); await tapItem(x => x.label === '小葵'); await tapItem(x => !x.nav); for (let k = 0; k < 12; k++) { const w = await where(); if (w.startsWith('hub')) break; if (w.includes('對話：')) await tapXY(960, 500); else await tapItem(x => !x.nav); }
await page.evaluate(() => { window.__mark = 'still-here'; __game.testReport(false); }); await wait(1500); await shot('1_report'); log.push('結案報告：' + await page.evaluate(() => __game.phase));
await tapBig(); await wait(900); log.push('點再挑戰一次 → ' + await where() + '｜頁面還是同一個：' + await page.evaluate(() => window.__mark === 'still-here')); await shot('2_after');
await tapItem(x => x.label === '一般行程'); await tapItem(x => x.label === '阿傑'); await tapItem(x => !x.nav); for (let k = 0; k < 12; k++) { const w = await where(); if (w.startsWith('hub')) break; if (w.includes('對話：')) await tapXY(960, 500); else await tapItem(x => !x.nav); }
log.push('新的一輪：' + (await where()).slice(0, 40) + '｜主角 ' + await page.evaluate(() => __game.run.starter));
await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
log.push('出發之後：' + (await where()).slice(0, 80)); try { await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 60000 }); } catch (e) { log.push('等不到指令：' + (await where()).slice(0, 120) + '｜回合 ' + await page.evaluate(() => __game.state.round + ' over=' + __game.state.over + ' actor=' + __game.actor)); await shot('3_stuck'); await done(); } await wait(400); await shot('3_battle'); log.push('進到戰鬥：輪到 ' + await page.evaluate(() => __game.actor));
await done();
