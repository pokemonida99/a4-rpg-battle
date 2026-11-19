// node export.mjs stills <t ...>          → out/stills/t_XXX.jpg＋總覽圖 out/stills/sheet_NN.jpg（沒給時間就每 3 秒一張）
// node export.mjs events                 → out/events.json（音效事件、配樂區段、片長；給 tools/mix.py）
// node export.mjs part <a> <b> <file>    → 錄 a～b 秒（沒聲音）
// node export.mjs video [workers=2]      → out/video.mp4（分段同時錄再接起來；有 out/mix.wav 就配上）
import fs from 'node:fs'; import path from 'node:path'; import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/');
const puppeteer = require('puppeteer-core');
const ROOT = path.dirname(new URL(import.meta.url).pathname), PORT = 4630, OUT = path.join(ROOT, 'out'), URL0 = `http://localhost:${PORT}/?capture`;
const [mode = 'stills', ...args] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
async function open() {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
  page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[error]', e.message));
  await page.goto(URL0); await page.waitForFunction('window.ready === true', { timeout: 90000 });
  const frame = (t, q) => page.evaluate(async (t, q) => (await window.capture(t, q)).split(',')[1], t, q);
  return { browser, page, frame };
}
if (mode === 'events') {
  const { browser, page } = await open(); const ev = await page.evaluate(() => ({ dur: window.DURATION, sfx: window.sfx, music: window.music })); fs.writeFileSync(path.join(OUT, 'events.json'), JSON.stringify(ev, null, 1)); await browser.close(); console.log('events', ev.sfx.length, 'dur', ev.dur.toFixed(2));
} else if (mode === 'stills') {
  const { browser, page, frame } = await open(), dir = path.join(OUT, 'stills'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const dur = await page.evaluate(() => window.DURATION); let ts = args.map(Number); if (!ts.length) for (let t = 1; t < dur; t += 3) ts.push(t);
  const files = []; for (const t of ts) { const f = path.join(dir, `t_${t.toFixed(2).padStart(6, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(await frame(t, .9), 'base64')); files.push(f); }
  await browser.close();
  for (let i = 0; i * 6 < files.length; i++) { const fs6 = files.slice(i * 6, i * 6 + 6), n = fs6.length; if (n < 2) break;
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...fs6.flatMap(f => ['-i', f]), '-filter_complex', `${fs6.map((_, k) => `[${k}:v]scale=960:540[v${k}]`).join(';')};${fs6.map((_, k) => `[v${k}]`).join('')}xstack=inputs=${n}:layout=${['0_0', 'w0_0', '0_h0', 'w0_h0', '0_h0+h1', 'w0_h0+h1'].slice(0, n).join('|')}:fill=black`, '-q:v', '3', path.join(dir, `sheet_${String(i).padStart(2, '0')}.jpg`)]); }
  console.log('stills', files.length, 'dur', dur.toFixed(2));
} else if (mode === 'part') {
  const [a, b, file] = [+args[0], +args[1], args[2]], { browser, frame } = await open(), fps = 30, n0 = Math.round(a * fps), n1 = Math.round(b * fps), t0 = Date.now();
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = n0; i < n1; i++) { const buf = Buffer.from(await frame(i / fps, .95), 'base64'); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if ((i - n0) % 150 === 0) fs.writeFileSync(file + '.log', `${i - n0}/${n1 - n0} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); fs.writeFileSync(file + '.log', `done ${n1 - n0} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`); await browser.close();
} else if (mode === 'video') {
  const Wk = +(args[0] || 2); const probe = await open(); const dur = await probe.page.evaluate(() => window.DURATION); await probe.browser.close(); const fps = 30, N = Math.round(dur * fps), parts = path.join(OUT, 'parts'); fs.rmSync(parts, { recursive: true, force: true }); fs.mkdirSync(parts, { recursive: true });
  const jobs = Array.from({ length: Wk }, (_, k) => { const a = Math.round(N * k / Wk) / fps, b = Math.round(N * (k + 1) / Wk) / fps, f = path.join(parts, `p${k}.mp4`); return new Promise((res, rej) => spawn('node', [path.join(ROOT, 'export.mjs'), 'part', a, b, f], { stdio: 'inherit' }).on('close', c => (c ? rej(new Error(`part ${k} 失敗`)) : res(f)))); });
  const files = await Promise.all(jobs); fs.writeFileSync(path.join(parts, 'list.txt'), files.map(f => `file '${f}'`).join('\n'));
  const out = path.join(OUT, 'video.mp4'), audio = path.join(OUT, 'mix.wav'), has = fs.existsSync(audio);
  const a = has ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-af', 'apad', '-ar', '48000', '-c:a', 'aac', '-b:a', '224k', '-shortest'] : [];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(parts, 'list.txt'), ...a, '-c:v', 'copy', '-movflags', '+faststart', out], { stdio: 'inherit' });
  console.log('wrote', out, has ? '' : '（沒有聲音檔）');
}
