// 試玩版：同一套場景、角色、特效和介面，改成即時的回合制戰鬥。
// 規則在 rules.js（純邏輯）；這裡負責：遊戲時鐘、輪到誰、指令選單（滑鼠／觸控／鍵盤）、把每個行動的結果演出來、即時播音效。
// 影片版的演出都是「排在某個時間點」的事件，所以試玩版只要把事件排在「現在之後」就能沿用同一套東西。
import { makeEngine, W, H, sat, lerp, ease, easeOut, back } from './engine.js';
import { setupStage, DEFS, PARTY, WIDE, LINES } from './battle.js';
import { makeUI, COL } from './ui.js';
import * as R from './rules.js';
import { makeSkin, INK, INK2, CREAM, TEAL, RED, BRASS } from './skin.js';

// 小葵的 24 格揮劍（影片抽格的試驗素材）。每格 1/8 秒照影片原速播；蓄力和揮完定住那兩段幾乎不動的影格只留頭尾，縮短停頓。
// 使用者試過覺得跟原本差不多（2026-11-19），所以預設不用；網址加 ?h3=1 才會換成這組，留著之後比較。
const H3_T = [0, .125, .25, .375, .5, .625, .75, .75, .75, .75, .875, 1.0, 1.125, 1.25, 1.375, 1.375, 1.375, 1.375, 1.375, 1.375, 1.375, 1.5, 1.625, 1.75], H3_HIT = 1.0, H3_END = 1.875;
const SANS = '"Noto Sans TC", sans-serif', SERIF = '"Songti TC", "Noto Serif TC", "PMingLiU", serif';
const gl = document.getElementById('gl'), hudCv = document.getElementById('hud'), stage = document.getElementById('stage');
const Q = new URLSearchParams(location.search);
const VERSION = 'v0.3.0';      // 改版時一起改 tools/deploy.sh 會顯示的版本

// ---------- 載入 ----------
let loadMsg = '載入中', booted = false;
{ const c = hudCv.getContext('2d'); c.fillStyle = '#07060c'; c.fillRect(0, 0, W, H); c.fillStyle = '#a9a08e'; c.font = `500 34px ${SANS}`; c.textAlign = 'center'; c.fillText('載入中…', W / 2, H / 2); }
await Promise.all(['500 40px "Noto Sans TC"', '700 40px "Noto Sans TC"', '900 40px "Noto Sans TC"', '700 40px "Songti TC"', '900 40px "Songti TC"'].map(f => document.fonts.load(f, '奧客總經理吐槽一閃').catch(() => 0)));
// 規則的數值蓋到顯示用的設定上（血條長度、選單上的 SP 消耗）
for (const id of R.HEROES) { DEFS[id].hp = R.STAT[id].hp; DEFS[id].sp = R.STAT[id].sp; DEFS[id].cost = R.STAT[id].cost; }
DEFS.boss.hp = R.STAT.boss.hp;
const E = makeEngine(gl), { arena, units, A, FXL, SFX, fx, S, cam, num } = await setupStage(E);
const ui = makeUI(hudCv, A, S), c = hudCv.getContext('2d');
const state = R.newState(Q.has('seed') ? R.mulberry(+Q.get('seed')) : Math.random);
S.noBp = true; S.stamps = []; S.mo = [{ t: -1, v: state.mo }];      // 個人 BP 拿掉，改成全隊共用的氣勢條
S.shield.boss = [{ t: -1, v: state.shield }];
S.partyMode = 'h';      // 隊伍狀態放最上面一排，不蓋到右邊的角色
const skin = makeSkin(c, A, S, DEFS); let moShown = state.mo;
S.skinHud = (t, a, cardOn) => skin.hud(t, a, cardOn, moShown, R.MO, R.STAT.boss.shield); S.skinBoxes = t => skin.boxes(t);

// ---------- 聲音：WebAudio，事件排在遊戲時鐘上 ----------
const PREF = (() => { try { return JSON.parse(localStorage.getItem('a4rpg') || '{}'); } catch (e) { return {}; } })(), savePref = () => { try { localStorage.setItem('a4rpg', JSON.stringify(PREF)); } catch (e) { /* 存不了就算了 */ } };
if (Q.has('mute')) PREF.mute = true; if (Q.has('low')) PREF.low = true;
// 低畫質：關掉景深、光暈和陰影（手機卡的時候用）。沒選過的話，開始畫面會量幾十格，太慢就自動切過去
const applyQuality = () => { E.dof.enabled = !PREF.low; E.bloom.enabled = !PREF.low; E.renderer.shadowMap.enabled = !PREF.low; E.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
applyQuality();
const AC = new (window.AudioContext || window.webkitAudioContext)(), master = AC.createGain(), musicGain = AC.createGain(); master.connect(AC.destination); musicGain.connect(master); master.gain.value = PREF.mute ? 0 : .9;
const buf = {}; let now = 0, music = null;
const SFX_IDS = ['boss_appear', 'boss_charge', 'boss_down', 'break', 'buff', 'card', 'confirm', 'cursor', 'cutin', 'dark_blast', 'dark_charge', 'defeat', 'encounter', 'explosion', 'explosion_big', 'fanfare', 'heal', 'hit', 'holy_cast', 'paper_storm', 'shield_block', 'shield_up', 'slash', 'slash_b', 'slash_multi', 'stat'];
async function loadSound(id, url) { try { const r = await fetch(url); if (!r.ok) return; buf[id] = await AC.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* 少一個聲音不影響遊戲 */ } }
const pick = await fetch('audio/pick.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const audioReady = Promise.all([...SFX_IDS.map(id => loadSound(id, `audio/sfx/${id}.mp3`)), loadSound('whoosh', 'audio/sfx/whoosh.wav'),
  ...Object.keys(LINES).map(k => loadSound('vo/' + k, `audio/vo/${pick['vo/' + k] || k + '_1'}.mp3`)), loadSound('bgm/battle', 'audio/bgm/battle.mp3'), loadSound('bgm/victory', 'audio/bgm/victory.mp3')]);
const snd = (t, id, v = 1) => { const b = buf[id]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(), vo = id.startsWith('vo/'); s.buffer = b; g.gain.value = v * (vo ? 1 : .6); s.connect(g).connect(master);
  const when = AC.currentTime + Math.max(0, t - now); s.start(when); if (vo) { musicGain.gain.setTargetAtTime(.16, when, .08); musicGain.gain.setTargetAtTime(.42, when + b.duration + .2, .3); } };
function playMusic(id) { if (music) { const m = music; m.g.gain.setTargetAtTime(0, AC.currentTime, .25); setTimeout(() => m.s.stop(), 1200); music = null; } const b = buf[id]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(1, AC.currentTime, .5); s.connect(g).connect(musicGain); s.start(); music = { s, g }; }
musicGain.gain.value = .42;
const say = (t, line, who) => { snd(t, 'vo/' + line, 1.25); const [text, len] = LINES[line]; S.subs.push({ t0: t, len, text, name: DEFS[who].name, color: DEFS[who].enemy ? '#e2463f' : DEFS[who].color }); };

// ---------- 排程與共用零件 ----------
const todo = []; const at = (t, fn) => { todo.push({ t, fn }); todo.sort((a, b) => a.t - b.t); };
const home = id => DEFS[id].pos, P = (x, y, z) => { const [px, py] = E.project(x, y, z); return [px / 4, py / 4]; };
const ko = {}; let guardShown = true, aegisFx = [], phase = 'load', actor = null, queue = [];
const kill = (t, id) => { units[id].pose(t - .05, 'hit').die(t, 1.0); fx('spawn/poof', t + .55, id, { scale: 1.3, y: .2 }); snd(t + .05, 'defeat', .9); };
const box = (t, dur, text, enemy) => S.boxes.push({ t0: t, t1: t + dur, text, enemy });
// 護衛狀態有變就更新牌子
const syncGuard = t => { const g = R.guarded(state); if (g === guardShown) return; guardShown = g; S.guard.push({ t, v: g }); if (!g) { num(t + .1, 'boss', '護衛解除！', 'text', { col: '#ffe27a', px: 38, y: .78 }); snd(t, 'break', .6); } };
const syncBars = t => { if (S.mo.at(-1).v !== state.mo) S.mo.push({ t, v: state.mo }); for (const id of R.HEROES) if (S.sp[id].at(-1).v !== state.sp[id]) S.sp[id].push({ t, v: state.sp[id] }); };
const minionShield = {};
// 演一筆命中：數字、受擊、血條、倒下
function applyHit(t, h, o = {}) {
  if (!h || !h.dst) return;
  const foe = DEFS[h.dst].enemy;
  if (h.guard) { num(t, h.dst, 0, 'guard', { y: o.y ?? (foe ? .5 : .9), dx: o.dx, dy: o.dy }); if (o.snd !== false) snd(t, 'shield_block', .55); if (h.dst === 'boss') num(t + .15, 'boss', '護衛中', 'text', { col: '#ff9a8a', px: 28, y: .3 }); return; }
  units[h.dst].hit(t, o.pow ?? 1, foe ? -1 : 1); S.hp[h.dst].push({ t, v: h.hp });
  if (!h.kill && h.v > 0) { const u = units[h.dst];      // 受擊姿勢：縮一下再回原本的站姿（防禦中回防禦、魔王理虧中回垂頭）
    if (!foe && !h.cover && u.frames.hurt) { u.pose(t, 'hurt'); at(t + .42, () => { if (!ko[h.dst] && R.alive(state, h.dst) && phase !== 'end') u.pose(now, state.defend[h.dst] ? 'guard' : 'ready'); }); }
    if (h.dst === 'boss' && u.frames.hurt) { u.pose(t, 'hurt'); at(t + .36, () => { if (R.alive(state, 'boss')) u.pose(now, state.broken ? 'stun' : 'idle'); }); } }
  num(t, h.dst, h.v, foe ? (o.kind || (h.crit ? 'crit' : 'dmg')) : 'foe', { weak: foe && h.weak, big: !foe && h.v >= 1000, dx: o.dx, dy: o.dy, fixed: o.fixed });
  if (o.snd !== false) snd(t, o.snd || 'hit', o.vol ?? .8);
  if (h.dst === 'boss' && h.shield != null) S.shield.boss.push({ t, v: h.shield });
  if (foe && h.dst !== 'boss') { minionShield[h.dst] = Math.max(1, (minionShield[h.dst] ?? 2) - 1); S.shield[h.dst].push({ t, v: minionShield[h.dst] }); if (stepReveal < 4) S.reveal.push({ t, v: ++stepReveal }); }
  if (h.cover) num(t + .12, 'kevin', '代為承受', 'text', { col: '#9af0ff', px: 26, y: 1.2 });
  if (h.def) num(t + .1, h.dst, '防禦', 'text', { col: '#bfd0ff', px: 24, y: 1.15 });
  if (h.brk) { S.stamps.push({ t, id: 'boss' }); snd(t, 'break', .9); cam.shake(t, .3, .6); fx('status/stunned', t + .4, 'boss', { y: 2.35, dx: .45, scale: 2.2, dur: 4 }); }
  if (h.kill) { if (h.dst === 'boss') return; if (foe) { kill(t + .1, h.dst); at(t + .25, () => syncGuard(now)); } else { at(t + .15, () => { ko[h.dst] = true; }); num(t + .35, h.dst, '倒下', 'text', { col: '#ff6a5a', px: 32, y: 1.2 }); const u = units[h.dst], hp = home(h.dst); u.move(t + .12, hp[0], hp[1], .25); if (u.frames.ko) u.anim(t + .12, 'ko', [0, .42]); else u.pose(t + .1, 'wind'); snd(t + .5, 'defeat', .5); } }
}
let stepReveal = 0;
const ready = (t, id) => { if (!ko[id] && R.alive(state, id)) units[id].pose(t, 'ready'); };
const goHome = (t, id, dur = .28) => units[id].move(t, home(id)[0], home(id)[1], dur);

// ---------- 我方行動的演出。都回傳結束時間 ----------
function playAttack(r, t0) {
  const id = r.id, u = units[id], h = r.hits[0], tg = r.target, [tx, tz] = units[tg].posAt(t0), gap = tg === 'boss' ? 2.0 : 1.05; let th, te;
  if (id === 'kui' && u.frames.h3 && Q.get('h3') === '1') { th = t0 + H3_HIT; u.anim(t0, 'h3', H3_T).move(t0 + .45, tx + gap + .25, tz + .02, .22, easeOut); snd(t0 + .45, 'whoosh', .5); SFX.add('speed', t0 + .8, .2, { a: .4 });
    fx('melee/sword-slash', th - .08, [tx + gap, tz], { flip: true, palette: 'fire', scale: tg === 'boss' ? 1.6 : 1.2 }); snd(th - .06, 'slash', .9); cam.shake(th, .1, .25); applyHit(th, h, { snd: false }); goHome(t0 + 1.5, id, .28); te = t0 + H3_END; }
  else if (id === 'kui') { th = t0 + .28; u.pose(t0, 'wind').move(t0 + .06, tx + gap, tz + .02, .14, easeOut).pose(t0 + .2, 'act'); SFX.add('speed', t0 + .04, .2, { a: .4 }); snd(t0 + .06, 'whoosh', .5);
    fx('melee/sword-slash', th - .06, [tx + gap, tz], { flip: true, palette: 'fire', scale: tg === 'boss' ? 1.6 : 1.2 }); snd(th - .04, 'slash', .9); cam.shake(th, .1, .25); applyHit(th, h, { snd: false }); goHome(th + .45, id, .26); te = th + .8; }
  else if (id === 'kevin') { th = t0 + .32; u.anim(t0, 'ult', [0, .04, .1, .2, .26, .3, 1.0, 1.2]).move(t0 + .06, tx + gap + .1, tz + .05, .2, easeOut); snd(t0 + .06, 'whoosh', .5); SFX.add('speed', t0 + .05, .22, { a: .35 });
    fx('impacts/blunt-hit', th, tg, { y: tg === 'boss' ? 1.0 : .6, dx: tg === 'boss' ? 1.0 : .4, scale: 1.7, palette: 'cyber' }); snd(th, 'shield_block', .8); cam.shake(th, .14, .3); applyHit(th, h, { snd: h?.guard ? false : 'hit' }); goHome(th + .5, id, .3); te = th + .9; }
  else if (id === 'jie') { th = t0 + .62; u.pose(t0, 'wind').pose(t0 + .3, 'act'); fx('arcane/spell-charge', t0, id, { palette: 'shadow', scale: .6, y: .9, dx: -.4, flip: true, dur: .4 }); snd(t0, 'dark_charge', .45);
    const [jx, jz] = home(id), [x0, y0] = P(jx - .45, 1.25, jz), [x1, y1] = P(tx, tg === 'boss' ? 1.4 : .7, tz); SFX.add('slash', t0 + .36, .34, { x0, y0, x1, y1, c: [190, 120, 255], w: 5 });
    fx('explosions/small-explosion', th - .1, tg, { scale: tg === 'boss' ? 1.8 : 1.2, y: tg === 'boss' ? 1.0 : .3, palette: 'arcane' }); fx('impacts/crit-hit', th, tg, { y: tg === 'boss' ? 1.4 : .7, scale: 1.3, palette: 'arcane' }); snd(th - .05, 'dark_blast', .55); applyHit(th, h); te = th + .75; }
  else { th = t0 + .92; u.pose(t0, 'wind').pose(t0 + .35, 'act'); snd(t0, 'holy_cast', .6); fx('holy/blessing', t0, id, { scale: .9, dur: .9 }); fx('holy/smite', t0, tg, { scale: tg === 'boss' ? 1.8 : 1.2, dx: tg === 'boss' ? .2 : 0 });
    SFX.add('flash', th - .05, .3, { c: [255, 245, 200], a: .5 }); cam.shake(th, .14, .3); applyHit(th, h); te = th + .7; }
  if (h?.guard) box(th + .2, 1.6, '小兵護衛中　魔王不受傷害', true);
  ready(te - .05, id); return te;
}
function playDefend(r, t0) { units[r.id].pose(t0, 'guard'); num(t0 + .1, r.id, '防禦', 'text', { col: '#bfd0ff', px: 32, y: r.id === 'vivi' ? 1.0 : 1.2, dx: r.id === 'vivi' ? -110 : 0 }); snd(t0 + .05, 'shield_up', .5); fx('impacts/parry', t0 + .05, r.id, { scale: 1.0, y: .5, palette: 'cyber' }); at(t0 + .3, () => syncBars(now)); return t0 + .75; }
function playCheer(r, t0) { const u = units.vivi; u.pose(t0, 'wind').pose(t0 + .3, u.frames.cheer ? 'cheer' : 'act'); snd(t0 + .3, 'buff', .9); fx('holy/feather-burst', t0 + .3, 'vivi', { scale: 1.0, y: 1.6, palette: 'neon' }); num(t0 + .35, 'vivi', '加油！', 'text', { col: '#ffc0dc', px: 34, y: 1.0, dx: -130 });
  R.FRONT.filter(id => R.alive(state, id)).forEach((id, i) => { const tb = t0 + .5 + i * .09; fx('arcane/mana-burst', tb, id, { scale: .8, palette: 'gold', y: .5 }); units[id].hop(tb + .2, .16, .28); }); num(t0 + .7, 'kevin', `氣勢 ＋${R.MO.cheer}`, 'text', { col: '#ffe27a', px: 34, y: 1.5 });
  at(t0 + .75, () => syncBars(now)); ready(t0 + 1.4, 'vivi'); return t0 + 1.5; }
function playItem(r, t0) { const it = R.ITEMS[r.key], th = t0 + 1.05; units[r.id].pose(t0, r.id === 'mi' || r.id === 'vivi' ? 'act' : 'win'); S.items.push({ t0, from: r.id, to: r.target, key: r.key === 'bento' ? 'tea' : r.key, name: it.name }); snd(t0, 'card', .8);
  if (r.revive) { at(th, () => { ko[r.target] = false; units[r.target].pose(now, 'ready'); }); fx('holy/blessing', th - .1, r.target, { scale: 1.3, dur: 1.4 }); snd(th, 'holy_cast', .6); num(th + .1, r.target, '復活', 'text', { col: '#fff3c8', px: 34, y: 1.3 }); units[r.target].pose(th, 'ready'); }
  if (r.heal != null && (r.heal > 0 || r.revive)) { fx('holy/heal', th - .1, r.target, { scale: 1.25 }); snd(th, 'heal', .9); S.hp[r.target].push({ t: th + .15, v: r.hp }); num(th + .15, r.target, r.heal, 'heal'); }
  if (r.spGain) { fx('arcane/mana-burst', th - .05, r.target, { scale: 1.0, palette: 'cyber', y: .5 }); snd(th, 'buff', .8); S.sp[r.target].push({ t: th + .15, v: r.sp }); num(th + .15, r.target, r.spGain, 'sp'); }
  units[r.target].hop(th + .2, .16, .3); ready(th + .9, r.id); return th + 1.0; }

// 招式（技能）：上方跳招式名，各自的演出
function playSkill(r, t0) {
  const id = r.id, u = units[id], hs = r.hits || []; box(t0, 1.5, r.name); at(t0 + .1, () => syncBars(now)); let te = t0 + 1.2;
  const foeY = f => (f === 'boss' ? 1.2 : .6);
  if (r.key === 'sweep') { const th = t0 + .34; u.anim(t0, 'ult', [0, .04, .08, .14, .2, .26, .7, .9]).move(t0 + .06, .3, -.3, .14, easeOut); SFX.add('speed', t0 + .04, .25, { a: .5 }); snd(t0 + .08, 'whoosh', .6); snd(th - .06, 'slash_multi', 1);
    fx('melee/spin-slash', th - .12, [.0, -.3], { flip: true, palette: 'fire', scale: 2.4 }); const [x0, y0] = P(1.2, 1.1, -.3), [x1, y1] = P(-3.6, .9, -.3); SFX.add('slash', th - .04, .4, { x0, y0, x1, y1, c: [255, 190, 110], w: 8 }); cam.shake(th, .16, .35);
    hs.forEach((h, i) => applyHit(th + i * .09, h, { snd: i ? false : 'slash', dy: i % 2 ? -70 : 0 })); goHome(th + .6, id, .28); te = th + 1.0; }
  else if (r.key === 'retort') { const tg = r.target, [tx, tz] = units[tg].posAt(t0), gap = tg === 'boss' ? 2.0 : 1.05, h3 = u.frames.h3 && Q.get('h3') === '1', th = t0 + (h3 ? H3_HIT : .36);
    if (h3) { u.anim(t0, 'h3', H3_T).move(t0 + .45, tx + gap + .25, tz + .02, .22, easeOut); snd(t0 + .45, 'whoosh', .55); SFX.add('speed', t0 + .8, .22, { a: .5 }); }
    else { u.anim(t0, 'ult', [0, .05, .1, .16, .22, .28, .8, 1.0]).move(t0 + .1, tx + gap, tz + .02, .14, easeOut); SFX.add('speed', t0 + .06, .22, { a: .5 }); snd(t0 + .1, 'whoosh', .55); }
    fx('melee/heavy-cleave', th - .2, [tx + gap, tz], { flip: true, palette: 'fire', scale: tg === 'boss' ? 1.7 : 1.3 }); fx('impacts/crit-hit', th, tg, { y: foeY(tg), scale: 1.6, palette: 'fire' }); snd(th - .05, 'slash_b', 1); cam.shake(th, .2, .4); SFX.add('flash', th, .2, { c: [255, 200, 140], a: .45 });
    num(th - .1, id, '這樣不行吧！', 'text', { col: '#ffd0a0', px: 26, y: 1.25 }); applyHit(th, hs[0], { snd: false, pow: 1.3 }); goHome(h3 ? t0 + 1.5 : th + .55, id, .28); te = h3 ? t0 + H3_END : th + .95; }
  else if (r.key === 'taunt') { u.pose(t0, 'win').hop(t0 + .05, .2, .3); fx('impacts/ground-slam', t0 + .2, id, { palette: 'cyber', scale: 1.1 }); snd(t0 + .2, 'shield_up', .7); num(t0 + .25, id, '這個我來！', 'text', { col: '#9af0ff', px: 34, y: 1.3 });
    SFX.add('ring', t0 + .2, .6, { cx: 300, cy: 180, r: 240, c: [120, 240, 255], w: 3 }); R.foes(state).forEach((f, i) => num(t0 + .55 + i * .08, f, '被挑釁', 'text', { col: '#ff9a8a', px: 24, y: f === 'boss' ? .7 : 1.25 })); te = t0 + 1.25; }
  else if (r.key === 'bash') { const tg = r.target, [tx, tz] = units[tg].posAt(t0), gap = tg === 'boss' ? 2.1 : 1.15, th = t0 + .34; u.anim(t0, 'ult', [0, .04, .1, .2, .26, .3, 999, 999]).move(t0 + .06, tx + gap, tz + .05, .2, easeOut); snd(t0 + .06, 'whoosh', .5); SFX.add('speed', t0 + .05, .22, { a: .4 });
    fx('impacts/blunt-hit', th, tg, { y: foeY(tg), dx: tg === 'boss' ? 1.0 : .4, scale: 2.0, palette: 'cyber' }); fx('impacts/crit-hit', th, tg, { y: foeY(tg), scale: 1.3, palette: 'cyber' }); snd(th, 'shield_block', 1); cam.shake(th, .2, .35);
    applyHit(th, hs[0], { snd: hs[0]?.guard ? false : 'hit', pow: 1.3 }); goHome(th + .5, id, .3); num(th + .7, id, '防禦', 'text', { col: '#bfd0ff', px: 28, y: 1.2 }); te = th + 1.0; at(te - .02, () => { units[id].pose(now, 'guard'); }); return te; }
  else if (r.key === 'barrage') { const th = t0 + .86; u.pose(t0, 'wind').pose(t0 + .3, 'act'); fx('arcane/spell-charge', t0, id, { palette: 'shadow', scale: .7, y: .9, dx: -.4, flip: true, dur: .5 }); snd(t0, 'dark_charge', .6); SFX.add('dim', t0 + .1, 1.4, { c: [22, 6, 44], a: .35, fade: .2 });
    hs.forEach((h, i) => { fx('arcane/star-fall', t0 + .2 + i * .1, h.dst, { scale: h.dst === 'boss' ? 2.0 : 1.2, palette: 'shadow', dx: h.dst === 'boss' ? .3 : 0 }); applyHit(th + i * .1, h, { snd: i ? false : 'hit', dy: i % 2 ? -70 : 0 }); }); snd(th - .1, 'dark_blast', .7); cam.shake(th, .16, .4); te = th + .9; }
  else if (r.key === 'curse') { const tg = r.target, th = t0 + .8; u.pose(t0, 'wind').pose(t0 + .3, 'act'); snd(t0, 'dark_charge', .6); fx('shadow/grasping-hands', t0 + .1, tg, { scale: tg === 'boss' ? 2.0 : 1.3, dx: tg === 'boss' ? .6 : 0 }); fx('shadow/shadow-tendrils', t0 + .2, tg, { scale: tg === 'boss' ? 1.6 : 1.0 });
    applyHit(th, hs[0], { snd: 'hit' }); if (r.down) { num(th + .25, tg, '攻擊力 ↓', 'text', { col: '#c9a0ff', px: 34, y: tg === 'boss' ? .75 : 1.3 }); snd(th + .2, 'defeat', .5); } te = th + .95; }
  else if (r.key === 'mend' || r.key === 'soothe') { const th = t0 + .6; u.pose(t0, 'wind').pose(t0 + .32, 'act'); snd(t0, 'holy_cast', .7); fx('holy/blessing', t0, id, { scale: 1.0, dur: 1.0 }); if (r.key === 'soothe') fx('holy/heal-aoe', th - .25, [3.0, -.1], { scale: 2.0, palette: 'heal' }); snd(th, 'heal', .9);
    r.heals.forEach((h, i) => { fx('holy/heal', th - .05 + i * .08, h.dst, { scale: 1.2 }); if (h.v > 0) { S.hp[h.dst].push({ t: th + .2 + i * .08, v: h.hp }); num(th + .2 + i * .08, h.dst, h.v, 'heal', { dy: i % 2 ? -76 : 0 }); } units[h.dst].hop(th + .25 + i * .08, .16, .3); }); te = th + 1.0; }
  else if (r.key === 'treat') { const th = t0 + .6; u.pose(t0, 'wind').pose(t0 + .3, u.frames.cheer ? 'cheer' : 'act'); snd(t0 + .3, 'buff', .9); fx('holy/feather-burst', t0 + .3, id, { scale: 1.0, y: 1.6, palette: 'neon' }); num(t0 + .35, id, '我請客！', 'text', { col: '#ffc0dc', px: 32, y: 1.0, dx: -130 });
    r.spGains.forEach((h, i) => { const tb = th + i * .09; fx('arcane/mana-burst', tb, h.dst, { scale: .9, palette: 'cyber', y: .5 }); if (h.v > 0) { S.sp[h.dst].push({ t: tb + .15, v: h.sp }); num(tb + .15, h.dst, h.v, 'sp', { dy: i % 2 ? -66 : 0 }); } units[h.dst].hop(tb + .2, .16, .28); }); te = th + 1.1; }
  ready(te - .05, id); return te;
}

// 奧義：斜切眼神 → 喊招 → 各自的演出
function playUlt(r, t0) {
  const id = r.id, u = units[id], d = DEFS[id], tc = t0 + .1, ta = tc + 1.6; S.cutins.push({ t0: tc, dur: 1.55, id }); snd(tc, 'cutin', 1); say(tc + .2, id, id); at(tc, () => syncBars(now));
  cam.to(t0, .4, { x: lerp(WIDE.x, home(id)[0], .08), d: 12.5, y: 1.48 }).to(tc + 1.35, .35, WIDE);
  const card = len => S.cards.push({ t0: ta - .12, t1: ta + len, id }); let te;
  if (id === 'kui') {
    u.anim(ta, 'ult', [0, .14, .3, .5, .56, .62, 3.2, 3.4]); fx('arcane/spell-charge', ta, id, { palette: 'fire', scale: .7, y: .5, dx: -.3, flip: true, dur: .55 }); snd(ta, 'buff', .5); let tt = ta + .5;
    for (const m of R.MINIONS) { const hs = r.hits.filter(h => h.stage === m); if (!hs.length) continue; const [mx, mz] = home(m);
      u.move(tt, mx + 1.0, mz, .1, easeOut).anim(tt, 'ult', [0, 0, 0, .02, .1, .18, 9, 9]); SFX.add('speed', tt - .04, .2, { a: .55 }); snd(tt, 'slash_multi', .95);
      fx('melee/sword-slash', tt + .04, [mx + 1.0, mz], { flip: true, palette: 'fire', scale: 1.25 }); applyHit(tt + .12, hs[0], { snd: false });
      if (hs[1]) { fx('melee/double-slash', tt + .24, [mx + 1.0, mz], { flip: true, palette: 'fire', scale: 1.25 }); applyHit(tt + .4, hs[1], { dx: 90, dy: -92, snd: 'slash', vol: .6 }); }
      tt += .78; }
    const hb = r.hits.find(h => h.stage === 'boss' && h.dst); const d3 = tt + .1;
    if (hb) { u.anim(d3, 'ult', [0, 0, .06, .12, .17, .22, .9, 1.15]).move(d3 + .12, -4.6, -.25, .1, easeOut); SFX.add('dim', d3 - .05, .5, { a: .55, fade: .06 });
      SFX.add('slash', d3 + .14, .55, { x0: 300, y0: 60, x1: 20, y1: 215, c: [255, 170, 80], w: 11 }); SFX.add('flash', d3 + .2, .3, { a: .8 }); snd(d3 + .14, 'slash_b', 1.1);
      fx('melee/heavy-cleave', d3 + .1, [-1.8, -.25], { flip: true, palette: 'fire', scale: 1.9 }); if (!hb.guard) { fx('impacts/crit-hit', d3 + .46, 'boss', { y: 1.2, scale: 2.2, palette: 'fire' }); snd(d3 + .5, 'explosion', .6); cam.shake(d3 + .5, .3, .7); }
      applyHit(d3 + .5, hb, { kind: 'crit', pow: 1.5, snd: 'hit' }); }
    u.move(d3 + 1.3, home(id)[0], home(id)[1], .28).hop(d3 + 1.3, .5, .3); te = d3 + 1.7; card(te - ta - .3);
  } else if (id === 'jie') {
    u.anim(ta, 'ult', [0, .25, .55, 1.15, 1.32, 1.42, 3.2, 3.55]); snd(ta, 'dark_charge', 1); fx('arcane/magic-circle-cast', ta - .1, id, { palette: 'arcane', scale: 1.15, dz: -.05 }); fx('arcane/spell-charge', ta + .2, id, { palette: 'shadow', scale: .8, y: .9, dx: -.35, flip: true, dur: 1.1 });
    SFX.add('dim', ta + .15, 3.6, { c: [22, 6, 44], a: .5, fade: .4 }); SFX.add('embers', ta + .3, 3.2, { c: [170, 90, 255], n: 60 });
    fx('shadow/black-hole', ta + .5, 'boss', { scale: 2.2, y: .1, dur: 2.5, dz: -.2 }); fx('shadow/shadow-tendrils', ta + 1.1, 'boss', { scale: 1.8, dx: .3 }); fx('shadow/dark-explosion', ta + .98, 'boss', { scale: 2.0, y: .2, dx: .2 });
    const tp = ta + .98 + 1.84; snd(tp - .1, 'dark_blast', 1.1); SFX.add('flash', tp, .45, { c: [200, 150, 255], a: .9 }); cam.shake(tp, .34, .9); SFX.add('lines', tp, .7, { cx: 150, cy: 130, c: [200, 150, 255], a: .6 });
    const mh = r.hits.filter(h => h.dst !== 'boss'), bh = r.hits.filter(h => h.dst === 'boss'); mh.forEach((h, i) => { fx('shadow/grasping-hands', ta + 1.1, h.dst, { scale: 1.3 }); applyHit(tp - .35 + i * .12, h, { snd: i ? false : 'hit' }); });
    bh.forEach((h, i) => applyHit(tp + .05 + i * .25, h, i ? { dx: 150, dy: 120, pow: .8, snd: false } : { kind: h.crit ? 'crit' : 'dmg', pow: 1.6, snd: false })); if (bh.some(h => !h.guard)) fx('shadow/shadow-flames', tp + .2, 'boss', { scale: 2.2, dur: 1.5, dx: .2 });
    te = tp + 1.3; card(te - ta - .3);
  } else if (id === 'kevin') {
    u.move(ta, .55, -.35, .34).anim(ta + .1, 'ult', [0, .12, .28, .46, .56, .64, 999, 999]); snd(ta + .1, 'whoosh', .6); const tk = ta + .74; snd(tk, 'shield_up', 1.1); cam.shake(tk, .14, .4); fx('impacts/ground-slam', tk - .05, [.55, -.35], { palette: 'cyber', scale: 1.3 });
    SFX.add('flash', tk, .3, { c: [120, 240, 255], a: .5 }); SFX.add('ring', tk, .6, { cx: 262, cy: 185, r: 300, c: [120, 240, 255], w: 3 });
    aegisFx = [FXL.add({ id: 'holy/divine-shield', t: tk, dur: 600, x: 3.3, y: -.2, z: 1.9, scale: 5.2, palette: 'cyber', glow: 1.2 }), FXL.add({ id: 'holy/divine-shield', t: tk, dur: 600, x: .1, y: 0, z: -.2, scale: 1.7, palette: 'cyber' })];
    num(tk + .3, id, '全體掩護', 'text', { col: '#9af0ff', y: 1.25 }); for (const h of ['kui', 'jie', 'mi', 'vivi']) if (h === 'vivi' || R.alive(state, h)) num(tk + .45, h, '掩護', 'text', { col: '#9af0ff', px: 26, y: h === 'vivi' ? .9 : 1.12, dx: h === 'vivi' ? -100 : 0 });
    te = tk + 1.3; card(te - ta - .2);
  } else if (id === 'mi') {
    u.anim(ta, 'ult', [0, .2, .45, .95, 1.1, 1.22, 3.0, 3.3]); snd(ta, 'holy_cast', 1); fx('holy/blessing', ta, id, { scale: 1.3, dur: 3.0 }); fx('holy/sunburst', ta + 1.0, id, { scale: .9, y: 2.0, dx: -.3, dur: 1.6 }); SFX.add('rays', ta + .3, 3.0, {}); SFX.add('embers', ta + .5, 2.6, { c: [255, 230, 140], n: 50 });
    const th = ta + 1.25; fx('holy/heal-aoe', th - .2, [3.4, -.1], { scale: 2.3, palette: 'heal' }); snd(th, 'heal', 1); SFX.add('flash', th, .4, { c: [255, 245, 190], a: .45 });
    r.heals.forEach((h, i) => { fx('holy/heal', th + .1 + i * .09, h.dst, { scale: 1.25 }); if (h.v > 0) { S.hp[h.dst].push({ t: th + .35 + i * .09, v: h.hp }); num(th + .35 + i * .09, h.dst, h.v, 'heal', { dy: i % 2 ? -76 : 0 }); } units[h.dst].hop(th + .4 + i * .09, .18, .3); });
    const hs = r.hits[0], ts = ta + 1.9; if (hs) { const b = hs.dst === 'boss'; fx('holy/smite', ts, hs.dst, { scale: b ? 2.0 : 1.3, dx: b ? .2 : 0 }); fx('holy/holy-pillar', ts + .7, hs.dst, { scale: b ? 1.9 : 1.2, dz: -.1, dx: b ? .2 : 0 }); snd(ts + .85, 'explosion', .6); SFX.add('flash', ts + .9, .4, { c: [255, 245, 200], a: .8 }); cam.shake(ts + .9, .18, .5); applyHit(ts + .95, hs, { pow: 1.2, snd: false }); }
    te = ts + 1.8; card(te - ta - .3);
  } else {      // Vivi：強化 → 全員總攻擊
    u.anim(ta, 'ult', [0, .18, .4, .62, .74, .84, 2.2, 2.45]); const tk = ta + .84; snd(tk, 'buff', 1.1); SFX.add('flash', tk, .35, { c: [255, 170, 210], a: .5 }); SFX.add('embers', tk, 2.2, { c: [255, 200, 120], n: 80 }); fx('holy/feather-burst', tk, id, { scale: 1.3, y: 1.6, palette: 'neon' });
    R.FRONT.filter(h => !ko[h]).forEach((h, i) => { const tb = tk + .15 + i * .13; fx('arcane/mana-burst', tb, h, { scale: 1.0, palette: 'gold', y: .5 }); fx('holy/blessing', tb + .1, h, { scale: 1.1, dur: 1.4 }); num(tb + .45, h, '攻擊力 ↑↑', 'text', { col: '#ffe27a', px: 28, y: 1.2 }); units[h].hop(tb + .5, .2, .3); });
    card(2.2); let tt = ta + 2.4; box(tt - .2, .5 + r.hits.length * .5 + 1.2, '全員總攻擊'); SFX.add('speed', tt, r.hits.length * .5 + .4, { a: .32, n: 34 }); snd(tt - .1, 'whoosh', .8); cam.to(tt - .2, .6, { x: -.6, d: 12.2, y: 1.45 });
    for (const h of r.hits) { const by = h.by, bu = units[by], b = h.dst === 'boss', [tx, tz] = home(h.dst), off = [-60 + Math.round((tt * 97) % 120), -80 + Math.round((tt * 53) % 120)];
      if (h.final) { tt += .15; bu.anim(tt - .3, 'ult', [0, 0, .03, .08, .14, .2, 2.4, 2.7]); SFX.add('dim', tt - .3, .45, { a: .7, fade: .1 }); SFX.add('lines', tt - .3, .45, { cx: 150, cy: 130, c: [255, 190, 220], a: .7 });
        fx('explosions/big-explosion', tt, h.dst, { scale: b ? 2.2 : 1.4, dx: b ? .2 : 0 }); fx('explosions/firework-burst', tt + .5, h.dst, { scale: b ? 2.0 : 1.2, y: b ? 2.4 : 1.4, palette: 'candy' }); snd(tt, 'explosion_big', 1.2); SFX.add('flash', tt, .9, { a: 1, pow: 1.5 }); cam.shake(tt, .5, 1.4); SFX.add('ring', tt + .05, .9, { cx: 150, cy: 170, r: 520, w: 6 });
        applyHit(tt + .25, h, { kind: h.guard ? undefined : 'big', fixed: h.guard ? undefined : [860, 520], pow: 2, snd: false }); tt += 1.3; continue; }
      if (by === 'kui') { bu.anim(tt, 'ult', [0, .05, .1, .16, .22, .28, .8, 1.0]).move(tt + .14, tx + (b ? 1.9 : 1.0), tz, .1, easeOut).move(tt + .9, home(by)[0], home(by)[1], .3); fx('melee/double-slash', tt + .2, [tx + (b ? 1.9 : 1.0), tz], { flip: true, palette: 'fire', scale: b ? 1.7 : 1.4 }); snd(tt + .2, 'slash', 1); applyHit(tt + .36, h, { dx: off[0], dy: off[1], snd: false }); }
      else if (by === 'kevin') { bu.anim(tt, 'ult', [0, .04, .08, .14, .2, .26, .7, .9]).move(tt + .1, tx + (b ? 2.1 : 1.1), tz + .3, .12, easeOut).move(tt + .9, home(by)[0], home(by)[1], .3); fx('impacts/blunt-hit', tt + .28, h.dst, { y: b ? 1.0 : .6, dx: b ? 1.0 : .4, scale: 1.9, palette: 'cyber' }); snd(tt + .28, 'shield_block', .9); applyHit(tt + .32, h, { dx: off[0], dy: off[1] }); cam.shake(tt + .32, .16, .3); }
      else if (by === 'jie') { bu.anim(tt, 'ult', [0, .05, .1, .18, .26, .34, 1.1, 1.3]); fx('explosions/plasma-explosion', tt + .1, h.dst, { y: b ? 1.5 : .6, dx: b ? .2 : 0, scale: b ? 2.3 : 1.4, palette: 'arcane' }); snd(tt + .1, 'dark_blast', .8); SFX.add('flash', tt + .25, .3, { c: [200, 150, 255], a: .5 }); applyHit(tt + .3, h, { dx: off[0], dy: off[1], snd: false }); }
      else { bu.anim(tt, 'ult', [0, .05, .1, .18, .26, .34, 1.1, 1.3]); fx('lightning/lightning-strike', tt - .15, h.dst, { scale: b ? 1.7 : 1.1, palette: 'holy', dx: b ? .1 : 0 }); snd(tt + .1, 'holy_cast', .6); SFX.add('flash', tt + .3, .3, { c: [255, 245, 190], a: .5 }); applyHit(tt + .34, h, { dx: off[0], dy: off[1] }); }
      tt += .5; }
    te = tt + .9; for (const h of R.FRONT) if (!ko[h]) ready(te - .1, h); cam.to(te - .5, .5, WIDE);
  }
  at(ta + .5, () => syncBars(now)); if (id !== 'kevin') ready(te - .05, id); return te;
}

// ---------- 敵人行動的演出 ----------
function playFoe(r, t0) {
  const id = r.id, u = units[id];
  if (r.kind === 'foeAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, [hx, hz] = home(id), [tx, tz] = units[tgt].posAt(t0); box(t0, 1.3, '加班連打', true);
    u.pose(t0 + .15, 'atk').move(t0 + .15, tx - .95, tz + .02, .2, easeOut); snd(t0 + .15, 'whoosh', .45); const th = t0 + .41; fx('impacts/blunt-hit', th, tgt, { y: .7, dx: -.2, scale: 1.2 });
    r.hits.forEach((h, i) => applyHit(th + i * .05, h, { pow: .9, snd: i ? false : undefined })); if (r.hits.taunted) num(th - .2, 'kevin', '這個我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 }); if (r.weak) num(t0 + .1, id, '詛咒中', 'text', { col: '#c9a0ff', px: 24, y: 1.2 }); u.move(th + .3, hx, hz, .28).pose(th + .62, 'idle'); return th + .95; }
  if (r.kind === 'stunned') { box(t0, 1.3, '理虧中　說不出話', true); u.pose(t0, 'stun').pose(t0 + 1.0, 'idle'); num(t0 + .9, 'boss', '底氣回復', 'text', { col: '#ffd0c8', y: .5 }); S.shield.boss.push({ t: t0 + .9, v: r.shield }); snd(t0 + .9, 'shield_up', .5); return t0 + 1.4; }
  if (r.kind === 'charge') { cam.to(t0, .6, { x: -1.3, d: 11.4, y: 1.7 }).to(t0 + 2.3, .5, WIDE); box(t0 + .2, 2.4, '蓄力　再改一版！', true); u.anim(t0 + .3, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); snd(t0 + .3, 'boss_charge', 1); say(t0 + .65, 'boss_attack', 'boss');
    fx('lightning/charge-up', t0 + .4, 'boss', { palette: 'blood', scale: 2.0, y: 2.2, dx: .2 }); SFX.add('vignette', t0 + .4, 2.2, { c: [220, 30, 30], a: .8, pulse: 14 }); SFX.add('embers', t0 + .4, 2.2, { c: [255, 80, 50], x0: 0, w: 260 }); cam.shake(t0 + 1.0, .08, 1.4);
    num(t0 + 1.4, 'boss', '下一次行動：全體大傷害', 'text', { col: '#ff8a70', y: .5, px: 32 }); return t0 + 2.8; }
  if (r.kind === 'bossAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, bh = home('boss'), [kx, kz] = home(tgt); box(t0 + .1, 2.2, '退件重擊', true); cam.to(t0, .5, { x: -.2, d: 12.3, y: 1.5 });
    const ts = t0 + .3, th = ts + .58; u.move(ts, kx - 2.1, kz + .3, .45).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.3, 1.6]); snd(ts, 'whoosh', .6); fx('melee/hammer-smash', th - .5, [kx - 1.2, kz + .1], { scale: 1.5, palette: 'blood' }); snd(th, 'explosion', .7); cam.shake(th, .3, .6); SFX.add('flash', th, .25, { c: [255, 120, 100], a: .6 });
    r.hits.forEach((h, i) => applyHit(th + .02 + i * .05, h, { pow: 1.6, snd: i ? false : 'hit' })); if (!r.hits[0].guard && !r.hits[0].cover && !r.hits[0].kill) units[tgt].move(th + .02, kx + .55, kz, .2, easeOut).move(th + 1.0, kx, kz, .3);
    if (r.hits.taunted) num(th - .3, 'kevin', '這個我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 });
    u.move(ts + 1.3, bh[0], bh[1], .55).pose(ts + 1.9, 'idle'); cam.to(ts + 1.3, .6, WIDE); return ts + 2.1; }
  // 大招「無限改稿」
  const bh = home('boss'); box(t0 + .1, 3.0, '奧義　無限改稿', true); cam.to(t0, .5, { x: .6, d: 13.2, y: 1.4 }); snd(t0 + .3, 'paper_storm', 1); SFX.add('papers', t0 + .3, 2.4, { n: 200 }); SFX.add('speed', t0 + .3, 2.3, { dir: 1, a: .3, n: 26 }); cam.shake(t0 + .4, .1, 2.0);
  const ts = t0 + 1.5, th = ts + .58; let te = ts + 2.2;
  if (r.blocked) { const kh = r.hits.find(h => h.cover); [.7, 1.15].forEach((dt, i) => { fx('impacts/shield-block', t0 + dt, [.05, -.35], { palette: 'cyber', scale: 1.7, flip: true, y: .1 + i * .15 }); snd(t0 + dt, 'shield_block', .8); SFX.add('flash', t0 + dt, .16, { c: [150, 240, 255], a: .35 }); });
    u.move(ts, -1.5, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]); snd(th - .05, 'shield_block', 1.2); snd(th, 'explosion', .8); fx('melee/hammer-smash', th - .5, [-1.0, -.4], { scale: 1.6, palette: 'blood' }); fx('impacts/parry', th, [.1, -.35], { scale: 2.2, palette: 'cyber', y: .2 });
    SFX.add('flash', th, .35, { a: .9 }); SFX.add('lines', th, .5, { cx: 250, cy: 170, c: [150, 240, 255] }); cam.shake(th, .36, .8); r.hits.forEach((h, i) => applyHit(th + .03 + (h.cover ? 0 : .05 + i * .03), h, { pow: 1.2, snd: false, y: h.dst === 'vivi' ? .3 : .9 }));
    if (kh) num(th + .5, 'kevin', '完全防禦！', 'text', { col: '#9af0ff', y: 1.5, px: 44 });
  } else { SFX.add('vignette', t0 + .3, 3.4, { c: [220, 30, 30], a: .75, pulse: 10 }); u.move(ts, -1.1, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]);
    fx('melee/hammer-smash', th - .5, [-.5, -.4], { scale: 1.8, palette: 'blood' }); fx('impacts/ground-slam', th, [.9, -.3], { scale: 2.6, palette: 'blood' }); snd(th - .05, 'hit', 1); snd(th, 'explosion', 1.1);
    SFX.add('flash', th, .45, { c: [255, 140, 110], a: .95 }); SFX.add('ring', th, .7, { cx: 215, cy: 190, r: 460, c: [255, 120, 90], w: 6 }); SFX.add('lines', th, .5, { cx: 215, cy: 180, c: [255, 150, 120], a: .6 }); cam.shake(th, .5, 1.0);
    r.hits.forEach((h, i) => { const hp = home(h.dst), tt = th + .05 + i * .07; applyHit(tt, h, { pow: 1.7, snd: false, dy: [-40, -150, -70, -190][i % 4], dx: [-30, 10, -20, 40][i % 4] }); if (!h.kill) units[h.dst].move(tt, hp[0] + .5, hp[1], .2, easeOut).move(tt + 1.2, hp[0], hp[1], .4); });
    num(t0 + 1.0, 'vivi', '後排', 'text', { col: '#ffc0dc', px: 26, y: .9, dx: -110 }); }
  u.move(ts + 1.5, bh[0], bh[1], .6).pose(ts + 2.1, 'idle');
  if (r.summon) { const t1 = te + .2; box(t1 + .1, 2.4, '召喚　加班大隊', true); cam.to(t1, .5, { x: -.9, d: 12.0, y: 1.5 }).to(t1 + 2.1, .6, WIDE); u.pose(t1 + .2, 'atk').pose(t1 + 1.8, 'idle'); snd(t1 + .2, 'boss_charge', .6); SFX.add('embers', t1 + .3, 2.0, { c: [255, 80, 50], x0: 60, w: 220 });
    R.MINIONS.forEach((m, i) => { const tm = t1 + .8 + i * .32; fx('arcane/rune-circle', tm - .5, home(m), { palette: 'blood', scale: 1.2 }); fx('spawn/poof', tm - .08, home(m), { scale: 1.5, y: .3 }); snd(tm, 'boss_appear', .55);
      at(tm, () => { const mu = units[m]; mu.dead = null; mu.poseK.length = 0; mu.moveK.length = 0; mu.hitK.length = 0; mu.pose(now, 'idle').hop(now, .34, .42); S.hp[m].push({ t: now, v: R.STAT[m].hp }); minionShield[m] = 2; S.shield[m].push({ t: now, v: 2 }); }); });
    at(t1 + 1.5, () => { syncGuard(now); num(now + .1, 'boss', '護衛中：不受傷害', 'text', { col: '#ff9a8a', px: 32, y: .62 }); snd(now, 'shield_up', .7); }); te = t1 + 2.8; }
  else cam.to(te - .5, .5, WIDE);
  return te;
}

// ---------- 回合流程 ----------
let menu = null, focus = 0, hint = '', lastOrder = '';
const NAME = { boss: '奧客總經理', ma: '社畜小兵 A', mb: '社畜小兵 B' };
function setOrder() { const list = [actor, ...queue].filter(id => R.alive(state, id)); const key = list.join(); if (key !== lastOrder) { lastOrder = key; S.order.push({ t: now, v: list }); } }
function nextTurn() {
  if (state.over) return finish();
  if (!queue.length) { queue = R.startRound(state).slice(); box(now, 1.15, `第 ${state.round} 回合`); snd(now, 'card', .6); if (state.atkUp === 0 && atkShown) atkShown = false; at(now + .95, nextTurn); phase = 'anim'; actor = queue[0]; setOrder(); actor = null; return; }
  const id = queue.shift(); if (!R.beginTurn(state, id)) return nextTurn();
  actor = id; setOrder(); S.active.push({ t: now, v: id });
  if (R.HEROES.includes(id)) { syncBars(now); units[id].pose(now, 'ready');
    if (id === 'kevin' && aegisFx.length) { for (const f of aegisFx) f.end = now - f.o.t + .25; aegisFx = []; goHome(now, 'kevin', .3); num(now + .1, 'kevin', '掩護結束', 'text', { col: '#9af0ff', px: 24, y: 1.2 }); }
    phase = 'command'; openMenu('root'); snd(now, 'cursor', .5); }
  else { phase = 'anim'; const r = R.enemyTurn(state, id), te = playFoe(r, now + .25); at(te, () => { S.active.push({ t: now, v: null }); nextTurn(); }); }
}
let atkShown = false;
function act(r) {      // 玩家選完，演出然後換下一個
  phase = 'anim'; menu = null; const t0 = now + .12;
  const te = r.kind === 'attack' ? playAttack(r, t0) : r.kind === 'defend' ? playDefend(r, t0) : r.kind === 'cheer' ? playCheer(r, t0) : r.kind === 'item' ? playItem(r, t0) : r.kind === 'skill' ? playSkill(r, t0) : playUlt(r, t0);
  at(te, () => { syncBars(now); syncGuard(now); for (const id of [...R.HEROES, 'boss', ...R.MINIONS]) if (S.hp[id].at(-1).v !== state.hp[id]) S.hp[id].push({ t: now, v: state.hp[id] }); S.active.push({ t: now, v: null }); nextTurn(); });
}
// 指令選單的內容。每個按鈕：{ label, sub, off（不能按的原因）, go, target（要在誰頭上畫箭頭）, hint }
function openMenu(kind, arg) {
  const id = actor, d = DEFS[id], skills = R.SKILLS[id], back = { label: '返回', sub: '', go: () => openMenu('root'), back: true }; let items = [];
  if (kind === 'root') {
    const needBp = state.mo < R.MO.ult, needSp = state.sp[id] < R.STAT[id].cost, anyItem = Object.keys(R.ITEMS).some(k => state.items[k] > 0 && R.itemTargets(state, k).length);
    items = [id === 'vivi' ? { label: '應援', sub: `氣勢 ＋${R.MO.cheer}`, go: () => act(R.doCheer(state)), hint: `幫全隊加氣勢。氣勢到 ${R.MO.ult} 就能放奧義，全隊共用。` } : { label: '攻擊', sub: '普通攻擊', go: () => openMenu('target'), hint: '選一個敵人攻擊。小兵還在的時候打不到魔王。' },
      { label: '技能', sub: skills.some(k => R.skillOk(state, id, k)) ? skills.map(k => k.name).join('、') : 'SP 不足', off: !skills.some(k => R.skillOk(state, id, k)), go: () => openMenu('skills'), hint: '各自的招式：只花 SP，不用氣勢。' },
      { label: '奧義', sub: needBp ? `氣勢 ${state.mo}／${R.MO.ult}` : needSp ? 'SP 不足' : `${d.skill}　SP ${R.STAT[id].cost}`, off: needBp || needSp, go: () => act(R.doUlt(state, id)), hint: d.desc, gold: !needBp && !needSp },
      { label: '道具', sub: anyItem ? '補血、補 SP、復活' : '現在用不到', off: !anyItem, go: () => openMenu('items'), hint: '珍珠奶茶補 HP，黑咖啡補 SP，雞排便當讓倒下的同伴復活。' },
      { label: '防禦', sub: '受傷減半', go: () => act(R.doDefend(state, id)), hint: `到自己下一次行動前受到的傷害減半，氣勢 ＋${R.MO.defend}。` }];
  } else if (kind === 'target') { const sk = arg, bk = sk ? { ...back, go: () => openMenu('skills') } : back;      // arg＝招式（沒有就是普通攻擊）
    items = R.foes(state).filter(f => f !== 'boss').concat('boss').map(f => ({ label: NAME[f], sub: f === 'boss' ? (R.guarded(state) ? '護衛中　傷害無效' : `HP ${Math.ceil(state.hp.boss / R.STAT.boss.hp * 100)}%`) : `HP ${state.hp[f]}`, warn: f === 'boss' && R.guarded(state), target: f, go: () => act(sk ? R.doSkill(state, id, sk.key, f) : R.doAttack(state, id, f)) })); items.push(bk);
  } else if (kind === 'skills') { items = skills.map(k => ({ label: k.name, sub: `SP ${k.sp}　${k.note}`, off: !R.skillOk(state, id, k), hint: k.desc, go: () => k.target === 'foe' ? openMenu('target', k) : k.target === 'ally' ? openMenu('allySkill', k) : act(R.doSkill(state, id, k.key)) })); items.push(back);
  } else if (kind === 'allySkill') { items = R.FRONT.filter(h => R.alive(state, h) && state.hp[h] < R.STAT[h].hp).map(h => ({ label: DEFS[h].name, sub: `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doSkill(state, id, arg.key, h)) })); items.push({ ...back, go: () => openMenu('skills') });
  } else if (kind === 'items') { items = Object.keys(R.ITEMS).map(k => { const it = R.ITEMS[k], ok = state.items[k] > 0 && R.itemTargets(state, k).length; return { label: it.name, sub: `${it.note}　×${state.items[k]}`, off: !ok, go: () => openMenu('ally', k) }; }); items.push(back);
  } else if (kind === 'ally') { items = R.itemTargets(state, arg).map(h => ({ label: DEFS[h].name, sub: R.ITEMS[arg].sp ? `SP ${state.sp[h]}／${R.STAT[h].sp}` : `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doItem(state, id, arg, h)) })); items.push({ ...back, go: () => openMenu('items') }); }
  menu = { kind, items }; focus = Math.max(0, items.findIndex(i => !i.off)); if (kind !== 'root') snd(now, 'cursor', .6);
}
function finish() {
  phase = 'end'; menu = null; actor = null; const t0 = now + .2;
  if (state.over === 'win') { const u = units.boss; for (let i = 0; i < 6; i++) u.hit(t0 + i * .25, .7 - i * .08); say(t0 + .4, 'boss_down', 'boss'); cam.to(t0, 1.4, { x: -2.6, d: 9.6, y: 1.7 }); S.ui[0].t1 = t0 + .3;
    u.die(t0 + 1.8, 2.4); snd(t0 + 1.8, 'boss_down', 1); for (let i = 0; i < 5; i++) fx('spawn/poof', t0 + 2.1 + i * .35, 'boss', { scale: 1.8, dx: -1 + i * .5, y: .3 + (i % 2) * 1.2, seed: i + 2 }); for (const m of R.MINIONS) if (R.alive(state, m)) kill(t0 + 1.2, m);
    const tv = t0 + 4.6; at(tv - .6, () => playMusic(null)); snd(tv, 'fanfare', 1); cam.to(tv - .4, 1.2, { x: .98, y: 1.25, z: -.1, d: 10.9, pitch: 7 });
    PARTY.forEach((id, i) => { if (!ko[id]) units[id].pose(tv + .15 + i * .12, 'win').hop(tv + .15 + i * .12, .26, .36).hop(tv + 1.2 + i * .1, .14, .3); }); fx('ui/confetti', tv + .3, [3.4, 1.0], { scale: 2.4, y: .6 }); fx('ui/confetti', tv + .9, [4.6, -.8], { scale: 2.2, y: .8, seed: 5 });
    S.victory = { t0: tv + .2, t1: 1e9 }; S.results = [{ k: '回合數', v: state.round }, { k: '被召喚的小兵', v: state.summons * 2 }, { k: '獎金', v: Math.max(1000, 9000 - state.round * 400), c: COL.gold }, { k: '戰利品', v: '準時下班券 ×5' }]; S.results.forEach((r, i) => snd(tv + 1.4 + i * .32, 'stat', .7));
    at(tv + 4.2, () => { playMusic('bgm/victory'); phase = 'over'; });
  } else { S.ui[0].t1 = t0 + .6; SFX.add('black', t0 + .4, 1.2, { from: 0, to: .72 }); SFX.add('black', t0 + 1.6, 1e9, { from: .72, to: .72 }); at(t0 + .3, () => playMusic(null)); units.boss.anim(t0 + .5, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); say(t0 + .9, 'boss_attack', 'boss'); at(t0 + 2.4, () => { phase = 'over'; }); }
}
function start() {
  phase = 'anim'; AC.resume(); playMusic('bgm/battle'); const t0 = now + .1; SFX.add('encounter', t0, 1.3); snd(t0 + .05, 'encounter');
  cam.to(t0 - .01, 0, { x: -3.0, y: 1.9, z: -.5, d: 7.2, pitch: 3, blur: 10 }).to(t0 + .7, 2.6, { d: 8.4, y: 1.75 }, easeOut); snd(t0 + 1.15, 'boss_appear'); cam.shake(t0 + 1.2, .16, .6); S.intro = { t0: t0 + 1.35, t1: t0 + 3.6 };
  units.boss.anim(t0 + 1.9, 'swing', [0, .1, .22, .38, 9, 9, 9, 9]).pose(t0 + 3.2, 'idle'); say(t0 + 1.95, 'boss_intro', 'boss'); cam.shake(t0 + 2.25, .2, .9); SFX.add('lines', t0 + 2.25, .9, { cx: 190, cy: 120, c: [255, 120, 100], a: .55, r0: 150 });
  cam.to(t0 + 3.5, 1.1, WIDE); snd(t0 + 3.5, 'whoosh', .7); PARTY.forEach((id, i) => { units[id].pose(t0, 'wind').pose(t0 + 4.0 + i * .1, 'ready').hop(t0 + 4.0 + i * .1, .14, .26); });
  S.ui.push({ t0: t0 + 4.3, t1: 1e9 }); at(t0 + 4.7, nextTurn);
}

// ---------- 指令選單與開始／結束畫面（畫在介面畫布上，同時記下可以按的範圍） ----------
let zones = [], pointer = null;
const font = (px, w = 700, fam = SANS) => { c.font = `${w} ${px}px ${fam}`; };
const text = (s, x, y, o = {}) => { font(o.px ?? 28, o.w ?? 700, o.fam ?? SANS); c.textAlign = o.align ?? 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = `${o.ls ?? 0}px`; if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.sw ?? 6; c.strokeStyle = o.stroke; c.strokeText(s, x, y); } c.fillStyle = o.col ?? COL.text; c.fillText(s, x, y); c.letterSpacing = '0px'; };
const gem = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill(); };
const fit = (str, room, px, w = 700, fam = SANS) => { font(px, w, fam); while (c.measureText(str).width > room && str.length > 5) str = str.slice(0, -2) + '…'; return str; };
// 指令按鈕＝資料夾的索引標籤：選到的是綠色、往上拉出來一截；按下去會沉、閃一下；不能按的是舊紙，按了會抖
function button(x, y, w, h, it, on, i) {
  const off = !!it.off, pe = pressed && pressed.i === i && !pressed.big && !pressed.opt ? (performance.now() - pressed.t) / PRESS_MS : -1, dn = pe >= 0 && !off, shake = pe >= 0 && off ? Math.sin(pe * 22) * 7 * (1 - Math.min(1, pe)) : 0, sel = on && !off;
  zones.push({ x, y: y - 14, w, h: h + 14, i, off }); c.save(); c.translate(shake, (sel && !dn ? -14 : 0) + (dn ? 6 : 0));
  skin.paper(x, y, w, h, { old: off });
  if (sel) { c.fillStyle = '#1e3b36'; c.fillRect(x + 5, y + 5, w - 10, h - 10); c.fillStyle = TEAL; c.fillRect(x + 7, y + 7, w - 14, h - 14); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x + 7, y + 7, w - 14, 5); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(x + 7, y + h - 13, w - 14, 6); gem(x + 30 + Math.sin(now * 9) * 3, y + 50, 8, CREAM); }
  if (dn) { c.fillStyle = `rgba(255,246,216,${.85 - .5 * Math.min(1, pe)})`; c.fillRect(x, y, w, h); c.strokeStyle = `rgba(255,246,216,${1 - Math.min(1, pe)})`; c.lineWidth = 4; const k = 10 * Math.min(1, pe); c.strokeRect(x - k, y - k, w + 2 * k, h + 2 * k); }
  const col = off ? 'rgba(43,31,24,.36)' : dn ? INK : sel ? '#fff8e6' : INK, lx = x + (sel ? 50 : 24); let px = 44; font(px, 900, SERIF); while (px > 26 && c.measureText(it.label).width + it.label.length * 2 > x + w - lx - 14) { px -= 2; font(px, 900, SERIF); }
  text(it.label, lx, y + 64, { px, w: 900, fam: SERIF, col, ls: 2 });
  if (it.sub) text(fit(it.sub, w - 44, 19, 700), x + 24, y + h - 20, { px: 19, w: 700, col: it.warn ? (sel ? '#ffd0c8' : RED) : off ? 'rgba(43,31,24,.36)' : sel && !dn ? 'rgba(255,248,230,.85)' : INK2 });
  if (it.gold) skin.stamp('可發動', x + w - 52, y + 26, -.1, 17);
  c.restore();
}
// 小開關（聲音、畫質）
function toggle(label, x, y, key, w = 150) { const pe = pressed && pressed.opt === key ? (performance.now() - pressed.t) / PRESS_MS : -1; zones.push({ x, y, w, h: 38, opt: key }); c.save(); c.translate(0, pe >= 0 ? 3 : 0); skin.paper(x, y, w, 38, { old: !!PREF[key] === (key === 'mute') }); text(label, x + w / 2, y + 27, { px: 20, w: 700, align: 'center', col: INK }); c.restore(); }
const toggles = (x, y) => { toggle(PREF.mute ? '聲音　關' : '聲音　開', x, y, 'mute'); toggle(PREF.low ? '畫質　省電' : '畫質　一般', x + 162, y, 'low', 170); };
function drawMenu() {
  zones = []; if (phase !== 'command' || !menu) return;
  const n = menu.items.length, X0 = 770, X1 = 1880, gap = 12, w = Math.min(290, (X1 - X0 - gap * (n - 1)) / n), h = 116, y = 944, x0 = X1 - (w * n + gap * (n - 1)), d = DEFS[actor];
  // 木頭資料夾：上面夾一張說明紙（輪到誰＋目前選項的說明），下面一排索引標籤
  const it = menu.items[focus] || {}, tip = it.hint || (menu.kind === 'target' ? '選攻擊對象（也可以直接點敵人）' : menu.kind === 'ally' || menu.kind === 'allySkill' ? '選要給誰' : menu.kind === 'items' ? '選道具' : menu.kind === 'skills' ? '選招式' : '');
  skin.wood(X0 - 16, y - 84, X1 - X0 + 32, 84 + h + 30, { studs: false }); skin.paper(X0, y - 72, X1 - X0, 46); c.fillStyle = d.color; c.fillRect(X0 + 8, y - 64, 6, 30);
  text(d.name, X0 + 26, y - 39, { px: 28, w: 900, fam: SERIF, col: INK }); font(28, 900, SERIF); const nw = c.measureText(d.name).width; text(d.job, X0 + 36 + nw, y - 40, { px: 18, w: 700, col: INK2 }); font(18, 700); const jw = c.measureText(d.job).width;
  text(fit(tip, X1 - X0 - nw - jw - 90, 20, 700), X0 + 62 + nw + jw, y - 40, { px: 20, w: 700, col: INK });
  menu.items.forEach((m, i) => button(x0 + i * (w + gap), y, w, h, m, i === focus, i));
  toggles(28, 148);
  // 目標頭上的箭頭
  if (it.target) { const [tx, ty] = S.proj(it.target, 1), foe = DEFS[it.target].enemy, col = foe ? '#ff6a5a' : '#8cf09a', by = ty - 40 + Math.sin(now * 9) * 6; c.fillStyle = col; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 19, by - 26); c.lineTo(tx + 19, by - 26); c.lineTo(tx, by); c.closePath(); c.stroke(); c.fill(); text('目標', tx, by - 34, { px: 22, w: 900, align: 'center', col, stroke: 'rgba(10,8,18,.9)', sw: 5, ls: 3 }); }
  // 現在是誰：頭上的箭頭
  { const [ax, ay] = S.proj(actor, 1), by = ay - 30 + Math.sin(now * 7) * 5; c.fillStyle = CREAM; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax - 15, by - 22); c.lineTo(ax + 15, by - 22); c.lineTo(ax, by); c.closePath(); c.stroke(); c.fill(); }
  // 選攻擊對象時，敵人本身也可以點
  if (menu.kind === 'target') menu.items.forEach((m, i) => { if (!m.target) return; const [px, py] = S.proj(m.target, .5), boss = m.target === 'boss', r = boss ? 210 : 100; zones.push({ x: px - r, y: py - r * 1.15, w: r * 2, h: r * 2.3, i, off: false, soft: true }); });
}
function bigButton(label, cx, cy, w = 440, h = 116) { const on = pointer && Math.abs(pointer[0] - cx) < w / 2 && Math.abs(pointer[1] - cy) < h / 2, x = cx - w / 2, pe = pressed && pressed.big ? (performance.now() - pressed.t) / PRESS_MS : -1, dn = pe >= 0, y = cy - h / 2 + (dn ? 6 : 0); zones.push({ x, y: cy - h / 2, w, h, big: true });
  skin.wood(x, y, w, h); skin.paper(x + 16, y + 16, w - 32, h - 32); if (on && !dn) { c.fillStyle = TEAL; c.fillRect(x + 22, y + 22, w - 44, h - 44); } if (dn) { c.fillStyle = `rgba(255,246,216,${.85 - .4 * Math.min(1, pe)})`; c.fillRect(x + 16, y + 16, w - 32, h - 32); }
  text(label, cx, y + h / 2 + 17, { px: 48, w: 900, fam: SERIF, align: 'center', ls: 8, col: on && !dn ? '#fff8e6' : INK }); }
function drawOverlay() {
  if (phase === 'title' || phase === 'load') { zones = []; c.fillStyle = 'rgba(10,7,6,.76)'; c.fillRect(0, 0, W, H);
    text('不 想 上 班 RPG', W / 2, 168, { px: 34, w: 700, align: 'center', col: BRASS, ls: 10 });
    text('上班旅人', W / 2, 350, { px: 190, w: 900, fam: SERIF, align: 'center', ls: 26, col: CREAM, stroke: 'rgba(20,10,4,.95)', sw: 18 });
    c.fillStyle = BRASS; c.fillRect(W / 2 - 420, 398, 840, 3); text('討伐奧客總經理', W / 2, 458, { px: 44, w: 900, fam: SERIF, align: 'center', col: CREAM, ls: 14 }); skin.paper(W / 2 + 396, 268, 250, 58); skin.stamp(`試玩版 ${VERSION}`, W / 2 + 521, 297, 0, 26);
    skin.paper(W / 2 - 520, 506, 1040, 236, { clips: [W / 2 - 440, W / 2 + 440] });
    ['小兵還在場上的時候，魔王不會受傷，先把小兵清掉', '行動會累積全隊共用的「氣勢」，夠了就能放奧義；Vivi 的應援加最多', '把魔王的「底氣」打到歸零，他會理虧：少動一次、受到的傷害變多', '魔王蓄力之後下一次行動放大招，用 Kevin 的奧義或防禦撐過去'].forEach((s, i) => { gem(W / 2 - 474, 552 + i * 50, 6, RED); text(s, W / 2 - 452, 562 + i * 50, { px: 27, w: 700, col: INK }); });
    if (phase === 'title') bigButton('開始戰鬥', W / 2, 838); else text(loadMsg + '…', W / 2, 848, { px: 30, w: 500, align: 'center', col: COL.dim });
    toggles(W / 2 - 166, 930); text('滑鼠／觸控點選，或用方向鍵與 Enter', W / 2, 1022, { px: 21, w: 500, align: 'center', col: 'rgba(239,230,207,.7)' }); }
  if (phase === 'over') { zones = []; if (state.over === 'win') bigButton('再玩一次', 1500, 930, 400, 110);
    else { text('全員倒下', W / 2, 400, { px: 150, w: 900, fam: SERIF, align: 'center', ls: 20, col: '#ff8a78', stroke: 'rgba(20,6,8,.9)', sw: 16 }); text(`撐到第 ${state.round} 回合　魔王還剩 ${Math.ceil(state.hp.boss / R.STAT.boss.hp * 100)}% 的血`, W / 2, 500, { px: 32, w: 500, align: 'center', col: COL.text }); text('提示：看到「蓄力」就讓 Kevin 放奧義；血少的時候小米的奧義可以全員補滿', W / 2, 560, { px: 24, w: 500, align: 'center', col: COL.dim }); bigButton('再挑戰一次', W / 2, 760); } }
}

// ---------- 操作 ----------
const toStage = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
const hitZone = p => { let z = zones.find(z => !z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h); return z || zones.find(z => z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h); };
const PRESS_MS = 130; let pressed = null;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 沒有震動就算了 */ } };
function press(z) {
  if (!z || (pressed && performance.now() - pressed.t < PRESS_MS)) return;
  if (z.opt) { pressed = { opt: z.opt, t: performance.now() }; PREF[z.opt] = !PREF[z.opt]; PREF.set = true; savePref(); if (z.opt === 'mute') master.gain.value = PREF.mute ? 0 : .9; else applyQuality(); snd(now, 'cursor', .6); buzz(8); setTimeout(() => { pressed = null; }, PRESS_MS); return; }
  if (z.off) { pressed = { i: z.i, t: performance.now() }; snd(now, 'cursor', .35); buzz([8, 40, 8]); setTimeout(() => { pressed = null; }, 260); return; }
  pressed = { i: z.i, big: z.big, t: performance.now() }; snd(now, 'confirm', .9); buzz(14); if (!z.big) focus = z.i;
  const m = menu, ph = phase; setTimeout(() => { pressed = null; if (z.big) { if (ph === 'title') { phase = 'anim'; audioReady.then(start); } else if (ph === 'over') location.reload(); return; } if (menu === m && phase === 'command') m.items[z.i].go(); }, PRESS_MS);
}
stage.addEventListener('pointermove', e => { pointer = toStage(e); const z = hitZone(pointer); if (z && !z.big && !z.opt && !z.off && phase === 'command' && z.i !== focus) { focus = z.i; } });
stage.addEventListener('pointerdown', e => { e.preventDefault(); pointer = toStage(e); if (AC.state !== 'running') AC.resume(); press(hitZone(pointer)); });
addEventListener('keydown', e => { if (phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (phase === 'over' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (phase !== 'command' || !menu) return; const n = menu.items.length;
  const step = d => { let i = focus; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!menu.items[i].off) break; } if (i !== focus) { focus = i; snd(now, 'cursor', .5); } };
  if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { step(1); e.preventDefault(); } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { step(-1); e.preventDefault(); } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); press({ i: focus, off: !!menu.items[focus]?.off }); } else if (e.code === 'Escape' || e.code === 'Backspace') { const b = menu.items.find(i => i.back); if (b) b.go(); } });
// 擋掉縮放、選取、長按選單
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart']) addEventListener(ev, e => e.preventDefault(), { passive: false });
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false }); addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// ---------- 主迴圈 ----------
let last = performance.now(), pruneAt = 0, slowN = 0, slowSum = 0;
function frame(ts) {
  const dt = Math.min(.1, (ts - last) / 1000); last = ts;
  if (!PREF.set && !PREF.low && (phase === 'title' || phase === 'load') && ++slowN > 20) { slowSum += dt; if (slowN === 70 && slowSum / 50 > .03) { PREF.low = true; applyQuality(); } }
  now += dt * (Q.has('fast') ? +Q.get('fast') || 3 : 1);      // ↑ 開始畫面平均不到 33 格：自動切省電畫質
  while (todo.length && todo[0].t <= now) todo.shift().fn();
  arena.update(now); for (const id in units) units[id].update(now);
  for (const id of R.FRONT) if (ko[id]) { const m = units[id].mesh; if (units[id].frames.ko) m.material.color.multiplyScalar(.82); else { m.material.color.multiplyScalar(.3); m.scale.y *= .62; } }
  FXL.update(now); cam.update(now); for (const id in units) { const u = units[id]; u.x = u.group.position.x; }
  E.render(1); ui.draw(now, SFX); c.globalAlpha = 1; { const mv = S.mo.filter(k => k.t <= now).at(-1)?.v ?? state.mo; moShown += (mv - moShown) * .18; } drawMenu(); drawOverlay();
  if (now > pruneAt) { pruneAt = now + 2; FXL.prune(now); S.nums = S.nums.filter(n => n.t > now - 4); S.boxes = S.boxes.filter(b => b.t1 > now - 1); S.items = S.items.filter(k => k.t0 > now - 3); S.subs = S.subs.filter(k => k.t0 > now - 8); S.cutins = S.cutins.filter(k => k.t0 > now - 4); S.cards = S.cards.filter(k => k.t1 > now - 1); S.menus.length = 0; }
  requestAnimationFrame(frame);
}
units.mc.show(-2, false); units.md.show(-2, false); cam.to(-1, 0, WIDE); S.order.push({ t: -1, v: [] });
window.__game = { state, S, units, get phase() { return phase; }, get now() { return now; }, get menu() { return menu; }, get actor() { return actor; }, press: i => { focus = i; menu.items[i].go(); }, tap: i => press({ i, off: !!menu.items[i].off }), start: () => press(zones.find(z => z.big)) };
booted = true; requestAnimationFrame(frame); loadMsg = '聲音載入中'; phase = 'load'; audioReady.then(() => { if (phase === 'load') phase = 'title'; });
// 等聲音太久（網路慢）也讓玩家先開始
setTimeout(() => { if (phase === 'load') phase = 'title'; }, 6000);
