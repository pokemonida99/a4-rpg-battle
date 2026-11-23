// 11/24 改版的新按鈕用真的觸控點：換一組職位、報帳處「強化與服務」與「回道具」「離開」、過關獎勵「都先不要」。node tools/tests/revamptap.mjs
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core'); const wait = ms => new Promise(r => setTimeout(r, ms)); const errors = []; let bad = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'BAD ') + m); if (!c) bad++; };
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.stack.split('\n').slice(0, 3).join(' | ')));
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&floor=4&team=kevin,mi,heilun&job=pick&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await wait(4000);
// 按某張卡（menu.items 的第 i 個）的觸控區中心，用真的 touch
const tapItem = async pred => { const p = await page.evaluate(src => { const g = __game, f = new Function('m', 'return ' + src), i = g.menu.items.findIndex(m => f(m)); const z = g.zones.find(z => z.i === i); const cv = [...document.querySelectorAll('canvas')].at(-1).getBoundingClientRect(); return z ? { x: cv.left + (z.x + z.w / 2) * cv.width / 1920, y: cv.top + (z.y + z.h / 2) * cv.height / 1080, i } : null; }, pred.toString().replace(/^m => /, '')); if (!p) return false; await page.touchscreen.tap(p.x, p.y); await wait(700); return true; };
const labels = () => page.evaluate(() => __game.menu ? __game.menu.items.map(m => m.label) : []);
await page.evaluate(() => __game.pickJob()); await wait(800); const j0 = (await labels()).slice(0, 3);
ok(await tapItem(m => m.label === '換一組'), '點得到「換一組」'); const j1 = (await labels()).slice(0, 3); ok(j1.join() !== j0.join(), `職位換了：${j0} → ${j1}`);
ok(await tapItem(m => m.label === '一般職員'), '點得到「一般職員」'); await wait(1500); for (let k = 0; k < 4 && await page.evaluate(() => __game.phase !== 'hub'); k++) { await page.evaluate(() => __game.press(0)); await wait(800); }
ok(await page.evaluate(() => __game.run.job === 'staff' && __game.run.coin === 30), '一般職員：開局 30 點');
await page.evaluate(() => { const r = __game.run; r.coin = 400; r.path[r.floor] = 0; __game.openShop(0); }); await wait(800);
ok(await tapItem(m => m.label === '強化與服務'), '點得到「強化與服務」'); ok((await labels()).includes('換一格強化'), '到了第二頁');
ok(await tapItem(m => m.nav), '點得到「回道具」'); ok((await labels()).includes('強化與服務'), '回到第一頁');
const c0 = await page.evaluate(() => __game.run.coin); ok(await tapItem(m => !m.nav && !m.off && m.label !== '強化與服務'), '點一個道具買'); ok(await page.evaluate(c => __game.run.coin < c, c0), '錢有扣');
const fl = await page.evaluate(() => __game.run.floor); ok(await tapItem(m => m.nav), '點得到「離開」'); ok(await page.evaluate(f => __game.phase === 'hub' && __game.run.floor === f + 1, fl), '離開後到下一站');
await page.evaluate(() => { const r = __game.run; r.reward = null; r.node = { type: 'battle', tag: '戰鬥' }; r.path[r.floor] = 0; __game.openUpgrade(false); }); await wait(800); const c1 = await page.evaluate(() => __game.run.coin);
ok(await tapItem(m => m.label === '都先不要'), '點得到「都先不要」'); ok(await page.evaluate(c => __game.run.coin === c + 15 && __game.phase === 'hub', c1), '領 15 點回行程表');
console.log('錯誤：', errors.length ? errors.join(' ／ ') : '無'); console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); await browser.close();
