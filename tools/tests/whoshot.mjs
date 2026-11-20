// 名冊滿了的招募：選新人 → 選誰回公司（手機尺寸）
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core'); const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:4630/game.html?mute&seed=6&map=office&floor=5&team=kevin,mi,jie,qiang,xu&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
const st = () => page.evaluate(() => `${__game.phase} 第${__game.run.floor + 1}站 名冊 ${__game.run.roster.join(',')}` + (__game.menu && __game.menu.items ? ' 卡片 ' + __game.menu.items.map(x => x.label).filter(Boolean).join('/') : ''));
const go = async i => { await page.evaluate(i => __game.go(i), i); await wait(350); await page.evaluate(i => { if (__game.phase === 'hub') __game.go(i); }, i); await wait(900); };
await go(1); console.log('1 點人力銀行 →', await st()); await page.evaluate(() => __game.press(1)); await wait(900); console.log('2 選第二位新人 →', await st()); await page.screenshot({ path: '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2/63_who_leaves.jpg', type: 'jpeg', quality: 84 });
await page.evaluate(() => __game.press(5)); await wait(700); console.log('3 還是不換 →', await st()); await page.evaluate(() => __game.press(1)); await wait(700); await page.evaluate(() => __game.press(1)); await wait(900); console.log('4 換掉第二張 →', await st());
console.log('錯誤：', errors.length ? errors.join(' ／ ') : '無'); await browser.close();
