// 考績表的實機檢查（手機尺寸）：標題畫面的入口與清單、打贏第一場跳出的小紙條
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.goto(`http://localhost:4630/game.html?mute&seed=4&map=office&fast=5&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
const shot = n => page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 86 });
await page.evaluate(() => { localStorage.setItem('a4rpg', JSON.stringify({ ...JSON.parse(localStorage.getItem('a4rpg') || '{}'), ach: { first: 1, weak5: 1, unite: 1, c_office: 1, wok: 1, job3: 1 } })); }); await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 }); await wait(800); await shot('41_title');
const box = await page.evaluate(() => { const r = document.getElementById('hud').getBoundingClientRect(); return { x: r.left, y: r.top, k: r.width / 1920 }; });
await page.touchscreen.tap(box.x + 584 * box.k, box.y + 981 * box.k); await wait(900); await shot('42_ach_list');
await page.touchscreen.tap(box.x + 900 * box.k, box.y + 500 * box.k); await wait(600);
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('a4rpg')); delete p.ach.first; localStorage.setItem('a4rpg', JSON.stringify(p)); }); await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(800);
await page.evaluate(() => __game.go(0)); await wait(300); await page.evaluate(() => { if (__game.phase === 'hub') __game.go(0); });
await page.evaluate(() => { setInterval(() => { const g = __game; if (g.phase !== 'command' || !g.menu) return; const m = g.menu; for (const f of ['ma', 'mb', 'mc']) if (g.state.hp[f] > 1) g.state.hp[f] = 1; const i = m.items.findIndex(x => !x.off && !x.back); g.press(i < 0 ? m.items.length - 1 : i); }, 150); });
await page.waitForFunction('__game.phase === "pick"', { timeout: 120000 }); await wait(700); await shot('43_ach_toast');
console.log('考績', await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('a4rpg')).ach)), '錯誤：', errors.length ? errors.slice(0, 5).join(' ／ ') : '無'); await browser.close();
