// 錄出招節奏對照：node recswing.mjs <hero> <old|new> <outdir> [map] [stage]
// 遊戲用 ?fast=0.1 放慢 10 倍，一直截圖並記下遊戲時間 now，之後再照遊戲時間排成 60fps 影片。
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const [hero = 'kui', mode = 'new', out = 'rec', act = 'atk', map = 'office', stage = ''] = process.argv.slice(2); const wait = ms => new Promise(r => setTimeout(r, ms));
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message));
const team = [hero, ...['jie', 'kevin', 'mi', 'kui'].filter(h => h !== hero)].slice(0, 3).join();
await page.goto(`http://localhost:4630/game.html?mute&seed=3&map=${map}&team=${team}${hero !== 'kui' && !['jie'].includes(hero) ? '&back=kui' : ''}${stage ? '&stage=' + stage : '&floor=2'}${mode === 'old' ? '&oldswing' : ''}&fresh=${Date.now()}`);
await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await wait(9000); await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
await page.evaluate(() => { const g = __game; g.go(g.menu.items.filter(x => x.node != null).length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) g.go(g.menu.items.filter(x => x.node != null).length - 1); });
// 輪到 hero 之前，別人都按防禦
for (let k = 0; k < 12; k++) { await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 60000 }); const who = await page.evaluate(() => __game.actor); if (k === 0) console.log('隊伍', await page.evaluate(() => JSON.stringify([__game.front, __game.run.roster, __game.run.back, location.search]))); if (who === hero) break; await page.evaluate(() => { const g = __game, i = g.menu.items.findIndex(x => x.label === '防禦'); g.press(i); }); await wait(300); }
if (act === 'atk') { await page.evaluate(() => { const g = __game, i = g.menu.items.findIndex(x => x.label === '攻擊'); g.press(i); }); await wait(300); }
else { await page.evaluate(() => { const g = __game, i = g.menu.items.findIndex(x => x.label === '技能'); g.press(i); }); await wait(400); const got = await page.evaluate(name => { const g = __game, i = g.menu.items.findIndex(x => (x.label || '').includes(name)); if (i >= 0) g.press(i); return i >= 0 ? g.menu.items[i]?.label || 'ok' : 'NO:' + g.menu.items.map(x => x.label).join('/'); }, act); console.log('招式', got); await wait(300); }
// 放慢 10 倍再選目標
await page.evaluate(() => { window.__spd = .1; });
const t0 = await page.evaluate(() => { const g = __game; if (g.menu && g.menu.kind === 'target') { const i = g.menu.items.findIndex(x => x.target && x.target !== 'boss'); g.press(i >= 0 ? i : 0); } return g.now; });
let n = 0; const log = []; const tEnd = Date.now() + 40000;
while (Date.now() < tEnd) { const a = await page.evaluate(() => __game.now); const f = path.join(out, `f${String(n).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 88 }); const b = await page.evaluate(() => __game.now); const now = (a + b) / 2; log.push([n, now - t0, b - a]); n++; if (now - t0 > 1.6) break; }
fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log)); console.log(hero, mode, '張數', n, '錯誤', errors.length ? errors.slice(0, 3).join(' / ') : '無'); await browser.close();
