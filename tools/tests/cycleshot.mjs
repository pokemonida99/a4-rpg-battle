// 週目的實機檢查（手機尺寸）：已經開到三週目的玩家，選路線 → 選週目 → 主角 → 招式 → 帶誰 → 出發。用法：node tools/tests/cycleshot.mjs [週目=3]
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms)); const CY = +(process.argv[2] || 3);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
await page.evaluateOnNewDocument(() => { try { localStorage.clear(); localStorage.setItem('a4rpg', JSON.stringify({ seen: ['kui', 'jie', 'kevin', 'mi', 'xu', 'fairy'], rec: { office: { n: 2, best: 30 } }, cyc: { office: 3 }, team: { office: ['kui', 'kevin', 'mi', 'xu', 'fairy', 'jie'] }, tips: ['basics'] })); } catch (e) {} });
await page.goto(`http://localhost:4630/game.html?mute&seed=9&fast=3&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await wait(2500); await page.evaluate(() => __game.start());
const shot = n => page.screenshot({ path: path.join(OUT, `c_${n}.jpg`), type: 'jpeg', quality: 84 }), labs = () => page.evaluate(() => (__game.menu ? __game.menu.items.map(x => x.label).join('｜') : '（沒有選單）'));
const pressLab = l => page.evaluate(l => { const g = __game, i = g.menu.items.findIndex(x => x.label === l); g.press(i < 0 ? 0 : i); }, l);
await page.waitForFunction('__game.menu && __game.menu.items.length >= 2'); await wait(700); console.log('路線：', await labs()); await shot('1_route'); await pressLab('一般行程'); await wait(800);
console.log('週目：', await labs()); await shot('2_cycle'); await pressLab(['一週目', '二週目', '三週目'][CY - 1]); await wait(800);
let l = await labs(); if (/加班|準時下班/.test(l)) { console.log('加班：', l); await page.evaluate(() => __game.press(0)); await wait(800); l = await labs(); }
console.log('主角：', l); await pressLab('小葵'); await wait(800); console.log('招式：', await labs()); await page.evaluate(() => __game.press(0)); await wait(900);
l = await labs(); console.log('帶誰：', l); await shot('3_carry'); await pressLab('Kevin'); await wait(900);
l = await labs(); if (!(await page.evaluate(() => __game.phase === 'hub'))) { console.log('職位：', l); await page.evaluate(() => { const g = __game; g.press(g.menu.items.length - 1); }); }
for (let k = 0; k < 6 && !(await page.evaluate(() => __game.phase === 'hub' && !!__game.menu)); k++) { await wait(900); console.log('   …', await page.evaluate(() => __game.phase + '／' + (__game.menu ? __game.menu.kind + ' ' + __game.menu.items.map(x => x.label).join('｜') : '無選單'))); await page.evaluate(() => { const g = __game; if (g.menu && g.phase !== 'hub') g.press(0); }); } await wait(1200); await shot('4_hub');
console.log('出發：', await page.evaluate(() => JSON.stringify({ cycle: __game.run.cycle, roster: __game.run.roster, carry: __game.run.carry, guest: __game.run.guest })));
console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 5).join(' ／ ') : '無'); await browser.close();
