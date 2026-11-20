// 行程表某一站的截圖（手機尺寸）。用法：node floorshot.mjs office:5 office:8 hell:10 mirror:8　（地圖:第幾站）；FULL=1 把名冊塞滿六人
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; fs.mkdirSync(OUT, { recursive: true }); const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const a of process.argv.slice(2)) { const [map, fl, pick] = a.split(':'); const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://localhost:4630/game.html?mute&seed=6&map=${map}&floor=${fl}&team=${process.env.FULL ? 'kevin,mi,jie,qiang,xu' : 'kevin,mi'}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
  await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(1500);
  await page.screenshot({ path: path.join(OUT, `60_${map}_${fl}_hub.jpg`), type: 'jpeg', quality: 84 });
  const nodes = await page.evaluate(() => __game.menu.items.filter(x => x.node != null).map(x => x.label || x.node));
  if (pick != null) { await page.evaluate(i => __game.go(i), +pick); await wait(350); await page.evaluate(i => { if (__game.phase === 'hub') __game.go(i); }, +pick); await wait(1200); await page.screenshot({ path: path.join(OUT, `61_${map}_${fl}_pick${pick}.jpg`), type: 'jpeg', quality: 84 }); }
  console.log(a, '這一站的選項', JSON.stringify(nodes), '名冊', await page.evaluate(() => __game.run.roster.join(',')), '畫面', await page.evaluate(() => __game.phase + (__game.menu ? '/' + (__game.menu.title || __game.menu.kind) : '')), '錯誤：', errors.length ? errors.slice(0, 4).join(' ／ ') : '無'); await page.close(); }
await browser.close();
