// 站後排的人放合體技的實機檢查（手機尺寸、真的觸控點）。用法：node tools/tests/uniteback.mjs
// 隊伍：小葵、阿傑、Kevin 在前排，鼠仙女站後排。輪到鼠仙女時點「技能」→「午夜前全部重建」，確認放得出來、她有出手、阿傑的行動也用掉。
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [], log = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() === 404) errors.push('404 ' + r.url().split('/').slice(-2).join('/')); });
await page.goto(`http://localhost:4630/game.html?mute&seed=9&map=office&fast=1&stage=chief&team=jie,fairy,kevin&back=fairy&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
const shot = n => page.screenshot({ path: path.join(OUT, `ub_${n}.jpg`), type: 'jpeg', quality: 84 });
const done = async () => { console.log(log.join('\n')); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close(); process.exit(0); };
const rect = () => page.evaluate(() => { const cv = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || document.querySelector('canvas'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const tapItem = async label => { const z = await page.evaluate(l => { const g = __game, i = g.menu ? g.menu.items.findIndex(x => x.label === l) : -1, z = g.zones.find(z => z.i === i && !z.big && !z.soft) || g.zones.find(z => z.i === i && !z.big); return z ? { x: z.x + z.w / 2, y: z.y + z.h / 2 } : null; }, label); if (!z) return false; const b = await rect(); await page.touchscreen.tap(b.l + z.x / 1920 * b.w, b.t + z.y / 1080 * b.h); await wait(650); return true; };
const items = () => page.evaluate(() => __game.menu ? __game.menu.items.map(x => x.label + (x.off ? '(×)' : '') + (x.sub2 ? '〔' + x.sub2 + '〕' : '')).join(' ') : '沒有選單');
await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
const cmd = () => page.waitForFunction('(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || __game.state.over', { timeout: 120000 });
let fired = false;
for (let k = 0; k < 20 && !fired; k++) { await cmd(); await wait(300); const a = await page.evaluate(() => ({ who: __game.actor, back: __game.state.back, over: __game.state.over, round: __game.state.round })); if (a.over) { log.push('結束：' + a.over); break; }
  if (k === 0) log.push(`上場：${await page.evaluate(() => __game.run.roster.join())}｜後排 ${a.back}`);
  if (a.who === 'fairy') { await page.evaluate(() => { const s = __game.state; s.sp.fairy = 300; s.sp.jie = 300; }); log.push('鼠仙女（後排）的指令：' + await items()); await shot('1_root');
    if (!await tapItem('技能')) { log.push('點不到技能'); break; } log.push('技能裡：' + await items()); await shot('2_skills');
    const before = await page.evaluate(() => ({ q: __game.state.queue.join(), foe: ['boss', 'ma', 'mb'].map(f => f + ' ' + __game.state.hp[f]).join('、') }));
    if (!await tapItem('午夜前全部重建')) { log.push('點不到合體技（按鈕不在或被蓋住）'); break; } await wait(900); await shot('3_film'); await wait(2600); await shot('4_hit'); await wait(2600);
    const after = await page.evaluate(() => ({ q: __game.state.queue.join(), foe: ['boss', 'ma', 'mb'].map(f => f + ' ' + __game.state.hp[f]).join('、'), log: (__game.lastLog || []).slice(-2).join('｜') }));
    log.push(`放之前 敵人 ${before.foe}｜還沒動的 ${before.q}`); log.push(`放之後 敵人 ${after.foe}｜還沒動的 ${after.q}` + (after.log ? '｜' + after.log : '')); fired = true; break; }
  await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '防禦')); }); await wait(400); }
if (!fired) log.push('沒輪到鼠仙女（沒測到）');
// 同一回合輪到阿傑：他的行動已經被合體技用掉，不會再輪到他
{ await cmd(); const who = []; for (let k = 0; k < 6; k++) { await cmd(); await wait(250); const a = await page.evaluate(() => ({ who: __game.actor, round: __game.state.round, over: __game.state.over })); if (a.over || a.round > 1) break; who.push(a.who); await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '防禦' || x.label === '應援')); }); await wait(400); } log.push('這一回合後面輪到的人：' + (who.join('、') || '沒有人') + '（不應該有阿傑、鼠仙女）'); }
await done();
