// 省電畫質的實機檢查（手機尺寸、真的觸控點）。用法：node tools/tests/lowshot.mjs [網址] [url]
// 起因（11/22 網友回報）：省電畫質下 3D 畫面整個停在最後一格——隊伍是阿傑＋Kevin，畫面上卻還是開機時的小葵和兩隻小兵。
// 檢查：① 以前被自動切到省電的人，打開後回到一般畫質 ② 一般畫質下場景會動 ③ 在設定裡點成省電，場景照樣會動、出手時人會移動 ④ 重新整理後還是省電（自己選的要留著），場景也會動
// 第二個參數給 url：不動設定，直接用網址的 ?low 開（拿來對照線上舊版：舊版這樣開，場景是停住的）
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms)); const BASE = process.argv[2] || 'http://localhost:4630/game.html', BYURL = process.argv[3] === 'url';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [], log = []; let bad = 0; const ok = (c, m) => { log.push((c ? '✓ ' : '✗ ') + m); if (!c) bad++; };
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
const URL = `${BASE}?mute&seed=9&map=office&fast=1&floor=3&team=jie,kevin&savetest${BYURL ? '&low' : ''}`;
const rect = () => page.evaluate(() => { const cv = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || document.querySelector('canvas'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
// 場景中間一條（人的身體那一帶，沒有介面的字和箭頭）：隔半秒拍兩次，一樣就是場景沒在重畫
const clip = async () => { const b = await rect(); return Buffer.from(await page.screenshot({ type: 'png', clip: { x: b.l + 500 / 1920 * b.w, y: b.t + 520 / 1080 * b.h, width: 1250 / 1920 * b.w, height: 120 / 1080 * b.h } })); };
const moving = async () => { const a = await clip(); await wait(600); const b2 = await clip(); return !a.equals(b2); };
const tapZone = async pick => { const z = await page.evaluate(src => { const z = __game.zones.find(eval(src)); return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null; }, pick.toString()); if (!z) return false; const b = await rect(); await page.touchscreen.tap(b.l + z.x / 1920 * b.w, b.t + z.y / 1080 * b.h); await wait(700); return true; };
const tapItem = async label => { const i = await page.evaluate(l => __game.menu ? __game.menu.items.findIndex(x => x.label === l) : -1, label); if (i < 0) return false; const z = await page.evaluate(i => { const z = __game.zones.find(z => z.i === i && !z.big); return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null; }, i); if (!z) return false; const b = await rect(); await page.touchscreen.tap(b.l + z.x / 1920 * b.w, b.t + z.y / 1080 * b.h); await wait(700); return true; };
const pref = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('a4rpg') || '{}'); } catch (e) { return {}; } });
const toBattle = async () => { await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await page.evaluate(() => __game.start()); await page.waitForFunction('(__game.phase === "pick" || __game.phase === "command") && __game.menu', { timeout: 60000 }); if (await page.evaluate(() => __game.phase) === 'command') { await wait(600); return; }      // 有存檔的時候大按鈕是「繼續上班」，直接回到戰鬥
  await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
  await page.evaluate(() => { const g = __game; g.go(0); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) g.go(0); }); await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 120000 }); await wait(600); };
const shot = n => page.screenshot({ path: path.join(OUT, `low_${n}.jpg`), type: 'jpeg', quality: 84 });
const done = async () => { console.log(log.join('\n')); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); console.log(bad ? `有 ${bad} 項沒過` : '全部通過'); await browser.close(); process.exit(bad ? 1 : 0); };

await page.goto(URL + `&fresh=${Date.now()}`);
if (BYURL) { await toBattle(); const mv = await moving(); ok(mv, `網址 ?low：場景${mv ? '會動' : '停住了'}`); await shot('byurl'); await done(); }
// ① 以前被自動切到省電的人
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('a4rpg', JSON.stringify({ low: true, set: true })); }); await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 });
{ const p = await pref(); ok(p.low === false && p.q2 === 1, `以前被切到省電的人：打開後是${p.low ? '省電' : '一般'}畫質`); }
await wait(4000); { const p = await pref(); ok(!p.low, '開始畫面放四秒：沒有自動切成省電'); }
// ② 一般畫質
await toBattle(); ok(await moving(), '一般畫質：場景會動'); await shot('1_normal');
// ③ 在設定裡點成省電
ok(await tapZone(z => z.opt === 'conf'), '點得到設定'); ok(await tapItem('畫質'), '點得到畫質'); { const p = await pref(); ok(p.low === true, `點完是${p.low ? '省電' : '一般'}`); } await shot('2_conf');
ok(await tapItem('回戰鬥'), '回戰鬥'); await wait(500); ok(await moving(), '省電畫質：場景會動'); await shot('3_low');
{ const a = await clip(); await page.evaluate(() => { const g = __game; g.press(0); }); await wait(300); await page.evaluate(() => { const g = __game; if (g.phase === 'command' && g.menu && g.menu.kind !== 'root') g.press(0); }); await wait(650); const b2 = await clip(); await shot('4_low_hit'); ok(!a.equals(b2), '省電畫質：出手時人有移動'); }
// ④ 重新整理：自己選的省電留著
await page.goto(URL + `&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); { const p = await pref(); ok(p.low === true, '重新整理後還是省電（自己選的不會被改回去）'); }
await toBattle(); ok(await moving(), '重新整理後的省電畫質：場景會動');
await page.evaluate(() => { localStorage.clear(); }); await done();
