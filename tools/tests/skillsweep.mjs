// 每個招式都用一次：七組隊伍把 16 個夥伴的招式、奧義、合體技、普攻、防禦全部按過，看有沒有錯誤或卡住。
// 每次輪到人都把 SP、氣勢、HP 補滿，頭目的血也補回去，讓戰鬥不會結束。用法：node skillsweep.mjs [第幾組…]
import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const TEAMS = [[0, 'jie,senpai,you', 'chief'], [0, 'kevin,yan,an', 'chief'], [0, 'mi,xu,cha', 'chief'], [0, 'cha,qiang,wu', 'chief'], [0, 'zhe,fairy,xu', 'chief'], [1, 'vivi,heilun,fairy', 'chief'], [0, 'zhe,an,kevin', 'chief']];
const only = process.argv.slice(2).map(Number), FAST = process.env.FAST || 4, wait = ms => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required'] });
let allBad = 0;
for (const [ti, [starter, team, stage]] of TEAMS.entries()) { if (only.length && !only.includes(ti)) continue;
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://localhost:4630/game.html?mute&map=${process.env.MAPK || 'office'}&fast=${FAST}&seed=${11 + ti}&stage=${stage}&team=${team}&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
  await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu'); await page.evaluate(i => __game.press(i), starter); await wait(600); await page.evaluate(() => __game.press(0)); await page.waitForFunction('__game.phase === "hub" && __game.menu', { timeout: 30000 }); await wait(800);
  await page.evaluate(() => __game.go(0)); await wait(300); await page.evaluate(() => { if (__game.phase === 'hub') __game.go(0); });
  await page.evaluate(() => { window.__used = {}; window.__skip = {}; window.__last = performance.now(); window.__done = false;
    setInterval(() => { const g = __game; if (g.phase !== 'command' || !g.menu) return; const m = g.menu, s = g.state, id = g.actor; window.__last = performance.now();
      const U = __used[id] || (__used[id] = new Set());
      if (m.kind === 'root') { for (const h of g.front) { if (s.hp[h] > 0) { s.sp[h] = 999; s.hp[h] = Math.max(s.hp[h], 3000); } } s.mo = 100; if (s.hp.boss > 0) s.hp.boss = Math.max(s.hp.boss, 30000); window.__want = null;
        const has = l => m.items.findIndex(x => x.label === l && !x.off);
        if (has('技能') >= 0 && !U.has('@skills') && !U.has('@wait')) return void g.press(has('技能')); if (U.has('@wait')) { U.delete('@wait'); return void g.press(has('攻擊') >= 0 ? has('攻擊') : has('防禦')); }
        for (const l of ['奧義', '防禦', '攻擊', '應援']) if (has(l) >= 0 && !U.has(l)) { U.add(l); return void g.press(has(l)); }
        window.__done = g.front.every(h => !(s.hp[h] > 0) || (__used[h] && __used[h].has('@end'))); U.add('@end'); return void g.press(has('攻擊') >= 0 ? has('攻擊') : has('應援') >= 0 ? has('應援') : has('防禦')); }
      if (m.kind === 'skills') { const i = m.items.findIndex(x => !x.back && !x.off && !U.has(x.label)); for (const x of m.items) if (x.off && !x.back && !U.has(x.label)) (__skip[id] || (__skip[id] = new Set())).add(x.label);
        if (i < 0) { const left = m.items.some(x => !x.back && !U.has(x.label)); window.__try = window.__try || {}; __try[id] = (__try[id] || 0) + 1; if (!left || __try[id] > 5) U.add('@skills'); else U.add('@wait'); return void g.press(m.items.length - 1); } U.add(m.items[i].label); (__skip[id] || new Set()).delete(m.items[i].label); return void g.press(i); }
      const i = m.items.findIndex(x => !x.off && !x.back); g.press(i < 0 ? m.items.length - 1 : i); }, 120); });
  const t0 = Date.now(); let st = null;
  while (Date.now() - t0 < 300000) { await wait(1000); st = await page.evaluate(() => ({ done: __done, idle: performance.now() - __last, phase: __game.phase, over: __game.state.over, round: __game.state.round })); if (st.done || st.over || st.idle > 40000 || errors.length) break; }
  const rep = await page.evaluate(() => ({ used: Object.fromEntries(Object.entries(__used).map(([k, v]) => [k, [...v].filter(x => x[0] !== '@')])), skip: Object.fromEntries(Object.entries(__skip).map(([k, v]) => [k, [...v]]).filter(e => e[1].length)) }));
  const stuck = !st.done && !st.over && st.idle > 40000, bad = errors.length || stuck; if (bad) allBad++;
  console.log(`── 第 ${ti} 組 ${starter ? 'jie' : 'kui'},${team}　${st.round} 回合　${st.done ? '全部用過' : st.over ? '戰鬥結束：' + st.over : stuck ? '卡住（' + st.phase + '）' : '時間到'}　錯誤：${errors.length ? errors.slice(0, 4).join(' ／ ') : '無'}`);
  console.log('   用過：' + Object.entries(rep.used).map(([k, v]) => `${k} ${v.length}`).join('　') + (Object.keys(rep.skip).length ? '\n   一直按不了：' + JSON.stringify(rep.skip) : ''));
  await page.close(); }
await browser.close(); process.exit(allBad ? 1 : 0);
