// 玩法影片的錄影工具：開真的遊戲（game.html），把頁面的時間換成「虛擬時鐘」——每一格往前走 1/30 秒、畫完再截圖，所以不會掉格；
// 字卡、手指點擊的圈圈畫在疊在遊戲上面的一張畫布上（跟著虛擬時鐘淡入淡出）；音效照遊戲實際發出的時間記下來（game.js 的 window.__sndLog），最後混成一軌。
// 用法看 tools/howto/README.md；每支影片一個腳本（super.mjs、team.mjs、route.mjs），都呼叫這裡的 open()。
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), FPS = 30, W = 1920, H = 1080;
const wait = ms => new Promise(r => setTimeout(r, ms));
// 教學便條（第一次遇到才出現的那種）全部當作看過：影片有自己的字卡，兩種疊在一起會亂
const { KINDS } = await import(path.join(ROOT, 'js/rules.js')), TIPS_SEEN = ['super', 'pets', 'blind', 'sense', 'basics', 'ult', 'charge', 'broken', 'guard', 'pot', 'audit', 'parrot', 'monkey', 'pig', 'swap', 'combo', 'unite', 'weak', 'locks', 'mirror', 'hell_gate', 'hell_archive', 'hell_director', 'tw_pot', 'tw_night', 'tw_roof', ...Object.keys(KINDS).map(k => 'k_' + k)];

// 進頁面之前先裝好：虛擬時鐘、字卡畫布
function inject(pref) {
  try { localStorage.clear(); localStorage.setItem('a4rpg', JSON.stringify(pref)); } catch (e) { /* 沒關係 */ }
  let vt = 0, tid = 1; const raf = [], timers = new Map();
  performance.now = () => vt; const D0 = 1795000000000; Date.now = () => D0 + vt;
  window.requestAnimationFrame = fn => { raf.push(fn); return raf.length; }; window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms = 0, ...a) => { const id = tid++; timers.set(id, { t: vt + (+ms || 0), fn, a }); return id; }; window.clearTimeout = id => { timers.delete(id); };
  window.setInterval = (fn, ms = 0) => { const id = tid++, again = () => timers.set(id, { t: vt + (+ms || 16), fn: () => { again(); fn(); }, a: [] }); again(); return id; }; window.clearInterval = id => { timers.delete(id); };
  window.__sndLog = [];
  // ---- 字卡畫布 ----
  const OV = { caps: [], taps: [], tag: '', big: null, end: null, cv: null };
  const SERIF = '"Songti TC", "Noto Serif TC", "PMingLiU", serif', SANS = '"Noto Sans TC", sans-serif';
  const sat = x => Math.max(0, Math.min(1, x)), ease = x => 1 - (1 - x) ** 3;
  function drawOv() { if (!OV.cv) { const st = document.getElementById('stage'); if (!st) return; const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; cv.id = 'ov'; cv.style.zIndex = 50; st.appendChild(cv); OV.cv = cv; }
    const c = OV.cv.getContext('2d'), t = vt / 1000; c.clearRect(0, 0, 1920, 1080); c.textBaseline = 'alphabetic';
    const plate = (x, y, w, h, a) => { c.globalAlpha = a; c.fillStyle = 'rgba(20,12,6,.5)'; c.fillRect(x + 6, y + 8, w, h); c.fillStyle = '#efe6cf'; c.fillRect(x, y, w, h); c.fillStyle = '#2b1f18'; c.fillRect(x, y, w, 6); c.fillStyle = '#d8a02a'; c.fillRect(x, y + 6, w, 4); c.fillStyle = 'rgba(43,31,24,.12)'; c.fillRect(x, y + h - 5, w, 5); };
    // 小標（整支片都在；戰鬥畫面放上方「議程」和隊伍血條中間的空位）
    if (OV.tag) { c.font = `900 28px ${SERIF}`; const w = c.measureText(OV.tag).width + 44, x = (OV.tagX ?? 752) - w / 2, y = OV.tagY ?? 34; c.globalAlpha = 1; c.fillStyle = '#2b1f18'; c.fillRect(x, y, w, 48); c.fillStyle = '#d8a02a'; c.fillRect(x, y, 7, 48); c.fillStyle = '#efe6cf'; c.textAlign = 'left'; c.fillText(OV.tag, x + 24, y + 34); }
    // 說明字卡（畫面上方三分之一，不擋指令選單）
    for (const k of OV.caps) { const el = t - k.t0; if (el < 0 || el > k.dur) continue; const a = Math.min(sat(el / .25), sat((k.dur - el) / .3)), dy = (1 - ease(sat(el / .3))) * 26; c.font = `900 58px ${SERIF}`; const lines = k.text.split('\n'), w = Math.max(...lines.map(s => c.measureText(s).width)) + 110, h = 44 + lines.length * 76, x = 960 - w / 2, y = (k.y ?? 250) + dy; plate(x, y, w, h, a); c.fillStyle = '#2b1f18'; c.textAlign = 'center'; lines.forEach((s, i) => c.fillText(s, 960, y + 88 + i * 76)); }
    // 手指點的地方：一個圈往外散
    for (const k of OV.taps) { const el = t - k.t0; if (el < 0 || el > .7) continue; const u = el / .7; c.globalAlpha = 1 - u; c.strokeStyle = '#fff3c8'; c.lineWidth = 10 * (1 - u) + 3; c.beginPath(); c.arc(k.x, k.y, 26 + 70 * ease(u), 0, 7); c.stroke(); c.globalAlpha = (1 - u) * .9; c.fillStyle = '#ffe27a'; c.beginPath(); c.arc(k.x, k.y, 20 * (1 - u * .5), 0, 7); c.fill(); }
    // 片頭大字、片尾
    for (const B of [OV.big, OV.end]) { if (!B) continue; const el = t - B.t0; if (el < 0 || el > B.dur) continue; const a = Math.min(sat(el / .3), sat((B.dur - el) / .4)); c.globalAlpha = a * (B.dim ?? .72); c.fillStyle = '#0c0705'; c.fillRect(0, 0, 1920, 1080); c.globalAlpha = a; c.textAlign = 'center';
      c.fillStyle = '#d8a02a'; c.fillRect(960 - 330, 470, 660, 5); c.font = `900 150px ${SERIF}`; c.lineWidth = 14; c.strokeStyle = 'rgba(30,14,0,.9)'; c.strokeText(B.title, 960, 430); c.fillStyle = '#ffe9a8'; c.fillText(B.title, 960, 430);
      c.font = `900 66px ${SERIF}`; c.fillStyle = '#efe6cf'; (B.lines || []).forEach((s, i) => c.fillText(s, 960, 570 + i * 88)); if (B.foot) { c.font = `700 36px ${SANS}`; c.fillStyle = 'rgba(239,230,207,.8)'; c.fillText(B.foot, 960, 940); } }
    c.globalAlpha = 1; }
  window.__ov = OV;
  window.__step = dt => { vt += dt; for (const [id, k] of [...timers]) if (k.t <= vt) { timers.delete(id); try { k.fn(...k.a); } catch (e) { console.error('timer', e && e.message); } } const q = raf.splice(0); for (const fn of q) { try { fn(vt); } catch (e) { console.error('raf', e && e.stack || e); } } try { drawOv(); } catch (e) { console.error('ov', e && e.message); } return vt; };
}

export async function open(name, url, pref = {}) {
  const dir = path.join(ROOT, 'out/howto', name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', `--window-size=${W},${H}`] });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument(inject, { spd: 0, set: true, tips: TIPS_SEEN, dragged: true, noA2hs: true, ...pref });
  await page.goto(`http://localhost:4630/game.html?${url}&fresh=${Date.now()}`, { waitUntil: 'domcontentloaded' });
  let frames = 0, vt = 0; const spans = [];      // spans：錄了哪幾段虛擬時間 → 對到影片的第幾秒（給音效用）
  const tick = async rec => { vt = await page.evaluate(d => window.__step(d), 1000 / FPS); if (rec) { if (!spans.length || spans.at(-1).v1 !== vt - 1000 / FPS) spans.push({ v0: vt - 1000 / FPS, v1: vt, o0: frames / FPS }); else spans.at(-1).v1 = vt; await page.screenshot({ path: path.join(dir, `f_${String(++frames).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 93 }); } };
  const A = {
    page, errors, get frames() { return frames; }, get sec() { return frames / FPS; },
    // 往前走 sec 秒；rec＝要不要錄
    async run(sec, rec = true) { for (let i = 0; i < Math.round(sec * FPS); i++) await tick(rec); },
    // 一直走到條件成立（頁面裡的運算式字串）；最多 max 秒
    async until(expr, rec = true, max = 60) { for (let i = 0; i < max * FPS; i++) { if (await page.evaluate(expr)) return true; await tick(rec); } return false; },
    // 等素材載入（真實時間）：邊等邊讓虛擬時鐘走，不錄
    async boot(expr, maxReal = 120) { const t0 = Date.now(); while (Date.now() - t0 < maxReal * 1000) { if (await page.evaluate(expr)) return true; await tick(false); await wait(40); } return false; },
    ev: f => page.evaluate(f), evArg: (f, a) => page.evaluate(f, a),
    cap: (text, dur = 3, y) => page.evaluate((text, dur, y) => { __ov.caps.push({ text, dur, y, t0: performance.now() / 1000 }); }, text, dur, y),
    tag: text => page.evaluate(text => { __ov.tag = text; }, text),
    big: (title, lines, dur = 3.2, foot = '') => page.evaluate((title, lines, dur, foot) => { __ov.big = { title, lines, dur, foot, t0: performance.now() / 1000 }; }, title, lines, dur, foot),
    end: (title, lines, dur = 3.6, foot = '') => page.evaluate((title, lines, dur, foot) => { __ov.end = { title, lines, dur, foot, dim: .86, t0: performance.now() / 1000 }; }, title, lines, dur, foot),
    // 點畫面（畫布座標 1920×1080）：先畫圈、走幾格再真的點下去
    async tap(x, y, rec = true) { await page.evaluate((x, y) => { __ov.taps.push({ x, y, t0: performance.now() / 1000 }); }, x, y); await A.run(.18, rec); await page.mouse.click(x, y); await A.run(.12, rec); },
    // 點選單上某個字的按鈕
    async tapItem(label, rec = true) { const z = await page.evaluate(l => { const g = __game, i = g.menu ? g.menu.items.findIndex(x => x.label === l) : -1, z = g.zones.find(z => z.i === i && !z.big && !z.soft) || g.zones.find(z => z.i === i && !z.big); return z ? [z.x + z.w / 2, z.y + z.h / 2] : null; }, label); if (!z) return false; await A.tap(z[0], z[1], rec); return true; },
    async tapUnit(id, rec = true) { const p = await page.evaluate(id => __game.S.proj(id, .5), id); await A.tap(p[0], p[1], rec); },
    // 收尾：把音效對到影片時間、混音、壓成 mp4
    async finish(out, music = 'bgm/battle') { const log = await page.evaluate(() => window.__sndLog); await browser.close();
      const toOut = at => { const v = at * 1000; for (const s of spans) if (v >= s.v0 && v <= s.v1) return s.o0 + (v - s.v0) / 1000; return null; }, dur = frames / FPS;
      const sfx = log.filter(e => e.id && !e.id.startsWith('bgm/')).map(e => ({ t: toOut(e.at), id: e.id, v: e.v })).filter(e => e.t != null);
      fs.writeFileSync(path.join(ROOT, 'out/events.json'), JSON.stringify({ dur, sfx, music: music ? [{ id: music, t0: 0, t1: dur }] : [] }));
      execFileSync('uv', ['run', '--quiet', '--with', 'numpy', 'python', 'tools/mix.py'], { cwd: ROOT, stdio: 'inherit' }); fs.copyFileSync(path.join(ROOT, 'out/mix.wav'), path.join(dir, 'mix.wav'));
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f_%06d.jpg'), '-i', path.join(dir, 'mix.wav'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
      console.log(`${path.basename(out)}　${dur.toFixed(1)} 秒　${frames} 格　音效 ${sfx.length} 個　錯誤：${errors.length ? [...new Set(errors)].slice(0, 4).join(' ／ ') : '無'}`); },
  };
  return A;
}
