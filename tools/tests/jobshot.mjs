// 職位的實機檢查（手機尺寸）：選職位畫面、行程表標題、強化清單
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = []; const wait = ms => new Promise(r => setTimeout(r, ms));
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.goto(`http://localhost:4630/game.html?mute&seed=${process.env.SEED || 4}&map=${process.env.MAPK || 'office'}&job=pick&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
const shot = n => page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 86 });
await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await wait(900); await shot('21_job_pick');
console.log('職位卡', await page.evaluate(() => __game.menu.items.map(x => x.label)));
await page.evaluate(i => __game.press(i), +(process.env.PICK || 0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(1400); await shot('22_job_hub');
console.log('職位', await page.evaluate(() => __game.run.job), '名冊', await page.evaluate(() => __game.run.roster), '額度', await page.evaluate(() => __game.run.coin));
await page.evaluate(() => { __game.openPanel(); }); await wait(500); await page.evaluate(() => __game.tab && __game.tab(0)); await wait(600); await shot('23_job_panel');
console.log('錯誤：', errors.length ? errors.slice(0, 5).join(' ／ ') : '無'); await browser.close();
