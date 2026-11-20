// 戰鬥中存檔的實機檢查：打到一半重新整理 → 繼續上班 → 重演後的狀態要跟重新整理前一樣，而且可以接著打。
// 用法：node bsavetest.mjs [地圖] [先走幾站] [這一場下幾個指令再重新整理]
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire('/Users/hermes/Public/0720/office-idle-reel/'), puppeteer = require('puppeteer-core');
const OUT = '/Users/hermes/Public/0720/a4-rpg-battle/out/phone2'; const wait = ms => new Promise(r => setTimeout(r, ms));
const MAPK = process.argv[2] || 'office', FLOORS = +(process.argv[3] || 0), CMDS = +(process.argv[4] || 5), SEED = +(process.env.SEED || 21);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, protocolTimeout: 900000, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage(); await page.setViewport({ width: 870, height: 402, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errors = [];
page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
const URL = `http://localhost:4630/game.html?mute&seed=${SEED}&map=${MAPK}&fast=6` + (process.env.STAGE ? `&stage=${process.env.STAGE}&team=${process.env.TEAM || 'kevin,mi,jie,qiang,xu'}&savetest=1` : '');      // STAGE=chief：直接跳到那一關（要加 savetest 才會存檔）
await page.goto(URL + `&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 }); await page.evaluate(() => localStorage.removeItem('a4rpg.run'));
// 自動玩：行程表挑戰鬥優先、卡片挑第一張、戰鬥裡輪流用各種指令。__stop＝這一場下滿幾個指令就停手
const bot = () => page.evaluate(() => { window.__n = 0; window.__stop = 1e9; window.__fl = -1; clearInterval(window.__iv); window.__iv = setInterval(() => { const g = __game; if (!g.menu) return; const m = g.menu;
  if (g.phase === 'hub') { const nodes = m.items.map((x, i) => [x, i]).filter(e => e[0].node != null && !e[0].off); if (!nodes.length) return; return void g.go(0); }
  if (g.phase === 'pick') { const i = m.items.findIndex(x => !x.off); return void g.press(i < 0 ? 0 : i); }
  if (g.phase !== 'command') return; if (g.run.floor !== __fl) { __fl = g.run.floor; __n = 0; } if (__n >= __stop && m.kind === 'root') return; const s = g.state, id = g.actor;
  if (m.kind === 'root') { const want = ['攻擊', '技能', '攻擊', '防禦', '技能', '奧義', '道具', '換人'][__n % 8], i = m.items.findIndex(x => x.label === want && !x.off); __n++; return void g.press(i >= 0 ? i : m.items.findIndex(x => (x.label === '攻擊' || x.label === '應援') && !x.off)); }
  const i = m.items.findIndex(x => !x.off && !x.back); g.press(i < 0 ? m.items.length - 1 : i); }, 140);
  if (!window.__wrapped) { window.__wrapped = true; } });
const snap = () => page.evaluate(() => { const g = __game, s = g.state; return JSON.stringify({ floor: g.run.floor, actor: g.actor, round: s.round, hp: s.hp, sp: s.sp, mo: s.mo, shield: s.shield, queue: s.queue, items: s.items, front: g.front, roster: g.run.roster, n: s.cmdLog.length, charging: s.charging, ward: s.ward }); });
await page.evaluate(() => __game.start()); await bot(); if (process.env.STAGE) { await page.waitForFunction('__game.phase === "hub" && __game.menu', { timeout: 60000 }); await page.evaluate(() => { clearInterval(window.__iv); const g = __game, n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); }); await wait(400); await page.evaluate(() => { const g = __game; if (g.phase === 'hub' && g.menu) { const n = g.menu.items.filter(x => x.node != null); g.go(n.length - 1); } }); await bot(); }
// 先走到指定的站
if (process.env.DBG) console.log('· 等進戰鬥'); await page.waitForFunction(f => __game.phase === 'command' && __game.run.floor >= f, { timeout: 600000, polling: 300 }, FLOORS); if (process.env.DBG) console.log('· 進戰鬥了');
await page.evaluate(n => { window.__stop = n; }, CMDS); await page.waitForFunction(n => __game.phase === 'command' && __game.menu && __game.menu.kind === 'root' && __game.state.cmdLog.length >= n, { timeout: 300000, polling: 200 }, CMDS); await wait(500);
await page.evaluate(() => clearInterval(window.__iv)); await wait(300); const before = await snap(), saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('a4rpg.run') || 'null'); return d ? { pend: d.pend, n: (d.blog || []).length, floor: d.floor, log: JSON.stringify(d.blog) } : null; });
await page.screenshot({ path: path.join(OUT, '51_bsave_before.jpg'), type: 'jpeg', quality: 80 });
await page.goto(URL.replace(`seed=${SEED}`, 'seed=999') + `&fresh=${Date.now()}`); await page.waitForFunction('window.__game && window.__game.phase === "title"', { timeout: 60000 }); await wait(600); await page.screenshot({ path: path.join(OUT, '52_bsave_title.jpg'), type: 'jpeg', quality: 80 });
if (process.env.DBG) console.log('· 重新整理完，按繼續'); const t0 = Date.now(); await page.evaluate(() => __game.resume()); if (process.env.DBG) console.log('· 已按繼續'); await wait(1200); await page.screenshot({ path: path.join(OUT, '53_bsave_replay.jpg'), type: 'jpeg', quality: 80 });
await page.waitForFunction(n => __game.phase === 'command' && __game.menu && __game.menu.kind === 'root' && __game.state.cmdLog.length >= n, { timeout: 120000, polling: 100 }, CMDS); const took = Date.now() - t0; await wait(600);
const after = await snap(); if (process.env.DBG) console.log('重演後的指令紀錄', await page.evaluate(() => JSON.stringify(__game.state.cmdLog))); await page.screenshot({ path: path.join(OUT, '54_bsave_after.jpg'), type: 'jpeg', quality: 80 });
console.log(`${MAPK} 第 ${JSON.parse(before).floor + 1} 站，下了 ${CMDS} 個指令後重新整理。存檔：${JSON.stringify(saved)}　重演花了 ${(took / 1000).toFixed(1)} 秒`);
console.log(before === after ? '重演後狀態一致' : `✗ 不一致\n  前 ${before}\n  後 ${after}`);
// 接著打完這一場，確認後面流程正常（打贏會進選強化，或打輸）
await bot(); await page.waitForFunction(f => __game.phase === 'over' || __game.run.floor > f || (__game.phase === 'pick'), { timeout: 400000, polling: 300 }, JSON.parse(before).floor); await wait(500);
const end = await page.evaluate(() => ({ phase: __game.phase, floor: __game.run.floor, over: __game.state.over, pend: (JSON.parse(localStorage.getItem('a4rpg.run') || 'null') || {}).pend ?? null }));
console.log('接著打完：', JSON.stringify(end), '錯誤：', errors.length ? errors.slice(0, 5).join(' ／ ') : '無'); await browser.close(); process.exit(before === after && !errors.length ? 0 : 1);
