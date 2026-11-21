// UX 巡檢：背景開一個無頭 Chrome（node tools/tests/ux_step.mjs serve），之後每次執行送一個動作過去。只觀察，不改遊戲。
// 用法：node tools/tests/ux_step.mjs <指令> [參數…]
//   open <網址參數>   重新載入 game.html（載入時在 game.js 尾巴加一行 window.__zones，只存在這個分頁的記憶體，不動檔案）
//   shot <名字>       截圖到 out/ux/<名字>.jpg
//   zones             列出目前可以點的區域（畫布 1920×1080 座標），標出被別的區域蓋住、點不到的
//   tap <x> <y>       用真的觸控點畫布座標 (x,y)
//   tapi <i>          點第 i 個選項所在區域的正中間（zone.i === i；也可以寫 big、opt:名字、act:名字）
//   st                印出 phase／menu 種類／選項
//   eval <js>         在頁面執行
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/ux'; const wait = ms => new Promise(r => setTimeout(r, ms));
const [cmd, ...args] = process.argv.slice(2), CMD = path.join(OUT, '.cmd'), RES = path.join(OUT, '.res');
if (cmd !== 'serve') {      // 用戶端：寫指令、等結果
  try { fs.unlinkSync(RES); } catch {} fs.writeFileSync(CMD, JSON.stringify([cmd, args]));
  for (let k = 0; k < 1200; k++) { await wait(100); if (fs.existsSync(RES)) { console.log(fs.readFileSync(RES, 'utf8')); fs.unlinkSync(RES); process.exit(0); } } console.log('逾時'); process.exit(1); }
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: '/private/tmp/claude-502/-Users-hermes-Public-0720/fcf5d0bc-7ce1-4303-a506-0258754e9ec2/scratchpad/ux-profile', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
let out = []; const log = (...a) => out.push(a.join(' '));
const st = () => page.evaluate(() => { const g = window.__game; if (!g) return 'no game'; const m = g.menu; return JSON.stringify({ phase: g.phase, kind: m && m.kind, title: m && m.title, actor: g.actor, panel: !!g.panel, sheet: g.sheetId || null, items: m ? m.items.map((x, i) => i + ':' + (x.label || x.tab != null && 'tab' + x.tab || x.use || x.view || (x.node != null && 'node' + x.node) || '?') + (x.off ? '(×)' : '')).join(' ') : '' }); });
const cv = () => page.evaluate(() => { const c = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || [...document.querySelectorAll('canvas')].sort((a, b) => b.width - a.width)[0], r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, cw: c.width, ch: c.height }; });
const tap = async (x, y) => { const b = await cv(); await page.touchscreen.tap(b.l + x / 1920 * b.w, b.t + y / 1080 * b.h); };
async function run(cmd, args) {
if (cmd === 'open') {
  await page.setRequestInterception(true);
  const h = async req => { if (process.env.UXDBG) log('req', req.url()); if (req.url().split('?')[0].endsWith('/js/game.js')) { const r = await fetch(req.url()); let t = await r.text(); t = t.replace('let zones = [], pointer = null;', 'let zones = [], pointer = null; window.__zones = () => zones;'); return req.respond({ status: 200, contentType: 'application/javascript', body: t }); } req.continue(); };
  page.on('request', h);
  try { await page.goto(`http://localhost:4630/game.html?${args[0] || ''}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); } finally { page.off('request', h); await page.setRequestInterception(false); } await wait(1500); log(await st());
} else if (cmd === 'shot') { await page.screenshot({ path: path.join(OUT, args[0] + '.jpg'), type: 'jpeg', quality: 82 }); log(path.join(OUT, args[0] + '.jpg'));
} else if (cmd === 'zones') { const z = await page.evaluate(() => { const Z = window.__zones ? window.__zones() : null; if (!Z) return null; const hit = p => Z.find(z => !z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h) || Z.find(z => z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h); const m = window.__game.menu;
    return Z.map((z, k) => { const c = [z.x + z.w / 2, z.y + z.h / 2], h = hit(c); const lab = z.i != null && m && m.items[z.i] ? (m.items[z.i].label || m.items[z.i].use || m.items[z.i].view || 'node' + m.items[z.i].node) : (z.opt || z.act || ''); return `${k}: i=${z.i ?? '-'} ${lab}${z.off ? '(×)' : ''}${z.soft ? ' soft' : ''} [${Math.round(z.x)},${Math.round(z.y)} ${Math.round(z.w)}×${Math.round(z.h)}]` + (h !== z ? `  ← 中心被 ${Z.indexOf(h)} 蓋住` : '') + (z.w < 110 || z.h < 90 ? '  （小於 110×90）' : ''); }); }); log(z ? z.join('\n') : 'no zones hook');
} else if (cmd === 'tap') { await tap(+args[0], +args[1]); await wait(+args[2] || 900); log(await st());
} else if (cmd === 'tapi') { const a = args[0]; const z = await page.evaluate(a => { const Z = window.__zones(); const f = a === 'big' ? Z.find(z => z.big) : a.startsWith('opt:') ? Z.find(z => z.opt === a.slice(4)) : a.startsWith('act:') ? Z.find(z => z.act === a.slice(4)) : Z.find(z => z.i === +a); return f && [f.x + f.w / 2, f.y + f.h / 2]; }, a); if (!z) { log('找不到區域', a); } else { await tap(z[0], z[1]); await wait(+args[1] || 900); log(`點 (${Math.round(z[0])},${Math.round(z[1])})`, await st()); }
} else if (cmd === 'st') { log(await st());
} else if (cmd === 'eval') { log(JSON.stringify(await page.evaluate(args.join(' ')))); }

}
try { fs.unlinkSync(CMD); } catch {}
for (;;) { await wait(80); if (!fs.existsSync(CMD)) continue; const [c, a] = JSON.parse(fs.readFileSync(CMD, 'utf8')); fs.unlinkSync(CMD); out = [];
  if (c === 'quit') { fs.writeFileSync(RES, 'bye'); await browser.close(); process.exit(0); }
  try { await run(c, a); } catch (e) { out.push('例外：' + e.message); } if (errs.length) { out.push('錯誤：' + errs.join(' ／ ')); errs.length = 0; } fs.writeFileSync(RES, out.join('\n')); }
