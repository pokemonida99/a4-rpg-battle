// 候補區與復活的實機檢查（手機尺寸）。用法：node tools/tests/benchshot.mjs [sub|vivi|map]
// sub：前排倒下 → 候補自動補上 → 小米復活候補；vivi：Vivi 的「誰准你下班的」；map：行程表上用真的觸控點道具、再點人
import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms)); const MODE = process.argv[2] || 'sub';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2.3, isMobile: true, hasTouch: true }); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() === 404) errors.push('404 ' + r.url().split('/').slice(-2).join('/')); });
const team = MODE === 'vivi' ? 'kevin,jie,vivi' : 'kevin,mi,jie,qiang,xu', url = MODE === 'map' ? `map=office&floor=5&team=${team}&fast=3` : `map=office&fast=1&stage=chief&team=${team}`;
await page.goto(`http://localhost:4630/game.html?mute&seed=9&${url}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 90000 }); await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(() => __game.press(0)); await wait(700); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu'); await wait(900);
const shot = n => page.screenshot({ path: path.join(OUT, `bn_${MODE}_${n}.jpg`), type: 'jpeg', quality: 84 }), log = [];
const done = async () => { console.log(log.join('\n')); console.log('錯誤：', errors.length ? [...new Set(errors)].slice(0, 6).join(' ／ ') : '無'); await browser.close(); };

if (MODE === 'map') {
  await page.evaluate(() => { const g = __game, r = g.run; r.hp[r.roster[0]] = 300; r.sp[r.roster[1]] = 5; g.openPanel(); }); await wait(900); await shot('1_panel');
  const info = () => page.evaluate(() => { const g = __game, r = g.run; return `奶茶 ${r.items.tea}　咖啡 ${r.items.coffee}　${r.roster[0]} HP ${r.hp[r.roster[0]]}　${r.roster[1]} SP ${r.sp[r.roster[1]]}　選單 ${g.menu && g.menu.kind}`; });
  const tap = async (cx, cy) => { const b = await page.evaluate(() => { const cv = [...document.querySelectorAll('canvas')].find(c => c.width === 1920) || document.querySelector('canvas'), r = cv.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }); await page.touchscreen.tap(b.l + cx / 1920 * b.w, b.t + cy / 1080 * b.h); await wait(700); };
  log.push('一開始：' + await info());
  await tap(1232, 346); await shot('2_tea_picked'); log.push('點珍珠奶茶之後：' + await info());
  await tap(452, 267); await shot('3_tea_used'); log.push('點第一個人之後：' + await info());
  await tap(1232 + 248, 346); await tap(452, 267 + 142); await shot('4_coffee_used'); log.push('點黑咖啡再點第二個人之後：' + await info());
  await tap(1232 + 496, 346); log.push('點雞排便當（應該沒反應）：' + await info());
  await tap(452, 267 + 142 * 2); log.push('沒選道具時點第三個人（應該開資料）：' + await info());
  await done(); process.exit(0);
}

await page.evaluate(() => { const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } });
const cmd = () => page.waitForFunction('(__game.phase === "command" && __game.menu && __game.menu.kind === "root") || __game.state.over', { timeout: 120000 });
const press = lab => page.evaluate(l => { const g = __game, i = g.menu.items.findIndex(x => x.label === l); g.press(i < 0 ? g.menu.items.findIndex(x => x.label === '防禦' || x.label === '應援') : i); return i >= 0; }, lab);
const st = () => page.evaluate(() => { const g = __game, r = g.run, s = g.state; return { who: g.actor, round: s.round, over: s.over, hp: r.roster.map(id => id + ':' + (s.hp[id] != null && g.menu ? Math.max(0, s.hp[id]) : '?') + '/' + r.hp[id]).join(' '), roster: r.roster.join(), root: g.menu ? g.menu.items.map(x => x.label + (x.off ? '(×)' : '')).join(' ') : '' }; });

if (MODE === 'vivi') { let used = false;
  for (let k = 0; k < 30 && !used; k++) { await cmd(); await wait(250); const a = await st(); if (a.over) break;
    if (a.who === 'vivi') { log.push('Vivi 的指令：' + a.root); await shot('1_root'); await press('技能'); await wait(400); log.push('沒人倒下時的技能：' + await page.evaluate(() => __game.menu.items.map(x => x.label + (x.off ? '(×)' : '') + (x.sub2 ? '〔' + x.sub2 + '〕' : '')).join(' '))); await shot('2_skills_off'); await page.evaluate(() => { const g = __game; g.press(g.menu.items.length - 1); }); await wait(300);
      await page.evaluate(() => { __game.state.hp.jie = 0; }); await press('技能'); await wait(400); log.push('阿傑倒下後的技能：' + await page.evaluate(() => __game.menu.items.map(x => x.label + (x.off ? '(×)' : '')).join(' '))); await shot('3_skills_on');
      await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '誰准你下班的')); }); await wait(400); log.push('選對象：' + await page.evaluate(() => __game.menu ? __game.menu.kind + ' ' + __game.menu.items.map(x => x.label + (x.sub ? '〔' + x.sub + '〕' : '')).join(' ') : '直接放了')); await page.evaluate(() => { const g = __game; if (g.menu && g.menu.kind === 'allySkill') g.press(0); }); await wait(1500); await shot('4_cast'); await wait(1200); const b = await page.evaluate(() => `阿傑 HP ${__game.state.hp.jie}　Vivi SP ${__game.state.sp.vivi}`); log.push('用了之後：' + b); used = true; continue; }
    await press('防禦'); await wait(400); }
  if (!used) log.push('沒輪到 Vivi'); await done(); process.exit(0);
}

// sub：把阿傑的血壓到 1，等敵人把他打倒
let fell = false, revived = false, n = 0;
for (let k = 0; k < 60; k++) { await cmd(); await wait(250); const a = await st(); if (a.over) { log.push('結束：' + a.over); break; } if (a.round > 9) break;
  const down = await page.evaluate(() => __game.run.roster.filter(id => __game.run.hp[id] === 0).join());
  if (!fell && down) { fell = true; log.push(`R${a.round} 倒下的在候補區：${down}｜名冊 ${a.roster}`); await shot('2_after_sub'); }
  if (!fell) { await page.evaluate(() => { const s = __game.state; for (const id of ['jie']) if (s.hp[id] > 1) s.hp[id] = 1; }); if (k === 0) await shot('1_start'); }
  if (fell && !revived && a.who === 'mi') { await press('技能'); await wait(400); log.push('小米的招式：' + await page.evaluate(() => __game.menu.items.map(x => x.label + (x.off ? '(×)' : '')).join(' '))); await shot('3_mi_skills'); await page.evaluate(() => { const g = __game; g.press(g.menu.items.findIndex(x => x.label === '幫您重新接通')); }); await wait(400); log.push('選對象：' + await page.evaluate(() => __game.menu ? __game.menu.kind + ' ' + __game.menu.items.map(x => x.label + (x.sub ? '〔' + x.sub + '〕' : '')).join(' ') : '直接放了')); await shot('3b_pick'); await page.evaluate(() => { const g = __game; if (g.menu && g.menu.kind === 'allySkill') g.press(0); }); await wait(900); await shot('4_revive'); await wait(900); revived = true; log.push('復活之後候補的 HP：' + await page.evaluate(() => __game.run.roster.slice(4).map(id => id + ' ' + __game.run.hp[id] + '／SP ' + __game.run.sp[id]).join('、'))); continue; }
  if (revived && n < 3) { n++; log.push(`R${a.round} ${a.who}｜候補 ` + await page.evaluate(() => __game.run.roster.slice(4).map(id => id + ' HP ' + __game.run.hp[id]).join('、'))); if (n === 1) { const ok = await press('換人'); await wait(400); if (ok) { log.push('換人選單：' + await page.evaluate(() => __game.menu.items.map(x => x.label + '〔' + (x.sub || '') + '〕').join(' '))); await shot('5_swap_menu'); await page.evaluate(() => { const g = __game; g.press(g.menu.items.length - 1); }); await wait(300); } } }
  if (revived && n >= 3) break;
  await press('防禦'); await wait(400); }
if (!fell) log.push('沒有人倒下（沒測到）'); if (fell && !revived) log.push('沒輪到小米復活（沒測到）'); await done();
