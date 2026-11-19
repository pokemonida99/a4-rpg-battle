// 試玩版自動測試：開無頭瀏覽器、自動按指令打完一場，沿途截圖，回報有沒有錯誤。
// 用法：node tools/playtest.mjs [seed=7] [打法=smart|mash] [快轉=5]   → 截圖在 out/play/
// 需要本機伺服器開在 4630（python3 tools/serve.py 4630）
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { execFileSync } from 'node:child_process';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname)), OUT = path.join(ROOT, 'out', 'play');
const [seed = '7', policy = 'smart', fast = '5'] = process.argv.slice(2);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 }); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
// PLAY_URL=https://…/ 可以改測線上版
const BASE = process.env.PLAY_URL || 'http://localhost:4630/game.html'; page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
await page.goto(`${BASE}?mute&fast=${fast}&seed=${seed}`);
await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
const shot = async name => { const url = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); x.drawImage(document.getElementById('gl'), 0, 0); x.drawImage(document.getElementById('hud'), 0, 0); return c.toDataURL('image/jpeg', .85); }); fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); };
await shot('00_title');
await page.evaluate(policy => {
  window.__log = []; __game.start();
  setInterval(() => { const g = __game; if (g.phase !== 'command' || !g.menu) return; const m = g.menu, s = g.state, F = ['kui', 'kevin', 'jie', 'mi'], id = g.actor;
    const note = t => __log.push(`${Math.round(g.now)}s R${s.round} ${id}: ${t}`);
    if (m.kind === 'root') {
      if (policy === 'mash') { note(m.items[0].label); return g.press(0); }
      const hurt = F.filter(h => s.hp[h] > 0 && s.hp[h] < 1100), dead = F.filter(h => s.hp[h] <= 0);
      if ((dead.length || hurt.length) && !m.items[2].off && id !== 'kui' && id !== 'jie') { note('道具'); return g.press(2); }
      if (!m.items[1].off && !(id === 'kevin' && !s.charging) && !(id === 'mi' && hurt.length < 1 && F.every(h => s.hp[h] > 1500))) { note('奧義'); return g.press(1); }
      if (s.charging && !s.aegis && id !== 'vivi') { note('防禦'); return g.press(3); }
      note(m.items[0].label); return g.press(0); }
    const i = m.items.findIndex(x => !x.off && !x.back); note('→ ' + m.items[i < 0 ? m.items.length - 1 : i].label); g.press(i < 0 ? m.items.length - 1 : i); }, 120);
}, policy);
let n = 1, lastLog = 0; const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  await new Promise(r => setTimeout(r, 900)); const st = await page.evaluate(() => ({ phase: __game.phase, now: __game.now, over: __game.state.over, round: __game.state.round, hp: __game.state.hp, n: __log.length }));
  if (n < 60) await shot(String(n++).padStart(2, '0') + `_r${st.round}_${Math.round(st.now)}s`);
  if (st.phase === 'over') { await new Promise(r => setTimeout(r, 1500)); await shot('99_end'); break; }
}
const fin = await page.evaluate(() => ({ phase: __game.phase, now: Math.round(__game.now), over: __game.state.over, round: __game.state.round, summons: __game.state.summons, hp: __game.state.hp, log: __log }));
await browser.close();
console.log(fin.log.join('\n')); console.log(JSON.stringify({ phase: fin.phase, now: fin.now, over: fin.over, round: fin.round, summons: fin.summons, hp: fin.hp })); console.log('錯誤：', errors.length ? errors : '無');
// 截圖排成總覽圖，每張 6 格
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(OUT, f));
for (let i = 0; i * 6 < files.length; i++) { const g = files.slice(i * 6, i * 6 + 6); if (g.length < 2) break;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...g.flatMap(f => ['-i', f]), '-filter_complex', `${g.map((_, k) => `[${k}:v]scale=960:540[v${k}]`).join(';')};${g.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${g.length}:layout=${['0_0', 'w0_0', '0_h0', 'w0_h0', '0_h0+h1', 'w0_h0+h1'].slice(0, g.length).join('|')}:fill=black`, '-q:v', '4', path.join(OUT, `sheet_${String(i).padStart(2, '0')}.jpg`)]); }
