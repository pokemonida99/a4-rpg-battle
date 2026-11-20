// 五個新壞人的實機檢查：每一場開無頭瀏覽器自動打，機制發生的時候截圖。用法：node villshot.mjs parrot monkey pig crowd_a crowd_s night_a night_s
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/vill'; fs.mkdirSync(OUT, { recursive: true });
const stages = process.argv.slice(2), FAST = process.env.FAST || 3, BT = +(process.env.BT || 0), GAP = +(process.env.GAP || 2.2), TAG = process.env.TAG || '', SK = +(process.env.SK || 0);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required'] });
for (const stage of stages) {
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(`http://localhost:4630/game.html?mute&map=${process.env.MAPK || "office"}&fast=${FAST}&seed=${process.env.SEED || 5}&stage=${stage}&team=${process.env.TEAM || 'kevin,mi,heilun'}&fresh=${Date.now()}${process.env.XQ || ""}`);
  await page.evaluate(() => { try { const k = Object.keys(localStorage); for (const x of k) { const v = JSON.parse(localStorage[x] || 'null'); if (v && v.tips) { v.tips = []; v.seen = []; localStorage[x] = JSON.stringify(v); } } } catch (e) {} });
  await page.reload(); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 });
  const shot = async name => { const url = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1920; c.height = 1080; const x = c.getContext('2d'); x.drawImage(document.getElementById('gl'), 0, 0); x.drawImage(document.getElementById('hud'), 0, 0); return c.toDataURL('image/jpeg', .85); }); fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(url.split(',')[1], 'base64')); };
  await page.evaluate(() => __game.start()); await page.waitForFunction('__game.phase === "pick" && __game.menu', { timeout: 30000 });
  await page.evaluate(() => __game.press(0)); await new Promise(r => setTimeout(r, 600)); await page.evaluate(() => __game.press(0));
  await page.waitForFunction('__game.phase === "hub" && __game.menu', { timeout: 30000 }); await new Promise(r => setTimeout(r, 1500)); await shot(`${stage}${TAG}_00_hub`);
  const floor = await page.evaluate(() => __game.run.floor);
  await page.evaluate(() => { const g = __game, nodes = g.menu.items.filter(x => x.node != null); g.go(nodes.length - 1); }); await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const nodes = g.menu.items.filter(x => x.node != null); g.go(nodes.length - 1); } });
  // 自動打：每一場的打法不一樣，讓機制都演得到
  await page.evaluate((stage, BT, SK) => { window.__log = []; window.__n = {};
    setInterval(() => { const g = __game; if (g.phase !== 'command' || !g.menu) return; const m = g.menu, s = g.state, id = g.actor; if (BT && !__n.ph) { s.bossTurns = BT; __n.ph = 1; } if (BT && __n.ph === 1 && s.charging) __n.ph = 2; if (BT && stage === 'monkey' && __n.ph === 2 && !s.charging) { s.bossTurns = BT; __n.ph = 3; __n.letUlt = 1; } const hurt = g.front.filter(h => s.hp[h] > 0 && s.hp[h] < 900);
      const pressL = l => { const i = m.items.findIndex(x => x.label === l && !x.off); if (i < 0) return false; __log.push(`R${s.round} ${id}: ${l}`); g.press(i); return true; };
      const tgt = want => { const i = m.items.findIndex(x => x.target === want && !x.off); const j = i >= 0 ? i : m.items.findIndex(x => x.target && !x.off); __log.push(`R${s.round} ${id} → ${m.items[j].label}`); g.press(j); };
      const kinds = Object.fromEntries(Object.entries(s.kind).map(([k, v]) => [v, k])), alive = f => s.hp[f] > 0;
      if (m.kind === 'root') {
        if (hurt.length && id === 'mi' && pressL('技能')) return;
        if (SK && Math.random() < .75 && pressL('技能')) return; if (id === 'vivi') return void g.press(0); if (BT && stage === 'monkey' && __n.letUlt) return void pressL('防禦');
        if (s.charging && !(stage === 'monkey' && s.proj && alive(s.proj) && !__n.letUlt) && id === 'kevin' && pressL('奧義')) return;
        if (stage === 'crowd_a' || stage === 'night_a' || stage === 'pig') { if (!__n.sk && id === 'kui' && pressL('技能')) { __n.sk = 1; return; } }
        return void pressL('攻擊'); }
      if (m.kind === 'skills') { const ok = m.items.map((x, q) => q).filter(q => !m.items[q].off && !m.items[q].back), i = SK ? ok[Math.floor(Math.random() * ok.length)] : ok[0]; __log.push(`R${s.round} ${id} 招式 ${i == null ? '-' : m.items[i].label}`); return void g.press(i == null ? m.items.length - 1 : i); }
      if (m.kind === 'target') {
        if (stage === 'monkey' && s.charging && s.proj && alive(s.proj) && !__n.letUlt) return tgt(s.proj);
        if (stage === 'parrot' && s.round >= 2 && s.round <= 5 && s.echo && alive(s.echo)) return tgt(s.echo);
        if ((stage === 'crowd_a' || stage === 'night_a' || stage === 'pig') && kinds.auntie && alive(kinds.auntie) && __n.sk === 1) { __n.sk = 2; return tgt(kinds.auntie); }
        if (stage === 'crowd_s' || stage === 'night_s') return tgt(alive('ma') ? 'ma' : null);
        if (BT && stage === 'monkey') return tgt(['ma', 'mb'].find(x => alive(x) && x !== s.proj) || s.proj); return tgt(alive('boss') ? 'boss' : null); }
      const i = m.items.findIndex(x => !x.off && !x.back); g.press(i < 0 ? m.items.length - 1 : i); }, SK ? 420 : 150); }, stage, BT, SK);
  let n = 1, lastSig = '', lastAnim = -9; const t0 = Date.now(); let end = null;
  while (Date.now() - t0 < 200000 && n < +(process.env.MAXN || 34)) { await new Promise(r => setTimeout(r, 180));
    const st = await page.evaluate(() => { const g = __game, s = g.state; return { phase: g.phase, now: g.now, over: s.over, floor: g.run.floor, round: s.round, sig: [s.round, s.charging, s.echo, s.proj, s.broken, JSON.stringify(s.smoke), s.shield].join('|'), act: g.actor, monkeyMiss: !s.charging && s.proj === null }; });
    if (st.over || st.floor !== floor || st.phase === 'pick' || st.phase === 'over') { end = st; await new Promise(r => setTimeout(r, 1200)); await shot(`${stage}${TAG}_${String(n++).padStart(2, '0')}_end`); break; }
    if (st.phase === 'command' && st.sig !== lastSig) { lastSig = st.sig; await new Promise(r => setTimeout(r, 60)); await shot(`${stage}${TAG}_${String(n++).padStart(2, '0')}_r${st.round}_cmd`); }
    else if (st.phase === 'anim' && st.now - lastAnim > GAP) { lastAnim = st.now; await shot(`${stage}${TAG}_${String(n++).padStart(2, '0')}_r${st.round}_anim`); }
    }
  if (SK) console.log((await page.evaluate(() => __log)).filter(l => l.includes('招式')).join(' ｜ ').slice(0, 1500));
  const fin = await page.evaluate(() => ({ log: __log.slice(-12), over: __game.state.over, round: __game.state.round, phase: __game.phase }));
  console.log(`── ${stage}　結果 ${fin.over || fin.phase}　${fin.round} 回合　截圖 ${n - 1} 張　錯誤：${errors.length ? errors.slice(0, 5).join(' ／ ') : '無'}`);
  await page.close(); }
await browser.close();
