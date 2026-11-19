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
await page.goto(`${BASE}?mute&fast=${fast}&seed=${seed}${process.env.STAGE ? '&stage=' + process.env.STAGE : ''}${process.env.TEAM ? '&team=' + process.env.TEAM : ''}`);
await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
const shot = async name => { const url = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); x.drawImage(document.getElementById('gl'), 0, 0); x.drawImage(document.getElementById('hud'), 0, 0); return c.toDataURL('image/jpeg', .85); }); fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); };
await shot('00_title');
// RELOAD=hub:3（在第 4 站的行程表）或 RELOAD=pick:2（第 3 站打贏、選強化之前）：重新整理網頁，檢查存檔讀回來一樣，再接著玩
const inject = (how, keep = []) => page.evaluate((policy, HUB, PICK, how, keep) => {
  window.__log = keep; if (how === 'resume') __game.resume(); else __game.start();
  setInterval(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const nodes = g.menu.items.filter(x => x.node != null), i = HUB === 'rest' ? 0 : nodes.length - 1; window.__hubN = (window.__hubN || 0) + 1; if (window.__hubN < 12) return;      /* 在大地圖停一下讓截圖拍得到 */ window.__hubN = 0; __log.push(`${Math.round(g.now)}s 行程表：${nodes[i].label}　隊伍 ${g.run.roster.join(',')}`); return g.go(i); } if (g.phase === 'pick' && g.menu) { window.__pickN = (window.__pickN || 0) + 1; if (window.__pickN < 10) return; window.__pickN = 0; const k = PICK === 'last' ? g.menu.items.length - 1 : 0; __log.push(`${Math.round(g.now)}s 選卡「${g.menu.title}」：${g.menu.items[k].label}`); return g.press(k); } if (g.phase !== 'command' || !g.menu) return; const m = g.menu, s = g.state, F = g.front, id = g.actor;
    const note = t => __log.push(`${Math.round(g.now)}s R${s.round} ${id}: ${t}`);
    if (m.kind === 'root') {
      if (policy === 'mash') { note(m.items[0].label); return g.press(0); }
      const hurt = F.filter(h => s.hp[h] > 0 && s.hp[h] < 1100), dead = F.filter(h => s.hp[h] <= 0);
      if ((dead.length || hurt.length) && !m.items[3].off && id !== 'kui' && id !== 'jie') { note('道具'); return g.press(3); }
      if (!m.items[2].off && !(id === 'kevin' && !s.charging) && !(id === 'mi' && hurt.length < 1 && F.every(h => s.hp[h] > 1500))) { note('奧義'); return g.press(2); }
      if (s.charging && !s.aegis && id !== 'vivi') { note('防禦'); return g.press(m.items.length - 1); }
      if (!m.items[1].off && Math.random() < .45) { note('技能'); return g.press(1); }
      note(m.items[0].label); return g.press(0); }
    const i = m.items.findIndex(x => !x.off && !x.back); note('→ ' + m.items[i < 0 ? m.items.length - 1 : i].label); g.press(i < 0 ? m.items.length - 1 : i); }, 120);
}, policy, process.env.HUB || 'fight', process.env.PICK || 'first', how, keep);
await inject('start'); const RL = (process.env.RELOAD || '').split(':'); let reloaded = !RL[0];
const snap = src => page.evaluate(src => { const r = src === 'saved' ? __game.saved && __game.saved.run : __game.run; return r && JSON.stringify({ floor: r.floor, roster: r.roster, hp: r.hp, sp: r.sp, picks: r.picks, items: r.items, skills: r.skills }); }, src);
let n = 1, lastLog = 0; const t0 = Date.now();
while (Date.now() - t0 < 520000) {
  await new Promise(r => setTimeout(r, 900)); const st = await page.evaluate(() => ({ phase: __game.phase, now: __game.now, over: __game.state.over, round: __game.state.round, stage: __game.run.floor, hp: __game.state.hp, n: __log.length, title: __game.menu && __game.menu.title }));
  if (!reloaded && st.phase === RL[0] && st.stage === +RL[1] && (RL[0] !== 'pick' || st.title === '過關獎勵')) { reloaded = true; const before = await snap('run'), log = await page.evaluate(() => __log);
    await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 }); await new Promise(r => setTimeout(r, 700)); await shot('50_title_resume'); const after = await snap('saved');
    if (before !== after) errors.push(`存檔讀回來不一樣：\n  存 ${before}\n  讀 ${after}`); await inject('resume', log.concat(`── 重新整理（${RL.join(' ')}），讀取進度${before === after ? '一致' : '不一致'}`)); continue; }
  if (n < 90 && n % 2 === 1 | 1) await shot(String(n++).padStart(2, '0') + `_s${st.stage + 1}r${st.round}_${Math.round(st.now)}s`);
  if (st.phase === 'over') { await new Promise(r => setTimeout(r, 1500)); await shot('99_end'); break; }
}
const fin = await page.evaluate(() => ({ phase: __game.phase, now: Math.round(__game.now), over: __game.state.over, round: __game.state.round, summons: __game.state.summons, stage: __game.run.floor + 1, picks: __game.run.picks, hp: __game.state.hp, log: __log }));
await browser.close();
console.log(fin.log.join('\n')); console.log(JSON.stringify({ phase: fin.phase, now: fin.now, over: fin.over, stage: fin.stage, round: fin.round, picks: fin.picks, hp: fin.hp })); { const real = errors.filter(e => !/404|Failed to load resource/.test(e)), miss = errors.filter(e => e.startsWith('404')); fs.writeFileSync(path.join(OUT, 'log.txt'), fin.log.join('\n')); console.log('錯誤：', real.length ? real : '無', miss.length ? `（另有 ${miss.length} 個檔案 404：${[...new Set(miss.map(m => m.split('/').pop().split('_')[0]))].join(' ')}）` : ''); }
// 截圖排成總覽圖，每張 6 格
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.jpg')).sort().map(f => path.join(OUT, f));
for (let i = 0; i * 6 < files.length; i++) { const g = files.slice(i * 6, i * 6 + 6); if (g.length < 2) break;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...g.flatMap(f => ['-i', f]), '-filter_complex', `${g.map((_, k) => `[${k}:v]scale=960:540[v${k}]`).join(';')};${g.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${g.length}:layout=${['0_0', 'w0_0', '0_h0', 'w0_h0', '0_h0+h1', 'w0_h0+h1'].slice(0, g.length).join('|')}:fill=black`, '-q:v', '4', path.join(OUT, `sheet_${String(i).padStart(2, '0')}.jpg`)]); }
