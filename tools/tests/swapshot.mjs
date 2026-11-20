// 換人的實機檢查（手機尺寸）：六個人、指令列兩排、換人、隊伍列
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&stage=chief&team=kevin,mi,jie,qiang,xu&fast=2&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(1200);
const shot = n => page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 86 });
await shot('11_hub_six'); await page.evaluate(() => __game.go(0)); await wait(300); await page.evaluate(() => { if (__game.phase === 'hub') __game.go(0); });
const cmd = () => page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 60000 }); await cmd(); await wait(400); await shot('12_root_six');
console.log('指令', await page.evaluate(() => __game.menu.items.map(x => x.label)), '輪到', await page.evaluate(() => __game.actor));
await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '換人')); }); await wait(400); await shot('13_swap_menu'); await page.evaluate(() => __game.press(0)); await wait(900); await shot('14_swap_anim'); await cmd(); await wait(400); await shot('15_after_swap');
console.log('換人後上場', await page.evaluate(() => __game.front), '名冊', await page.evaluate(() => __game.run.roster));
// 再打幾下確認新上場的人能正常行動
for (let k = 0; k < 6; k++) { await page.evaluate(() => { const g = __game; g.press(0); }); await wait(300); await page.evaluate(() => { const g = __game; if (g.menu && g.menu.kind === 'target') g.press(0); }); await cmd(); await wait(200); }
await shot('16_later'); console.log('第', await page.evaluate(() => __game.state.round), '回合，錯誤：', errors.length ? errors.slice(0, 5).join(' ／ ') : '無'); await browser.close();
