// 隊伍頁的「站後排」按鈕：用真的觸控點下去（不是直接呼叫選單），看有沒有反應。用法：node tools/tests/backtap.mjs
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&floor=5&team=senpai,cha&fast=3&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
await page.evaluate(() => __game.openPanel()); await wait(900); await page.screenshot({ path: path.join(OUT, 't_1_before.jpg'), type: 'jpeg', quality: 80 });
const st = () => page.evaluate(() => JSON.stringify({ back: __game.run.back, sheet: !!(__game.menu && __game.menu.kind === 'sheet'), kind: __game.menu && __game.menu.kind, btn: __game.menu ? __game.menu.items.filter(x => x.bk != null).map(x => x.label).join() : '' }));
console.log('點之前：', await st());
// 使用者截圖上按鈕的位置：畫面 2000×923 的 (723, 446) → 這個視窗 870×402
const X = 723 / 2000 * 870, Y = 446 / 923 * 402; await page.touchscreen.tap(X, Y); await wait(900); console.log(`點 (${X.toFixed(0)}, ${Y.toFixed(0)}) 之後：`, await st()); await page.screenshot({ path: path.join(OUT, 't_2_after.jpg'), type: 'jpeg', quality: 80 });
console.log('錯誤：', errors.length ? errors.slice(0, 3).join(' ／ ') : '無'); await browser.close();
