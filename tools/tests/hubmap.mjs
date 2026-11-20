// 行程表地圖檢查：一般行程（放大／全覽／拖曳／點站）與台灣篇（三張紙、三條支線）
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/hubmap'; fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
async function open(q) { const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(`http://localhost:4630/game.html?mute&seed=5&${q}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
  await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu', { timeout: 30000 }); await page.evaluate(() => __game.press(0)); await new Promise(r => setTimeout(r, 600)); await page.evaluate(() => __game.press(0));
  await page.waitForFunction('__game.phase === "hub" && __game.menu', { timeout: 30000 }); await new Promise(r => setTimeout(r, 1500)); return page; }
const shot = async (page, name) => { const url = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); x.drawImage(document.getElementById('gl'), 0, 0); x.drawImage(document.getElementById('hud'), 0, 0); return c.toDataURL('image/jpeg', .85); }); fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); };
const wait = ms => new Promise(r => setTimeout(r, ms));
{ const p = await open('map=office&floor=4&team=kevin,mi'); await shot(p, 'o1_big'); const c0 = await p.evaluate(() => __game.mapCam);
  await p.mouse.move(1200, 500); await p.mouse.down(); await p.mouse.move(900, 300, { steps: 8 }); await p.mouse.up(); await wait(300); const c1 = await p.evaluate(() => __game.mapCam); await shot(p, 'o2_dragged');
  console.log('拖曳前後鏡頭', c0.map(v => Math.round(v * 100) / 100), c1.map(v => Math.round(v * 100) / 100), '階段', await p.evaluate(() => __game.phase));
  await p.evaluate(() => __game.mapLook([1090, 560], true)); await wait(200);
  // 點站：先找這一層開著的站在畫面上的位置（用選單的 node 項目），真的用滑鼠點
  const hit = await p.evaluate(() => { const g = __game; return { n: g.menu.items.filter(x => x.node != null).length, off: g.menu.items.filter(x => x.node != null).map(x => !!x.off) }; }); console.log('這一層', JSON.stringify(hit));
  await shot(p, 'o3_before_tap'); await p.close(); }
{ const p = await open('map=office&floor=4&team=kevin,mi'); await p.evaluate(() => { const z = [...document.querySelectorAll('canvas')]; }); // 切到全覽
  await p.mouse.click(1670 + 100, 110 + 18); await wait(1200); await shot(p, 'o4_fit'); await p.close(); }
{ const p = await open('map=taiwan'); await shot(p, 't1_start'); await p.evaluate(() => __game.go(0)); await wait(300); await p.close(); }
for (const fl of [2, 5, 7, 10, 12]) { const p = await open('map=taiwan&floor=' + fl + '&team=kevin,mi,heilun'); await shot(p, 't_floor' + fl); if (fl === 7) { await p.mouse.click(1770, 128); await wait(1200); await shot(p, 't_fit'); } await p.close(); }
console.log('錯誤：', errors.length ? errors.slice(0, 6).join(' ／ ') : '無'); await browser.close();
