// 招式選單的實機檢查（手機尺寸）：每個上場的人各開一次「技能」截圖
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&stage=chief&team=${process.env.TEAM || 'jie,kevin,mi'}&fast=3&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(800);
await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(0); }); await wait(300); await page.evaluate(() => { if (__game.phase === 'hub') __game.go(0); });
const seen = new Set(); for (let k = 0; k < 8 && seen.size < 4; k++) { await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 90000 }); await wait(300); const id = await page.evaluate(() => __game.actor);
  if (!seen.has(id) && id !== 'vivi') { seen.add(id); await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '技能')); }); await wait(500); await page.screenshot({ path: path.join(OUT, `81_skills_${id}.jpg`), type: 'jpeg', quality: 86 }); console.log(id, await page.evaluate(() => __game.menu.items.length), '個選項'); await page.evaluate(() => __game.press(__game.menu.items.length - 1)); await wait(300); }
  await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '防禦')); }); await wait(400); }
console.log('錯誤：', errors.length ? errors.join(' ／ ') : '無'); await browser.close();
