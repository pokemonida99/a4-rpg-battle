// 眼睛開關的實機檢查（手機尺寸、真的觸控點）。用法：node tools/tests/eyeshot.mjs
// ① 有小燕：左上角有眼睛 → 點一下收起標籤 → 重新整理後還記得 → 等頭目蓄力，大招預告照樣顯示 → 再點一下打開
// ② 沒有小燕、學姊：沒有眼睛
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [], log = [];
const open = async team => { const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });
  await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&fast=2&stage=chief&team=${team}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
  await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } }); return page; };
const cmd = page => page.waitForFunction('(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || __game.state.over', { timeout: 120000 });
const eye = page => page.evaluate(() => { const z = __game.zones.find(z => z.opt === 'eye'); return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null; });
const tap = async (page, p) => { const b = await page.evaluate(() => { const cv = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || document.querySelector('canvas'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }); await page.touchscreen.tap(b.l + p.x / 1920 * b.w, b.t + p.y / 1080 * b.h); await wait(600); };
const pref = page => page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && v.includes('"eyeOff"')) return /"eyeOff":true/.test(v); } return false; });

let page = await open('kui,yan,jie'); await cmd(page); await wait(900); const shot = n => page.screenshot({ path: path.join(OUT, `eye_${n}.jpg`), type: 'jpeg', quality: 86 });
let e = await eye(page); log.push('① 有小燕：眼睛按鈕 ' + (e ? `在 (${e.x}, ${e.y})` : '沒有（不對）')); await shot('1_open');
await tap(page, e); log.push('   點一下 → 存起來的設定 eyeOff=' + await pref(page) + '｜還在指令選單：' + await page.evaluate(() => __game.phase + ' ' + (__game.menu && __game.menu.kind))); await shot('2_closed');
// 一直防禦到頭目蓄力，看大招預告有沒有留著
let ult = false; for (let k = 0; k < 40 && !ult; k++) { await cmd(page); if (await page.evaluate(() => !!__game.state.over)) break; ult = await page.evaluate(() => !!__game.state.charging); if (ult) break; await page.evaluate(() => { const g = __game, s = g.state; for (const h of g.front) if (s.hp[h] > 0) s.hp[h] = 9999; g.press(g.menu.items.findIndex(m => m.label === '防禦' || m.label === '應援')); }); await wait(300); }
await wait(900); log.push('   頭目蓄力中：' + ult + '（閉眼時的畫面看 eye_3_charge.jpg）'); await shot('3_charge');
e = await eye(page); await tap(page, e); log.push('   再點一下 → eyeOff=' + await pref(page)); await shot('4_open_charge'); await tap(page, e); await page.close();
page = await open('kui,jie,mi'); await cmd(page); await wait(900); log.push('② 沒有小燕、學姊：眼睛按鈕 ' + ((await eye(page)) ? '有（不對）' : '沒有')); await page.screenshot({ path: path.join(OUT, 'eye_5_nosense.jpg'), type: 'jpeg', quality: 86 }); await page.close();
console.log(log.join('\n')); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close();
