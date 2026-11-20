// 試玩版：同一套場景、角色、特效和介面，改成即時的回合制戰鬥。
// 規則在 rules.js（純邏輯）；這裡負責：遊戲時鐘、輪到誰、指令選單（滑鼠／觸控／鍵盤）、把每個行動的結果演出來、即時播音效。
// 影片版的演出都是「排在某個時間點」的事件，所以試玩版只要把事件排在「現在之後」就能沿用同一套東西。
import { makeEngine, W, H, PPU, sat, lerp, ease, easeOut, back, loadTex } from './engine.js';
import { Unit } from './units.js';
import { setupStage, DEFS, EXTRA, WIDE, LINES } from './battle.js';
import { makeUI, COL } from './ui.js';
import * as R from './rules.js';
import { makeSkin, INK, INK2, CREAM, TEAL, RED, BRASS } from './skin.js';

// 小葵的 24 格揮劍（影片抽格的試驗素材）。每格 1/8 秒照影片原速播；蓄力和揮完定住那兩段幾乎不動的影格只留頭尾，縮短停頓。
// 使用者試過覺得跟原本差不多（2026-11-19），所以預設不用；網址加 ?h3=1 才會換成這組，留著之後比較。
const H3_T = [0, .125, .25, .375, .5, .625, .75, .75, .75, .75, .875, 1.0, 1.125, 1.25, 1.375, 1.375, 1.375, 1.375, 1.375, 1.375, 1.375, 1.5, 1.625, 1.75], H3_HIT = 1.0, H3_END = 1.875;
const SANS = '"Noto Sans TC", sans-serif', SERIF = '"Songti TC", "Noto Serif TC", "PMingLiU", serif';
const gl = document.getElementById('gl'), hudCv = document.getElementById('hud'), stage = document.getElementById('stage');
const Q = new URLSearchParams(location.search);
const VERSION = 'v0.9.0';      // 改版時一起改 tools/deploy.sh 會顯示的版本

// ---------- 載入 ----------
let loadMsg = '載入中', booted = false;
{ const c = hudCv.getContext('2d'); c.fillStyle = '#07060c'; c.fillRect(0, 0, W, H); c.fillStyle = '#a9a08e'; c.font = `500 34px ${SANS}`; c.textAlign = 'center'; c.fillText('載入中…', W / 2, H / 2); }
await Promise.all(['500 40px "Noto Sans TC"', '700 40px "Noto Sans TC"', '900 40px "Noto Sans TC"', '700 40px "Songti TC"', '900 40px "Songti TC"'].map(f => document.fonts.load(f, '奧客總經理吐槽一閃').catch(() => 0)));
// 規則的數值蓋到顯示用的設定上（血條長度、選單上的 SP 消耗）
for (const id of R.ALL) { DEFS[id].hp = R.STAT[id].hp; DEFS[id].sp = R.STAT[id].sp; DEFS[id].cost = R.STAT[id].cost; if (R.ULTS[id]) DEFS[id].desc = R.ULTS[id][1]; }
const E = makeEngine(gl), { arena, g: stageGroup, units, A, FXL, SFX, fx, S, cam, num } = await setupStage(E);
const ui = makeUI(hudCv, A, S), c = hudCv.getContext('2d');
// 圖還沒齊的夥伴先不放進招募名單
for (const id of [...R.ALL]) if (!units[id]) R.ALL.splice(R.ALL.indexOf(id), 1);
// 大地圖與卡片用的圖（桌面、藍圖、站點圖示、強化與招式的小圖示）。載不到就用程式畫的替代
const loadImg = url => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });
A.map = { table: await loadImg('art/map/table.jpg'), blueprint: await loadImg('art/map/blueprint.jpg') }; A.icons = {};
await Promise.all(['battle', 'elite', 'rest', 'gift', 'shop', 'event', 'recruit', 'rescue', 'hunt', 'chief', 'boss', 'clock', ...Object.keys(R.UPGRADES).map(k => 'up_' + k), 'sk_ult', ...Object.values(R.SKILLS).flat().map(k => 'sk_' + k.key)].map(async n => { A.icons[n] = await loadImg(`art/map/icons/${n}.png`); }));
// 一輪＝走完行程表（肉鴿路線，rules.js 的 MAP）。開局選人選招式之後才真正開新的一輪；這裡先放一個暫時的，讓開始畫面後面有東西可以看
const RAND = Q.has('seed') ? R.mulberry(+Q.get('seed')) : Math.random;
let run = R.newRun(RAND, 'kui', 'draft'); R.prepare(run);
let state = R.newState(run);
// 第二關的頭目「甩鍋課長」：跟魔王共用 'boss' 這個位置，進關時換上去
const bossU = units.boss; let chiefU = null; A.faceBoss = A.face.boss;
try { const [i, w, a, h] = await Promise.all(['idle', 'wind', 'atk', 'hurt'].map(k => loadTex(`art/enemy/chief_${k}.png`)));
  chiefU = new Unit(stageGroup, { idle: i, atk: a, hurt: h, stun: h, swing: [i, w, w, a, a, a, i, i] }, { x: -2.5, z: -.5, scale: 2.3 * PPU / i.image.height, tint: 0xf0e8f4, shadowK: .7 });
  const fc = document.createElement('canvas'); fc.width = fc.height = 96; const fk = fc.getContext('2d'); fk.imageSmoothingEnabled = false; fk.drawImage(i.image, 40, 4, 56, 56, 0, 0, 96, 96); A.faceChief = fc; } catch (e) { /* 沒有圖就用魔王頂著 */ }
DEFS.mc.pos = [-2.7, -.3]; units.mc.home = [-2.7, -.3]; DEFS.ma.name = DEFS.mb.name = DEFS.mc.name = '社畜小兵';
// 其他種類的一般敵人（rules.js 的 KINDS）與菁英「考績魔導士」：一般敵人共用 ma／mb／mc 三個位置，菁英共用 'boss' 的位置，進關時換上去。沒有圖的種類用社畜小兵頂著
const cropFace = (im, [x, y, sz]) => { const fc = document.createElement('canvas'); fc.width = fc.height = 96; const k = fc.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(im, x, y, sz, sz, 0, 0, 96, 96); return fc; };
const minionU = { drone: { ma: units.ma, mb: units.mb, mc: units.mc } }, minionFace = { drone: A.face.ma }, KLOOK = { courier: { hgt: 1.44, face: [22, 2, 40] }, knight: { hgt: 1.34, face: [26, 0, 40] }, intern: { hgt: 1.4, face: [12, 0, 42] } };
for (const kind in KLOOK) try { const f = {}; for (const k of ['idle', 'atk', 'hit']) f[k] = await loadTex(`art/enemy/${kind}_${k}.png`); const us = {};
  for (const m of ['ma', 'mb', 'mc']) { const front = m !== 'mb'; us[m] = new Unit(stageGroup, f, { x: DEFS[m].pos[0], z: DEFS[m].pos[1], scale: KLOOK[kind].hgt * PPU / f.idle.image.height, tint: front ? 0xf0e8f4 : 0xd8d4ee, phase: front ? .2 : .7 }); us[m].show(-1e9, false); }
  minionU[kind] = us; minionFace[kind] = cropFace(f.idle.image, KLOOK[kind].face); } catch (e) { /* 沒有圖 */ }
let auditU = null;
try { const [i, w, a, h] = await Promise.all(['idle', 'wind', 'atk', 'hurt'].map(k => loadTex(`art/enemy/audit_${k}.png`)));
  auditU = new Unit(stageGroup, { idle: i, atk: a, hurt: h, stun: h, swing: [i, w, w, a, a, a, i, i] }, { x: -2.5, z: -.5, scale: 1.95 * PPU / i.image.height, tint: 0xf0e8f4, shadowK: .7 }); auditU.show(-1e9, false); A.faceAudit = cropFace(i.image, [2, 0, 34]); } catch (e) { /* 沒有圖就用魔王頂著 */ }
const spareUnits = () => [bossU, chiefU, auditU, ...Object.values(minionU).flatMap(us => Object.values(us))].filter(u => u && !Object.values(units).includes(u));
S.noBp = true; S.stamps = []; S.mo = [{ t: -1, v: state.mo }];      // 個人 BP 拿掉，改成全隊共用的氣勢條
S.partyMode = 'h';      // 隊伍狀態放最上面一排，不蓋到右邊的角色
const skin = makeSkin(c, A, S, DEFS); let moShown = state.mo;
S.skinHud = (t, a, cardOn) => skin.hud(t, a, cardOn, moShown, R.MO, R.STAT.boss.shield); S.skinBoxes = t => skin.boxes(t);
S.pot = () => !!(state.L && state.L.pot) && !state.potUsed && R.MINIONS.some(m => R.alive(state, m));      // 甩鍋課長：這回合的第一下還沒甩掉

// ---------- 加到主畫面的提醒 ----------
// 已經是從主畫面開的（standalone）就不提醒。Android Chrome 會給 beforeinstallprompt，可以直接跳安裝；iPhone 只能教使用者按分享鈕。
const UA = navigator.userAgent, IOS = /iPhone|iPad|iPod/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1), ANDROID = /Android/.test(UA);
const STANDALONE = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let installEvt = null, installed = false, iconImg = null; { const im = new Image(); im.onload = () => { iconImg = im; }; im.src = 'icons/icon-192.png'; }
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; }); addEventListener('appinstalled', () => { installed = true; installEvt = null; });
const a2hs = () => { if (STANDALONE || installed || PREF.noA2hs) return null; if (installEvt) return ['點這裡加到主畫面', '以後從圖示開，全螢幕玩']; if (IOS) return ['加到主畫面，全螢幕玩', 'Safari 的分享鈕 →「加入主畫面」']; if (ANDROID || Q.has('a2hs')) return ['加到主畫面，全螢幕玩', '瀏覽器選單 ⋮ →「加到主畫面」']; return null; };

// ---------- 聲音：WebAudio，事件排在遊戲時鐘上 ----------
const PREF = (() => { try { return JSON.parse(localStorage.getItem('a4rpg') || '{}'); } catch (e) { return {}; } })(), savePref = () => { try { localStorage.setItem('a4rpg', JSON.stringify(PREF)); } catch (e) { /* 存不了就算了 */ } };
if (Q.has('mute')) PREF.mute = true; if (Q.has('low')) PREF.low = true;
// 進度存檔：每次回到行程表、每次打贏要選強化之前各存一次（localStorage）。格式與檢查在 rules.js 的 saveRun／loadRun；讀不回來的存檔直接刪掉
const SAVE_KEY = 'a4rpg.run'; let saved, savedAt = -9;
const saveGame = extra => { if (Q.has('stage') || Q.has('floor')) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...R.saveRun(run, extra), ver: VERSION, at: Date.now() })); savedAt = performance.now(); } catch (e) { /* 存不了就算了 */ } };
const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 沒關係 */ } };
const readSave = () => { if (Q.has('stage') || Q.has('floor')) return null; try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const back = R.loadRun(JSON.parse(raw), RAND); if (!back) clearSave(); return back; } catch (e) { clearSave(); return null; } };
// 低畫質：關掉景深、光暈和陰影（手機卡的時候用）。沒選過的話，開始畫面會量幾十格，太慢就自動切過去
const applyQuality = () => { E.dof.enabled = !PREF.low; E.bloom.enabled = !PREF.low; E.renderer.shadowMap.enabled = !PREF.low; E.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
applyQuality();
const AC = new (window.AudioContext || window.webkitAudioContext)(), master = AC.createGain(), musicGain = AC.createGain(); master.connect(AC.destination); musicGain.connect(master); master.gain.value = PREF.mute ? 0 : .9;
const buf = {}; let now = 0, music = null;
const SFX_IDS = ['boss_appear', 'boss_charge', 'boss_down', 'break', 'buff', 'card', 'confirm', 'cursor', 'cutin', 'dark_blast', 'dark_charge', 'defeat', 'encounter', 'explosion', 'explosion_big', 'fanfare', 'heal', 'hit', 'holy_cast', 'paper_storm', 'shield_block', 'shield_up', 'slash', 'slash_b', 'slash_multi', 'stat',
  // 新敵人的專屬音效（audio/sfx/foe_<種類>.mp3）與新夥伴共用的喊聲。檔案還沒有的話就用原本共用的聲音
  'foe_courier', 'foe_knight', 'foe_intern', 'foe_audit', 'shout_m_1', 'shout_m_2', 'shout_f_1', 'shout_f_2', 'squeak_1', 'squeak_2'];
const sfxOr = (a, b) => buf[a] ? a : b;
async function loadSound(id, url) { try { const r = await fetch(url); if (!r.ok) return; buf[id] = await AC.decodeAudioData(await r.arrayBuffer()); } catch (e) { /* 少一個聲音不影響遊戲 */ } }
const pick = await fetch('audio/pick.json').then(r => r.ok ? r.json() : {}).catch(() => ({}));
const audioReady = Promise.all([...SFX_IDS.map(id => loadSound(id, `audio/sfx/${id}.mp3`)), loadSound('whoosh', 'audio/sfx/whoosh.wav'),
  ...Object.keys(LINES).map(k => loadSound('vo/' + k, `audio/vo/${pick['vo/' + k] || k + '_1'}.mp3`)), loadSound('bgm/battle', 'audio/bgm/battle.mp3'), loadSound('bgm/boss', 'audio/bgm/boss.mp3'), loadSound('bgm/map', 'audio/bgm/map.mp3'), loadSound('bgm/victory', 'audio/bgm/victory.mp3')]);
const snd = (t, id, v = 1) => { const b = buf[id]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(), vo = id.startsWith('vo/'); s.buffer = b; g.gain.value = v * (vo ? 1 : .6); s.connect(g).connect(master);
  const when = AC.currentTime + Math.max(0, t - now); s.start(when); if (vo) { musicGain.gain.setTargetAtTime(.16, when, .08); musicGain.gain.setTargetAtTime(.42, when + b.duration + .2, .3); } };
// 配樂的切換：行程表（地圖）播地圖曲；進戰鬥換戰鬥曲、魔王站換魔王曲；戰鬥一結束戰鬥曲就停，回到行程表再換回地圖曲。
// 地圖曲暫時借用之前沒用到的那首程式合成的結算曲（audio/bgm/map.mp3），之後使用者有自己的再換。
const MUSIC_VOL = { 'bgm/map': .75 }; let musicId = null;
function playMusic(id) { if (id && id === musicId && music) return; musicId = id; if (music) { const m = music; m.g.gain.setTargetAtTime(0, AC.currentTime, .25); setTimeout(() => m.s.stop(), 1200); music = null; } const b = buf[id]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(); s.buffer = b; s.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(MUSIC_VOL[id] ?? 1, AC.currentTime, .5); s.connect(g).connect(musicGain); s.start(); music = { s, g }; }
musicGain.gain.value = .42;
// 介面按鍵聲：程式合成的短促木頭聲（使用者嫌原本的音效難聽）。move 游標移動、ok 按下、no 不能按
function uiSound(kind) { if (AC.state !== 'running') return; const t = AC.currentTime;
  const tone = (f0, f1, dur, vol, type = 'sine') => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + .02); };
  if (kind === 'move') tone(980, 820, .03, .045, 'triangle'); else if (kind === 'ok') { tone(400, 280, .075, .17); tone(800, 600, .045, .045, 'triangle'); } else tone(150, 110, .09, .13, 'triangle'); }
// 普攻的發力聲／短台詞：清單在 audio/vo/attack.json，每個人輪流用（發力聲、台詞交錯）
const ATKVO = await fetch('audio/vo/attack.json').then(r => r.ok ? r.json() : {}).catch(() => ({})), atkIdx = {};
audioReady.then(() => Promise.all(Object.values(ATKVO).flat().map(n => loadSound('vo/' + n, `audio/vo/${n}.mp3`))));
const grunt = (t, id) => { const list = ATKVO[id] || []; if (!list.length) return; const order = [0, 2, 1, 3].filter(i => i < list.length), k = atkIdx[id] = ((atkIdx[id] ?? -1) + 1) % order.length; const b = buf['vo/' + list[order[k]]]; if (!b) return; const src = AC.createBufferSource(), g = AC.createGain(); src.buffer = b; g.gain.value = .8; src.connect(g).connect(master); src.start(AC.currentTime + Math.max(0, t - now)); };
const say = (t, line, who) => { snd(t, 'vo/' + line, 1.25); const [text, len] = LINES[line]; S.subs.push({ t0: t, len, text, name: DEFS[who].name, color: DEFS[who].enemy ? '#e2463f' : DEFS[who].color }); };

// ---------- 排程與共用零件 ----------
const todo = []; const at = (t, fn) => { todo.push({ t, fn }); todo.sort((a, b) => a.t - b.t); };
const home = id => DEFS[id].pos, P = (x, y, z) => { const [px, py] = E.project(x, y, z); return [px / 4, py / 4]; };
const ko = {}; let guardShown = true, aegisFx = [], bulwarkFx = [], phase = 'load', actor = null;
const endFx = arr => { for (const f of arr) f.end = now - f.o.t + .25; arr.length = 0; };
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
  if (h.miss) { num(t, h.dst, '落空！', 'text', { col: '#bfeaff', px: 40, y: .95 }); units[h.dst].hop(t - .05, .22, .3); snd(t, 'whoosh', .5); return; }
  if (h.guard) { num(t, h.dst, 0, 'guard', { y: o.y ?? (foe ? .5 : .9), dx: o.dx, dy: o.dy }); if (o.snd !== false) snd(t, 'shield_block', .55); if (h.dst === 'boss') num(t + .15, 'boss', '護衛中', 'text', { col: '#ff9a8a', px: 28, y: .3 }); return; }
  if (h.pot) { num(t - .12, 'boss', '甩鍋！', 'text', { col: '#ffd0a0', px: 40, y: .9 }); units.boss.pose(t - .15, 'atk'); at(t + .4, () => { if (R.alive(state, 'boss')) units.boss.pose(now, 'idle'); }); snd(t - .12, 'shield_block', .6); }
  units[h.dst].hit(t, o.pow ?? 1, foe ? -1 : 1); S.hp[h.dst].push({ t, v: h.hp });
  if (!h.kill && h.v > 0) { const u = units[h.dst];      // 受擊姿勢：縮一下再回原本的站姿（防禦中回防禦、魔王理虧中回垂頭）
    if (!foe && !h.cover && u.frames.hurt) { u.pose(t, 'hurt'); at(t + .42, () => { if (!ko[h.dst] && R.alive(state, h.dst) && phase !== 'end') u.pose(now, state.defend[h.dst] ? 'guard' : 'ready'); }); }
    if (h.dst === 'boss' && u.frames.hurt) { u.pose(t, 'hurt'); at(t + .36, () => { if (R.alive(state, 'boss')) u.pose(now, state.broken ? 'stun' : 'idle'); }); } }
  num(t, h.dst, h.v, foe ? (o.kind || (h.crit ? 'crit' : 'dmg')) : 'foe', { weak: foe && h.weak, big: !foe && h.v >= 1000, dx: o.dx, dy: o.dy, fixed: o.fixed });
  if (o.snd !== false) snd(t, o.snd || 'hit', o.vol ?? .8);
  if (h.dst === 'boss' && h.shield != null) S.shield.boss.push({ t, v: h.shield });
  if (foe && h.dst !== 'boss') { minionShield[h.dst] = Math.max(1, (minionShield[h.dst] ?? 2) - 1); S.shield[h.dst].push({ t, v: minionShield[h.dst] }); if (stepReveal < 4) S.reveal.push({ t, v: ++stepReveal }); }
  if (h.armor) num(t + .14, h.dst, '裝甲　傷害減半', 'text', { col: '#c8d0dc', px: 26, y: 1.3 });
  if (h.cover) num(t + .12, h.dst, '代為承受', 'text', { col: '#9af0ff', px: 26, y: 1.2 });
  if (h.bounty) num(t + .3, h.dst, '業績到手　氣勢 ＋20' + (h.bountySp ? `　全員 SP ＋${h.bountySp}` : ''), 'text', { col: '#ffe27a', px: 28, y: 1.3 });
  if (h.def) num(t + .1, h.dst, '防禦', 'text', { col: '#bfd0ff', px: 24, y: 1.15 });
  if (h.endure) num(t + .2, h.dst, '撐住了！', 'text', { col: '#ffe27a', px: 30, y: 1.3 });
  if (h.aid) { num(t + .2, h.dst, '急救箱！留下三成 HP', 'text', { col: '#9af0b0', px: 30, y: 1.3 }); fx('holy/heal', t + .1, h.dst, { scale: 1.2 }); snd(t + .15, 'heal', .7); }
  if (h.brk) { S.stamps.push({ t, id: 'boss' }); snd(t, 'break', .9); cam.shake(t, .3, .6); fx('status/stunned', t + .4, 'boss', { y: 2.35, dx: .45, scale: 2.2, dur: 4 }); }
  if (h.kill) { if (h.dst === 'boss') return; if (foe) { kill(t + .1, h.dst); at(t + .25, () => syncGuard(now)); } else { at(t + .15, () => { ko[h.dst] = true; }); num(t + .35, h.dst, '倒下', 'text', { col: '#ff6a5a', px: 32, y: 1.2 }); const u = units[h.dst], hp = home(h.dst); u.move(t + .12, hp[0], hp[1], .25); if (u.frames.ko) u.anim(t + .12, 'ko', [0, .42]); else u.pose(t + .1, 'wind'); snd(t + .5, 'defeat', .5); } }
}
let stepReveal = 0;
const ready = (t, id) => { if (!ko[id] && R.alive(state, id)) units[id].pose(t, 'ready'); };
const goHome = (t, id, dur = .28) => units[id].move(t, home(id)[0], home(id)[1], dur);

// ---------- 我方行動的演出。都回傳結束時間 ----------
// 新夥伴的普攻是近戰還是施法
const CASTER = { yan: 1, cha: 1, fairy: 1, xu: 1 };
// 新夥伴出招：有 8 格圖就逐格播（1～4 準備、5 揮出、6 出手的頂點、7 停住、8 收回），第 6 格對在 th 前一點；圖還沒有的人用蓄力／出手兩張
// 沒有專屬語音的夥伴（黑輪之後的人）：出招時喊一聲共用的「賀！」「哈！」，分男女；兩隻老鼠是吱吱聲。每個人兩種聲音輪流（audio/sfx/shout_m_1～2、shout_f_1～2、squeak_1～2）
const VOICE = { heilun: 'm', qiang: 'm', you: 'm', yan: 'f', cha: 'f', senpai: 'f', wu: 'f', fairy: 'f', xu: 'f', zong: 'q', hui: 'q' }, shoutN = {};
const shout = (t, id, v = 1.15) => { const k = VOICE[id]; if (!k) return; const n = 1 + ((shoutN[id] = (shoutN[id] ?? Object.keys(VOICE).indexOf(id)) + 1) % 2); snd(t, k === 'q' ? 'squeak_' + n : `shout_${k}_${n}`, v); };
const has8 = id => !!units[id].frames.ult.real, BLADE = { wu: 1, you: 1 };      // BLADE：拿扇子、匕首的人，打中是刀光與斬擊聲
const reach = (id, big) => (big ? 2.0 : 1.05) + (has8(id) ? .4 : 0);      // 逐格圖出手那格會往前伸很長，站遠一點武器才剛好碰到人
function swing(id, t0, th, ta = .3, hold = .5) { const u = units[id], d = th - t0; if (has8(id)) u.anim(t0, 'ult', [0, d * .16, d * .34, d * .54, d * .76, d * .93, d + .16, d + hold]); else u.pose(t0, 'wind').pose(t0 + ta, 'act'); return u; }
function playAttack(r, t0) {
  grunt(t0 + .05, r.id);
  if (DEFS[r.id].extra) { const id = r.id, u = units[id], h = r.hits[0], tg = r.target, [tx, tz] = units[tg].posAt(t0), big = tg === 'boss', pal = DEFS[id].pal; let th, te; shout(t0 + .04, id);
    if (CASTER[id]) { th = t0 + .7; swing(id, t0, th - .08, .32); fx('arcane/spell-charge', t0, id, { palette: pal, scale: .6, y: .9, dx: -.4, flip: true, dur: .4 }); snd(t0, 'buff', .4);
      fx('explosions/small-explosion', th - .1, tg, { scale: big ? 1.7 : 1.1, y: big ? 1.0 : .3, palette: pal }); snd(th - .05, 'hit', .7); applyHit(th, h, { snd: false }); te = th + .7; }
    else { const k = has8(id) ? .16 : 0; th = t0 + .32 + k; swing(id, t0, th, .22).move(t0 + .06 + k, tx + reach(id, big), tz + .02, .16, easeOut); SFX.add('speed', t0 + .04 + k, .2, { a: .4 }); snd(t0 + .06 + k, 'whoosh', .5);
      if (BLADE[id]) fx('melee/sword-slash', th - .08, [tx + reach(id, big), tz], { flip: true, palette: pal, scale: big ? 1.5 : 1.1 }); else fx('impacts/blunt-hit', th, tg, { y: big ? 1.0 : .6, dx: big ? 1.0 : .4, scale: 1.6, palette: pal });
      cam.shake(th, .12, .28); applyHit(th, h, { snd: h?.guard ? false : BLADE[id] ? 'slash' : 'hit' }); goHome(th + .5, id, .28); te = th + .9; }
    if (h?.guard) box(th + .2, 1.6, '小兵護衛中　魔王不受傷害', true); ready(te - .05, id); return te; }
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
function playCheer(r, t0) { grunt(t0 + .25, 'vivi'); const u = units.vivi; u.pose(t0, 'wind').pose(t0 + .3, u.frames.cheer ? 'cheer' : 'act'); snd(t0 + .3, 'buff', .9); fx('holy/feather-burst', t0 + .3, 'vivi', { scale: 1.0, y: 1.6, palette: 'neon' }); num(t0 + .35, 'vivi', '加油！', 'text', { col: '#ffc0dc', px: 34, y: 1.0, dx: -130 });
  R.FRONT.filter(id => R.alive(state, id)).forEach((id, i) => { const tb = t0 + .5 + i * .09; fx('arcane/mana-burst', tb, id, { scale: .8, palette: 'gold', y: .5 }); units[id].hop(tb + .2, .16, .28); }); num(t0 + .7, 'kevin', `氣勢 ＋${R.MO.cheer}`, 'text', { col: '#ffe27a', px: 34, y: 1.5 });
  at(t0 + .75, () => syncBars(now)); ready(t0 + 1.4, 'vivi'); return t0 + 1.5; }
function playItem(r, t0) { const it = R.ITEMS[r.key], th = t0 + 1.05; units[r.id].pose(t0, r.id === 'mi' || r.id === 'vivi' ? 'act' : 'win'); S.items.push({ t0, from: r.id, to: r.target, key: r.key === 'bento' ? 'tea' : r.key, name: it.name }); snd(t0, 'card', .8);
  if (r.revive) { at(th, () => { ko[r.target] = false; units[r.target].pose(now, 'ready'); }); fx('holy/blessing', th - .1, r.target, { scale: 1.3, dur: 1.4 }); snd(th, 'holy_cast', .6); num(th + .1, r.target, '復活', 'text', { col: '#fff3c8', px: 34, y: 1.3 }); units[r.target].pose(th, 'ready'); }
  if (r.heal != null && (r.heal > 0 || r.revive)) { fx('holy/heal', th - .1, r.target, { scale: 1.25 }); snd(th, 'heal', .9); S.hp[r.target].push({ t: th + .15, v: r.hp }); num(th + .15, r.target, r.heal, 'heal'); }
  if (r.spGain) { fx('arcane/mana-burst', th - .05, r.target, { scale: 1.0, palette: 'cyber', y: .5 }); snd(th, 'buff', .8); S.sp[r.target].push({ t: th + .15, v: r.sp }); num(th + .15, r.target, r.spGain, 'sp'); }
  units[r.target].hop(th + .2, .16, .3); ready(th + .9, r.id); return th + 1.0; }

// 招式（技能）：上方跳招式名，各自的演出
// 新招式的演出設定。type：melee 衝過去打、cast 原地施法打一個、all 施法打全體、self 自己擺姿勢、ally 對同伴
const SKFX = { counter: { type: 'self', say: '放馬過來！', pose: 'guard', hold: true }, chat: { type: 'self', say: '陪我聊一下嘛～' }, carry: { type: 'self', say: '這個我來搬！', pose: 'guard', hold: true },
  burn: { type: 'cast', fx: 'explosions/small-explosion', pal: 'fire', sfx: 'explosion' }, delay: { type: 'cast', fx: 'arcane/rune-circle', pal: 'gold', sfx: 'buff' }, lock: { type: 'all', fx: 'arcane/rune-circle', pal: 'gold', sfx: 'buff' }, mark: { type: 'all', fx: 'arcane/rune-circle', pal: 'gold', sfx: 'stat' },
  deal: { type: 'melee', fx: 'impacts/blunt-hit', pal: 'gold' }, box: { type: 'melee', fx: 'impacts/ground-slam', pal: 'fire', heavy: true }, probe: { type: 'melee', fx: 'impacts/hit-spark', pal: 'blood' }, expose: { type: 'melee', fx: 'impacts/crit-hit', pal: 'blood', heavy: true }, push: { type: 'ally' },
  encore: { type: 'ally', say: '再來一次！' }, dance: { type: 'self', say: '尾牙熱舞！' }, slack: { type: 'self', say: '摸魚中……' }, backdoor: { type: 'melee', fx: 'impacts/hit-spark', pal: 'cyber' }, mice: { type: 'all', fx: 'impacts/hit-spark', pal: 'gold', sfx: 'hit' }, wand: { type: 'ally', say: '下一擊必爆擊' },
  sip: { type: 'self', say: '續命……', pose: 'guard', hold: true }, news: { type: 'melee', fx: 'impacts/blunt-hit', pal: 'gold' }, overtime: { type: 'melee', fx: 'impacts/blunt-hit', pal: 'shadow' }, allnight: { type: 'melee', fx: 'impacts/ground-slam', pal: 'blood', heavy: true }, transfer: { type: 'ally', say: '幫您轉接' }, mix: { type: 'ally', say: '特調一杯' } };
function genericSkill(r, t0, G) {
  const id = r.id, u = units[id], hs = r.hits || [], fy = f => f === 'boss' ? 1.2 : .6; box(t0, 1.5, r.name); at(t0 + .1, () => syncBars(now)); let th = t0 + .5, te = t0 + 1.25; shout(t0 + .06, id);
  if (G.type === 'melee') { const tg = r.target, [tx, tz] = units[tg].posAt(t0), big = tg === 'boss'; const k = has8(id) ? .16 : 0; th = t0 + .36 + k; swing(id, t0, th, .24, .6).move(t0 + .08 + k, tx + reach(id, big), tz + .02, .16, easeOut); SFX.add('speed', t0 + .05 + k, .22, { a: .45 }); snd(t0 + .08 + k, 'whoosh', .55);
    fx(G.fx, th - .04, tg, { y: G.heavy ? .1 : fy(tg), dx: big ? .9 : .3, scale: G.heavy ? (big ? 2.2 : 1.6) : 1.5, palette: G.pal }); if (G.heavy) { snd(th, 'explosion', .6); cam.shake(th, .24, .45); SFX.add('flash', th, .2, { a: .4 }); } else cam.shake(th, .12, .3);
    hs.forEach((h, i) => applyHit(th + i * .2, h, { pow: G.heavy ? 1.5 : 1.1, snd: h.guard ? false : BLADE[id] ? 'slash' : 'hit' })); goHome(th + .6, id, .28); te = th + 1.05; }
  else if (G.type === 'cast' || G.type === 'all') { const tgs = G.type === 'all' ? (r.down || r.marked || hs.map(h => h.dst)) : [r.target]; th = t0 + .62; swing(id, t0, th - .08, .3); fx('arcane/spell-charge', t0, id, { palette: G.pal, scale: .6, y: .9, dx: -.4, flip: true, dur: .4 }); snd(t0, 'buff', .45);
    tgs.forEach((f, i) => fx(G.fx, th - .25 + i * .1, f, { scale: f === 'boss' ? 1.8 : 1.1, y: G.fx.startsWith('explosions') ? fy(f) - .3 : G.fx.startsWith('impacts') ? fy(f) : 0, dx: G.fx.startsWith('impacts') ? (i % 3 - 1) * .3 : 0, palette: G.pal })); snd(th - .05, G.sfx, .6); hs.forEach((h, i) => applyHit(th + i * .12, h, { snd: i ? false : 'hit' })); te = th + .95; }
  else if (G.type === 'self') { if (u.frames.sup && !G.pose) { u.anim(t0, 'sup', [0, .16, .4, .92]); u.pose(t0 + 1.25, 'ready'); te = t0 + 1.35; } else u.pose(t0, G.pose && u.frames[G.pose] ? G.pose : 'act').hop(t0 + .05, .16, .3); fx('impacts/parry', t0 + .1, id, { scale: 1.1, y: .5, palette: DEFS[id].pal }); snd(t0 + .1, 'shield_up', .5); num(t0 + .15, id, G.say, 'text', { col: DEFS[id].color, px: 32, y: 1.3 }); th = t0 + .3; te = Math.max(te, t0 + 1.1); }
  else { th = t0 + .45; if (u.frames.sup) { u.anim(t0, 'sup', [0, .16, .4, .92]); u.pose(t0 + 1.25, 'ready'); } else swing(id, t0, th, .3); snd(t0 + .3, 'buff', .6); te = t0 + (u.frames.sup ? 1.35 : 1.25); if (r.target && units[r.target]) { fx('holy/blessing', th - .1, r.target, { scale: 1.0, dur: 1.1 }); units[r.target].hop(th + .1, .18, .3); if (G.say) num(th, r.target, G.say, 'text', { col: DEFS[id].color, px: 30, y: 1.3 }); } }
  // 附帶效果用字說明
  const tag = (f, s, col = '#ffe27a', dt = .25) => num(th + dt, f, s, 'text', { col, px: 30, y: DEFS[f].enemy ? (f === 'boss' ? .75 : 1.3) : 1.2 });
  for (const f of r.down || []) tag(f, '攻擊力 ↓', '#c9a0ff'); for (const f of r.marked || []) tag(f, '大客戶　受傷 ＋30%'); if (r.delayed) tag(r.delayed, '延到最後'); if (r.burn) tag(r.burn, '灼燒', '#ff9a5a'); if (r.cover) { tag(r.cover, '幫忙擋下一擊', '#9af0ff', 0); units[r.cover].hop(th, .16, .3); }
  if (r.key === 'probe' || (r.key === 'expose' && r.exposed)) tag(id, `證據 ×${r.evidence}`, '#ffd0c8', .45); if (r.key === 'box' && r.duty) tag(id, `扛責 ×${r.duty} 一次砸出去`, '#ffc890', -.2); if (r.bonusMo) tag(id, `氣勢 ＋${r.bonusMo}`, '#ffe27a', .45); if (r.exposed) tag(r.target, '抓到破綻！', '#ff8a78', .1);
  if (r.spGain) { S.sp[id].push({ t: th + .4, v: r.sp }); num(th + .5, id, r.spGain, 'sp'); }
  (r.heals || []).forEach((h, i) => { fx('holy/heal', th + i * .08, h.dst, { scale: 1.15 }); S.hp[h.dst].push({ t: th + .2 + i * .08, v: h.hp }); if (h.v > 0) num(th + .2 + i * .08, h.dst, h.v, 'heal'); }); if (r.heals) snd(th + .05, 'heal', .8);
  (r.spGains || []).forEach((h, i) => { fx('arcane/mana-burst', th + i * .08, h.dst, { scale: .9, palette: 'cyber', y: .5 }); S.sp[h.dst].push({ t: th + .2, v: h.sp }); if (h.v > 0) num(th + .25, h.dst, h.v, 'sp'); });
  if (r.atkUp) R.FRONT.filter(h => R.alive(state, h)).forEach((h, i) => { units[h].hop(th + i * .07, .2, .3); fx('arcane/mana-burst', th + i * .07, h, { scale: .8, palette: 'candy', y: .5 }); num(th + .15 + i * .07, h, '攻擊力 ↑', 'text', { col: '#ffb0d0', px: 26, y: 1.2 }); });
  if (r.shielded) tag(r.shielded, '減傷', '#9af0ff', .5); if (r.overtime) tag(id, `加班 ×${r.overtime}`, '#c8d4e4', .45); if (r.selfDmg) { S.hp[id].push({ t: t0 + .2, v: r.selfHp }); num(t0 + .2, id, r.selfDmg, 'foe'); }
  if (!G.hold) ready(te - .05, id); return te;
}
function playSkill(r, t0) {
  if (SKFX[r.key]) return genericSkill(r, t0, SKFX[r.key]);
  const id = r.id, u = units[id], hs = r.hits || []; box(t0, 1.5, r.name); at(t0 + .1, () => syncBars(now)); let te = t0 + 1.2;
  const foeY = f => (f === 'boss' ? 1.2 : .6);
  if (r.key === 'sweep') { const th = t0 + .34; u.anim(t0, 'ult', [0, .04, .08, .14, .2, .26, .7, .9]).move(t0 + .06, .3, -.3, .14, easeOut); SFX.add('speed', t0 + .04, .25, { a: .5 }); snd(t0 + .08, 'whoosh', .6); snd(th - .06, 'slash_multi', 1);
    fx('melee/spin-slash', th - .12, [.0, -.3], { flip: true, palette: 'fire', scale: 2.4 }); const [x0, y0] = P(1.2, 1.1, -.3), [x1, y1] = P(-3.6, .9, -.3); SFX.add('slash', th - .04, .4, { x0, y0, x1, y1, c: [255, 190, 110], w: 8 }); cam.shake(th, .16, .35);
    hs.forEach((h, i) => applyHit(th + i * .09, h, { snd: i ? false : 'slash', dy: i % 2 ? -70 : 0 })); goHome(th + .6, id, .28); te = th + 1.0; }
  else if (r.key === 'draft') { const tg = r.target, [tx, tz] = units[tg].posAt(t0), gap = tg === 'boss' ? 2.0 : 1.05, h3 = u.frames.h3 && Q.get('h3') === '1', th = t0 + (h3 ? H3_HIT : .36);
    if (h3) { u.anim(t0, 'h3', H3_T).move(t0 + .45, tx + gap + .25, tz + .02, .22, easeOut); snd(t0 + .45, 'whoosh', .55); SFX.add('speed', t0 + .8, .22, { a: .5 }); }
    else { u.anim(t0, 'ult', [0, .05, .1, .16, .22, .28, .8, 1.0]).move(t0 + .1, tx + gap, tz + .02, .14, easeOut); SFX.add('speed', t0 + .06, .22, { a: .5 }); snd(t0 + .1, 'whoosh', .55); }
    fx('melee/heavy-cleave', th - .2, [tx + gap, tz], { flip: true, palette: 'fire', scale: tg === 'boss' ? 1.7 : 1.3 }); fx('impacts/crit-hit', th, tg, { y: foeY(tg), scale: 1.6, palette: 'fire' }); snd(th - .05, 'slash_b', 1); cam.shake(th, .2, .4); SFX.add('flash', th, .2, { c: [255, 200, 140], a: .45 });
    num(th - .1, id, '這樣不行吧！', 'text', { col: '#ffd0a0', px: 26, y: 1.25 }); applyHit(th, hs[0], { snd: false, pow: 1.3 }); if (hs[1]) { fx('melee/double-slash', th + .12, [tx + gap, tz], { flip: true, palette: 'fire', scale: tg === 'boss' ? 1.6 : 1.2 }); snd(th + .16, 'slash', .8); applyHit(th + .24, hs[1], { snd: false, pow: 1.1, dx: 80, dy: -80 }); } goHome(h3 ? t0 + 1.5 : th + .75, id, .28); te = h3 ? t0 + H3_END : th + 1.15; }
  else if (r.key === 'taunt') { u.pose(t0, 'win').hop(t0 + .05, .2, .3); fx('impacts/ground-slam', t0 + .2, id, { palette: 'cyber', scale: 1.1 }); snd(t0 + .2, 'shield_up', .7); num(t0 + .25, id, '這個我來！', 'text', { col: '#9af0ff', px: 34, y: 1.3 });
    SFX.add('ring', t0 + .2, .6, { cx: 300, cy: 180, r: 240, c: [120, 240, 255], w: 3 }); R.foes(state).forEach((f, i) => num(t0 + .55 + i * .08, f, '被挑釁', 'text', { col: '#ff9a8a', px: 24, y: f === 'boss' ? .7 : 1.25 })); te = t0 + 1.25; }
  else if (r.key === 'bash') { const tg = r.target, [tx, tz] = units[tg].posAt(t0), gap = tg === 'boss' ? 2.1 : 1.15, th = t0 + .34; u.anim(t0, 'ult', [0, .04, .1, .2, .26, .3, 999, 999]).move(t0 + .06, tx + gap, tz + .05, .2, easeOut); snd(t0 + .06, 'whoosh', .5); SFX.add('speed', t0 + .05, .22, { a: .4 });
    fx('impacts/blunt-hit', th, tg, { y: foeY(tg), dx: tg === 'boss' ? 1.0 : .4, scale: 2.0, palette: 'cyber' }); fx('impacts/crit-hit', th, tg, { y: foeY(tg), scale: 1.3, palette: 'cyber' }); snd(th, 'shield_block', 1); cam.shake(th, .2, .35);
    applyHit(th, hs[0], { snd: hs[0]?.guard ? false : 'hit', pow: 1.3 }); goHome(th + .5, id, .3); num(th + .7, id, '防禦', 'text', { col: '#bfd0ff', px: 28, y: 1.2 }); te = th + 1.0; at(te - .02, () => { units[id].pose(now, 'guard'); }); return te; }
  else if (r.key === 'barrage') { const th = t0 + .86; u.pose(t0, 'wind').pose(t0 + .3, 'act'); fx('arcane/spell-charge', t0, id, { palette: 'shadow', scale: .7, y: .9, dx: -.4, flip: true, dur: .5 }); snd(t0, 'dark_charge', .6); SFX.add('dim', t0 + .1, 1.4, { c: [22, 6, 44], a: .35, fade: .2 });
    hs.forEach((h, i) => { fx('arcane/star-fall', t0 + .2 + i * .1, h.dst, { scale: h.dst === 'boss' ? 2.0 : 1.2, palette: 'shadow', dx: h.dst === 'boss' ? .3 : 0 }); applyHit(th + i * .1, h, { snd: i ? false : 'hit', dy: i % 2 ? -70 : 0 }); }); snd(th - .1, 'dark_blast', .7); cam.shake(th, .16, .4); if (r.spGain) num(th + .5, id, r.spGain, 'sp'); te = th + .9; }
  else if (r.key === 'freeze') { const tg = r.target, th = t0 + .8; u.pose(t0, 'wind').pose(t0 + .3, 'act'); snd(t0, 'dark_charge', .6); fx('shadow/grasping-hands', t0 + .1, tg, { scale: tg === 'boss' ? 2.0 : 1.3, dx: tg === 'boss' ? .6 : 0 }); fx('shadow/shadow-tendrils', t0 + .2, tg, { scale: tg === 'boss' ? 1.6 : 1.0 });
    applyHit(th, hs[0], { snd: 'hit' }); if (r.down) { num(th + .25, r.down[0], '攻擊力 ↓', 'text', { col: '#c9a0ff', px: 34, y: r.down[0] === 'boss' ? .75 : 1.3 }); snd(th + .2, 'defeat', .5); } te = th + .95; }
  else if (r.key === 'mend' || r.key === 'soothe') { const th = t0 + .6; u.pose(t0, 'wind').pose(t0 + .32, 'act'); snd(t0, 'holy_cast', .7); fx('holy/blessing', t0, id, { scale: 1.0, dur: 1.0 }); if (r.key === 'soothe') fx('holy/heal-aoe', th - .25, [3.0, -.1], { scale: 2.0, palette: 'heal' }); snd(th, 'heal', .9);
    r.heals.forEach((h, i) => { fx('holy/heal', th - .05 + i * .08, h.dst, { scale: 1.2 }); if (h.v > 0) { S.hp[h.dst].push({ t: th + .2 + i * .08, v: h.hp }); num(th + .2 + i * .08, h.dst, h.v, 'heal', { dy: i % 2 ? -76 : 0 }); } units[h.dst].hop(th + .25 + i * .08, .16, .3); }); te = th + 1.0; }
  else if (r.key === 'treat') { const th = t0 + .6; u.pose(t0, 'wind').pose(t0 + .3, u.frames.cheer ? 'cheer' : 'act'); snd(t0 + .3, 'buff', .9); fx('holy/feather-burst', t0 + .3, id, { scale: 1.0, y: 1.6, palette: 'neon' }); num(t0 + .35, id, '我請客！', 'text', { col: '#ffc0dc', px: 32, y: 1.0, dx: -130 });
    r.spGains.forEach((h, i) => { const tb = th + i * .09; fx('arcane/mana-burst', tb, h.dst, { scale: .9, palette: 'cyber', y: .5 }); if (h.v > 0) { S.sp[h.dst].push({ t: tb + .15, v: h.sp }); num(tb + .15, h.dst, h.v, 'sp', { dy: i % 2 ? -66 : 0 }); } units[h.dst].hop(tb + .2, .16, .28); }); te = th + 1.1; }
  ready(te - .05, id); return te;
}

// 新夥伴的奧義：斜切眼神（有圖才播）→ 字幕 → 各自的效果。動作用站姿／蓄力／出手三張，之後有逐格動畫再換
function playUltNew(r, t0) {
  const id = r.id, u = units[id], d = DEFS[id], hs = r.hits || [], tc = t0 + .1, has = !!A.eyes[id], ta = tc + (has ? 1.6 : .45); if (has) { S.cutins.push({ t0: tc, dur: 1.55, id }); snd(tc, 'cutin', 1); }
  S.subs.push({ t0: tc + .2, len: 1.5, text: d.shout, name: d.name, color: d.color }); S.cards.push({ t0: ta - .12, t1: ta + 2.3, id }); at(tc, () => syncBars(now)); cam.to(t0, .4, { x: lerp(WIDE.x, home(id)[0], .08), d: 12.5, y: 1.48 }).to(tc + 1.35, .35, WIDE);
  const tk = ta + .55; let te = ta + 2.3; swing(id, ta, tk, .45, 1.5); shout(ta + .1, id, 1.3); fx('arcane/magic-circle-cast', ta - .1, id, { palette: d.pal, scale: 1.1, dz: -.05 }); snd(ta, 'buff', .8);
  const tag = (f, s, col, dt = 0) => num(tk + .2 + dt, f, s, 'text', { col, px: 30, y: DEFS[f].enemy ? (f === 'boss' ? .75 : 1.3) : 1.2 });
  if (id === 'yan') { SFX.add('flash', tk, .4, { c: [255, 220, 140], a: .5 }); SFX.add('embers', tk, 2.0, { c: [255, 210, 120], n: 60 }); snd(tk, 'holy_cast', .8); R.foes(state).forEach((f, i) => { fx('arcane/rune-circle', tk - .2 + i * .08, f, { palette: 'gold', scale: f === 'boss' ? 1.9 : 1.2 }); tag(f, '延到最後', '#ffe27a', i * .08); });
    R.FRONT.filter(h => !ko[h]).forEach((h, i) => { tag(h, '這回合受傷 －40%', '#9af0ff', .3 + i * .06); units[h].hop(tk + .4 + i * .06, .16, .3); }); }
  else if (id === 'heilun') { SFX.add('speed', tk - .1, 1.2, { a: .3, n: 30 }); hs.forEach((h, i) => { const tt = tk + i * .22; fx('explosions/small-explosion', tt - .1, h.dst, { scale: h.dst === 'boss' ? 1.9 : 1.2, y: h.dst === 'boss' ? 1.0 : .3, palette: 'gold' }); applyHit(tt, h, { snd: i ? false : 'hit' }); }); snd(tk, 'explosion', .7); cam.shake(tk, .2, .5); (r.marked || []).forEach((f, i) => tag(f, '大客戶　受傷 ＋30%', '#ffe27a', .5 + i * .08)); te = tk + 1.8; }
  else if (id === 'cha') { fx('holy/feather-burst', tk, id, { scale: 1.3, y: 1.6, palette: 'heal' }); SFX.add('flash', tk, .4, { c: [170, 240, 200], a: .45 }); snd(tk, 'heal', .9); hs.forEach((h, i) => applyHit(tk + .2 + i * .14, h, { snd: i ? false : 'hit', pow: .7 }));
    R.FRONT.filter(h => !ko[h]).forEach((h, i) => { fx('holy/blessing', tk + i * .08, h, { scale: 1.0, dur: 1.3 }); tag(h, '受傷減半', '#aaf0c8', .3 + i * .06); }); te = tk + 1.7; }
  else if (id === 'qiang') { u.pose(ta + .45, u.frames.guard ? 'guard' : 'act'); snd(tk, 'shield_up', 1.1); cam.shake(tk, .16, .4); fx('impacts/ground-slam', tk - .05, id, { palette: 'fire', scale: 1.3 }); SFX.add('flash', tk, .3, { c: [255, 190, 120], a: .5 });
    bulwarkFx = [FXL.add({ id: 'holy/divine-shield', t: tk, dur: 600, x: 3.3, y: -.2, z: 1.9, scale: 5.2, palette: 'fire', glow: 1.1 })]; tag(id, '全部我來扛', '#ffc890'); R.HEROES.filter(h => h !== id && !ko[h]).forEach((h, i) => tag(h, '掩護', '#ffc890', .15 + i * .05)); te = tk + 1.3; return te; }
  else if (id === 'senpai') { const h = hs[0]; if (h) { const big = h.dst === 'boss', [tx, tz] = units[h.dst].posAt(ta); u.move(ta + .3, tx + reach(id, big), tz, .16, easeOut); SFX.add('dim', tk - .1, .5, { a: .55, fade: .08 }); SFX.add('slash', tk + .05, .5, { x0: 300, y0: 70, x1: 30, y1: 210, c: [255, 110, 90], w: 10 }); SFX.add('flash', tk + .12, .3, { a: .8 }); snd(tk + .05, 'slash_b', 1.1);
      fx('impacts/crit-hit', tk + .15, h.dst, { y: big ? 1.2 : .6, scale: 2.2, palette: 'blood' }); cam.shake(tk + .2, .32, .7); applyHit(tk + .2, h, { kind: 'crit', pow: 1.6, snd: 'hit' }); if (r.evidence) tag(id, `證據 ×${r.evidence} 全部攤開`, '#ffd0c8', -.3); goHome(tk + 1.1, id, .3); } te = tk + 1.7; }
  else if (id === 'wu') { SFX.add('flash', tk, .4, { c: [255, 160, 200], a: .5 }); fx('ui/confetti', tk, [3.2, .2], { scale: 2.0, y: .8 }); snd(tk, 'fanfare', .5); u.hop(tk, .3, .4);
    (r.encore || []).forEach((h, i) => { units[h].hop(tk + .25 + i * .1, .24, .34); fx('arcane/mana-burst', tk + .2 + i * .1, h, { scale: .9, palette: 'candy', y: .5 }); tag(h, '再來一次！', '#ffb0d0', .1 + i * .1); }); te = tk + 1.5; }
  else if (id === 'you') { const h = hs[0]; if (h) { const big = h.dst === 'boss', [tx, tz] = units[h.dst].posAt(ta); u.move(ta + .3, tx + reach(id, big), tz, .14, easeOut); SFX.add('dim', tk - .1, .5, { a: .5, fade: .08 }); SFX.add('slash', tk + .05, .45, { x0: 310, y0: 150, x1: 20, y1: 120, c: [120, 240, 220], w: 9 }); SFX.add('flash', tk + .12, .3, { a: .7 }); snd(tk + .05, 'slash_b', 1.0);
      fx('impacts/crit-hit', tk + .15, h.dst, { y: big ? 1.2 : .6, scale: 2.1, palette: 'cyber' }); cam.shake(tk + .2, .3, .7); tag(h.dst, '走後門！', '#9af0e0', -.25); applyHit(tk + .2, h, { kind: 'crit', pow: 1.6, snd: 'hit' }); goHome(tk + 1.0, id, .3); } te = tk + 1.6; }
  else if (id === 'fairy') { SFX.add('flash', tk, .5, { c: [200, 230, 255], a: .55 }); SFX.add('embers', tk, 2.0, { c: [210, 235, 255], n: 70 }); snd(tk, 'holy_cast', .9);
    (r.heals || []).forEach((h, i) => { const tt = tk + .3 + i * .12; fx('holy/blessing', tt - .1, h.dst, { scale: 1.2, dur: 1.4 }); S.hp[h.dst].push({ t: tt, v: h.hp }); if (h.v > 0) num(tt, h.dst, h.v, 'heal'); units[h.dst].hop(tt + .1, .18, .3);
      if (h.revive) { at(tt, () => { ko[h.dst] = false; units[h.dst].pose(now, 'ready'); }); units[h.dst].pose(tt, 'ready'); num(tt + .15, h.dst, '復活', 'text', { col: '#fff3c8', px: 34, y: 1.3 }); } }); snd(tk + .35, 'heal', .9); te = tk + 1.9; }
  else if (id === 'zong') { u.pose(ta + .45, u.frames.guard ? 'guard' : 'act'); snd(tk, 'shield_up', 1.0); SFX.add('flash', tk, .3, { c: [255, 220, 150], a: .45 }); R.FRONT.filter(h => R.alive(state, h)).forEach((h, i) => { fx('impacts/parry', tk + i * .08, h, { scale: 1.1, y: .5, palette: 'gold' }); tag(h, '不會倒下', '#ffe27a', i * .08); units[h].hop(tk + .1 + i * .08, .14, .26); }); te = tk + 1.4; }
  else if (id === 'hui') { SFX.add('speed', tk - .1, 1.4, { a: .3, n: 30 }); hs.forEach((h, i) => { const tt = tk + i * .26; if (has8(id)) u.anim(tt - .2, 'ult', [0, 0, 0, .02, .1, .17, 9, 9]); else u.pose(tt - .12, i % 2 ? 'wind' : 'act'); fx('impacts/blunt-hit', tt - .04, h.dst, { scale: h.dst === 'boss' ? 2.0 : 1.5, y: h.dst === 'boss' ? 1.0 : .5, dx: (i % 2 ? .3 : -.2), palette: 'shadow' }); cam.shake(tt, .12, .35); applyHit(tt, h, { snd: 'hit', dy: i % 2 ? -60 : 0 }); }); te = tk + hs.length * .26 + 1.0; }
  else if (id === 'xu') { fx('holy/feather-burst', tk, id, { scale: 1.2, y: 1.6, palette: 'heal' }); SFX.add('flash', tk, .4, { c: [170, 240, 180], a: .45 }); snd(tk, 'heal', .9);
    (r.heals || []).forEach((h, i) => { const tt = tk + .25 + i * .1; fx('holy/heal', tt - .1, h.dst, { scale: 1.2 }); S.hp[h.dst].push({ t: tt, v: h.hp }); if (h.v > 0) num(tt, h.dst, h.v, 'heal'); units[h.dst].hop(tt + .1, .16, .3); });
    (r.spGains || []).forEach((h, i) => { S.sp[h.dst].push({ t: tk + .7, v: h.sp }); if (h.v > 0) num(tk + .75 + i * .08, h.dst, h.v, 'sp'); }); if (r.tea) tag(id, '珍珠奶茶 ＋1', '#ffe27a', .9); te = tk + 1.9; }
  ready(te - .05, id); return te;
}
// 奧義：斜切眼神 → 喊招 → 各自的演出
function playUlt(r, t0) {
  if (DEFS[r.id].extra) return playUltNew(r, t0);
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
    const ctr = state.hasBoss ? 'boss' : [-1.7, -.4];
    fx('shadow/black-hole', ta + .5, ctr, { scale: 2.2, y: .1, dur: 2.5, dz: -.2 }); fx('shadow/shadow-tendrils', ta + 1.1, ctr, { scale: 1.8, dx: .3 }); fx('shadow/dark-explosion', ta + .98, ctr, { scale: 2.0, y: .2, dx: .2 });
    const tp = ta + .98 + 1.84; snd(tp - .1, 'dark_blast', 1.1); SFX.add('flash', tp, .45, { c: [200, 150, 255], a: .9 }); cam.shake(tp, .34, .9); SFX.add('lines', tp, .7, { cx: 150, cy: 130, c: [200, 150, 255], a: .6 });
    const mh = r.hits.filter(h => h.dst !== 'boss'), bh = r.hits.filter(h => h.dst === 'boss'); mh.forEach((h, i) => { fx('shadow/grasping-hands', ta + 1.1, h.dst, { scale: 1.3 }); applyHit(tp - .35 + i * .12, h, { snd: i ? false : 'hit' }); });
    bh.forEach((h, i) => applyHit(tp + .05 + i * .25, h, i ? { dx: 150, dy: 120, pow: .8, snd: false } : { kind: h.crit ? 'crit' : 'dmg', pow: 1.6, snd: false })); if (bh.some(h => !h.guard)) fx('shadow/shadow-flames', tp + .2, ctr, { scale: 2.2, dur: 1.5, dx: .2 });
    te = tp + 1.3; card(te - ta - .3);
  } else if (id === 'kevin') {
    u.move(ta, .55, -.35, .34).anim(ta + .1, 'ult', [0, .12, .28, .46, .56, .64, 999, 999]); snd(ta + .1, 'whoosh', .6); const tk = ta + .74; snd(tk, 'shield_up', 1.1); cam.shake(tk, .14, .4); fx('impacts/ground-slam', tk - .05, [.55, -.35], { palette: 'cyber', scale: 1.3 });
    SFX.add('flash', tk, .3, { c: [120, 240, 255], a: .5 }); SFX.add('ring', tk, .6, { cx: 262, cy: 185, r: 300, c: [120, 240, 255], w: 3 });
    aegisFx = [FXL.add({ id: 'holy/divine-shield', t: tk, dur: 600, x: 3.3, y: -.2, z: 1.9, scale: 5.2, palette: 'cyber', glow: 1.2 }), FXL.add({ id: 'holy/divine-shield', t: tk, dur: 600, x: .1, y: 0, z: -.2, scale: 1.7, palette: 'cyber' })];
    num(tk + .3, id, '全體掩護', 'text', { col: '#9af0ff', y: 1.25 }); for (const h of R.HEROES.filter(x => x !== 'kevin')) if (h === 'vivi' || R.alive(state, h)) num(tk + .45, h, '掩護', 'text', { col: '#9af0ff', px: 26, y: h === 'vivi' ? .9 : 1.12, dx: h === 'vivi' ? -100 : 0 });
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
// 我方的反擊（小葵的架勢、阿強的扛）：敵人打完之後馬上打回去
function counters(r, th) { (r.hits.counters || []).forEach((cn, i) => { const u = units[cn.src], tt = th + .42 + i * .12; u.pose(tt - .14, 'act'); fx('impacts/crit-hit', tt, cn.dst, { y: cn.dst === 'boss' ? 1.2 : .6, scale: 1.5, palette: DEFS[cn.src].pal }); num(tt - .1, cn.src, '反擊！', 'text', { col: '#ffe27a', px: 30, y: 1.3 }); applyHit(tt, cn, { snd: 'slash', pow: 1.2 }); at(tt + .5, () => { if (!ko[cn.src] && R.alive(state, cn.src) && phase !== 'end') u.pose(now, state.bulwark || state.carry ? 'guard' : 'ready'); }); }); }
function playFoe(r, t0) {
  const id = r.id, u = units[id];
  if (r.kind === 'foeAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, [hx, hz] = home(id), [tx, tz] = units[tgt].posAt(t0); box(t0, 1.3, R.KINDS[state.kind[id]].move, true);
    u.pose(t0 + .15, 'atk').move(t0 + .15, tx - .95, tz + .02, .2, easeOut); snd(t0 + .15, sfxOr('foe_' + state.kind[id], 'whoosh'), buf['foe_' + state.kind[id]] ? .7 : .45); const th = t0 + .41; fx('impacts/blunt-hit', th, tgt, { y: .7, dx: -.2, scale: 1.2 });
    r.hits.forEach((h, i) => applyHit(th + i * .05, h, { pow: .9, snd: i ? false : undefined })); for (const h of r.hits) if (h.spLoss) { num(th + .28, h.dst, `SP －${h.spLoss}`, 'text', { col: '#8fc0ff', px: 30, y: 1.65 }); S.sp[h.dst].push({ t: th + .28, v: h.sp }); } if (r.hits.taunted && r.hits[0] && !r.hits[0].miss) num(th - .2, r.hits[0].dst, '我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 }); counters(r, th); if (r.weak) num(t0 + .1, id, '詛咒中', 'text', { col: '#c9a0ff', px: 24, y: 1.2 }); u.move(th + .3, hx, hz, .28).pose(th + .62, 'idle'); return th + .95; }
  if (r.kind === 'foeHeal') { const th = t0 + .55; box(t0, 1.4, R.KINDS[state.kind[id]].move, true); u.pose(t0 + .15, 'atk').pose(t0 + 1.0, 'idle'); snd(t0 + .15, sfxOr('foe_' + state.kind[id], 'whoosh'), buf['foe_' + state.kind[id]] ? .7 : .35); fx('holy/heal', th - .1, r.dst, { scale: r.dst === 'boss' ? 1.9 : 1.2, y: r.dst === 'boss' ? .6 : 0 }); snd(th, 'heal', .7);
    S.hp[r.dst].push({ t: th + .15, v: r.hp }); num(th + .15, r.dst, r.v, 'heal'); units[r.dst].hop(th + .2, .16, .3); return t0 + 1.4; }
  if (r.kind === 'stunned') { box(t0, 1.3, '理虧中　說不出話', true); u.pose(t0, 'stun').pose(t0 + 1.0, 'idle'); num(t0 + .9, 'boss', '底氣回復', 'text', { col: '#ffd0c8', y: .5 }); S.shield.boss.push({ t: t0 + .9, v: r.shield }); snd(t0 + .9, 'shield_up', .5); return t0 + 1.4; }
  if (r.kind === 'charge') { cam.to(t0, .6, { x: -1.3, d: 11.4, y: 1.7 }).to(t0 + 2.3, .5, WIDE); box(t0 + .2, 2.4, state.L.text.charge, true); u.anim(t0 + .3, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); snd(t0 + .3, 'boss_charge', 1); if (state.L.id === 'boss') say(t0 + .65, 'boss_attack', 'boss');
    fx('lightning/charge-up', t0 + .4, 'boss', { palette: 'blood', scale: 2.0, y: 2.2, dx: .2 }); SFX.add('vignette', t0 + .4, 2.2, { c: [220, 30, 30], a: .8, pulse: 14 }); SFX.add('embers', t0 + .4, 2.2, { c: [255, 80, 50], x0: 0, w: 260 }); cam.shake(t0 + 1.0, .08, 1.4);
    num(t0 + 1.4, 'boss', '下一次行動：全體大傷害', 'text', { col: '#ff8a70', y: .5, px: 32 }); return t0 + 2.8; }
  if (r.kind === 'bossAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, bh = home('boss'), [kx, kz] = home(tgt); box(t0 + .1, 2.2, state.L.text.atk, true); cam.to(t0, .5, { x: -.2, d: 12.3, y: 1.5 });
    const ts = t0 + .3, th = ts + .58; u.move(ts, kx - 2.1, kz + .3, .45).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.3, 1.6]); snd(ts, state.L.id === 'audit' ? sfxOr('foe_audit', 'whoosh') : 'whoosh', .6); fx('melee/hammer-smash', th - .5, [kx - 1.2, kz + .1], { scale: 1.5, palette: 'blood' }); snd(th, 'explosion', .7); cam.shake(th, .3, .6); SFX.add('flash', th, .25, { c: [255, 120, 100], a: .6 });
    r.hits.forEach((h, i) => applyHit(th + .02 + i * .05, h, { pow: 1.6, snd: i ? false : 'hit' })); if (!r.hits[0].guard && !r.hits[0].cover && !r.hits[0].kill) units[tgt].move(th + .02, kx + .55, kz, .2, easeOut).move(th + 1.0, kx, kz, .3);
    if (r.hits.taunted && r.hits[0] && !r.hits[0].miss) num(th - .3, r.hits[0].dst, '我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 }); counters(r, th);
    u.move(ts + 1.3, bh[0], bh[1], .55).pose(ts + 1.9, 'idle'); cam.to(ts + 1.3, .6, WIDE); return ts + 2.1; }
  // 大招「無限改稿」
  const bh = home('boss'); box(t0 + .1, 3.0, state.L.text.ult, true); cam.to(t0, .5, { x: .6, d: 13.2, y: 1.4 }); snd(t0 + .3, 'paper_storm', 1); SFX.add('papers', t0 + .3, 2.4, { n: 200 }); SFX.add('speed', t0 + .3, 2.3, { dir: 1, a: .3, n: 26 }); cam.shake(t0 + .4, .1, 2.0);
  const ts = t0 + 1.5, th = ts + .58; let te = ts + 2.2;
  if (r.blocked) { const kh = r.hits.find(h => h.cover); [.7, 1.15].forEach((dt, i) => { fx('impacts/shield-block', t0 + dt, [.05, -.35], { palette: 'cyber', scale: 1.7, flip: true, y: .1 + i * .15 }); snd(t0 + dt, 'shield_block', .8); SFX.add('flash', t0 + dt, .16, { c: [150, 240, 255], a: .35 }); });
    u.move(ts, -1.5, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]); snd(th - .05, 'shield_block', 1.2); snd(th, 'explosion', .8); fx('melee/hammer-smash', th - .5, [-1.0, -.4], { scale: 1.6, palette: 'blood' }); fx('impacts/parry', th, [.1, -.35], { scale: 2.2, palette: 'cyber', y: .2 });
    SFX.add('flash', th, .35, { a: .9 }); SFX.add('lines', th, .5, { cx: 250, cy: 170, c: [150, 240, 255] }); cam.shake(th, .36, .8); r.hits.forEach((h, i) => applyHit(th + .03 + (h.cover ? 0 : .05 + i * .03), h, { pow: 1.2, snd: false, y: h.dst === 'vivi' ? .3 : .9 }));
    if (kh) num(th + .5, kh.dst, '完全防禦！', 'text', { col: '#9af0ff', y: 1.5, px: 44 }); counters(r, th);
  } else { SFX.add('vignette', t0 + .3, 3.4, { c: [220, 30, 30], a: .75, pulse: 10 }); u.move(ts, -1.1, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]);
    fx('melee/hammer-smash', th - .5, [-.5, -.4], { scale: 1.8, palette: 'blood' }); fx('impacts/ground-slam', th, [.9, -.3], { scale: 2.6, palette: 'blood' }); snd(th - .05, 'hit', 1); snd(th, 'explosion', 1.1);
    SFX.add('flash', th, .45, { c: [255, 140, 110], a: .95 }); SFX.add('ring', th, .7, { cx: 215, cy: 190, r: 460, c: [255, 120, 90], w: 6 }); SFX.add('lines', th, .5, { cx: 215, cy: 180, c: [255, 150, 120], a: .6 }); cam.shake(th, .5, 1.0);
    r.hits.forEach((h, i) => { const hp = home(h.dst), tt = th + .05 + i * .07; applyHit(tt, h, { pow: 1.7, snd: false, dy: [-40, -150, -70, -190][i % 4], dx: [-30, 10, -20, 40][i % 4] }); if (!h.kill) units[h.dst].move(tt, hp[0] + .5, hp[1], .2, easeOut).move(tt + 1.2, hp[0], hp[1], .4); });
    num(t0 + 1.0, 'vivi', '後排', 'text', { col: '#ffc0dc', px: 26, y: .9, dx: -110 }); }
  if (r.moLoss) { num(th + .7, 'boss', `氣勢 －${r.moLoss}`, 'text', { col: '#ff8a70', px: 36, y: .62 }); S.mo.push({ t: th + .7, v: r.mo }); snd(th + .7, 'break', .5); }
  u.move(ts + 1.5, bh[0], bh[1], .6).pose(ts + 2.1, 'idle');
  if (r.summon) { const t1 = te + .2; box(t1 + .1, 2.4, state.L.text.summon, true); cam.to(t1, .5, { x: -.9, d: 12.0, y: 1.5 }).to(t1 + 2.1, .6, WIDE); u.pose(t1 + .2, 'atk').pose(t1 + 1.8, 'idle'); snd(t1 + .2, 'boss_charge', .6); SFX.add('embers', t1 + .3, 2.0, { c: [255, 80, 50], x0: 60, w: 220 });
    R.MINIONS.forEach((m, i) => { const tm = t1 + .8 + i * .32; fx('arcane/rune-circle', tm - .5, home(m), { palette: 'blood', scale: 1.2 }); fx('spawn/poof', tm - .08, home(m), { scale: 1.5, y: .3 }); snd(tm, 'boss_appear', .55);
      at(tm, () => { const mu = units[m]; mu.dead = null; mu.poseK.length = 0; mu.moveK.length = 0; mu.hitK.length = 0; mu.pose(now, 'idle').hop(now, .34, .42); S.hp[m].push({ t: now, v: R.STAT[m].hp }); minionShield[m] = 2; S.shield[m].push({ t: now, v: 2 }); }); });
    at(t1 + 1.5, () => { syncGuard(now); num(now + .1, 'boss', state.L.guard ? '護衛中：不受傷害' : '找到人背鍋了', 'text', { col: '#ff9a8a', px: 32, y: .62 }); snd(now, 'shield_up', .7); }); te = t1 + 2.8; }
  else cam.to(te - .5, .5, WIDE);
  return te;
}

// ---------- 回合流程 ----------
let menu = null, focus = 0, lastOrder = '';
const NAME = new Proxy({}, { get: (_, f) => { if (f === 'boss') return DEFS.boss.name; if (!DEFS[f]) return undefined; const same = ['ma', 'mb', 'mc'].filter(m => R.MINIONS.includes(m) && DEFS[m].name === DEFS[f].name); return DEFS[f].name + (same.length > 1 ? ' ' + 'ABC'[same.indexOf(f)] : ''); } });
function setOrder() { const list = [actor, ...state.queue].filter(id => id && R.alive(state, id)); const key = list.join(); if (key !== lastOrder) { lastOrder = key; S.order.push({ t: now, v: list }); } }
function nextTurn() {
  if (state.over) return finish();
  if (!state.queue.length) { R.startRound(state); box(now, 1.15, `第 ${state.round} 回合`); snd(now, 'card', .6); let te = now + .95;
    // 回合一開始先結算灼燒
    state.events.filter(e => e.kind === 'tempo').forEach(e => { S.mo.push({ t: now + .4, v: e.mo }); num(now + .4, R.FRONT.find(h => R.alive(state, h)) || R.HEROES[0], '準時開會　氣勢 ＋8', 'text', { col: '#ffe27a', px: 26, y: 1.45 }); });
    state.events.filter(e => e.kind === 'burn').forEach((e, i) => { const t = now + .55 + i * .3, big = e.dst === 'boss'; fx('explosions/small-explosion', t - .1, e.dst, { scale: big ? 1.5 : 1, y: big ? 1.0 : .3, palette: 'fire' }); num(t - .2, e.dst, '灼燒', 'text', { col: '#ff9a5a', px: 28, y: big ? .75 : 1.3 }); applyHit(t, { dst: e.dst, v: e.v, hp: e.hp, kill: e.kill }, { snd: 'hit', vol: .5 }); te = Math.max(te, t + .75); });
    phase = 'anim'; actor = state.queue[0]; setOrder(); actor = null; at(te, nextTurn); return; }
  const id = state.queue.shift(); if (!R.beginTurn(state, id)) return nextTurn();
  actor = id; setOrder(); S.active.push({ t: now, v: id });
  if (R.HEROES.includes(id)) { syncBars(now); units[id].pose(now, 'ready');
    if (id === 'kevin' && aegisFx.length) { endFx(aegisFx); goHome(now, 'kevin', .3); num(now + .1, 'kevin', '掩護結束', 'text', { col: '#9af0ff', px: 24, y: 1.2 }); }
    if (id === 'qiang' && bulwarkFx.length) { endFx(bulwarkFx); num(now + .1, 'qiang', '掩護結束', 'text', { col: '#ffc890', px: 24, y: 1.2 }); }
    phase = 'command'; pickTip(id); openMenu('root'); uiSound('move'); }
  else { phase = 'anim'; const r = R.enemyTurn(state, id), te = playFoe(r, now + .25); at(te, () => { S.active.push({ t: now, v: null }); nextTurn(); }); }
}
// 教學便條：第一次遇到某個狀況，輪到玩家下指令時在左上角貼一張（不擋中間），下完這一步就收起來。看過的記在 PREF.tips，之後不再出現
const TIPS = { basics: ['怎麼打', '攻擊、招式、防禦都會累積上方的「氣勢」，全隊共用。', '招式只花 SP。氣勢到 40、SP 也夠，「奧義」就會亮。'], ult: ['奧義可以放了', '放奧義會用掉 40 氣勢和自己的 SP。', '氣勢全隊共用，想清楚給誰放。'],
  charge: ['頭目在蓄力', '他下一次行動會打全體。', '現在防禦，或用坦克的招式、奧義擋下來。'], broken: ['頭目理虧了', '底氣歸零：他下一次行動取消。', '這段時間打他的傷害是 1.5 倍，趁現在全力打。'],
  guard: ['護衛中', '小兵還在場上時，打頭目沒有傷害。', '先把小兵清掉。'], pot: ['甩鍋', '課長每回合第一次被打，會甩給小兵承受。', '先用小招騙掉這一下，再放大招。'], audit: ['考績魔導士', '她的大招除了打全體，還會扣 40 氣勢。', '奧義亮了就放，不要存。'] };
let tipNow = null;
function pickTip(id) { const seen = PREF.tips || (PREF.tips = []), kinds = R.MINIONS.filter(m => R.alive(state, m) && state.kind[m] !== 'drone').map(m => 'k_' + state.kind[m]);
  const want = ['basics', state.charging && 'charge', state.broken && 'broken', R.guarded(state) && 'guard', S.pot() && 'pot', state.L && state.L.moDrain && 'audit', ...kinds, id !== 'vivi' && R.canUlt(state, id) && 'ult'].find(k => k && !seen.includes(k));
  if (!want) return (tipNow = null); seen.push(want); savePref(); const K = want.startsWith('k_') && R.KINDS[want.slice(2)]; tipNow = { t: performance.now(), title: K ? K.name : TIPS[want][0], lines: K ? [K.note + '。'] : TIPS[want].slice(1) }; }
function drawTip() { if (!tipNow || phase !== 'command') return; const k = Math.min(1, (performance.now() - tipNow.t) / 220), X = 14 - (1 - k) * 40, Y = 206, Wd = 590, rows = tipNow.lines.flatMap(l => wrap(l, Wd - 56, 22)), Hh = 74 + rows.length * 32;
  c.save(); c.globalAlpha = k; skin.paper(X, Y, Wd, Hh, { clips: [X + 60] }); c.fillStyle = RED; c.fillRect(X + 22, Y + 22, 7, 30); text(tipNow.title, X + 42, Y + 47, { px: 28, w: 900, fam: SERIF, col: INK, ls: 4 }); text('第一次遇到', X + Wd - 24, Y + 44, { px: 17, w: 700, align: 'right', col: INK2 });
  rows.forEach((l, i) => text(l, X + 28, Y + 86 + i * 32, { px: 22, w: 700, col: INK })); c.restore(); }
function act(r) {      // 玩家選完，演出然後換下一個
  phase = 'anim'; menu = null; tipNow = null; const t0 = now + .12;
  const te = r.kind === 'attack' ? playAttack(r, t0) : r.kind === 'defend' ? playDefend(r, t0) : r.kind === 'cheer' ? playCheer(r, t0) : r.kind === 'item' ? playItem(r, t0) : r.kind === 'skill' ? playSkill(r, t0) : playUlt(r, t0);
  at(te, () => { syncBars(now); syncGuard(now); for (const id of [...R.HEROES, 'boss', ...R.MINIONS]) if (S.hp[id].at(-1).v !== state.hp[id]) S.hp[id].push({ t: now, v: state.hp[id] }); S.active.push({ t: now, v: null }); nextTurn(); });
}
// 指令選單的內容。每個按鈕：{ label, sub, off（不能按的原因）, go, target（要在誰頭上畫箭頭）, hint }
function openMenu(kind, arg) {
  const id = actor, d = DEFS[id], skills = R.SKILLS[id].filter(k => R.knows(state, id, k.key)), back = { label: '返回', sub: '', go: () => openMenu('root'), back: true }; let items = [];
  if (kind === 'root') {
    const needBp = state.mo < R.MO.ult, needSp = state.sp[id] < R.STAT[id].cost, anyItem = Object.keys(R.ITEMS).some(k => state.items[k] > 0 && R.itemTargets(state, k).length), anySk = skills.some(k => R.skillOk(state, id, k));
    items = [id === 'vivi' ? { label: '應援', sub: `氣勢 ＋${R.MO.cheer}`, go: () => act(R.doCheer(state)), hint: `幫全隊加氣勢。氣勢到 ${R.MO.ult} 就能放奧義，全隊共用。` } : { label: '攻擊', sub: '普通攻擊', go: () => openMenu('target'), hint: '選一個敵人攻擊。' + (R.guarded(state) ? '小兵還在的時候打不到魔王。' : S.pot() ? '課長每回合被打的第一下會甩給小兵。' : '') },
      { label: '技能', sub: anySk ? skills.map(k => k.name).join('、') : skills.length ? '現在用不了' : '還沒學會', off: !anySk, go: () => openMenu('skills'), hint: '各自的招式：只花 SP，不用氣勢。' },
      { label: '奧義', sub: needBp ? `氣勢 ${state.mo}／${R.MO.ult}` : needSp ? 'SP 不足' : `${d.skill}　SP ${R.STAT[id].cost}`, off: needBp || needSp, go: () => act(R.doUlt(state, id)), hint: d.desc, gold: !needBp && !needSp },
      { label: '道具', sub: anyItem ? '補血、補 SP、復活' : '現在用不到', off: !anyItem, go: () => openMenu('items'), hint: '珍珠奶茶補 HP，黑咖啡補 SP，雞排便當讓倒下的同伴復活。' },
      { label: '防禦', sub: '受傷減半', go: () => act(R.doDefend(state, id)), hint: `到自己下一次行動前受到的傷害減半，氣勢 ＋${R.MO.defend}。` }];
  } else if (kind === 'target') { const sk = arg, bk = sk ? { ...back, go: () => openMenu('skills') } : back, blocked = R.guarded(state) && !(sk && sk.pierce), pot = S.pot() && !(sk && sk.pierce);      // arg＝招式（沒有就是普通攻擊）
    items = R.foes(state).filter(f => f !== 'boss').concat(R.alive(state, 'boss') ? ['boss'] : []).map(f => ({ label: NAME[f], sub: f === 'boss' ? (blocked ? '護衛中　傷害無效' : pot ? '甩鍋中　第一下小兵背' : `HP ${Math.ceil(state.hp.boss / R.STAT.boss.hp * 100)}%`) : `HP ${state.hp[f]}`, warn: f === 'boss' && blocked, target: f, go: () => act(sk ? R.doSkill(state, id, sk.key, f) : R.doAttack(state, id, f)) })); items.push(bk);
  } else if (kind === 'skills') { items = skills.map(k => ({ label: k.name, sub: `SP ${k.sp}　${k.note}`, off: !R.skillOk(state, id, k), hint: k.desc, go: () => k.target === 'foe' ? openMenu('target', k) : k.target === 'ally' ? openMenu('allySkill', k) : act(R.doSkill(state, id, k.key)) })); items.push(back);
  } else if (kind === 'allySkill') { items = R.allyTargets(state, id, arg).map(h => ({ label: DEFS[h].name, sub: arg.ally === 'sp' ? `SP ${state.sp[h]}／${R.STAT[h].sp}` : `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doSkill(state, id, arg.key, h)) })); items.push({ ...back, go: () => openMenu('skills') });
  } else if (kind === 'items') { items = Object.keys(R.ITEMS).map(k => { const it = R.ITEMS[k], ok = state.items[k] > 0 && R.itemTargets(state, k).length; return { label: it.name, sub: `${it.note}　×${state.items[k]}`, off: !ok, go: () => openMenu('ally', k) }; }); items.push(back);
  } else if (kind === 'ally') { items = R.itemTargets(state, arg).map(h => ({ label: DEFS[h].name, sub: R.ITEMS[arg].sp ? `SP ${state.sp[h]}／${R.STAT[h].sp}` : `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doItem(state, id, arg, h)) })); items.push({ ...back, go: () => openMenu('items') }); }
  menu = { kind, items }; focus = Math.max(0, items.findIndex(i => !i.off));
}
// 進一關：換頭目、擺好敵人與我方站位、把畫面上的血條等軌道重設成這一關的狀態
const resetUnit = (u, vis, pose) => { u.dead = null; u.poseK.length = 0; u.moveK.length = 0; u.hitK.length = 0; u.hopK.length = 0; u.showK = [{ t: -1e9, v: vis }]; if (pose) u.pose(-1e9, pose); };
// 前排站位（依人數）；Vivi 固定在後排
const FORM = { 1: [[2.3, -.2]], 2: [[1.7, -1.0], [3.0, .5]], 3: [[1.4, -1.5], [2.4, -.3], [3.5, .9]], 4: [[1.4, -1.6], [2.25, -.5], [3.35, .5], [4.25, 1.5]] }, BACK = [5.55, -.55];
function enterStage() {
  const st = R.STAGES[run.node.stage], L = st.boss; todo.length = 0; for (const f of [...aegisFx, ...bulwarkFx]) f.end = now - f.o.t; aegisFx = []; bulwarkFx = [];
  for (const u of [bossU, chiefU, auditU]) if (u) resetUnit(u, false, 'idle');
  units.boss = (L && { chief: chiefU, audit: auditU }[L.id]) || bossU; if (L) { resetUnit(units.boss, true, 'idle'); DEFS.boss.name = L.name; DEFS.boss.hp = L.hp; DEFS.boss.pos = units.boss.home.slice(); A.face.boss = units.boss === chiefU ? A.faceChief : units.boss === auditU ? A.faceAudit : A.faceBoss; }
  for (const m of ['ma', 'mb', 'mc']) { for (const k in minionU) resetUnit(minionU[k][m], false, 'idle'); const kind = minionU[state.kind[m]] ? state.kind[m] : 'drone'; units[m] = minionU[kind][m]; DEFS[m].name = R.KINDS[state.kind[m]].name; A.face[m] = minionFace[kind]; }
  for (const m of ['ma', 'mb', 'mc']) { resetUnit(units[m], R.MINIONS.includes(m), 'idle'); S.hp[m] = [{ t: -1, v: state.hp[m] }]; S.shield[m] = [{ t: -1, v: 2 }]; delete minionShield[m]; }
  for (const id in units) if (DEFS[id] && !DEFS[id].enemy) resetUnit(units[id], false, 'ready');      // 沒上場的夥伴先收起來
  R.FRONT.forEach((id, i) => { DEFS[id].pos = FORM[R.FRONT.length][i].slice(); }); if (R.HEROES.includes('vivi')) DEFS.vivi.pos = BACK.slice();
  for (const id of R.HEROES) { units[id].home = DEFS[id].pos.slice(); resetUnit(units[id], true, 'ready'); ko[id] = false; DEFS[id].hp = R.STAT[id].hp; S.hp[id] = [{ t: -1, v: state.hp[id] }]; S.sp[id] = [{ t: -1, v: state.sp[id] }]; }
  S.party = R.HEROES.slice(); DEFS.boss.hp = R.STAT.boss.hp;
  S.hp.boss = [{ t: -1, v: state.hp.boss }]; S.shield.boss = [{ t: -1, v: state.shield }]; S.mo = [{ t: -1, v: state.mo }]; moShown = state.mo; S.stamps = []; S.reveal = [{ t: -1, v: 0 }]; stepReveal = 0;
  guardShown = R.guarded(state); S.guard = [{ t: -1, v: guardShown }]; S.bossBar = [{ t: -1, v: !!L }]; S.foes = L ? ['boss', ...R.MINIONS] : [...R.MINIONS];
  S.order = [{ t: -1, v: [] }]; lastOrder = ''; S.active = [{ t: -1, v: null }]; actor = null; menu = null;
}
// 關卡開場：轉場、關卡牌、鏡頭帶一下敵人，再回到全景
function startStage() {
  playMusic(run.node.stage === 'boss' && buf['bgm/boss'] ? 'bgm/boss' : 'bgm/battle');      // 魔王那一站換魔王曲（使用者的歌：一般戰鬥〈月底吃土〉、魔王〈幽靈舞步〉）
  phase = 'anim'; const st = R.STAGES[run.node.stage], L = st.boss, t0 = now + .1; SFX.add('encounter', t0, 1.3); snd(t0 + .05, 'encounter'); S.stageCard = { t0: t0 + 1.0, t1: t0 + 3.5, n: run.floor + 1, name: st.name, sub: st.sub };
  if (L && L.id === 'boss') { cam.to(t0 - .01, 0, { x: -3.0, y: 1.9, z: -.5, d: 7.2, pitch: 3, blur: 10 }).to(t0 + .7, 2.6, { d: 8.4, y: 1.75 }, easeOut); snd(t0 + 1.15, 'boss_appear'); cam.shake(t0 + 1.2, .16, .6);
    units.boss.anim(t0 + 1.9, 'swing', [0, .1, .22, .38, 9, 9, 9, 9]).pose(t0 + 3.2, 'idle'); say(t0 + 1.95, 'boss_intro', 'boss'); cam.shake(t0 + 2.25, .2, .9); SFX.add('lines', t0 + 2.25, .9, { cx: 190, cy: 120, c: [255, 120, 100], a: .55, r0: 150 }); }
  else if (L) { cam.to(t0 - .01, 0, { x: -2.3, y: 1.35, z: -.5, d: 6.2, pitch: 3, blur: 10 }).to(t0 + .7, 2.6, { d: 7.4, y: 1.3 }, easeOut); snd(t0 + 1.15, 'boss_appear', .7); units.boss.anim(t0 + 1.8, 'swing', [0, .15, .3, .5, 9, 9, 9, 9]).pose(t0 + 3.0, 'idle'); cam.shake(t0 + 2.3, .12, .5); }
  else { cam.to(t0 - .01, 0, { x: -1.7, y: 1.0, z: -.3, d: 6.6, pitch: 5, blur: 9 }).to(t0 + .7, 2.6, { d: 8.0, x: -1.4 }, easeOut); R.MINIONS.forEach((m, i) => units[m].pose(t0 + 1.6 + i * .25, 'atk').hop(t0 + 1.6 + i * .25, .2, .3).pose(t0 + 2.6, 'idle')); snd(t0 + 1.6, 'whoosh', .5); }
  cam.to(t0 + 3.5, 1.1, WIDE); snd(t0 + 3.5, 'whoosh', .7); R.HEROES.forEach((id, i) => { units[id].pose(t0, 'wind').pose(t0 + 4.0 + i * .1, 'ready').hop(t0 + 4.0 + i * .1, .14, .26); });
  S.ui.push({ t0: t0 + 4.3, t1: 1e9 }); at(t0 + 4.7, nextTurn);
}

// ---------- 開局、招募、強化：都是「選一張卡」 ----------
// 卡片：{ label, tag, lines:[…], icon（art/map/icons 的名字）或 bust（角色）, go }
let rescued = null;
const met = id => { PREF.met = PREF.met || []; if (!PREF.met.includes(id)) { PREF.met.push(id); savePref(); } };
const heroCard = (id, go, starter) => ({ label: DEFS[id].name, tag: `${DEFS[id].job}　${R.ROLE[id]}`, bust: id, lines: [`HP ${R.STAT[id].hp}　SP ${R.STAT[id].sp}　攻擊 ${R.STAT[id].atk}`, ...(starter ? ['招式三選一（下一步選）'] : R.SKILLS[id].map(k => `◆ ${k.name}　${k.note}`)), `奧義「${DEFS[id].skill}」`, DEFS[id].desc || ''], go });
function openCards(o) { phase = 'pick'; menu = { kind: 'pick', ...o }; focus = 0; if (S.ui.length) S.ui.at(-1).t1 = Math.min(S.ui.at(-1).t1, now); S.stageCard = null; }
function resume() { const sv = saved; saved = null; if (!sv) return start(); AC.resume(); playMusic('bgm/map'); run = sv.run; for (const id of run.roster) met(id);
  if (sv.pend === 'upgrade') { rescued = sv.rescued; openUpgrade(false); } else openHub(`讀取進度：從第 ${run.floor + 1} 站繼續`); }
function start() { AC.resume(); playMusic('bgm/map'); saved = null;
  openCards({ title: '今天誰先去上班？', sub: '從一個人開始。路上會遇到同事，最多帶四個人上場。', foot: '選一位主角', items: R.STARTERS.map(id => heroCard(id, () => pickSkill(id), true)) }); }
function pickSkill(id) { openCards({ title: `${DEFS[id].name}的第一招`, sub: '三個招式先帶一個。其他的之後可以靠強化「在職進修」學會。', foot: '選一個招式就出發', items: R.SKILLS[id].map(k => ({ label: k.name, tag: `SP ${k.sp}　${k.note}`, icon: 'sk_' + k.key, lines: [k.desc], go: () => beginRun(id, k.key) })) }); }
// 測試用：網址加 ?stage=chief 或 ?floor=5（第幾站）直接跳過去，隊伍用 ?team=kevin,mi
function beginRun(id, key) { run = R.newRun(RAND, id, key); if (Q.has('stage') || Q.has('floor')) { const f = Q.has('floor') ? Math.min(R.MAP.length - 1, +Q.get('floor') - 1) : R.MAP.findIndex(fl => fl.some(nd => nd.stage === Q.get('stage'))); if (f > 0) { for (const h of (Q.get('team') || 'kevin,mi,vivi').split(',')) if (units[h]) R.join(run, h); run.floor = f; for (let k = 0; k < f; k++) run.path[k] = 0; } }
  R.prepare(run); snd(now, 'buff', .8); openHub(`${DEFS[id].name}出發，第一招「${R.SKILLS[id].find(k => k.key === key).name}」`); }
function openRecruit(i) { const nd = run.node, list = (run.offers[run.floor] || {})[i] || []; if (!list.length) { R.advance(run); return openHub('名冊已經滿了，這一站沒有人可以帶'); }
  openCards({ title: nd.name, sub: '選一位同事同行。' + (run.roster.length >= 4 ? '出戰最多四人，多的人當候補，可以在行程表調整順序。' : ''), foot: '選完回到行程表', items: list.map(id => heroCard(id, () => { R.join(run, id); met(id); snd(now, 'buff', .8); R.advance(run); openHub(`${DEFS[id].name}加入隊伍`); })) }); }
// 事件站：抽到的事件攤開成兩張選項卡，代價與好處都寫在卡上；選不了的（東西不夠）是舊紙
function openEvent() { const key = run.events[run.floor], ev = R.EVENTS[key];
  openCards({ title: ev.name, sub: ev.text, foot: '選一個，選完回到行程表', items: ev.opts.map((o, j) => ({ label: o.label, icon: o.icon, lines: o.lines, big: true, off: !R.eventOk(run, key, j), go: () => { const msg = R.applyEvent(run, key, j); if (msg == null) return; snd(now, 'buff', .8); R.advance(run); openHub(`${ev.name}：${msg}`); } })) }); }
function openUpgrade(gift) { const offers = R.offerUpgrades(run);
  openCards({ title: gift ? '福委會' : '過關獎勵', sub: gift ? '這個月的福利，選一個：' : (rescued ? `救出了${DEFS[rescued].name}！` : '') + '全員回復兩成五 HP、三成 SP，倒下的人也站起來了。再選一個強化：', foot: '選完回到行程表', items: offers.map(k => { const U = R.UPGRADES[k], who = (U.need || []).filter(id => run.roster.includes(id)).map(id => DEFS[id].name); return { label: U.name, tag: who.length ? `配合${who.join('、')}的招式` : '', icon: 'up_' + k, lines: U.desc.split('，'), big: true, go: () => pickUpgrade(k) }; }) }); }
function pickUpgrade(k, opt) {
  if (k === 'learn' && !opt) { const u = R.unlearned(run), id = run.starter; if (u.length > 1) return openCards({ title: '在職進修', sub: `${DEFS[id].name}要學哪一招？`, foot: '選一個招式，選完回到行程表', items: R.SKILLS[id].filter(q => u.includes(q.key)).map(q => ({ label: q.name, tag: `SP ${q.sp}　${q.note}`, icon: 'sk_' + q.key, lines: [q.desc], go: () => pickUpgrade(k, q.key) })) }); }
  R.applyUpgrade(run, k, opt); snd(now, 'buff', .8); R.advance(run); const r = rescued; rescued = null; openHub((k === 'learn' ? `${DEFS[run.starter].name}學會「${R.SKILLS[run.starter].find(q => q.key === run.skills[run.starter].at(-1)).name}」` : `拿到強化「${R.UPGRADES[k].name}」`) + (r ? `　${DEFS[r].name}加入隊伍` : '')); }

// ---------- 大地圖（行程表）：攤在會議桌上的公司剖面圖。選下一站、調整隊伍順序、看道具強化與夥伴名冊 ----------
let hubMsg = null, hubSel = -1, sheet = null;      // sheet＝正在看資料卡的那個人
function hubItems() { const fl = R.MAP[run.floor], items = fl.map((nd, i) => ({ label: R.nodeName(nd), node: i, go: () => { if (hubSel === i) chooseNode(i); else hubSel = i; } }));
  items.push({ label: '出發', depart: true, get off() { return hubSel < 0; }, go: () => chooseNode(hubSel) });
  run.roster.forEach((id, r) => { if (r > 0) items.push({ label: '上移', re: r, d: -1, go: () => { R.reorder(run, r, -1); refreshHub(); } }); if (r < run.roster.length - 1) items.push({ label: '下移', re: r, d: 1, go: () => { R.reorder(run, r, 1); refreshHub(); } }); });
  run.roster.forEach((id, r) => items.push({ label: '資料', view: id, row: r, go: () => openSheet(id) }));      // 點隊伍那一列或名冊的頭像看資料卡
  for (const id of DEX) if ((PREF.met || []).includes(id)) items.push({ label: '資料', view: id, dex: true, go: () => openSheet(id) });
  return items; }
// 資料卡：素質、招式、奧義。這一輪同行的人可以用「上一位／下一位」翻；名冊裡沒同行的人只看基本資料
const sheetList = () => run.roster.includes(sheet) ? run.roster : DEX.filter(id => (PREF.met || []).includes(id));
function openSheet(id) { sheet = id; menu = { kind: 'sheet', items: [{ label: '上一位', go: () => stepSheet(-1) }, { label: '下一位', go: () => stepSheet(1) }, { label: '回行程表', back: true, go: closeSheet }] }; focus = 2; }
function stepSheet(d) { const l = sheetList(); sheet = l[(l.indexOf(sheet) + d + l.length) % l.length]; }
function closeSheet() { sheet = null; menu = { kind: 'hub', items: hubItems() }; focus = 0; }
const refreshHub = () => { const f = focus; menu = { kind: 'hub', items: hubItems() }; focus = Math.min(f, menu.items.length - 1); };
function openHub(msg) { playMusic('bgm/map'); phase = 'hub'; sheet = null; hubMsg = msg ? { text: msg, t: performance.now() } : null; if (S.ui.length) S.ui.at(-1).t1 = Math.min(S.ui.at(-1).t1, now); S.stageCard = null; hubSel = R.MAP[run.floor].length === 1 ? 0 : -1; menu = { kind: 'hub', items: hubItems() }; focus = 0; for (const id of run.roster) met(id); saveGame(); }
function chooseNode(i) { if (i < 0) return; const nd = R.enterNode(run, i); menu = null;
  if (nd.type === 'battle') { phase = 'anim'; SFX.add('black', now + .05, .5, { from: 0, to: 1 }); at(now + .5, () => { state = R.newState(run); enterStage(); startStage(); }); }
  else if (nd.type === 'rest') { const v = R.rest(run); snd(now, 'heal', .8); R.advance(run); openHub(v > 0 ? `在茶水間休息：全隊共回復 ${v} HP，SP 補滿` : '在茶水間休息：SP 補滿（HP 本來就是滿的）'); }
  else if (nd.type === 'recruit') openRecruit(i);
  else if (nd.type === 'event') openEvent();
  else openUpgrade(true); }
function finish() {
  endFx(aegisFx); endFx(bulwarkFx);      // 護盾罩不要留到結算畫面
  phase = 'end'; menu = null; actor = null; const t0 = now + .2, last = R.isFinal(run), hud = S.ui.at(-1), L = state.L;
  if (state.over === 'win' && !last) {      // 過關：敵人退場、擺個姿勢，然後選強化
    if (L) { const u = units.boss; u.pose(t0, 'hurt'); for (let i = 0; i < 4; i++) u.hit(t0 + i * .2, .7 - i * .1); u.die(t0 + .9, 1.6); snd(t0 + .9, 'boss_down', .8); for (let i = 0; i < 3; i++) fx('spawn/poof', t0 + 1.2 + i * .3, 'boss', { scale: 1.6, dx: -.6 + i * .6, y: .3 + (i % 2) * .8, seed: i + 2 }); }
    for (const m of R.MINIONS) if (R.alive(state, m)) kill(t0 + .5, m);
    at(t0 + .1, () => playMusic(null)); hud.t1 = t0 + 1.6; const tv = t0 + (L ? 2.6 : 1.3); snd(tv, 'fanfare', .8);      // 戰鬥一結束戰鬥曲就停，號角響完到選強化時換地圖曲
    S.stageCard = { t0: tv, t1: tv + 2.3, n: run.floor + 1, name: '過關', sub: R.STAGES[run.node.stage].name + '　擺平了', clear: true };
    R.HEROES.forEach((id, i) => { if (!ko[id]) units[id].pose(tv + i * .1, 'win').hop(tv + i * .1, .24, .34); }); fx('ui/confetti', tv + .2, [3.4, 1.0], { scale: 2.0, y: .6 });
    at(tv + 2.4, () => { rescued = R.endStage(state, run); for (const id of R.HEROES) ko[id] = false; if (rescued) met(rescued); saveGame({ pend: 'upgrade', rescued }); openUpgrade(false); playMusic('bgm/map'); });
  } else if (state.over === 'win') { clearSave(); const u = units.boss; for (let i = 0; i < 6; i++) u.hit(t0 + i * .25, .7 - i * .08); say(t0 + .4, 'boss_down', 'boss'); cam.to(t0, 1.4, { x: -2.6, d: 9.6, y: 1.7 }); hud.t1 = t0 + .3;
    u.die(t0 + 1.8, 2.4); snd(t0 + 1.8, 'boss_down', 1); for (let i = 0; i < 5; i++) fx('spawn/poof', t0 + 2.1 + i * .35, 'boss', { scale: 1.8, dx: -1 + i * .5, y: .3 + (i % 2) * 1.2, seed: i + 2 }); for (const m of R.MINIONS) if (R.alive(state, m)) kill(t0 + 1.2, m);
    at(t0 + .1, () => playMusic(null)); const tv = t0 + 4.6; snd(tv, 'fanfare', 1); cam.to(tv - .4, 1.2, { x: .8, y: 1.2, z: -.1, d: 12.6, pitch: 7 });      // 鏡頭偏左，隊伍落在結案報告右邊
    R.HEROES.forEach((id, i) => { if (!ko[id]) units[id].pose(tv + .15 + i * .12, 'win').hop(tv + .15 + i * .12, .26, .36).hop(tv + 1.2 + i * .1, .14, .3); }); fx('ui/confetti', tv + .3, [3.4, 1.0], { scale: 2.4, y: .6 }); fx('ui/confetti', tv + .9, [4.6, -.8], { scale: 2.2, y: .8, seed: 5 });
    openReport(tv + .2, true);
    at(tv + 4.2, () => { playMusic('bgm/victory'); phase = 'over'; });
  } else { clearSave(); hud.t1 = t0 + .6; SFX.add('black', t0 + .4, 1.2, { from: 0, to: .72 }); SFX.add('black', t0 + 1.6, 1e9, { from: .72, to: .72 }); at(t0 + .3, () => playMusic(null)); if (L && R.alive(state, 'boss')) { units.boss.anim(t0 + .5, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); if (L.id === 'boss') say(t0 + .9, 'boss_attack', 'boss'); } openReport(t0 + 1.7, false); at(t0 + 2.6, () => { phase = 'over'; }); }
}

// ---------- 指令選單與開始／結束畫面（畫在介面畫布上，同時記下可以按的範圍） ----------
let zones = [], pointer = null;
const font = (px, w = 700, fam = SANS) => { c.font = `${w} ${px}px ${fam}`; };
const text = (s, x, y, o = {}) => { font(o.px ?? 28, o.w ?? 700, o.fam ?? SANS); c.textAlign = o.align ?? 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = `${o.ls ?? 0}px`; if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.sw ?? 6; c.strokeStyle = o.stroke; c.strokeText(s, x, y); } c.fillStyle = o.col ?? COL.text; c.fillText(s, x, y); c.letterSpacing = '0px'; };
const mw = (s, px, w = 700, fam = SANS) => { font(px, w, fam); return c.measureText(s).width; };
const gem = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill(); };
const fit = (str, room, px, w = 700, fam = SANS) => { font(px, w, fam); while (c.measureText(str).width > room && str.length > 5) str = str.slice(0, -2) + '…'; return str; };
// 中文折行：超過寬度就換行，標點不放行首
const wrap = (str, room, px, w = 700) => { font(px, w); const out = []; let line = ''; for (const ch of str) { if (line && c.measureText(line + ch).width > room && !'，。、：；！？）」'.includes(ch)) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; };
const pix = (im, x, y, w, h) => { if (!im) return; c.imageSmoothingEnabled = false; c.drawImage(im, x, y, w, h); c.imageSmoothingEnabled = true; };
const pressK = i => pressed && pressed.i === i && !pressed.big && !pressed.opt ? (performance.now() - pressed.t) / PRESS_MS : -1;
// 指令按鈕＝資料夾的索引標籤：選到的是綠色、往上拉出來一截；按下去會沉、閃一下；不能按的是舊紙，按了會抖
function button(x, y, w, h, it, on, i) {
  const off = !!it.off, pe = pressK(i), dn = pe >= 0 && !off, shake = pe >= 0 && off ? Math.sin(pe * 22) * 7 * (1 - Math.min(1, pe)) : 0, sel = on && !off;
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
  zones = []; if (phase === 'hub' && menu) return drawHub(); if (phase === 'pick' && menu) return drawPick(); if (phase !== 'command' || !menu) return; drawTip();
  const n = menu.items.length, X0 = 770, X1 = 1880, gap = 12, w = Math.min(290, (X1 - X0 - gap * (n - 1)) / n), h = 116, y = 944, x0 = X1 - (w * n + gap * (n - 1)), d = DEFS[actor];
  // 木頭資料夾：上面夾一張說明紙（輪到誰＋目前選項的說明），下面一排索引標籤
  const it = menu.items[focus] || {}, tip = it.hint || (menu.kind === 'target' ? '選攻擊對象（也可以直接點敵人）' : menu.kind === 'ally' || menu.kind === 'allySkill' ? '選要給誰' : menu.kind === 'items' ? '選道具' : menu.kind === 'skills' ? '選招式' : '');
  skin.wood(X0 - 16, y - 84, X1 - X0 + 32, 84 + h + 30, { studs: false }); skin.paper(X0, y - 72, X1 - X0, 46); c.fillStyle = d.color; c.fillRect(X0 + 8, y - 64, 6, 30);
  text(d.name, X0 + 26, y - 39, { px: 28, w: 900, fam: SERIF, col: INK }); const nw = mw(d.name, 28, 900, SERIF); text(d.job, X0 + 36 + nw, y - 40, { px: 18, w: 700, col: INK2 }); const jw = mw(d.job, 18);
  text(fit(tip, X1 - X0 - nw - jw - 90, 20, 700), X0 + 62 + nw + jw, y - 40, { px: 20, w: 700, col: INK });
  menu.items.forEach((m, i) => button(x0 + i * (w + gap), y, w, h, m, i === focus, i));
  toggles(28, 148); skin.paper(364, 148, 150, 38); text(`第 ${run.floor + 1}／${R.MAP.length} 站`, 439, 175, { px: 20, w: 700, align: 'center', col: INK });
  // 目標頭上的箭頭
  if (it.target) { const [tx, ty] = S.proj(it.target, 1), foe = DEFS[it.target].enemy, col = foe ? '#ff6a5a' : '#8cf09a', by = ty - 40 + Math.sin(now * 9) * 6; c.fillStyle = col; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 19, by - 26); c.lineTo(tx + 19, by - 26); c.lineTo(tx, by); c.closePath(); c.stroke(); c.fill(); text('目標', tx, by - 34, { px: 22, w: 900, align: 'center', col, stroke: 'rgba(10,8,18,.9)', sw: 5, ls: 3 }); }
  // 現在是誰：頭上的箭頭
  { const [ax, ay] = S.proj(actor, 1), by = ay - 30 + Math.sin(now * 7) * 5; c.fillStyle = CREAM; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax - 15, by - 22); c.lineTo(ax + 15, by - 22); c.lineTo(ax, by); c.closePath(); c.stroke(); c.fill(); }
  // 選攻擊對象時，敵人本身也可以點
  if (menu.kind === 'target') menu.items.forEach((m, i) => { if (!m.target) return; const [px, py] = S.proj(m.target, .5), boss = m.target === 'boss', r = boss ? 210 : 100; zones.push({ x: px - r, y: py - r * 1.15, w: r * 2, h: r * 2.3, i, off: false, soft: true }); });
}
// 會議桌（大地圖與選卡畫面的底）
function drawTable(dim) { if (A.map.table) c.drawImage(A.map.table, 0, 0, W, H); else { c.fillStyle = '#1a110b'; c.fillRect(0, 0, W, H); } if (dim) { c.fillStyle = `rgba(8,5,4,${dim})`; c.fillRect(0, 0, W, H); } }
// 行程表各站在藍圖上的位置（藍圖原圖 1536×1024 的座標）。一樓三站 → 電梯 → 二樓 → 樓梯 → 三樓 → 塔頂
const MK = .805, BPX = 30, BPY = 104, bp = ([x, y]) => [BPX + x * MK, BPY + y * MK];
const STN = [[[430, 868]], [[760, 868]], [[1090, 868]], [[1090, 512], [1090, 612]], [[845, 606]], [[600, 606]], [[440, 318], [440, 418]], [[720, 368]], [[1000, 318], [1000, 418]], [[768, 190]]], VIA = { 2: [[1347, 868], [1347, 562]], 5: [[200, 606], [200, 368]] }, START = [296, 868];
const TAGCOL = { 戰鬥: INK2, 事件: '#7a4a8a', 休息: TEAL, 福利: '#9a6a1c', 招募: '#27507e', 救援: '#27507e', 菁英: RED, 頭目: RED, 魔王: RED };
const DEX = ['kui', 'jie', 'kevin', 'mi', 'vivi', ...EXTRA];
const nodeDesc = nd => { if (nd.type !== 'battle') return [nd.sub || '', '這一站不用戰鬥']; const st = R.STAGES[nd.stage], cnt = {}; for (const m of st.minions) { const n = R.KINDS[(st.kinds || {})[m] || 'drone'].name; cnt[n] = (cnt[n] || 0) + 1; } return [nd.sub || st.sub, `敵人：${st.boss ? st.boss.name + '、' : ''}${Object.entries(cnt).map(([n, k]) => k > 1 ? `${n} ×${k}` : n).join('、')}　打贏可以三選一強化`]; };
function drawHub() {
  if (sheet) return drawSheet();
  drawTable(.3); const nF = R.MAP.length, fl = R.MAP[run.floor], tp = performance.now() / 1000, bw = 1536 * MK, bh = 1024 * MK;
  text('上班旅人', 40, 74, { px: 54, w: 900, fam: SERIF, col: CREAM, ls: 10, stroke: 'rgba(20,10,4,.9)', sw: 8 }); text(`今日行程　第 ${run.floor + 1}／${nF} 站`, 336, 70, { px: 26, w: 700, col: BRASS, ls: 4, stroke: 'rgba(20,10,4,.8)', sw: 5 }); toggles(1558, 40);
  // 藍圖
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(BPX + 10, BPY + 12, bw, bh); if (A.map.blueprint) c.drawImage(A.map.blueprint, BPX, BPY, bw, bh); else skin.paper(BPX, BPY, bw, bh);
  // 路線：走過的是紅線、現在可以走的是會動的金線、還沒到的是灰色虛線
  const segs = [[[START, STN[0][0]], run.floor > 0 ? 'walked' : 'open']];
  for (let i = 0; i < nF - 1; i++) R.MAP[i].forEach((_, a) => R.MAP[i + 1].forEach((_, b) => { const mine = i < run.floor && run.path[i] === a, st = i + 1 < run.floor ? (mine && run.path[i + 1] === b ? 'walked' : 'dead') : i + 1 === run.floor ? (mine ? 'open' : 'dead') : i < run.floor && !mine ? 'dead' : 'future'; segs.push([[STN[i][a], ...(VIA[i] || []), STN[i + 1][b]], st]); }));
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const pass of [0, 1]) for (const [pts, st] of segs) { if ((st === 'walked' || st === 'open') !== !!pass) continue; c.beginPath(); pts.forEach((p, i) => { const [x, y] = bp(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    if (st === 'walked') { c.strokeStyle = 'rgba(40,16,10,.85)'; c.lineWidth = 11; c.stroke(); c.strokeStyle = '#c23b2e'; c.lineWidth = 6; c.stroke(); }
    else if (st === 'open') { c.strokeStyle = 'rgba(40,24,6,.85)'; c.lineWidth = 11; c.stroke(); c.setLineDash([16, 13]); c.lineDashOffset = -tp * 34; c.strokeStyle = '#f0c24a'; c.lineWidth = 6; c.stroke(); c.lineDashOffset = 0; }
    else if (st === 'dead') { c.setLineDash([4, 12]); c.strokeStyle = 'rgba(239,230,207,.16)'; c.lineWidth = 4; c.stroke(); } else { c.setLineDash([2, 13]); c.strokeStyle = 'rgba(28,18,12,.75)'; c.lineWidth = 9; c.stroke(); c.strokeStyle = 'rgba(239,230,207,.8)'; c.lineWidth = 5; c.stroke(); } c.setLineDash([]); }
  // 起點：打卡鐘
  { const [x, y] = bp(START); c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, y, 30, 0, 7); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 27, 0, 7); c.stroke(); pix(A.icons.clock, x - 23, y - 23, 46, 46); }
  // 各站的徽章與名牌
  R.MAP.forEach((flr, i) => flr.forEach((nd, k) => { const [x, y] = bp(STN[i][k]), open = i === run.floor, done = i < run.floor && run.path[i] === k, skipped = i < run.floor && !done, sel = open && hubSel === k, hov = open && focus === k, big = nd.icon === 'boss' || nd.icon === 'chief', r = (big ? 40 : 33) + (hov ? 3 : 0), pe = open ? pressK(k) : -1, dn = pe >= 0;
    const nm = R.nodeName(nd), lw = Math.max(mw(nm, 21, 900, SERIF), mw(nd.tag, 13, 900) + 8) + 26, lx = x + r + 4; if (open) zones.push({ x: x - r - 10, y: y - r - 8, w: r * 2 + lw + 20, h: r * 2 + 16, i: k, off: false });
    c.save(); c.globalAlpha = skipped ? .32 : i > run.floor ? .9 : 1; c.translate(0, dn ? 4 : 0);
    skin.paper(lx, y - 25, lw, 50, { old: !open }); if (sel) { c.fillStyle = TEAL; c.fillRect(lx + 4, y - 21, lw - 8, 42); }
    text(nd.tag, lx + 13, y - 6, { px: 13, w: 900, col: sel ? 'rgba(255,248,230,.85)' : TAGCOL[nd.tag] || INK2, ls: 2 }); text(nm, lx + 13, y + 17, { px: 21, w: 900, fam: SERIF, col: sel ? '#fff8e6' : INK });
    if (open) { const pu = Math.sin(tp * 5); c.strokeStyle = `rgba(240,194,74,${.55 + .35 * pu})`; c.lineWidth = 6; c.beginPath(); c.arc(x, y, r + 9 + pu * 2, 0, 7); c.stroke(); }
    c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); c.fillStyle = big ? '#6e1c16' : done ? '#5a4c3c' : '#33241a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = sel ? '#7fe0c8' : BRASS; c.lineWidth = sel ? 5 : 3; c.beginPath(); c.arc(x, y, r - 2, 0, 7); c.stroke();
    const im = A.icons[nd.icon], iw = r * 1.56; if (im) pix(im, x - iw / 2, y - iw / 2, iw, iw); else text(nd.tag[0], x, y + 12, { px: 32, w: 900, fam: SERIF, align: 'center', col: CREAM });
    if (dn) { c.fillStyle = `rgba(255,246,216,${.7 - .5 * Math.min(1, pe)})`; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); }
    if (done) skin.stamp('結案', x + r * .55, y - r * .7, -.14, 14);
    c.restore(); if (open && (sel || (hubSel < 0 && hov))) { const ay = y - r - 16 + Math.sin(tp * 7) * 5; c.fillStyle = sel ? '#7fe0c8' : '#f0c24a'; c.strokeStyle = 'rgba(20,10,4,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 14, ay - 18); c.lineTo(x + 14, ay - 18); c.lineTo(x, ay); c.closePath(); c.stroke(); c.fill(); } }));
  // 隊伍現在在哪：主角的頭像
  { const at0 = run.floor === 0 ? START : STN[run.floor - 1][run.path[run.floor - 1]], [x, y0] = bp(at0), y = y0 - 78 + Math.sin(tp * 3) * 4; c.fillStyle = '#1c120c'; c.fillRect(x - 27, y - 27, 54, 54); c.fillStyle = BRASS; c.fillRect(x - 24, y - 24, 48, 48); skin.face(A.face[run.roster[0]], x - 21, y - 21, 42); c.fillStyle = '#1c120c'; c.beginPath(); c.moveTo(x - 9, y + 27); c.lineTo(x + 9, y + 27); c.lineTo(x, y + 38); c.fill(); }
  // 下方：選到的那一站的說明＋出發
  { const IX = BPX, IY = 940, IW = bw, IH = 126, nd = hubSel >= 0 ? fl[hubSel] : null, di = fl.length, BW2 = 236; skin.wood(IX, IY, IW, IH, { studs: false }); skin.paper(IX + 10, IY + 10, IW - 30 - BW2, IH - 20);
    if (!nd) text('前面有岔路：點地圖上亮著的站看內容，再點一次（或按「出發」）前進。', IX + 40, IY + 74, { px: 24, w: 700, col: INK });
    else { pix(A.icons[nd.icon], IX + 26, IY + 21, 84, 84); text(nd.tag, IX + 128, IY + 46, { px: 18, w: 900, col: TAGCOL[nd.tag] || INK2, ls: 4 }); const nm = R.nodeName(nd); text(nm, IX + 128, IY + 92, { px: 40, w: 900, fam: SERIF, col: INK, ls: 2 }); const nx = IX + 128 + mw(nm, 40, 900, SERIF) + 40, ds = nodeDesc(nd), who = (run.offers[run.floor] || {})[hubSel] || [];
      const room = IX + IW - 30 - BW2 - nx - who.length * 100 - 10; text(fit(ds[0], room, 22), nx, IY + 54, { px: 22, w: 900, col: INK }); text(fit(ds[1], room, 19), nx, IY + 90, { px: 19, w: 700, col: INK2 });
      who.forEach((id, j) => { const fx0 = IX + IW - 30 - BW2 - (who.length - j) * 100 + 6; skin.face(A.face[id], fx0 + 12, IY + 18, 62); text(DEFS[id].name, fx0 + 43, IY + 104, { px: 16, w: 900, fam: SERIF, align: 'center', col: INK }); }); }
    const it = menu.items[di], bx = IX + IW - BW2 - 8, by = IY + 12, bh2 = IH - 24, off = it.off, pe = pressK(di), dn = pe >= 0 && !off, on = focus === di && !off; zones.push({ x: bx, y: by, w: BW2, h: bh2, i: di, off });
    c.save(); c.translate(pe >= 0 && off ? Math.sin(pe * 22) * 6 * (1 - Math.min(1, pe)) : 0, dn ? 5 : 0); skin.paper(bx, by, BW2, bh2, { old: off }); if (!off) { c.fillStyle = '#1e3b36'; c.fillRect(bx + 6, by + 6, BW2 - 12, bh2 - 12); c.fillStyle = on ? '#3f9c88' : TEAL; c.fillRect(bx + 8, by + 8, BW2 - 16, bh2 - 16); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(bx + 8, by + 8, BW2 - 16, 5); }
    if (dn) { c.fillStyle = `rgba(255,246,216,${.8 - .5 * Math.min(1, pe)})`; c.fillRect(bx, by, BW2, bh2); } text('出發', bx + BW2 / 2, by + bh2 / 2 + 17, { px: 46, w: 900, fam: SERIF, align: 'center', ls: 12, col: off ? 'rgba(43,31,24,.36)' : '#fff8e6' }); c.restore(); }
  // 右欄：隊伍（前四位出戰，可以調順序）
  const PX = 1294, PY = 100, PW = 600, act = R.active(run); skin.wood(PX, PY, PW, 508); text('隊伍', PX + 26, PY + 44, { px: 28, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.7)', sw: 5 }); text('點人看資料　箭頭調順序（前四位出戰）', PX + PW - 26, PY + 42, { px: 17, w: 700, align: 'right', col: 'rgba(239,230,207,.72)' });
  for (let i = 0; i < 6; i++) { const id = run.roster[i], y = PY + 60 + i * 72 + (i >= 4 ? 8 : 0);
    if (!id) { c.strokeStyle = 'rgba(239,230,207,.2)'; c.setLineDash([8, 8]); c.lineWidth = 2; c.strokeRect(PX + 16, y + 2, PW - 32, 60); c.setLineDash([]); text(i < 4 ? '出戰空位' : '候補空位', PX + PW / 2, y + 39, { px: 18, w: 700, align: 'center', col: 'rgba(239,230,207,.32)' }); continue; }
    const d = DEFS[id], on = act.includes(id), hp = run.hp[id], mx = R.STAT[id].hp, low = hp / mx < .3; skin.paper(PX + 14, y, PW - 28, 64, { old: !on }); { const vi = menu.items.findIndex(m => m.view === id && m.row === i); if (vi >= 0) { zones.push({ x: PX + 14, y, w: PW - 28 - 104, h: 64, i: vi, off: false }); if (focus === vi) { c.strokeStyle = TEAL; c.lineWidth = 4; c.strokeRect(PX + 16, y + 2, PW - 32, 60); } } } c.fillStyle = on ? TEAL : '#8a7a66'; c.fillRect(PX + 14, y, 9, 64); skin.face(A.face[id], PX + 32, y + 6, 52);
    text(d.name, PX + 96, y + 29, { px: 23, w: 900, fam: SERIF, col: INK }); text(id === 'vivi' ? '公主・後排' : d.job, PX + 104 + mw(d.name, 23, 900, SERIF), y + 28, { px: 14, w: 700, col: INK2 }); text(on ? '出戰' : '候補', PX + 96, y + 54, { px: 14, w: 900, col: on ? '#1f6a5c' : INK2 });
    if (id !== 'vivi') { skin.bar(PX + 138, y + 43, 170, 11, hp / mx, low ? '#c8443a' : '#4f9a4a'); text(`${hp}／${mx}`, PX + 316, y + 55, { px: 15, w: 700, col: low ? RED : INK }); } text(`SP ${run.sp[id]}`, PX + 458, y + 29, { px: 16, w: 700, col: '#27507e', align: 'right' });
    for (const dd of [-1, 1]) { const idx = menu.items.findIndex(m => m.re === i && m.d === dd); if (idx < 0) continue; const ax = PX + PW - 28 - (dd < 0 ? 96 : 48), ay = y + 9, pe = pressK(idx), dn = pe >= 0, hov = focus === idx; zones.push({ x: ax - 2, y: y, w: 46, h: 64, i: idx, off: false });
      c.fillStyle = '#2b1f18'; c.fillRect(ax, ay + (dn ? 3 : 0), 42, 46); c.fillStyle = dn ? '#fff0c8' : hov ? '#d8b25a' : '#b08a4a'; c.fillRect(ax + 3, ay + 3 + (dn ? 3 : 0), 36, 40); c.fillStyle = '#2b1f18'; c.beginPath(); const cy = ay + 23 + (dn ? 3 : 0); if (dd < 0) { c.moveTo(ax + 21, cy - 10); c.lineTo(ax + 32, cy + 8); c.lineTo(ax + 10, cy + 8); } else { c.moveTo(ax + 21, cy + 10); c.lineTo(ax + 32, cy - 8); c.lineTo(ax + 10, cy - 8); } c.fill(); } }
  // 道具
  const IY2 = PY + 518; Object.keys(R.ITEMS).forEach((k, i) => { const x = PX + i * 202, im = A.items[k] || (k === 'bento' ? A.icons.up_bento : null); skin.wood(x, IY2, 196, 72, { studs: false }); if (im) pix(im, x + 12, IY2 + 9, 54 * im.width / im.height, 54); text(R.ITEMS[k].name, x + 72, IY2 + 32, { px: 19, w: 900, fam: SERIF, col: CREAM }); text(fit(R.ITEMS[k].note, 84, 13, 700), x + 72, IY2 + 56, { px: 13, w: 700, col: 'rgba(239,230,207,.7)' }); text(`×${run.items[k]}`, x + 186, IY2 + 58, { px: 22, w: 900, col: BRASS, align: 'right' }); });
  // 強化
  const UY = IY2 + 82; skin.paper(PX, UY, PW, 78); text('強化', PX + 22, UY + 48, { px: 24, w: 900, fam: SERIF, col: INK, ls: 4 });
  { const cnt = {}; for (const k of run.picks) cnt[k] = (cnt[k] || 0) + 1; let x = PX + 96; if (!run.picks.length) text('還沒有。打贏戰鬥或到福委會可以三選一', x, UY + 46, { px: 18, w: 700, col: INK2 });
    for (const k in cnt) { const im = A.icons['up_' + k]; if (im) pix(im, x, UY + 11, 56, 56); else text(R.UPGRADES[k].name, x, UY + 46, { px: 16, w: 900, col: INK }); if (cnt[k] > 1) { c.fillStyle = RED; c.fillRect(x + 36, UY + 48, 30, 22); text(`×${cnt[k]}`, x + 51, UY + 65, { px: 16, w: 900, align: 'center', col: '#fff8e6' }); } x += 66; } }
  // 夥伴名冊：這一輪同行的是亮的；以前遇過的是暗的；還沒遇過的是問號
  const RY = UY + 88, RH = H - 14 - RY, seen = PREF.met || []; skin.wood(PX, RY, PW, RH); text('夥伴名冊', PX + 26, RY + 42, { px: 26, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.7)', sw: 5 }); text(`遇過 ${DEX.filter(id => seen.includes(id)).length}／${DEX.length}`, PX + PW - 26, RY + 40, { px: 18, w: 700, align: 'right', col: BRASS });
  DEX.forEach((id, j) => { const col = j % 8, row = j / 8 | 0, x = PX + 22 + col * 70, y = RY + 56 + row * 100, inRun = run.roster.includes(id), known = seen.includes(id) && A.face[id]; skin.paper(x, y, 64, 92, { old: !inRun });
    if (known) { const vi = menu.items.findIndex(m => m.view === id && m.dex); if (vi >= 0) { zones.push({ x, y, w: 64, h: 92, i: vi, off: false }); if (focus === vi) { c.strokeStyle = TEAL; c.lineWidth = 4; c.strokeRect(x + 2, y + 2, 60, 88); } } c.save(); c.globalAlpha = inRun ? 1 : .55; skin.face(A.face[id], x + 5, y + 5, 54); c.restore(); text(fit(DEFS[id].name, 60, 13, 900), x + 32, y + 80, { px: 13, w: 900, align: 'center', col: inRun ? INK : INK2 }); if (inRun) { c.fillStyle = TEAL; c.fillRect(x + 5, y + 84, 54, 4); } }
    else { c.fillStyle = 'rgba(43,31,24,.18)'; c.fillRect(x + 5, y + 5, 54, 54); text('？', x + 32, y + 46, { px: 36, w: 900, fam: SERIF, align: 'center', col: 'rgba(43,31,24,.38)' }); } });
  if (hubMsg) { const el = (performance.now() - hubMsg.t) / 1000; if (el < 4.5) { const a = Math.min(1, el / .2, (4.5 - el) / .5), w = Math.min(1100, mw(hubMsg.text, 28, 900, SERIF) + 90), mx = BPX + bw / 2; c.save(); c.globalAlpha = a; skin.paper(mx - w / 2, 118 - (1 - Math.min(1, el / .2)) * 20, w, 64, { clips: [mx] }); text(hubMsg.text, mx, 162, { px: 28, w: 900, fam: SERIF, align: 'center', col: INK }); c.restore(); } }
}
// 資料卡：左邊半身像與名字，右邊素質、招式、奧義
function sheetBtn(label, x, y, w, h, i, main) { const pe = pressK(i), dn = pe >= 0, on = focus === i; zones.push({ x, y, w, h, i, off: false }); c.save(); c.translate(0, dn ? 5 : 0); skin.paper(x, y, w, h);
  if (main) { c.fillStyle = '#1e3b36'; c.fillRect(x + 6, y + 6, w - 12, h - 12); c.fillStyle = on ? '#3f9c88' : TEAL; c.fillRect(x + 8, y + 8, w - 16, h - 16); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(x + 8, y + 8, w - 16, 5); } else if (on) { c.strokeStyle = TEAL; c.lineWidth = 5; c.strokeRect(x + 6, y + 6, w - 12, h - 12); }
  if (dn) { c.fillStyle = `rgba(255,246,216,${.8 - .5 * Math.min(1, pe)})`; c.fillRect(x, y, w, h); } text(label, x + w / 2, y + h / 2 + 13, { px: 34, w: 900, fam: SERIF, align: 'center', ls: 6, col: main ? '#fff8e6' : INK }); c.restore(); }
function drawSheet() { const id = sheet, d = DEFS[id], st = R.STAT[id], inRun = run.roster.includes(id), on = inRun && R.active(run).includes(id), X = 150, Y = 56, PW = 1620, PH = 968, viv = id === 'vivi';
  drawTable(.66); skin.wood(X, Y, PW, PH);
  // 左：半身像、名字、職業
  const lx = X + 40, ly = Y + 46, lw = 500, lh = PH - 92; skin.paper(lx, ly, lw, lh, { clips: [lx + lw / 2] });
  { const ax = lx + 18, ay = ly + 22, aw = lw - 36, AH = 440, im = A.bust[id]; c.fillStyle = '#241812'; c.fillRect(ax, ay, aw, AH); c.fillStyle = d.color || '#3a2a1e'; c.globalAlpha = .34; c.fillRect(ax + 4, ay + 4, aw - 8, AH - 8); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < AH - 8; k += 6) c.fillRect(ax + 4, ay + 4 + k, aw - 8, 2);
    if (im) { const bh = 620, bw = bh * im.width / im.height, by = Math.min(ay + 8, ay + 4 + (AH - 8) * .43 - (EYE[id] || .38) * bh); c.save(); c.beginPath(); c.rect(ax + 4, ay + 4, aw - 8, AH - 8); c.clip(); pix(im, ax + aw / 2 - bw / 2, by, bw, bh); c.restore(); }
    c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(ax + 2.5, ay + 2.5, aw - 5, AH - 5);
    let ty = ay + AH + 84; text(d.name, lx + lw / 2, ty, { px: 64, w: 900, fam: SERIF, align: 'center', col: INK, ls: 6 }); ty += 44; text(`${viv ? '公主' : d.job}　${R.ROLE[id]}`, lx + lw / 2, ty, { px: 24, w: 900, align: 'center', col: RED, ls: 3 }); c.fillStyle = RED; c.fillRect(lx + lw / 2 - 70, ty + 14, 140, 4); ty += 58;
    text(inRun ? (on ? '出戰中' : '候補（排到前四位才會上場）') : '這一輪沒有同行', lx + lw / 2, ty, { px: 22, w: 900, align: 'center', col: on ? '#1f6a5c' : INK2 }); ty += 26;
    if (d.shout) wrap(`「${d.shout}」`, lw - 80, 24).slice(0, 3).forEach((ln, k) => text(ln, lx + lw / 2, ty + 44 + k * 36, { px: 24, w: 700, fam: SERIF, align: 'center', col: INK2 }));
    if (on) skin.stamp('出戰', lx + lw - 84, ay + AH + 2, -.12, 22); }
  // 右：素質、招式、奧義
  const rx = lx + lw + 30, rw = X + PW - 40 - rx, rh = lh - 124; skin.paper(rx, ly, rw, rh); const cx = rx + 40, cw = rw - 80; let y = ly + 58;
  const head = (s, note) => { c.fillStyle = RED; c.fillRect(cx, y - 24, 7, 28); text(s, cx + 20, y, { px: 26, w: 900, fam: SERIF, col: INK, ls: 8 }); const x1 = cx + 40 + mw(s, 26, 900, SERIF) + s.length * 8; c.fillStyle = 'rgba(43,31,24,.22)'; c.fillRect(x1, y - 10, cx + cw - x1 - (note ? mw(note, 18) + 18 : 0), 2); if (note) text(note, cx + cw, y - 3, { px: 18, w: 700, align: 'right', col: INK2 }); y += 20; };
  head('素質', inRun && run.picks.length ? `已拿 ${run.picks.length} 個強化` : '');
  { const up = run.atk > 1.001 ? `強化 ＋${Math.round((run.atk - 1) * 100)}%` : '', cut = run.def < .999 ? `強化 －${Math.round((1 - run.def) * 100)}%` : '', cells = viv ? [['位置', '後排', '不會被攻擊'], ['應援', `氣勢 ＋${R.MO.cheer}`, '每次行動替全隊加氣勢'], ['速度', st.spd, '數字大的先行動'], ['SP', inRun ? `${run.sp[id]}／${st.sp}` : st.sp, '放招式用'], ['奧義', `SP ${st.cost}`, `氣勢要 ${R.MO.ult}`]]
      : [['HP', inRun ? `${run.hp[id]}／${st.hp}` : st.hp, '', inRun ? run.hp[id] / st.hp : null, '#4f9a4a'], ['SP', inRun ? `${run.sp[id]}／${st.sp}` : st.sp, '放招式與奧義用', inRun ? run.sp[id] / st.sp : null, '#3d6fa8'], ['攻擊', Math.round(st.atk * (inRun ? run.atk : 1)), inRun ? up : ''], ['速度', st.spd, '數字大的先行動'], ['受到的傷害', inRun && cut ? `×${run.def.toFixed(2)}` : '×1', inRun ? cut : ''], ['奧義', `SP ${st.cost}`, `氣勢要 ${R.MO.ult}`]];
    const colW = cw / 3; cells.forEach(([k, v, note, bar, bcol], i) => { const x = cx + (i % 3) * colW, yy = y + 12 + Math.floor(i / 3) * 92; text(k, x, yy + 16, { px: 18, w: 900, col: INK2, ls: 3 }); text(String(v), x, yy + 56, { px: 38, w: 900, col: INK }); if (bar != null) skin.bar(x, yy + 66, colW - 60, 11, bar, bar < .3 && k === 'HP' ? '#c8443a' : bcol); else if (note) text(fit(note, colW - 20, 17), x, yy + 80, { px: 17, w: 700, col: note.startsWith('強化') ? '#1f6a5c' : INK2 }); }); y += 12 + Math.ceil(cells.length / 3) * 92 + 38; }
  const sk = R.SKILLS[id] || [], known = k => !inRun || (run.skills[id] || []).includes(k.key), rowH = sk.length > 2 ? 86 : 96;
  head('招式', id === run.starter && sk.some(k => !known(k)) ? '還沒學的招式，拿到強化「在職進修」可以學' : '只花 SP，不用氣勢');
  sk.forEach(k => { const ok = known(k), im = A.icons['sk_' + k.key]; c.save(); c.globalAlpha = ok ? 1 : .42; if (im) pix(im, cx, y + 8, 64, 64); else { c.fillStyle = '#33241a'; c.fillRect(cx + 4, y + 12, 56, 56); c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(cx + 5.5, y + 13.5, 53, 53); gem(cx + 32, y + 40, 15, CREAM); }
    text(k.name, cx + 84, y + 36, { px: 30, w: 900, fam: SERIF, col: INK, ls: 2 }); const nx = cx + 84 + mw(k.name, 30, 900, SERIF) + k.name.length * 2 + 24; text(`SP ${k.sp}`, nx, y + 34, { px: 20, w: 900, col: '#27507e' }); text(fit(k.note, cx + cw - nx - 110, 20, 900), nx + mw(`SP ${k.sp}`, 20, 900) + 22, y + 34, { px: 20, w: 900, col: RED });
    text(fit(k.desc, cw - 90, 21), cx + 84, y + 68, { px: 21, w: 700, col: INK2 }); c.restore(); if (!ok) skin.stamp('還沒學', cx + cw - 70, y + 38, -.1, 18); y += rowH; }); y += 34;
  head('奧義', `SP ${st.cost}　氣勢 ${R.MO.ult}`);
  { const im = A.icons.sk_ult || A.icons.up_morale; c.fillStyle = '#6e1c16'; c.fillRect(cx + 4, y + 12, 56, 56); c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(cx + 5.5, y + 13.5, 53, 53); if (im) pix(im, cx + 8, y + 16, 48, 48); text(`「${d.skill}」`, cx + 70, y + 38, { px: 32, w: 900, fam: SERIF, col: INK, ls: 2 }); wrap(d.desc || (R.ULTS[id] || [])[1] || '', cw - 90, 21).slice(0, 2).forEach((ln, k) => text(ln, cx + 84, y + 70 + k * 30, { px: 21, w: 700, col: INK2 })); }
  // 下方按鈕
  const by = ly + lh - 100, n = sheetList().length; if (n > 1) { sheetBtn('上一位', rx, by, 230, 100, 0); sheetBtn('下一位', rx + 250, by, 230, 100, 1); text(`${sheetList().indexOf(id) + 1}／${n}`, rx + 580, by + 50, { px: 26, w: 900, align: 'center', col: CREAM }); text(inRun ? '隊伍' : '名冊', rx + 580, by + 80, { px: 18, w: 700, align: 'center', col: 'rgba(239,230,207,.7)' }); }
  sheetBtn('回行程表', rx + rw - 330, by, 330, 100, 2, true);
}
// 選卡畫面：兩到三張夾在木板上的紙卡，上面是圖（角色半身像或小圖示），下面是說明
// 半身像裡眼睛的高度（佔整張圖的比例）。卡片上的圖框很扁，要用眼睛對位，戴高帽子或頭上有大蝴蝶結的人臉才不會掉到框的下緣。新角色要補一筆
const EYE = { kui: .40, jie: .45, kevin: .31, mi: .39, vivi: .33, yan: .37, heilun: .35, cha: .35, qiang: .30, senpai: .39, wu: .42, you: .30, fairy: .43, zong: .44, hui: .43, xu: .39 };
function drawPick() {
  drawTable(.62); const n = menu.items.length, CWd = n <= 2 ? 520 : 450, CH = 640, gap = 36, x0 = W / 2 - (CWd * n + gap * (n - 1)) / 2, y = 272, AH = 226;
  skin.wood(x0 - 46, 64, CWd * n + gap * (n - 1) + 92, 930); text(menu.title, W / 2, 158, { px: 62, w: 900, fam: SERIF, align: 'center', col: CREAM, ls: 12, stroke: 'rgba(20,10,4,.8)', sw: 8 }); wrap(menu.sub || '', CWd * n + gap * (n - 1) - 40, 25).slice(0, 2).forEach((s, i) => text(s, W / 2, 212 + i * 34, { px: 25, w: 700, align: 'center', col: 'rgba(239,230,207,.9)' }));
  menu.items.forEach((it, i) => { const x = x0 + i * (CWd + gap), off = !!it.off, on = i === focus && !off, pe = pressK(i), dn = pe >= 0 && !off; zones.push({ x, y, w: CWd, h: CH, i, off });
    c.save(); c.translate(pe >= 0 && off ? Math.sin(pe * 22) * 7 * (1 - Math.min(1, pe)) : 0, (on && !dn ? -12 : 0) + (dn ? 6 : 0)); skin.paper(x, y, CWd, CH, { clips: [x + CWd / 2], old: off });
    // 圖
    const ax = x + 18, ay = y + 22, aw = CWd - 36, col = it.bust ? DEFS[it.bust].color : '#3a2a1e'; c.fillStyle = '#241812'; c.fillRect(ax, ay, aw, AH); c.fillStyle = col; c.globalAlpha = it.bust ? .34 : 1; c.fillRect(ax + 4, ay + 4, aw - 8, AH - 8); c.globalAlpha = 1; c.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < AH - 8; k += 6) c.fillRect(ax + 4, ay + 4 + k, aw - 8, 2);
    if (it.bust && A.bust[it.bust]) { const im = A.bust[it.bust], bh = 372, bw = bh * im.width / im.height, by = Math.min(ay + 8, ay + 4 + (AH - 8) * .45 - (EYE[it.bust] || .38) * bh); c.save(); c.beginPath(); c.rect(ax + 4, ay + 4, aw - 8, AH - 8); c.clip(); pix(im, ax + aw / 2 - bw / 2, by, bw, bh); c.restore(); }
    else if (it.icon) { const s = 168; if (A.icons[it.icon]) pix(A.icons[it.icon], ax + aw / 2 - s / 2, ay + AH / 2 - s / 2, s, s); else text(it.label[0], ax + aw / 2, ay + AH / 2 + 34, { px: 96, w: 900, fam: SERIF, align: 'center', col: CREAM }); }
    c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(ax + 2.5, ay + 2.5, aw - 5, AH - 5);
    if (on) { c.strokeStyle = TEAL; c.lineWidth = 6; c.strokeRect(x + 8, y + 8, CWd - 16, CH - 16); } if (dn) { c.fillStyle = `rgba(255,246,216,${.8 - .5 * Math.min(1, pe)})`; c.fillRect(x, y, CWd, CH); }
    // 字
    let px = 48; while (px > 30 && mw(it.label, px, 900, SERIF) + it.label.length * 4 > CWd - 50) px -= 2; text(it.label, x + CWd / 2, y + AH + 84, { px, w: 900, fam: SERIF, align: 'center', col: INK, ls: 4 }); let ty = y + AH + 104;
    if (it.tag) { text(fit(it.tag, CWd - 50, 20, 900), x + CWd / 2, ty + 16, { px: 20, w: 900, align: 'center', col: RED, ls: 2 }); ty += 30; } c.fillStyle = RED; c.fillRect(x + CWd / 2 - 60, ty + 2, 120, 4); ty += 16;
    const lp = it.big ? 28 : 21, lh = it.big ? 40 : 30, rows = it.lines.filter(Boolean).flatMap(s => wrap(s, CWd - 64, lp)).slice(0, Math.floor((y + CH - 30 - ty) / lh)); rows.forEach((s, k) => text(s, it.big ? x + CWd / 2 : x + 32, ty + 30 + k * lh, { px: lp, w: 700, align: it.big ? 'center' : 'left', col: s.startsWith('奧義') ? INK : INK2 }));
    if (on) skin.stamp('選這個', x + CWd - 78, y + AH + 2, -.12, 20); if (off) skin.stamp('現在不行', x + CWd / 2, y + AH / 2 + 22, -.1, 30); c.restore(); });
  if (menu.foot) text(menu.foot, W / 2, 956, { px: 22, w: 700, align: 'center', col: 'rgba(239,230,207,.8)' });
}
// 關卡牌：開場與過關時畫面下方的一塊木牌
function drawStageCard() { const k = S.stageCard; if (!k || now < k.t0 || now > k.t1) return; const a = Math.min(sat((now - k.t0) / .25), sat((k.t1 - now) / .3)), u = easeOut(sat((now - k.t0) / .4)), w = 820, x = W / 2 - w / 2, y = 760 + (1 - u) * 40;
  c.save(); c.globalAlpha = a; skin.wood(x, y, w, 190); skin.paper(x + 22, y + 22, w - 44, 146, { clips: [x + 90, x + w - 90] }); text(`第 ${k.n} 站`, x + 60, y + 78, { px: 30, w: 900, fam: SERIF, col: RED, ls: 6 }); text(k.name, W / 2, y + 112, { px: 76, w: 900, fam: SERIF, align: 'center', col: INK, ls: 10 }); text(k.sub, W / 2, y + 150, { px: 24, w: 700, align: 'center', col: INK2, ls: 3 }); if (k.clear) skin.stamp('結案', x + w - 130, y + 70, -.16, 40, now - k.t0 < .5 ? lerp(2.4, 1, easeOut(sat((now - k.t0 - .3) / .2))) : 1); c.restore(); }
function bigButton(label, cx, cy, w = 440, h = 116, act = 'go') { const on = pointer && Math.abs(pointer[0] - cx) < w / 2 && Math.abs(pointer[1] - cy) < h / 2, x = cx - w / 2, pe = pressed && pressed.big && pressed.act === act ? (performance.now() - pressed.t) / PRESS_MS : -1, dn = pe >= 0, y = cy - h / 2 + (dn ? 6 : 0); zones.push({ x, y: cy - h / 2, w, h, big: true, act });
  skin.wood(x, y, w, h); skin.paper(x + 16, y + 16, w - 32, h - 32); if (on && !dn) { c.fillStyle = TEAL; c.fillRect(x + 22, y + 22, w - 44, h - 44); } if (dn) { c.fillStyle = `rgba(255,246,216,${.85 - .4 * Math.min(1, pe)})`; c.fillRect(x + 16, y + 16, w - 32, h - 32); }
  text(label, cx, y + h / 2 + 17, { px: 48, w: 900, fam: SERIF, align: 'center', ls: 8, col: on && !dn ? '#fff8e6' : INK }); }
// ---------- 結案報告（結算）：通關或全員倒下之後，把這一輪的路線、夥伴、強化攤在一張公文上 ----------
let report = null;
function openReport(t0, win) { const rounds = run.rounds + (state.round || 0), cnt = {}; for (const k of run.picks) cnt[k] = (cnt[k] || 0) + 1;
  report = { t0, win, rounds, bonus: win ? Math.max(1000, 16000 - rounds * 400) : 0, floor: run.floor, stage: R.nodeName(run.node), bossHp: !win && state.hasBoss ? Math.ceil(state.hp.boss / R.STAT.boss.hp * 100) : null, ups: Object.entries(cnt),
    route: R.MAP.map((fl, k) => k <= run.floor && run.path[k] != null && fl[run.path[k]] ? fl[run.path[k]] : null), party: run.roster.map(id => { const on = R.HEROES.includes(id); return { id, on, down: id !== 'vivi' && !((on ? state.hp[id] : run.hp[id]) > 0) }; }) };
  for (let i = 0; i < 4; i++) snd(t0 + .5 + i * .3, 'stat', .7); snd(t0 + 1.9, 'card', .9); }
function drawReport() { const k = report; if (!k || now < k.t0) return; zones = [];
  const el = now - k.t0, u = easeOut(sat(el / .4)), PW = 940, PH = 1008, X = (k.win ? 46 : W / 2 - PW / 2) - (1 - u) * 60, Y = 36, L = X + 64, IW = PW - 128, nF = R.MAP.length, show = i => easeOut(sat((el - .45 - i * .3) / .3));
  const head = (s, y, i) => { c.globalAlpha = show(i); c.fillStyle = RED; c.fillRect(L, y - 18, 6, 22); text(s, L + 16, y, { px: 21, w: 900, col: INK, ls: 6 }); c.fillStyle = 'rgba(43,31,24,.18)'; c.fillRect(L + 22 + mw(s, 21, 900) + s.length * 6, y - 8, IW - 22 - mw(s, 21, 900) - s.length * 6, 2); };
  c.save(); c.globalAlpha = sat(el / .25); skin.wood(X, Y, PW, PH); skin.paper(X + 20, Y + 20, PW - 40, PH - 40, { clips: [X + 130, X + PW - 130] });
  text('結案報告', L, Y + 130, { px: 78, w: 900, fam: SERIF, col: INK, ls: 10 }); text(k.win ? `討伐${DEFS.boss.name}　${nF} 站全部走完` : `倒在第 ${k.floor + 1} 站「${k.stage}」` + (k.bossHp != null ? `　對方還剩 ${k.bossHp}% 的血` : ''), L + 4, Y + 174, { px: 24, w: 700, col: INK2, ls: 2 }); c.fillStyle = INK; c.fillRect(L, Y + 192, IW, 3);
  // 路線：走過的站連成紅線；倒下的那一站打叉；沒走到的是虛線圈
  { const y0 = Y + 244, gap = (IW - 68) / (nF - 1), cy = y0 + 62, cx = i => L + 34 + i * gap, last = k.win ? nF - 1 : k.floor; head('路線', y0, 0);
    c.strokeStyle = 'rgba(43,31,24,.3)'; c.lineWidth = 4; c.setLineDash([3, 9]); c.beginPath(); c.moveTo(cx(0), cy); c.lineTo(cx(nF - 1), cy); c.stroke(); c.setLineDash([]); if (last > 0) { c.strokeStyle = '#c23b2e'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx(0), cy); c.lineTo(cx(last), cy); c.stroke(); }
    k.route.forEach((nd, i) => { const x = cx(i), r = 30, fell = !k.win && i === k.floor;
      if (!nd) { c.fillStyle = '#e9dfc6'; c.beginPath(); c.arc(x, cy, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(43,31,24,.4)'; c.lineWidth = 3; c.setLineDash([5, 6]); c.beginPath(); c.arc(x, cy, r - 2, 0, 7); c.stroke(); c.setLineDash([]); text('？', x, cy + 11, { px: 28, w: 900, fam: SERIF, align: 'center', col: 'rgba(43,31,24,.4)' }); return; }
      c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, cy, r + 4, 0, 7); c.fill(); c.fillStyle = nd.icon === 'boss' || nd.icon === 'chief' ? '#6e1c16' : '#33241a'; c.beginPath(); c.arc(x, cy, r, 0, 7); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 3; c.beginPath(); c.arc(x, cy, r - 2, 0, 7); c.stroke();
      const im = A.icons[nd.icon]; if (im) pix(im, x - 23, cy - 23, 46, 46); else text(nd.tag[0], x, cy + 11, { px: 28, w: 900, fam: SERIF, align: 'center', col: CREAM });
      if (fell) { c.strokeStyle = 'rgba(20,6,4,.9)'; c.lineWidth = 12; c.lineCap = 'round'; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x - 22, cy - 22 * d); c.lineTo(x + 22, cy + 22 * d); c.stroke(); } c.strokeStyle = '#e0483a'; c.lineWidth = 7; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x - 22, cy - 22 * d); c.lineTo(x + 22, cy + 22 * d); c.stroke(); } c.lineCap = 'butt'; }
      text(fit(R.nodeName(nd), gap - 6, 15, 900, SERIF), x, cy + 58, { px: 15, w: 900, fam: SERIF, align: 'center', col: fell ? RED : INK }); }); }
  // 同行夥伴
  { const y0 = Y + 416; head('同行夥伴', y0, 1); k.party.forEach((p, i) => { const x = L + 6 + i * 136, y = y0 + 22, d = DEFS[p.id]; skin.face(A.face[p.id], x + 20, y, 76, p.down ? .55 : 0);
      text(d.name, x + 58, y + 104, { px: 21, w: 900, fam: SERIF, align: 'center', col: INK }); text(p.down ? '倒下' : p.on ? '出戰' : '候補', x + 58, y + 126, { px: 15, w: 900, align: 'center', col: p.down ? RED : p.on ? '#1f6a5c' : INK2 }); }); }
  // 強化
  { const y0 = Y + 600; head('拿到的強化', y0, 2); if (!k.ups.length) text('這一輪沒有拿強化', L + 16, y0 + 60, { px: 20, w: 700, col: INK2 });
    k.ups.forEach(([key, n], i) => { const x = L + 6 + i * 104, y = y0 + 18, im = A.icons['up_' + key]; c.fillStyle = '#1c120c'; c.fillRect(x + 12, y - 2, 68, 68); c.fillStyle = '#3a2a1e'; c.fillRect(x + 15, y + 1, 62, 62); if (im) pix(im, x + 18, y + 4, 56, 56);
      if (n > 1) { c.fillStyle = RED; c.fillRect(x + 60, y + 46, 32, 24); text(`×${n}`, x + 76, y + 64, { px: 17, w: 900, align: 'center', col: '#fff8e6' }); } text(fit(R.UPGRADES[key].name, 100, 15, 900), x + 46, y + 88, { px: 15, w: 900, align: 'center', col: INK }); }); }
  // 數字
  { const y0 = Y + 748, cu = easeOut(sat((el - 1.35) / .6)), cells = k.win ? [['總回合數', Math.round(k.rounds * cu), INK], ['同行人數', k.party.length, INK], ['獎金', Math.round(k.bonus * cu).toLocaleString('en-US'), '#a8741a']] : [['總回合數', Math.round(k.rounds * cu), INK], ['走到', `第 ${k.floor + 1} 站`, INK], ['同行人數', k.party.length, INK]]; head('統計', y0, 3);
    cells.forEach(([lab, v, col], i) => { const x = L + i * (IW / 3); text(lab, x + 16, y0 + 44, { px: 18, w: 700, col: INK2, ls: 3 }); text(String(v), x + 16, y0 + 100, { px: 54, w: 900, col }); if (i) { c.fillStyle = 'rgba(43,31,24,.18)'; c.fillRect(x - 4, y0 + 24, 2, 84); } }); }
  c.globalAlpha = sat(el / .25);
  if (k.win) text('今天，準時下班。', L + 8, Y + PH - 74, { px: 38, w: 900, fam: SERIF, col: INK, ls: 6 }); else wrap('提示：看到「蓄力」就防禦或用坦克的奧義；血少先喝珍珠奶茶；岔路多去茶水間。', IW - 400, 20).forEach((ln, i) => text(ln, L + 8, Y + PH - 100 + i * 30, { px: 20, w: 700, col: INK2 }));
  { const se = el - 1.9; if (se > 0) skin.stamp(k.win ? '討伐完成' : '未結案', X + PW - 210, Y + 112, -.12, 46, se < .2 ? lerp(2.4, 1, easeOut(se / .2)) : 1); }
  c.restore(); if (phase === 'over') bigButton(k.win ? '再玩一次' : '再挑戰一次', X + PW - 64 - 180, Y + PH - 88, 360, 92);
}
function drawOverlay() {
  if (phase === 'title' || phase === 'load') { zones = []; c.fillStyle = 'rgba(10,7,6,.76)'; c.fillRect(0, 0, W, H);
    text('不 想 上 班 RPG', W / 2, 168, { px: 34, w: 700, align: 'center', col: BRASS, ls: 10 });
    text('上班旅人', W / 2, 350, { px: 190, w: 900, fam: SERIF, align: 'center', ls: 26, col: CREAM, stroke: 'rgba(20,10,4,.95)', sw: 18 });
    c.fillStyle = BRASS; c.fillRect(W / 2 - 420, 398, 840, 3); text('討伐奧客總經理', W / 2, 458, { px: 44, w: 900, fam: SERIF, align: 'center', col: CREAM, ls: 14 }); skin.paper(W / 2 + 396, 268, 250, 58); skin.stamp(`試玩版 ${VERSION}`, W / 2 + 521, 297, 0, 26);
    skin.paper(W / 2 - 520, 496, 1040, 262, { clips: [W / 2 - 440, W / 2 + 440] });
    ['一個人出發，照行程表一站一站走到奧客總經理；路上招募同事，最多四人上場', '打贏戰鬥可以三選一強化；岔路自己選：休息、福利、救人或找新同事', '行動會累積全隊共用的「氣勢」，夠了就能放奧義', '小兵還在場上的時候魔王不會受傷；把魔王的「底氣」打到歸零，他會理虧', '魔王蓄力之後下一次行動放大招：用防禦、坦克的招式或奧義撐過去'].forEach((s, i) => { gem(W / 2 - 474, 534 + i * 46, 6, RED); text(s, W / 2 - 452, 544 + i * 46, { px: 26, w: 700, col: INK }); });
    if (phase === 'title' && saved === undefined) saved = readSave();
    if (phase === 'title' && saved) { const r = saved.run; bigButton('繼續上班', W / 2 - 250, 856, 460, 112, 'cont'); bigButton('重新開始', W / 2 + 250, 856, 380, 96, 'new');
      text(`上次的進度：第 ${r.floor + 1} 站　${r.roster.slice(0, 4).map(id => DEFS[id].name).join('、')}${r.roster.length > 4 ? ` 等 ${r.roster.length} 人` : ''}　　重新開始會放棄這份進度`, W / 2, 787, { px: 22, w: 700, align: 'center', col: 'rgba(239,230,207,.82)' }); }
    else if (phase === 'title') bigButton('開始上班', W / 2, 838); else text(loadMsg + '…', W / 2, 848, { px: 30, w: 500, align: 'center', col: COL.dim });
    toggles(W / 2 - 166, 930);
    { const tip = a2hs(); if (tip) { const x = 1392, y = 52, w = 492, h = 150, pe = pressed && pressed.opt === 'a2hs' ? 1 : 0; zones.push({ x, y, w, h, opt: 'a2hs' }); c.save(); c.translate(0, pe ? 4 : 0); skin.paper(x, y, w, h, { clips: [x + 60, x + w - 60] });
        if (iconImg) { c.imageSmoothingEnabled = false; c.drawImage(iconImg, x + 20, y + 22, 106, 106); c.imageSmoothingEnabled = true; } text(tip[0], x + 144, y + 62, { px: 28, w: 900, fam: SERIF, col: INK }); text(tip[1], x + 144, y + 98, { px: 20, w: 700, col: INK2 }); text(installEvt ? '' : '點一下這張紙就不再提醒', x + 144, y + 128, { px: 16, w: 500, col: 'rgba(43,31,24,.55)' }); c.restore(); } } text('滑鼠／觸控點選，或用方向鍵與 Enter', W / 2, 1022, { px: 21, w: 500, align: 'center', col: 'rgba(239,230,207,.7)' }); }
  drawReport();
}

// ---------- 操作 ----------
const toStage = e => { const r = stage.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
const hitZone = p => { let z = zones.find(z => !z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h); return z || zones.find(z => z.soft && p[0] >= z.x && p[0] <= z.x + z.w && p[1] >= z.y && p[1] <= z.y + z.h); };
const PRESS_MS = 130; let pressed = null;
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* 沒有震動就算了 */ } };
function press(z) {
  if (!z || (pressed && performance.now() - pressed.t < PRESS_MS)) return;
  if (z.opt === 'a2hs') { pressed = { opt: 'a2hs', t: performance.now() }; uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; }, PRESS_MS); if (installEvt) { const e = installEvt; installEvt = null; e.prompt(); (e.userChoice || Promise.resolve()).then(r => { if (r && r.outcome === 'accepted') installed = true; }).catch(() => 0); } else { PREF.noA2hs = true; savePref(); } return; }
  if (z.opt) { pressed = { opt: z.opt, t: performance.now() }; PREF[z.opt] = !PREF[z.opt]; PREF.set = true; savePref(); if (z.opt === 'mute') master.gain.value = PREF.mute ? 0 : .9; else applyQuality(); uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; }, PRESS_MS); return; }
  if (z.off) { pressed = { i: z.i, t: performance.now() }; uiSound('no'); buzz([8, 40, 8]); setTimeout(() => { pressed = null; }, 260); return; }
  pressed = { i: z.i, big: z.big, act: z.act, t: performance.now() }; uiSound('ok'); buzz(14); if (!z.big) focus = z.i;
  const m = menu, ph = phase; setTimeout(() => { pressed = null; if (z.big) { if (ph === 'title') { phase = 'anim'; audioReady.then(z.act === 'cont' ? resume : start); } else if (ph === 'over') location.reload(); return; } if (menu === m && ['command', 'pick', 'hub'].includes(phase)) m.items[z.i].go(); }, PRESS_MS);
}
stage.addEventListener('pointermove', e => { pointer = toStage(e); const z = hitZone(pointer); if (z && !z.big && !z.opt && !z.off && ['command', 'pick', 'hub'].includes(phase) && z.i !== focus) { focus = z.i; } });
stage.addEventListener('pointerdown', e => { e.preventDefault(); pointer = toStage(e); if (AC.state !== 'running') AC.resume(); press(hitZone(pointer)); });
addEventListener('keydown', e => { if (phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (phase === 'over' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (!['command', 'pick', 'hub'].includes(phase) || !menu) return; const n = menu.items.length;
  const step = d => { let i = focus; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!menu.items[i].off) break; } if (i !== focus) { focus = i; uiSound('move'); } };
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
  arena.update(now); for (const id in units) units[id].update(now); for (const u of spareUnits()) u.update(now);
  for (const id of R.FRONT) if (ko[id]) { const m = units[id].mesh; if (units[id].frames.ko) m.material.color.multiplyScalar(.82); else { m.material.color.multiplyScalar(.3); m.scale.y *= .62; } }
  FXL.update(now); cam.update(now); for (const id in units) { const u = units[id]; u.x = u.group.position.x; }
  if (!((phase === 'hub' || phase === 'pick') && A.map.table)) E.render(1); ui.draw(now, SFX); c.globalAlpha = 1; { const mv = S.mo.filter(k => k.t <= now).at(-1)?.v ?? state.mo; moShown += (mv - moShown) * .18; } drawStageCard(); drawMenu(); drawOverlay();
  if (now > pruneAt) { pruneAt = now + 2; FXL.prune(now); S.nums = S.nums.filter(n => n.t > now - 4); S.boxes = S.boxes.filter(b => b.t1 > now - 1); S.items = S.items.filter(k => k.t0 > now - 3); S.subs = S.subs.filter(k => k.t0 > now - 8); S.cutins = S.cutins.filter(k => k.t0 > now - 4); S.cards = S.cards.filter(k => k.t1 > now - 1); S.menus.length = 0; }
  requestAnimationFrame(frame);
}
units.md.show(-2, false); cam.to(-1, 0, WIDE); enterStage();
window.__game = { get state() { return state; }, sheet: id => openSheet(id), get sheetId() { return sheet; }, get run() { return run; }, go: i => chooseNode(i), get front() { return R.FRONT.slice(); }, S, units, get phase() { return phase; }, testReport: win => { phase = 'over'; menu = null; if (S.ui.length) S.ui.at(-1).t1 = now; if (!win) SFX.add('black', now, 1e9, { from: .72, to: .72 }); openReport(now, win); }, get saved() { return saved; }, resume: () => press(zones.find(z => z.act === 'cont')), get now() { return now; }, get menu() { return menu; }, get actor() { return actor; }, press: i => { focus = i; menu.items[i].go(); }, tap: i => press({ i, off: !!menu.items[i].off }), start: () => press(zones.find(z => z.big)) };
booted = true; requestAnimationFrame(frame); loadMsg = '聲音載入中'; phase = 'load'; audioReady.then(() => { if (phase === 'load') phase = 'title'; });
// 等聲音太久（網路慢）也讓玩家先開始
setTimeout(() => { if (phase === 'load') phase = 'title'; }, 6000);
