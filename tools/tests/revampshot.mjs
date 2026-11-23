// 11/24 系統改版的畫面截圖：職位、過關獎勵（一般／菁英／頭目／福委會）、福利社、報帳處兩頁、道具欄、戰鬥道具選單。node tools/tests/revampshot.mjs
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core'); const wait = ms => new Promise(r => setTimeout(r, ms));
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/revamp'; fs.mkdirSync(OUT, { recursive: true }); const errors = [];
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const shot = n => page.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 86 }), menu = () => page.evaluate(() => __game.menu && __game.menu.items.map(x => x.label + (x.off ? '(off)' : '')));
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&floor=4&team=kevin,mi,heilun&job=pick&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await wait(4000);
await page.evaluate(() => __game.pickJob()); await wait(900); await shot('1_job'); console.log('職位', await menu());
await page.evaluate(() => __game.press(4)); await wait(700); await shot('1b_job_reroll'); console.log('換一組', await menu());
await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" || (__game.menu && __game.menu.kind === "pick")', { timeout: 20000 }); await wait(1200);
for (let k = 0; k < 4 && await page.evaluate(() => __game.phase !== 'hub'); k++) { await page.evaluate(() => __game.press(0)); await wait(900); }
await page.evaluate(() => { const r = __game.run; r.coin = 400; Object.assign(r.items, { stapler: 2, warmer: 1, poncho: 1, stamp: 1, tonic: 1, bandage: 1 }); });
await page.evaluate(() => __game.openStore()); await wait(900); await shot('2_store'); console.log('福利社', await menu());
await page.evaluate(() => __game.openShop(0)); await wait(900); await shot('3_shop_items'); console.log('報帳處1', await menu());
await page.evaluate(() => __game.openShop(1)); await wait(900); await shot('4_shop_ups'); console.log('報帳處2', await menu());
for (const [tag, nd] of [['normal', { type: 'battle', tag: '戰鬥' }], ['elite', { type: 'battle', tag: '菁英' }], ['boss', { type: 'battle', tag: '頭目' }], ['gift', { type: 'gift' }]]) {
  await page.evaluate((nd, k) => { const r = __game.run; r.reward = null; r.node = nd; r.floor = 4 + k; r.path[r.floor] = 0; __game.openUpgrade(nd.type === 'gift'); }, nd, ['normal', 'elite', 'boss', 'gift'].indexOf(tag)); await wait(900); await shot('5_reward_' + tag); console.log('獎勵', tag, await menu()); }
await page.evaluate(() => { const r = __game.run; r.floor = 4; r.reward = null; }); await page.evaluate(() => __game.openPanel()); await wait(900); await shot('6_panel_items');
console.log('錯誤：', errors.length ? errors.slice(0, 6).join(' ／ ') : '無'); await browser.close();
