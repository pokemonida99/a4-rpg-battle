// 設定頁的實機檢查，全部用真的觸控點。用法：node tools/tests/confshot.mjs
// 行程表點「設定」→ 切聲音、速度 → 現在存檔 → 回行程表；進戰鬥點「設定」→ 回到主畫面（按兩次）→ 主畫面按「繼續上班」→ 回到同一場戰鬥的同一回合
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [], log = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); let loads = 0; page.on('load', () => loads++);
await page.goto(`http://localhost:4630/game.html?seed=9&fast=2&fresh=${Date.now()}`); await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); const loads0 = loads;
const shot = n => page.screenshot({ path: path.join(OUT, `cf_${n}.jpg`), type: 'jpeg', quality: 84 });
const rect = () => page.evaluate(() => { const r = [...document.querySelectorAll('canvas')].find(c => c.width === 1920).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const tapXY = async (cx, cy) => { const b = await rect(); await page.touchscreen.tap(b.l + cx / 1920 * b.w, b.t + cy / 1080 * b.h); await wait(650); };
const tapZone = async src => { const z = await page.evaluate(s => { const g = __game, f = eval(s), z = g.zones.find(z => f(z, g)); return z ? [z.x + z.w / 2, z.y + z.h / 2] : null; }, src.toString()); if (!z) return false; await tapXY(z[0], z[1]); return true; };
const tapItem = lab => tapZone(`(z, g) => g.menu && z.i === g.menu.items.findIndex(x => x.label === ${JSON.stringify(lab)}) && !z.big`);
const tapOpt = k => tapZone(`z => z.opt === ${JSON.stringify(k)}`), tapBig = act => tapZone(act ? `z => z.big && z.act === ${JSON.stringify(act)}` : `z => z.big`);
const where = () => page.evaluate(() => { const g = __game, m = g.menu; return `${g.phase}｜${m ? (m.talk ? '對話' : (m.title || m.kind) + '：' + m.items.map(x => x.label + (x.val ? '〔' + x.val + '〕' : '')).join(' ')) : '沒有選單'}`; });
await shot('0_title'); await tapBig(); await page.waitForFunction('__game.phase === "pick" && __game.menu', { timeout: 20000 }); await wait(400);
for (let k = 0; k < 14; k++) { const w = await where(); if (w.startsWith('hub')) break; if (w.includes('對話')) await tapXY(960, 500); else await tapZone(`(z, g) => g.menu && z.i === 0 && !z.big`); }
log.push('① ' + (await where()).slice(0, 50)); await shot('1_hub');
log.push('② 點設定 → ' + await tapOpt('conf') + '｜' + await where()); await shot('2_conf_hub');
await tapItem('聲音'); await tapItem('戰鬥速度'); await tapItem('現在存檔'); log.push('③ 切聲音、速度、存檔 → ' + await where()); await shot('3_conf_changed');
await tapItem('回行程表'); log.push('④ 回行程表 → ' + (await where()).slice(0, 40));
await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 120000 }); await wait(400);
await tapItem('防禦'); await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 120000 }); await wait(400); await shot('4_battle');
const before = await page.evaluate(() => { const g = __game, s = g.state; return `輪到 ${g.actor}　第 ${s.round} 回合　指令 ${s.cmdLog.length} 個　HP ${JSON.stringify(s.hp)}`; }); log.push('⑤ 戰鬥中：' + before);
log.push('⑥ 點設定 → ' + await tapOpt('conf') + '｜' + (await where()).slice(0, 70)); await shot('5_conf_battle');
await tapItem('回到主畫面'); log.push('⑦ 按回到主畫面 → ' + (await where()).slice(-70)); await shot('6_confirm'); await tapItem('確定回主畫面'); await wait(900); log.push('⑧ 再按一次 → ' + await where()); await shot('7_title_again');
log.push('⑨ 有沒有「繼續上班」：' + await tapBig('cont')); await page.waitForFunction('__game.phase === "command" && __game.menu && __game.menu.kind === "root"', { timeout: 120000 }); await wait(500);
const after = await page.evaluate(() => { const g = __game, s = g.state; return `輪到 ${g.actor}　第 ${s.round} 回合　指令 ${s.cmdLog.length} 個　HP ${JSON.stringify(s.hp)}`; }); log.push('⑩ 繼續之後：' + after + (after === before ? '　← 跟離開前一樣 ✓' : '　← 不一樣 ✗')); await shot('8_resumed');
console.log(log.join('\n')); console.log(`整頁讀取次數（開始之後）：${loads - loads0}`); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close();
