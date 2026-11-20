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
const VERSION = 'v0.19.0';      // 改版時一起改 tools/deploy.sh 會顯示的版本

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
A.map = { table: await loadImg('art/map/table.jpg'), blueprint: await loadImg('art/map/blueprint.jpg'), cover: await loadImg('art/map/cover.jpg') }; A.icons = {};
await Promise.all(['battle', 'elite', 'rest', 'gift', 'shop', 'event', 'recruit', 'rescue', 'hunt', 'chief', 'boss', 'clock', ...new Set(Object.keys(R.UPGRADES).map(k => 'up_' + (R.UPGRADES[k].ic || k))), 'sk_ult', ...new Set(Object.values(R.SKILLS).flat().map(k => 'sk_' + (k.ic || k.key)))].map(async n => { A.icons[n] = await loadImg(`art/map/icons/${n}.png`); })); for (const k of Object.values(R.SKILLS).flat()) if (k.ic) A.icons['sk_' + k.key] = A.icons['sk_' + k.ic]; for (const k in R.UPGRADES) if (R.UPGRADES[k].ic) A.icons['up_' + k] = A.icons['up_' + R.UPGRADES[k].ic];      // 新招式先借舊招式的圖示
// 一輪＝走完行程表（肉鴿路線，rules.js 的 MAP）。開局選人選招式之後才真正開新的一輪；這裡先放一個暫時的，讓開始畫面後面有東西可以看
const RAND = Q.has('seed') ? R.mulberry(+Q.get('seed')) : Math.random;
let run = R.newRun(RAND, 'kui', 'draft'); R.prepare(run);
let state = R.newState(run);
// 第二關的頭目「甩鍋課長」：跟魔王共用 'boss' 這個位置，進關時換上去
const bossU = units.boss; let chiefU = null; A.faceBoss = A.face.boss;
try { const [i, w, a, h] = await Promise.all(['idle', 'wind', 'atk', 'hurt'].map(k => loadTex(`art/enemy/chief_${k}.png`)));
  chiefU = new Unit(stageGroup, { idle: i, atk: a, hurt: h, stun: h, swing: [i, w, w, a, a, a, i, i] }, { x: -2.5, z: -.5, scale: 2.3 * PPU / i.image.height, tint: 0xf0e8f4, shadowK: .7 });
  const fc = document.createElement('canvas'); fc.width = fc.height = 96; const fk = fc.getContext('2d'); fk.imageSmoothingEnabled = false; fk.drawImage(i.image, 40, 4, 56, 56, 0, 0, 96, 96); A.faceChief = fc; } catch (e) { /* 沒有圖就用魔王頂著 */ }
DEFS.mc.pos = [-2.7, -.3]; units.mc.home = [-2.7, -.3]; DEFS.ma.name = DEFS.mb.name = DEFS.mc.name = DEFS.md.name = '社畜小兵';
// 其他種類的一般敵人（rules.js 的 KINDS）與菁英「考績魔導士」：一般敵人共用 ma／mb／mc 三個位置，菁英共用 'boss' 的位置，進關時換上去。沒有圖的種類用社畜小兵頂著
const cropFace = (im, [x, y, sz]) => { const fc = document.createElement('canvas'); fc.width = fc.height = 96; const k = fc.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(im, x, y, sz, sz, 0, 0, 96, 96); return fc; };
const minionU = { drone: { ma: units.ma, mb: units.mb, mc: units.mc, md: units.md } }, minionFace = { drone: A.face.ma }, KLOOK = { courier: { hgt: 1.44, face: [22, 2, 40] }, knight: { hgt: 1.34, face: [26, 0, 40] }, intern: { hgt: 1.4, face: [12, 0, 42] }, auntie: { hgt: 1.32, face: [14, 0, 42] }, smoker: { hgt: 1.3, face: [18, 0, 36] },
  tw_drone: { hgt: 1.4, face: [18, 2, 32] }, tw_knight: { hgt: 1.34, face: [24, 8, 32] }, tw_auntie: { hgt: 1.32, face: [14, 0, 38] }, tw_courier: { hgt: 1.44, face: [28, 4, 30] }, tw_intern: { hgt: 1.4, face: [20, 2, 34] }, tw_smoker: { hgt: 1.3, face: [30, 0, 32] } };      // tw_＝台灣篇的換皮小兵
for (const kind in KLOOK) try { const f = {}; for (const k of ['idle', 'atk', 'hit']) f[k] = await loadTex(`art/enemy/${kind}_${k}.png`); const us = {};
  for (const m of R.SLOTS) { const front = m !== 'mb' && m !== 'md'; us[m] = new Unit(stageGroup, f, { x: DEFS[m].pos[0], z: DEFS[m].pos[1], scale: KLOOK[kind].hgt * PPU / f.idle.image.height, tint: front ? 0xf0e8f4 : 0xd8d4ee, phase: front ? .2 : .7 }); us[m].show(-1e9, false); }
  minionU[kind] = us; minionFace[kind] = cropFace(f.idle.image, KLOOK[kind].face); } catch (e) { /* 沒有圖 */ }
let auditU = null;
try { const [i, w, a, h] = await Promise.all(['idle', 'wind', 'atk', 'hurt'].map(k => loadTex(`art/enemy/audit_${k}.png`)));
  auditU = new Unit(stageGroup, { idle: i, atk: a, hurt: h, stun: h, swing: [i, w, w, a, a, a, i, i] }, { x: -2.5, z: -.5, scale: 1.95 * PPU / i.image.height, tint: 0xf0e8f4, shadowK: .7 }); auditU.show(-1e9, false); A.faceAudit = cropFace(i.image, [2, 0, 34]); } catch (e) { /* 沒有圖就用魔王頂著 */ }
// 另外三位長官（鸚鵡、猴子、豬腦）：做法跟考績魔導士一樣，共用 'boss' 的位置。圖跟小兵差不多高，在這裡放大（hgt＝站姿在場上多高）
const eliteU = {}, eliteFace = {}, ELOOK = { parrot: { hgt: 2.1, face: [10, 0, 40] }, monkey: { hgt: 1.8, face: [22, 12, 30] }, pig: { hgt: 1.95, face: [20, 6, 34] }, tw_pot: { hgt: 2.25, face: [30, 24, 34] }, tw_night: { hgt: 2.15, face: [36, 6, 28] }, tw_roof: { hgt: 2.7, face: [84, 60, 24] } };
for (const k in ELOOK) try { const [i, w, a, h] = await Promise.all(['idle', 'wind', 'atk', 'hurt'].map(n => loadTex(`art/enemy/${k}_${n}.png`)));
  eliteU[k] = new Unit(stageGroup, { idle: i, atk: a, hurt: h, stun: h, swing: [i, w, w, a, a, a, i, i] }, { x: -2.5, z: -.5, scale: ELOOK[k].hgt * PPU / i.image.height, tint: 0xf0e8f4, shadowK: .7 }); eliteU[k].show(-1e9, false); eliteFace[k] = cropFace(i.image, ELOOK[k].face); } catch (e) { /* 沒有圖就用魔王頂著 */ }
// 鏡像內戰：敵人是我方夥伴的鏡像。圖直接拿那個夥伴的（站姿、出手、受擊），左右翻過來、染一點紫；用到才做，做過的留著
const MIRROR_TINT = 0xa794ec, mirrorBossU = {};
function mirrorMinions(hero) { const key = 'm_' + hero; if (minionU[key] || !units[hero]) return minionU[key]; const f = units[hero].frames, fr = { idle: f.ready, atk: f.act, hit: f.hurt || f.wind }, us = {};
  for (const m of R.SLOTS) { us[m] = new Unit(stageGroup, fr, { x: DEFS[m].pos[0], z: DEFS[m].pos[1], scale: units[hero].s, tint: MIRROR_TINT, phase: m === 'mb' || m === 'md' ? .7 : .2 }); us[m].group.scale.x = -1; us[m].show(-1e9, false); }
  minionFace[key] = A.face[hero]; return (minionU[key] = us); }
function mirrorBoss(hero) { if (mirrorBossU[hero] || !units[hero]) return mirrorBossU[hero]; const f = units[hero].frames, hurt = f.hurt || f.wind;
  const u = new Unit(stageGroup, { idle: f.ready, atk: f.act, hurt, stun: hurt, swing: [f.ready, f.wind, f.wind, f.act, f.act, f.act, f.ready, f.ready] }, { x: -2.5, z: -.5, scale: units[hero].s * 1.45, tint: MIRROR_TINT, shadowK: .7 }); u.group.scale.x = -1; u.show(-1e9, false); return (mirrorBossU[hero] = u); }
const spareUnits = () => [bossU, chiefU, auditU, ...Object.values(eliteU), ...Object.values(mirrorBossU), ...Object.values(minionU).flatMap(us => Object.values(us))].filter(u => u && !Object.values(units).includes(u));
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
// 戰鬥播放速度：1、1.5、2 倍（左上角的小紙條切換，記在 PREF.spd）。只加快演出，選指令的時候不倒數。看過的頭目開場自動用兩倍帶過（introBoost）
const SPEEDS = [1, 1.5, 2]; let introBoost = -1;
const speedNow = () => Q.has('fast') ? +Q.get('fast') || 3 : (phase === 'anim' || phase === 'end' || phase === 'command' ? SPEEDS[PREF.spd || 0] * (now < introBoost ? 2 : 1) : 1);
const snd = (t, id, v = 1) => { const b = buf[id]; if (!b) return; const s = AC.createBufferSource(), g = AC.createGain(), vo = id.startsWith('vo/'); s.buffer = b; g.gain.value = v * (vo ? 1 : .6); s.connect(g).connect(master);
  const when = AC.currentTime + Math.max(0, t - now) / speedNow(); s.start(when); if (vo) { musicGain.gain.setTargetAtTime(.16, when, .08); musicGain.gain.setTargetAtTime(.42, when + b.duration + .2, .3); } };
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
  if (h.lock != null) { num(t + .2, 'boss', h.lockAll ? '三個鎖全拆　大招取消！' : `拆掉一個鎖　還剩 ${h.lock} 個`, 'text', { col: '#9af0ff', px: h.lockAll ? 40 : 30, y: .78 }); snd(t + .15, h.lockAll ? 'break' : 'shield_block', .8); if (h.lockAll) { S.shield.boss.push({ t, v: 0 }); if (h.guard || h.pot) { S.stamps.push({ t, id: 'boss' }); cam.shake(t, .3, .6); fx('status/stunned', t + .4, 'boss', { y: 2.35, dx: .45, scale: 2.2, dur: 4 }); } } }
  if (foe && h.type && !h.guard && h.v > 0) learnWeak(h.dst, h.type, !!h.wk);
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
  if (h.fab > 0) num(t + .16, h.dst, `護盾擋掉 ${h.fab}`, 'text', { col: '#ffb0a0', px: 26, y: h.dst === 'boss' ? .62 : 1.15 });
  if (h.wk) { num(t - .04, h.dst, '弱點！' + (h.wkMo ? `　氣勢 ＋${h.wkMo}` : ''), 'text', { col: '#ffe27a', px: 32, y: h.dst === 'boss' ? 1.05 : 1.55 }); SFX.add('flash', t, .14, { c: [255, 230, 150], a: .3 }); }
  if (h.armor) num(t + .14, h.dst, '裝甲　傷害減半', 'text', { col: '#c8d0dc', px: 26, y: 1.3 });
  if (h.dull) num(t + .14, h.dst, '一問三不知　招式減半', 'text', { col: '#d8c8e8', px: 26, y: 1.3 });
  if (h.sign != null) num(t + .3, 'boss', h.sign ? `招牌暗一格　再 ${h.sign} 下就熄` : '招牌熄了　服務費取消', 'text', { col: '#ffe27a', px: 30, y: .55 });
  if (h.layerDown != null) num(t + .3, 'boss', `拆掉一層　還剩 ${h.layerDown} 層`, 'text', { col: '#ffe27a', px: 30, y: .55 });
  if (h.projDown) num(t + .35, 'boss', '臨時專案倒了　大招落空', 'text', { col: '#ffe27a', px: 32, y: .55 });
  if (h.ab > 0) num(t + .1, h.dst, `護盾擋掉 ${h.ab}`, 'text', { col: '#9af0ff', px: 28, y: 1.5 });
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
// 屬性與弱點：打過的屬性記在 PREF.weak[敵人代號][屬性]＝1 是弱點、0 不是（永久記得）。敵人頭上兩格：知道的弱點畫屬性牌，還不知道的畫「？」
const TCOL = { slash: ['#c9ced6', '#22262c'], blunt: ['#b98b4e', '#2a1c0c'], fire: ['#e2573a', '#fff2e0'], ice: ['#5fb8e8', '#0c2230'], holy: ['#f1d77a', '#3a2a08'], dark: ['#7a55c0', '#f4ecff'] };
const foeKey = f => f === 'boss' ? state.L && state.L.id : state.kind[f], knownWeak = f => { const k = (PREF.weak || {})[foeKey(f)] || {}; return R.weakOf(state, f).filter(t => k[t] === 1); }, isKnownWeak = (f, t) => !!t && ((PREF.weak || {})[foeKey(f)] || {})[t] === 1;
function learnWeak(f, type, wk) { if (!type || !foeKey(f)) return; const W0 = PREF.weak || (PREF.weak = {}), k = W0[foeKey(f)] || (W0[foeKey(f)] = {}); if (k[type] === (wk ? 1 : 0)) return; k[type] = wk ? 1 : 0; savePref(); }
function typeChip(type, x, y, sz = 36, on = true) { c.fillStyle = '#1c120c'; c.fillRect(x - 2, y - 2, sz + 4, sz + 4); if (!type) { c.fillStyle = '#4a3c30'; c.fillRect(x, y, sz, sz); text('？', x + sz / 2, y + sz * .76, { px: Math.round(sz * .7), w: 900, align: 'center', col: 'rgba(239,230,207,.75)' }); return; }
  c.fillStyle = TCOL[type][0]; c.globalAlpha = on ? 1 : .35; c.fillRect(x, y, sz, sz); c.globalAlpha = 1; text(R.TYPES[type], x + sz / 2, y + sz * .78, { px: Math.round(sz * .72), w: 900, fam: SERIF, align: 'center', col: TCOL[type][1] }); }
function playAttack(r, t0) {
  if (r.spGain) { S.sp[r.id].push({ t: t0 + .6, v: r.sp }); num(t0 + .62, r.id, r.spGain, 'sp', { dy: -60 }); }
  grunt(t0 + .05, r.id); if (r.smoked) num(t0 + .05, r.id, '被煙嗆到　傷害減半', 'text', { col: '#cfd8a8', px: 26, y: 1.3 });
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
function playDefend(r, t0) { units[r.id].pose(t0, 'guard'); num(t0 + .1, r.id, '防禦', 'text', { col: '#bfd0ff', px: 32, y: r.id === 'vivi' ? 1.0 : 1.2, dx: r.id === 'vivi' ? -110 : 0 }); snd(t0 + .05, 'shield_up', .5); fx('impacts/parry', t0 + .05, r.id, { scale: 1.0, y: .5, palette: 'cyber' }); if (r.spGain) { S.sp[r.id].push({ t: t0 + .35, v: r.sp }); num(t0 + .4, r.id, r.spGain, 'sp', { dy: -60 }); } at(t0 + .3, () => syncBars(now)); return t0 + .75; }
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
// 合體技：橫幅＋成員一起擺姿勢，照打的人輪流衝上去（或一起施法），最後演附帶效果
function playUnite(r, t0) { const U = R.UNITES.find(x => x.key === r.key), hs = r.hits || [], mem = r.who.filter(h => units[h]), [f0, pal, sfx] = TFX[U.type] || ['holy/blessing', 'gold', 'buff'], fy = f => f === 'boss' ? 1.2 : .6;
  box(t0, 2.4, `合體技　${r.name}`); snd(t0, 'cutin', .9); SFX.add('dim', t0, 1.6, { c: [20, 12, 6], a: .4, fade: .25 }); SFX.add('flash', t0 + .05, .3, { c: [255, 226, 122], a: .5 }); cam.shake(t0 + .1, .1, .3);
  mem.forEach((h, i) => { shout(t0 + .05 + i * .12, h); units[h].hop(t0 + .08 + i * .1, .3, .36); if (h !== 'vivi') units[h].pose(t0 + .05, units[h].frames.wind ? 'wind' : 'act'); num(t0 + .2 + i * .1, h, i ? '好！' : '一起上！', 'text', { col: '#ffe27a', px: 30, y: 1.35, dx: h === 'vivi' ? -110 : 0 }); });
  for (const sp of r.sps || []) S.sp[sp.dst].push({ t: t0 + .3, v: sp.sp });
  let th = t0 + .9, te = t0 + 1.6;
  if (hs.length && U.target === 'foe') { hs.forEach((h, i) => { const by = h.by && units[h.by] && h.by !== 'vivi' ? h.by : mem.find(m => m !== 'vivi'), tg = h.dst, [tx, tz] = units[tg].posAt(t0), big = tg === 'boss', tt = t0 + .85 + i * .42, [hx, hz] = home(by);
      units[by].pose(tt - .22, 'act').move(tt - .2, tx + reach(by, big), tz + (i % 2 ? .25 : -.2), .16, easeOut).move(tt + .22, hx, hz, .22); snd(tt - .2, 'whoosh', .5); fx(f0, tt - .04, tg, { y: fy(tg), dx: big ? .8 : .3, scale: big ? 2.0 : 1.5, palette: pal }); cam.shake(tt, .18, .3); applyHit(tt, h, { pow: 1.3, snd: h.guard ? false : BLADE[by] ? 'slash' : 'hit', dy: i % 2 ? -70 : 0 }); th = tt; });
    te = th + .9; }
  else if (hs.length) { th = t0 + 1.0; SFX.add('flash', th, .3, { a: .5 }); snd(th - .05, sfx || 'hit', .8); cam.shake(th, .3, .5); hs.forEach((h, i) => { fx(f0, th - .2 + (i % 4) * .06, h.dst, { scale: h.dst === 'boss' ? 1.9 : 1.2, y: f0.startsWith('impacts') ? fy(h.dst) : 0, palette: pal }); applyHit(th + i * .09, h, { snd: i ? false : 'hit', dy: i % 2 ? -70 : 0 }); }); te = th + 1.0; }
  else { th = t0 + .8; snd(th, 'buff', .8); R.FRONT.filter(h => R.alive(state, h)).forEach((h, i) => fx('holy/blessing', th - .1 + i * .06, h, { scale: 1.0, dur: 1.0 })); te = th + 1.1; }
  const tag = (f, s2, col = '#ffe27a', dt = .3) => num(th + dt, f, s2, 'text', { col, px: 30, y: DEFS[f].enemy ? (f === 'boss' ? .75 : 1.3) : 1.2 });
  for (const f of r.down || []) tag(f, '攻擊力 ↓', '#c9a0ff'); for (const f of r.marked || []) tag(f, '標記　受傷 ＋30%', '#ffe27a', .1); for (const f of r.burns || []) tag(f, '灼燒', '#ff9a5a'); if (r.delayed) tag(r.delayed, '延到最後');
  (r.heals || []).forEach((h, i) => { fx('holy/heal', th + .2 + i * .08, h.dst, { scale: 1.15 }); S.hp[h.dst].push({ t: th + .4 + i * .08, v: h.hp }); if (h.v > 0) num(th + .4 + i * .08, h.dst, h.v, 'heal'); if (h.revive) at(th + .4, () => { ko[h.dst] = false; const u2 = units[h.dst]; u2.dead = null; u2.pose(now, 'ready').hop(now, .3, .4); }); }); if (r.heals) snd(th + .25, 'heal', .8);
  (r.spGains || []).forEach((h, i) => { fx('arcane/mana-burst', th + .2 + i * .08, h.dst, { scale: .9, palette: 'cyber', y: .5 }); S.sp[h.dst].push({ t: th + .4, v: h.sp }); if (h.v > 0) num(th + .45, h.dst, h.v, 'sp'); });
  showFx(r.fxs, th + .5, r.id); r.fxs = null;
  for (const h of mem) if (h !== 'vivi') ready(te - .05, h); else at(te - .05, () => units.vivi.pose(now, 'ready')); return te; }
// 新招式（rules.js 的 fx 清單）沒有專屬演出設定的，照目標與屬性配一個
const TFX = { slash: ['impacts/crit-hit', 'blood', 'hit'], blunt: ['impacts/blunt-hit', 'gold', 'hit'], fire: ['explosions/small-explosion', 'fire', 'explosion'], ice: ['impacts/hit-spark', 'cyber', 'hit'], holy: ['arcane/star-fall', 'gold', 'buff'], dark: ['shadow/shadow-tendrils', 'shadow', 'dark_blast'] };
function autoG(r) { const k = R.SKILLS[r.id].find(x => x.key === r.key); if (!k || !k.fx) return null; const [f, pal, sfx] = TFX[k.type] || [];
  if (k.target === 'foe') return CASTER[r.id] || k.type === 'fire' || k.type === 'dark' || k.type === 'holy' || k.type === 'ice' && r.id !== 'hui' ? { type: 'cast', fx: f, pal, sfx } : { type: 'melee', fx: f, pal };
  if (k.target === 'all') return { type: 'all', fx: f, pal, sfx }; if (k.target === 'ally') return { type: 'ally' }; return { type: 'self', say: k.name }; }
// 附帶效果（護盾、回血、回 SP、加氣勢、狀態字）一筆一筆演出來；why＝是哪個被動觸發的
function showFx(list, t, actor0) { (list || []).forEach((x, i) => { const tt = t + i * .14, who = x.dst || actor0; if (!who || !units[who]) return; const foe = DEFS[who].enemy, y = foe ? (who === 'boss' ? .8 : 1.35) : 1.35 + (i % 2) * .22;
    if (x.why) num(tt - .05, who, x.why, 'text', { col: '#e8dcc0', px: 24, y: y + .32 });
    if (x.t === 'ward') { num(tt, who, `護盾 ${x.v}`, 'text', { col: '#9af0ff', px: 30, y }); fx('impacts/parry', tt, who, { scale: .9, y: .6, palette: 'cyber' }); }
    else if (x.t === 'heal') { S.hp[who].push({ t: tt, v: x.hp }); num(tt, who, x.v, 'heal', { dy: -40 - (i % 2) * 50 }); fx('holy/heal', tt - .1, who, { scale: 1.0 }); }
    else if (x.t === 'sp') { S.sp[who].push({ t: tt, v: x.sp }); num(tt, who, x.v, 'sp', { dy: -40 - (i % 2) * 50 }); }
    else if (x.t === 'mo') { S.mo.push({ t: tt, v: x.mo }); num(tt, who, `氣勢 ＋${x.v}`, 'text', { col: '#ffe27a', px: 28, y }); }
    else if (x.t === 'tag') num(tt, who, x.text, 'text', { col: foe ? '#ffd0a0' : '#bfeaff', px: 28, y }); }); }
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
  for (const f of r.down || []) tag(f, '攻擊力 ↓', '#c9a0ff'); for (const f of r.marked || []) tag(f, '大客戶　受傷 ＋30%'); if (r.delayed) tag(r.delayed, '延到最後'); if (r.burn) tag(r.burn, '灼燒', '#ff9a5a'); for (const f of r.burns || []) tag(f, '灼燒', '#ff9a5a'); if (r.cover) { tag(r.cover, '幫忙擋下一擊', '#9af0ff', 0); units[r.cover].hop(th, .16, .3); }
  if (r.key === 'probe' || (r.key === 'expose' && r.exposed)) tag(id, `證據 ×${r.evidence}`, '#ffd0c8', .45); if (r.key === 'box' && r.duty) tag(id, `扛責 ×${r.duty} 一次砸出去`, '#ffc890', -.2); if (r.bonusMo) tag(id, `氣勢 ＋${r.bonusMo}`, '#ffe27a', .45); if (r.exposed) tag(r.target, '抓到破綻！', '#ff8a78', .1);
  if (r.spGain) { S.sp[id].push({ t: th + .4, v: r.sp }); num(th + .5, id, r.spGain, 'sp'); }
  (r.heals || []).forEach((h, i) => { fx('holy/heal', th + i * .08, h.dst, { scale: 1.15 }); S.hp[h.dst].push({ t: th + .2 + i * .08, v: h.hp }); if (h.v > 0) num(th + .2 + i * .08, h.dst, h.v, 'heal'); }); if (r.heals) snd(th + .05, 'heal', .8);
  (r.spGains || []).forEach((h, i) => { fx('arcane/mana-burst', th + i * .08, h.dst, { scale: .9, palette: 'cyber', y: .5 }); S.sp[h.dst].push({ t: th + .2, v: h.sp }); if (h.v > 0) num(th + .25, h.dst, h.v, 'sp'); });
  if (r.atkUp) R.FRONT.filter(h => R.alive(state, h)).forEach((h, i) => { units[h].hop(th + i * .07, .2, .3); fx('arcane/mana-burst', th + i * .07, h, { scale: .8, palette: 'candy', y: .5 }); num(th + .15 + i * .07, h, '攻擊力 ↑', 'text', { col: '#ffb0d0', px: 26, y: 1.2 }); });
  if (r.shielded) tag(r.shielded, '減傷', '#9af0ff', .5); if (r.overtime) tag(id, `加班 ×${r.overtime}`, '#c8d4e4', .45); if (r.selfDmg) { S.hp[id].push({ t: t0 + .2, v: r.selfHp }); num(t0 + .2, id, r.selfDmg, 'foe'); }
  if (!G.hold) ready(te - .05, id); return te;
}
function playSkill(r, t0) {
  { const G = SKFX[r.key] || autoG(r); if (G) return genericSkill(r, t0, G); }
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
// 敵人打中之後的附帶效果：扣 SP、二手煙
function sideFx(r, t) { for (const h of r.hits) { if (h.spLoss) { num(t, h.dst, `SP －${h.spLoss}`, 'text', { col: '#8fc0ff', px: 30, y: 1.65 }); S.sp[h.dst].push({ t, v: h.sp }); } if (h.hex) num(t + .12, h.dst, h.hex, 'text', { col: '#ffb0a0', px: 28, y: h.spLoss ? 1.95 : 1.65 }); if (h.smoke) { num(t + .1, h.dst, '被煙嗆到　下次普攻減半', 'text', { col: '#cfd8a8', px: 28, y: h.spLoss ? 1.95 : 1.65 }); fx('spawn/poof', t - .1, h.dst, { scale: 1.3, y: .9 }); } } }
// 小兵（重新）上場：地上畫陣、冒煙、跳出來
function popIn(m, tm) { fx('arcane/rune-circle', tm - .5, home(m), { palette: 'blood', scale: 1.2 }); fx('spawn/poof', tm - .08, home(m), { scale: 1.5, y: .3 }); snd(tm, 'boss_appear', .55);
  at(tm, () => { const mu = units[m]; mu.dead = null; mu.poseK.length = 0; mu.moveK.length = 0; mu.hitK.length = 0; mu.pose(now, 'idle').hop(now, .34, .42); S.hp[m].push({ t: now, v: R.STAT[m].hp }); minionShield[m] = 2; S.shield[m].push({ t: now, v: 2 }); }); }
function playFoe(r, t0) {
  const id = r.id, u = units[id];
  if (r.ignored) { num(t0 + .1, 'boss', '主管已讀不理　理虧也照樣行動', 'text', { col: '#ff8a70', px: 30, y: .8 }); S.shield.boss.push({ t: t0 + .2, v: r.shieldBack }); }
  if (r.pre) { S.hp.boss.push({ t: t0 + .2, v: r.pre.hp }); if (r.pre.regen > 0) { num(t0 + .2, 'boss', r.pre.regen, 'heal'); num(t0 + .1, 'boss', '舊案回流', 'text', { col: '#e8dcc0', px: 26, y: .8 }); fx('holy/heal', t0 + .1, 'boss', { scale: 1.8, y: .6 }); } }
  if (r.kind === 'foeWard') { const kd0 = id === 'boss' ? null : state.kind[id]; box(t0, 1.3, kd0 ? R.KINDS[kd0].move : '上護盾', true); u.pose(t0 + .15, 'atk').pose(t0 + 1.0, 'idle'); fx('impacts/parry', t0 + .5, r.dst, { scale: r.dst === 'boss' ? 1.8 : 1.2, y: r.dst === 'boss' ? 1.0 : .6, palette: 'blood' }); snd(t0 + .5, 'shield_up', .6); num(t0 + .55, r.dst, `護盾 ${r.v}`, 'text', { col: '#ffb0a0', px: 30, y: r.dst === 'boss' ? .8 : 1.3 }); return t0 + 1.3; }
  if (r.kind === 'bossMark') { box(t0 + .1, 2.0, '補件通知', true); u.pose(t0 + .2, 'atk').pose(t0 + 1.3, 'idle'); snd(t0 + .3, 'stat', .7); fx('arcane/rune-circle', t0 + .5, r.dst, { palette: 'blood', scale: 1.2 }); num(t0 + .7, r.dst, '被點名列管　受傷 ＋30%', 'text', { col: '#ffb0a0', px: 30, y: 1.5 }); num(t0 + 1.1, 'boss', '下一次只打他，而且很痛', 'text', { col: '#ff8a70', px: 30, y: .55 }); return t0 + 2.0; }
  if (r.kind === 'bossAoe') { const bh = home('boss'), th = t0 + 1.0; box(t0 + .1, 2.2, r.name, true); cam.to(t0, .5, { x: .3, d: 12.8, y: 1.45 }).to(t0 + 1.9, .5, WIDE); u.move(t0 + .3, -1.4, -.4, .45).anim(t0 + .3, 'swing', [0, .1, .22, .36, .5, .58, 1.3, 1.6]); snd(th, 'explosion', .8); cam.shake(th, .35, .7); SFX.add('flash', th, .3, { c: [255, 120, 100], a: .6 }); fx('impacts/ground-slam', th, [.9, -.3], { scale: 2.2, palette: 'blood' });
    r.hits.forEach((h, i) => applyHit(th + .04 + i * .06, h, { pow: 1.4, snd: i ? false : 'hit', dy: [-40, -130, -70, -170][i % 4] })); sideFx(r, th + .35); counters(r, th); u.move(t0 + 1.7, bh[0], bh[1], .5).pose(t0 + 2.2, 'idle'); return t0 + 2.4; }
  if (r.kind === 'foeAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, [hx, hz] = home(id), [tx, tz] = units[tgt].posAt(t0); box(t0, 1.3, R.KINDS[state.kind[id]].move + (r.heavy ? '（重擊）' : ''), true); const sk = 'foe_' + (R.KINDS[state.kind[id]].like || state.kind[id]);
    u.pose(t0 + .15, 'atk').move(t0 + .15, tx - .95, tz + .02, .2, easeOut); snd(t0 + .15, sfxOr(sk, 'whoosh'), buf[sk] ? .7 : .45); const th = t0 + .41; fx('impacts/blunt-hit', th, tgt, { y: .7, dx: -.2, scale: 1.2 });
    r.hits.forEach((h, i) => applyHit(th + i * .05, h, { pow: .9, snd: i ? false : undefined })); sideFx(r, th + .28); if (r.hits.taunted && r.hits[0] && !r.hits[0].miss) num(th - .2, r.hits[0].dst, '我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 }); counters(r, th); if (r.weak) num(t0 + .1, id, '詛咒中', 'text', { col: '#c9a0ff', px: 24, y: 1.2 }); u.move(th + .3, hx, hz, .28).pose(th + .62, 'idle'); return th + .95; }
  if (r.kind === 'foeHeal') { const th = t0 + .55, kd0 = state.kind[r.echo || id], kd = buf['foe_' + kd0] ? kd0 : R.KINDS[kd0].like || kd0; box(t0, 1.4, (r.echo ? '附議　' : '') + R.KINDS[kd0].move, true); if (r.echo) units[r.echo].hop(t0 + .05, .16, .3); u.pose(t0 + .15, 'atk').pose(t0 + 1.0, 'idle'); snd(t0 + .15, sfxOr('foe_' + kd, 'whoosh'), buf['foe_' + kd] ? .7 : .35); fx('holy/heal', th - .1, r.dst, { scale: r.dst === 'boss' ? 1.9 : 1.2, y: r.dst === 'boss' ? .6 : 0 }); snd(th, 'heal', .7);
    S.hp[r.dst].push({ t: th + .15, v: r.hp }); num(th + .15, r.dst, r.v, 'heal'); units[r.dst].hop(th + .2, .16, .3); return t0 + 1.4; }
  if (r.kind === 'foeStun') { box(t0, 1.2, '暈眩中　這次動不了', true); u.pose(t0 + .1, 'hit').pose(t0 + .9, 'idle'); fx('status/stunned', t0 + .1, id, { y: 1.5, scale: 1.2, dur: 1 }); num(t0 + .3, id, '暈眩', 'text', { col: '#ffe27a', px: 30, y: 1.3 }); return t0 + 1.2; }
  if (r.kind === 'echoMiss') { box(t0, 1.7, '附議落空　沒有人可以附和', true); u.pose(t0 + .2, 'hurt').pose(t0 + 1.2, 'idle'); num(t0 + .5, 'boss', '這次沒有行動', 'text', { col: '#ffe27a', px: 32, y: .55 }); snd(t0 + .3, 'break', .5); return t0 + 1.7; }
  if (r.kind === 'ultMiss') { box(t0 + .1, 2.2, '大招落空　專案沒有人做', true); cam.to(t0, .5, { x: -1.3, d: 11.4, y: 1.7 }).to(t0 + 1.7, .5, WIDE); u.anim(t0 + .2, 'swing', [0, .15, .35, 9, 9, 9, 9, 9]).pose(t0 + .95, 'hurt').pose(t0 + 1.8, 'idle'); snd(t0 + .95, 'break', .8); cam.shake(t0 + .95, .12, .4);
    num(t0 + 1.0, 'boss', '臨時專案倒了　大招放不出來', 'text', { col: '#ffe27a', px: 34, y: .55 }); return t0 + 2.3; }
  if (r.kind === 'wokBack') { const th = t0 + 1.25; box(t0 + .1, 2.6, '黑鍋彈回去了！', false); cam.to(t0, .5, { x: -.6, d: 12.0, y: 1.5 }).to(t0 + 2.2, .5, WIDE); u.anim(t0 + .25, 'swing', [0, .15, .35, .55, .7, .85, 1.6, 1.9]); units[r.dst].pose(t0 + .2, 'guard');
    fx('impacts/shield-block', th - .25, r.dst, { palette: 'cyber', scale: 1.6, y: .9 }); snd(th - .25, 'shield_block', 1.1); fx('impacts/parry', th - .2, r.dst, { scale: 2.0, palette: 'cyber', y: .9 }); SFX.add('flash', th - .2, .3, { c: [150, 240, 255], a: .6 }); num(th - .2, r.dst, '彈回去！', 'text', { col: '#9af0ff', px: 40, y: 1.5 });
    fx('impacts/crit-hit', th, 'boss', { y: 1.2, scale: 2.4, palette: 'blood' }); snd(th, 'explosion', 1); cam.shake(th, .4, .8); u.hit(th, 1.6, -1); u.pose(th, 'hurt'); S.hp.boss.push({ t: th, v: r.hp }); num(th, 'boss', r.v, 'crit'); S.shield.boss.push({ t: th, v: 0 }); S.stamps.push({ t: th, id: 'boss' }); snd(th + .1, 'break', .9); fx('status/stunned', th + .4, 'boss', { y: 2.35, dx: .45, scale: 2.2, dur: 4 });
    at(th + .9, () => { if (R.alive(state, 'boss')) u.pose(now, 'stun'); if (R.alive(state, r.dst)) units[r.dst].pose(now, 'guard'); }); return t0 + 2.8; }
  if (r.kind === 'stunned') { box(t0, 1.3, '理虧中　說不出話', true); u.pose(t0, 'stun').pose(t0 + 1.0, 'idle'); num(t0 + .9, 'boss', '底氣回復', 'text', { col: '#ffd0c8', y: .5 }); S.shield.boss.push({ t: t0 + .9, v: r.shield }); snd(t0 + .9, 'shield_up', .5); return t0 + 1.4; }
  if (r.kind === 'charge') { cam.to(t0, .6, { x: -1.3, d: 11.4, y: 1.7 }).to(t0 + 2.3, .5, WIDE); box(t0 + .2, 2.4, state.L.text.charge, true); u.anim(t0 + .3, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); snd(t0 + .3, 'boss_charge', 1); if (state.L.id === 'boss') say(t0 + .65, 'boss_attack', 'boss');
    fx('lightning/charge-up', t0 + .4, 'boss', { palette: 'blood', scale: 2.0, y: 2.2, dx: .2 }); SFX.add('vignette', t0 + .4, 2.2, { c: [220, 30, 30], a: .8, pulse: 14 }); SFX.add('embers', t0 + .4, 2.2, { c: [255, 80, 50], x0: 0, w: 260 }); cam.shake(t0 + 1.0, .08, 1.4);
    num(t0 + 1.4, 'boss', r.proj ? '打倒臨時專案，大招就落空' : state.L.brag ? '大招威力看底氣：削越多越不痛' : r.wok ? `鍋掛在${DEFS[r.wok].name}身上：防禦就彈回去` : r.sign ? '招牌全亮：我方用招式多扣 SP' : r.layers ? `加蓋到 ${r.layers} 層：用招式打他可以拆` : r.locks ? `屬性鎖 ${r.locks.map(t => R.TYPES[t]).join('、')}：打中一個，大招弱 25%` : '下一次行動：全體大傷害', 'text', { col: '#ff8a70', y: .5, px: 32 });
    if (r.moGain) { S.mo.push({ t: t0 + .9, v: r.mo }); num(t0 + .9, R.FRONT.find(h => R.alive(state, h)) || R.HEROES[0], `倒數桌曆　氣勢 ＋${r.moGain}`, 'text', { col: '#ffe27a', px: 28, y: 1.5 }); }
    if (r.wok) { num(t0 + 1.85, r.wok, '這鍋你背', 'text', { col: '#ffb060', px: 32, y: 1.45 }); at(t0 + 1.8, () => { if (R.alive(state, r.wok)) units[r.wok].hop(now, .2, .3); }); snd(t0 + 1.8, 'shield_block', .6); }
    if (r.called) popIn(r.called, t0 + 1.3); if (r.proj) { at(t0 + 1.75, () => { if (R.alive(state, r.proj)) units[r.proj].hop(now, .2, .3); }); num(t0 + 1.8, r.proj, '臨時專案', 'text', { col: '#ffb060', px: 32, y: 1.35 }); snd(t0 + 1.8, 'shield_up', .5); }
    return t0 + 2.8; }
  if (r.kind === 'bossAtk') { const tgt = (r.hits.find(h => h.guard) || r.hits[0]).dst, bh = home('boss'), [kx, kz] = home(tgt); box(t0 + .1, 2.2, r.name || (r.echo ? '附議　' + R.KINDS[state.kind[r.echo]].move : state.L.text.atk) + (r.heavy && !r.name ? '（重擊）' : ''), true); if (r.bward) num(t0 + 1.9, 'boss', `打完上護盾 ${r.bward}`, 'text', { col: '#ffb0a0', px: 30, y: .55 }); if (r.echo && R.alive(state, r.echo)) units[r.echo].hop(t0 + .1, .16, .3); cam.to(t0, .5, { x: -.2, d: 12.3, y: 1.5 });
    const ts = t0 + .3, th = ts + .58; u.move(ts, kx - 2.1, kz + .3, .45).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.3, 1.6]); snd(ts, state.L.id === 'audit' ? sfxOr('foe_audit', 'whoosh') : 'whoosh', .6); fx('melee/hammer-smash', th - .5, [kx - 1.2, kz + .1], { scale: 1.5, palette: 'blood' }); snd(th, 'explosion', .7); cam.shake(th, .3, .6); SFX.add('flash', th, .25, { c: [255, 120, 100], a: .6 });
    r.hits.forEach((h, i) => applyHit(th + .02 + i * .05, h, { pow: 1.6, snd: i ? false : 'hit' })); if (!r.hits[0].guard && !r.hits[0].cover && !r.hits[0].kill) units[tgt].move(th + .02, kx + .55, kz, .2, easeOut).move(th + 1.0, kx, kz, .3);
    if (r.hits.taunted && r.hits[0] && !r.hits[0].miss) num(th - .3, r.hits[0].dst, '我來！', 'text', { col: '#9af0ff', px: 28, y: 1.25 }); sideFx(r, th + .3); counters(r, th);
    u.move(ts + 1.3, bh[0], bh[1], .55).pose(ts + 1.9, 'idle'); cam.to(ts + 1.3, .6, WIDE); return ts + 2.1; }
  // 大招「無限改稿」
  const bh = home('boss'); box(t0 + .1, 3.0, state.L.text.ult, true); if (r.opened) num(t0 + .7, 'boss', `拆了 ${r.opened} 個鎖　威力 ${Math.round(r.pow * 100)}%`, 'text', { col: '#9af0ff', px: 34, y: .55 }); if (state.L.brag) num(t0 + .7, 'boss', `成果灌水　威力 ${Math.round(r.pow * 100)}%`, 'text', { col: r.pow <= .75 ? '#ffe27a' : '#ff8a70', px: 34, y: .55 }); cam.to(t0, .5, { x: .6, d: 13.2, y: 1.4 }); snd(t0 + .3, 'paper_storm', 1); SFX.add('papers', t0 + .3, 2.4, { n: 200 }); SFX.add('speed', t0 + .3, 2.3, { dir: 1, a: .3, n: 26 }); cam.shake(t0 + .4, .1, 2.0);
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
    R.MINIONS.forEach((m, i) => popIn(m, t1 + .8 + i * .32));
    at(t1 + 1.5, () => { syncGuard(now); num(now + .1, 'boss', state.L.guard ? '護衛中：不受傷害' : state.L.pot ? '找到人背鍋了' : '人手補上了', 'text', { col: '#ff9a8a', px: 32, y: .62 }); snd(now, 'shield_up', .7); }); te = t1 + 2.8; }
  else cam.to(te - .5, .5, WIDE);
  return te;
}

// ---------- 回合流程 ----------
let menu = null, focus = 0, lastOrder = '';
const NAME = new Proxy({}, { get: (_, f) => { if (f === 'boss') return DEFS.boss.name; if (!DEFS[f]) return undefined; const same = R.SLOTS.filter(m => R.MINIONS.includes(m) && DEFS[m].name === DEFS[f].name); return DEFS[f].name + (same.length > 1 ? ' ' + 'ABCD'[same.indexOf(f)] : ''); } });
function setOrder() { const list = [actor, ...state.queue].filter(id => id && R.alive(state, id)); const key = list.join(); if (key !== lastOrder) { lastOrder = key; S.order.push({ t: now, v: list }); } }
function nextTurn() {
  if (state.over) return finish();
  if (!state.queue.length) { R.startRound(state); box(now, 1.15, `第 ${state.round} 回合`); snd(now, 'card', .6); let te = now + .95;
    // 回合一開始先結算灼燒
    state.events.filter(e => e.kind === 'tempo').forEach(e => { S.mo.push({ t: now + .4, v: e.mo }); num(now + .4, R.FRONT.find(h => R.alive(state, h)) || R.HEROES[0], '準時開會　氣勢 ＋8', 'text', { col: '#ffe27a', px: 26, y: 1.45 }); });
    state.events.filter(e => e.kind === 'burn').forEach((e, i) => { const t = now + .55 + i * .3, big = e.dst === 'boss'; fx('explosions/small-explosion', t - .1, e.dst, { scale: big ? 1.5 : 1, y: big ? 1.0 : .3, palette: 'fire' }); num(t - .2, e.dst, '灼燒', 'text', { col: '#ff9a5a', px: 28, y: big ? .75 : 1.3 }); applyHit(t, { dst: e.dst, v: e.v, hp: e.hp, kill: e.kill }, { snd: 'hit', vol: .5 }); te = Math.max(te, t + .75); });
    state.events.filter(e => e.kind === 'poison').forEach((e, i) => { const t = now + .6 + i * .25, big = e.dst === 'boss'; num(t - .2, e.dst, '中毒', 'text', { col: '#b8e07a', px: 28, y: big ? .75 : 1.3 }); applyHit(t, { dst: e.dst, v: e.v, hp: e.hp, kill: e.kill }, { snd: 'hit', vol: .4 }); te = Math.max(te, t + .7); });
    state.events.filter(e => e.kind === 'rush').forEach(e => { num(now + .5, e.who, '急件插隊　最先動', 'text', { col: '#ff8a70', px: 28, y: 1.35 }); });
    state.events.filter(e => e.kind === 'hpoison').forEach((e, i) => { const t = now + .55 + i * .18; num(t - .15, e.dst, '中毒', 'text', { col: '#b8e07a', px: 26, y: 1.6 }); S.hp[e.dst].push({ t, v: e.hp }); num(t, e.dst, e.v, 'foe'); te = Math.max(te, t + .6); });
    state.events.filter(e => e.kind === 'regen').forEach((e, i) => { const t = now + .5 + i * .15; if (e.name) num(t - .05, e.dst, e.name, 'text', { col: '#e8dcc0', px: 24, y: 1.65 }); S.hp[e.dst].push({ t, v: e.hp }); num(t, e.dst, e.v, 'heal'); fx('holy/heal', t - .1, e.dst, { scale: 1.0 }); te = Math.max(te, t + .6); });
    state.events.filter(e => e.kind === 'passive').forEach((e, i) => { const t = now + .45 + i * .15, who = units[e.who] ? e.who : R.FRONT.find(h => R.alive(state, h)); num(t - .05, who, e.name, 'text', { col: '#e8dcc0', px: 24, y: 1.65, dx: e.who === 'vivi' ? -110 : 0 }); if (e.mo != null) S.mo.push({ t, v: e.mo }); if (e.sp != null) { S.sp[e.who].push({ t, v: e.sp }); num(t, e.who, e.v, 'sp'); } if (e.ward) num(t, e.who, `護盾 ${e.ward}`, 'text', { col: '#9af0ff', px: 28, y: 1.35 }); });
    phase = 'anim'; actor = state.queue[0]; setOrder(); actor = null; at(te, nextTurn); return; }
  const id = state.queue.shift(); if (!R.beginTurn(state, id)) return nextTurn();
  actor = id; setOrder(); S.active.push({ t: now, v: id });
  if (R.HEROES.includes(id)) { syncBars(now); units[id].pose(now, 'ready');
    if (id === 'kevin' && aegisFx.length) { endFx(aegisFx); goHome(now, 'kevin', .3); num(now + .1, 'kevin', '掩護結束', 'text', { col: '#9af0ff', px: 24, y: 1.2 }); }
    if (id === 'qiang' && bulwarkFx.length) { endFx(bulwarkFx); num(now + .1, 'qiang', '掩護結束', 'text', { col: '#ffc890', px: 24, y: 1.2 }); }
    phase = 'command'; pickTip(id); openMenu('root'); uiSound('move'); }
  else { phase = 'anim'; const r = R.enemyTurn(state, id), te = playFoe(r, now + .25); for (const h of r.hits || []) if (h && h.fxs) showFx(h.fxs, now + .9, h.dst); { const v = sumV(r.hits), dn = (r.hits || []).filter(h => h && h.kill).map(h => DEFS[h.dst].name); logStep(`${NAME[id]} ${r.kind === 'bossUlt' ? state.L.text.ult.replace('奧義　', '大招「') + '」' : r.kind === 'charge' ? '蓄力' : r.kind === 'stunned' ? '理虧，沒有行動' : r.kind === 'foeWard' ? '上護盾' : r.kind === 'bossMark' ? '補件通知（點名）' : r.kind === 'foeStun' ? '暈眩，沒有行動' : r.kind === 'echoMiss' ? '附議落空，沒有行動' : r.kind === 'ultMiss' ? '大招落空' : r.kind === 'foeHeal' ? `幫${NAME[r.dst]}回了 ${r.v}` : '攻擊'}` + (v ? `　我方 −${v}` : '') + (dn.length ? `　${dn.join('、')}倒下` : '')); } at(te, () => { S.active.push({ t: now, v: null }); nextTurn(); }); }
}
// 教學便條：第一次遇到某個狀況，輪到玩家下指令時在左上角貼一張（不擋中間），下完這一步就收起來。看過的記在 PREF.tips，之後不再出現
const TIPS = { basics: ['怎麼打', '攻擊、招式、防禦都會累積上方的「氣勢」，全隊共用。', '招式只花 SP。氣勢到 40、SP 也夠，「奧義」就會亮。'], ult: ['奧義可以放了', '放奧義會用掉 40 氣勢和自己的 SP。', '氣勢全隊共用，想清楚給誰放。'],
  charge: ['頭目在蓄力', '他下一次行動會打全體。', '現在防禦，或用坦克的招式、奧義擋下來。'], broken: ['頭目理虧了', '底氣歸零：他下一次行動取消。', '這段時間打他的傷害是 1.5 倍，趁現在全力打。'],
  guard: ['護衛中', '小兵還在場上時，打頭目沒有傷害。', '先把小兵清掉。'], pot: ['甩鍋', '課長每回合第一次被打，會甩給小兵承受。', '先用小招騙掉這一下，再放大招。'], audit: ['考績魔導士', '她的大招除了打全體，還會扣 40 氣勢。', '奧義亮了就放，不要存。'],
  parrot: ['鸚鵡長官', '他自己不出主意，只會「附議」一隻小兵，照抄那隻的行動。', '先打倒被附議的小兵，他那一次行動就落空。'], monkey: ['猴子長官', '他蓄力時會把大招丟給一隻小兵當「臨時專案」。', '在他放大招之前打倒那隻小兵，大招就落空。'],
  pig: ['豬腦長官', '他的大招威力看底氣：底氣全滿是 150%。', '蓄力之後多打他幾下，削到理虧只剩 50%。'],
  weak: ['弱點', '敵人頭上的兩格是弱點，一開始是「？」，用對屬性打中才會揭曉，之後永遠記得。', '打中弱點：傷害多三成、氣勢 ＋6，打頭目多削 1 點底氣。'], locks: ['屬性鎖', '頭目蓄力時頭上會出現三個屬性鎖。用那個屬性打中他一下，拆一個。', '每拆一個，大招弱 25%；三個全拆，大招取消、頭目理虧。'],
  hell_gate: ['補件通知', '人資長會先點名一個人（列管：受傷多三成），下一次只打他，而且是重擊，打完自己上護盾。', '被點名的人防禦、上護盾，或用「解除異常」清掉列管；坦克可以把攻擊引走。'], hell_archive: ['舊案回流', '主任開場和每次理虧恢復後，接下來兩次行動會先回血，而且下一次攻擊打全體又下毒。', '把傷害集中在理虧的時候打；中毒用「解除異常」清掉。'],
  hell_director: ['責任重新分配', '總監的血掉到七成、三成五時，下一次攻擊會變：前排有兩個人以上有護盾，就只打護盾最多的那個（很痛）；不然打全體。', '想讓坦克一個人扛，就先幫兩個人上護盾，並讓坦克的護盾最厚。'],
  tw_pot: ['這鍋你背', '課長蓄力時會把鍋掛在一個人身上，大招只打那個人，而且很痛。', '輪到背鍋的人時按「防禦」，鍋會彈回去，課長重傷又理虧。'], tw_night: ['加收服務費', '總監的招牌亮著時，我方每用一次招式多扣 10 SP。', '用普通攻擊打他三下，招牌就熄了；他下次蓄力才會再點亮。'],
  tw_roof: ['再加一層就好', '處長每行動一次就加蓋一層（最多三層），層數越多大招越痛。', '用招式打他，一招拆一層。'],
  mirror: ['鏡像內戰', '對面是自己人的鏡像，特長跟本人一樣：', '坦克普攻減半、補師會回血、小燕與黑輪扣 SP、阿傑打全體。'] };
let tipNow = null;
function pickTip(id) { const seen = PREF.tips || (PREF.tips = []), kinds = R.MINIONS.filter(m => R.alive(state, m) && state.kind[m] !== 'drone').map(m => 'k_' + state.kind[m]);
  const want = ['basics', run.map === 'mirror' && 'mirror', state.round >= 2 && 'weak', state.locks && state.charging && 'locks', state.charging && 'charge', state.broken && 'broken', R.guarded(state) && 'guard', S.pot() && 'pot', state.L && state.L.moDrain && 'audit', state.L && state.L.echo && 'parrot', state.L && state.L.proj && state.charging && 'monkey', state.L && state.L.brag && 'pig', state.L && state.L.notice && 'hell_gate', state.L && state.L.backlog && 'hell_archive', state.L && state.L.reassign && state.reassign && 'hell_director', state.L && state.L.wok && state.charging && 'tw_pot', state.L && state.L.fee && 'tw_night', state.L && state.L.layers && 'tw_roof', ...kinds.filter(k => R.KINDS[k.slice(2)].note), id !== 'vivi' && R.canUlt(state, id) && 'ult'].find(k => k && !seen.includes(k));
  if (!want) return (tipNow = null); seen.push(want); savePref(); const K = want.startsWith('k_') && R.KINDS[want.slice(2)]; tipNow = { t: performance.now(), title: K ? K.name : TIPS[want][0], lines: K ? [K.note + '。'] : TIPS[want].slice(1) }; }
function drawTip() { if (!tipNow || phase !== 'command') return; const k = Math.min(1, (performance.now() - tipNow.t) / 220), Wd = 590, X = W - Wd - 14 + (1 - k) * 40, Y = 142, rows = tipNow.lines.flatMap(l => wrap(l, Wd - 56, 22)), Hh = 74 + rows.length * 32;
  c.save(); c.globalAlpha = k; skin.paper(X, Y, Wd, Hh, { clips: [X + 60] }); c.fillStyle = RED; c.fillRect(X + 22, Y + 22, 7, 30); text(tipNow.title, X + 42, Y + 47, { px: 28, w: 900, fam: SERIF, col: INK, ls: 4 }); text('第一次遇到', X + Wd - 24, Y + 44, { px: 17, w: 700, align: 'right', col: INK2 });
  rows.forEach((l, i) => text(l, X + 28, Y + 86 + i * 32, { px: 22, w: 700, col: INK })); c.restore(); }
// 敵方意圖：輪到玩家下指令時，每個敵人頭上貼一張小紙條寫下一步（攻擊誰、補誰、蓄力、大招），底下一行是身上的狀態與還剩幾回合。內容來自 rules.js 的 intent()，跟實際行動一致
function drawIntents() { const placed = []; for (const f of R.foes(state)) { const it = R.intent(state, f); if (!it) continue; const [px, py] = S.proj(f, 1), who = t => t ? (DEFS[t].enemy ? NAME[t] : DEFS[t].name) : '隨機';
    const act = k => ({ atk: `攻擊${it.smoke ? '＋嗆煙' : ''} → ${who(it.target)}`, drain: `攻擊＋扣 SP → ${who(it.target)}`, heal: `補血 → ${who(it.target)}` })[k];
    const main = { ward: `上護盾 → ${who(it.target)}`, notice: `補件通知：點名${who(it.target)}（下一次只打他）`, atk: (it.re ? '責任重新分配：' : '') + (it.heavy ? '重擊' : '攻擊') + (it.smoke ? '＋嗆煙' : it.hex ? '＋' + it.hex : '') + ` → ${who(it.target)}` + (it.then ? `（${it.then}）` : ''), drain: act('drain'), aoe: (it.re ? '責任重新分配：' : '') + '攻擊全體' + (it.hex ? '＋' + it.hex : ''), heal: act('heal'), charge: '下一步：蓄力', stun: '理虧　這次動不了',
      ult: it.locks ? `大招：打全體（鎖還剩 ${it.locks.length} 個）` : it.wok ? `大招：只打${DEFS[it.wok].name}（他防禦就彈回去）` : it.proj || it.lost ? (it.lost ? '大招落空（專案沒人做）' : `大招：打全體（打倒${NAME[it.proj]}可阻止）`) : it.pow != null ? `大招：打全體（威力 ${Math.round(it.pow * 100)}%）` : '大招：打全體',
      echo: it.lost ? `附議落空（${NAME[it.echo]}已倒）` : `附議${NAME[it.echo]}：${act(it.act)}` }[it.kind] + (it.weak ? '（攻↓）' : '');
    const col = it.kind === 'heal' ? '#1f6a5c' : it.kind === 'stun' ? INK2 : RED, hot = it.kind === 'ult' || it.kind === 'charge', wkn = knownWeak(f), wkAll = R.weakOf(state, f), cw = wkAll.length * 40 + (wkAll.length ? 10 : 0), w = mw(main, 24, 900) + 30, x = Math.max(8, Math.min(W - w - cw - 8, px - (w + cw) / 2)); let y = Math.max(96, py - 86);
    while (placed.some(q => x < q[0] + q[2] + 8 && x + w + cw + 8 > q[0] && y < q[1] + 70 && y + 70 > q[1]) && y > 100) y -= 24; placed.push([x, y, w + cw]);      // 紙條不互相蓋住
    skin.paper(x, y, w, 40, { old: it.kind === 'stun' }); if (hot) { c.fillStyle = '#6e1c16'; c.fillRect(x + 3, y + 3, w - 6, 34); } text(main, x + 15, y + 29, { px: 24, w: 900, col: hot ? '#fff0e0' : col });
    wkAll.forEach((_, q) => typeChip(wkn[q] || null, x + w + 8 + q * 40, y + 2, 36));      // 弱點兩格：知道的寫屬性，不知道的是「？」
    if (it.locks) { const n0 = it.lockN, lx = x + (w + cw) / 2 - n0 * 23; for (let q = 0; q < n0; q++) { const t = it.locks[q]; if (t) typeChip(t, lx + q * 46, y - 48, 40); else { c.fillStyle = '#1c120c'; c.fillRect(lx + q * 46 - 2, y - 50, 44, 44); c.fillStyle = '#2f5c50'; c.fillRect(lx + q * 46, y - 48, 40, 40); text('✓', lx + q * 46 + 20, y - 18, { px: 30, w: 900, align: 'center', col: '#bff0dc' }); } } }
    const tags = []; if (state.burn[f] > 0) tags.push(`灼燒 ${state.burn[f]}`); if (state.mark[f] > 0) tags.push(`標記 ${state.mark[f]}`); if (state.atkDown[f] > 0) tags.push(`攻↓ ${state.atkDown[f]}`); if (state.poison[f] && state.poison[f].n > 0) tags.push(`中毒 ${state.poison[f].n}`); if (f !== 'boss' && state.stun[f]) tags.push('暈眩'); if (state.fward[f] > 0) tags.push(`護盾 ${state.fward[f]}`); if (it.re) tags.push('前排兩人以上有護盾 → 只打護盾最多的人；不然打全體'); if (f !== 'boss' && R.KINDS[state.kind[f]].armor) tags.push('裝甲'); if (f !== 'boss' && R.KINDS[state.kind[f]].dull) tags.push('招式減半');
    if (f === state.proj && state.charging) tags.push('臨時專案：打倒他，大招落空'); if (f !== 'boss' && f === state.echo && (R.intent(state, 'boss') || {}).kind === 'echo') tags.push('被附議中：打倒他，頭目這次落空');
    if (f === 'boss' && state.L.brag && !state.broken) tags.push(`大招威力 ${Math.round(R.bragPow(state) * 100)}%`);
    if (f === 'boss' && state.L.fee) tags.push(state.sign > 0 ? `招牌亮著：招式多扣 ${state.L.fee} SP（普攻再 ${state.sign} 下打熄）` : '招牌熄了'); if (f === 'boss' && state.L.layers) tags.push(`加蓋 ${state.layers} 層：大招 ${Math.round(R.roofPow(state) * 100)}%，用招式打他拆一層`);
    if (f === 'boss' && !state.broken && state.shield > 0) tags.push(`再削 ${state.shield} 點底氣就理虧`); if (f === 'boss' && state.broken) tags.push('理虧中：受傷加倍');
    if (tags.length) { const tl = tags.join('　'), tw = mw(tl, 20, 900); text(tl, Math.max(8 + tw / 2, Math.min(W - 8 - tw / 2, x + (w + cw) / 2)), y + 64, { px: 20, w: 900, align: 'center', col: '#ffe9c0', stroke: 'rgba(20,10,4,.85)', sw: 5 }); } }
  // 我方每個人頭上的狀態（護盾、再生、攻擊提升、嗆到、背鍋、吸引攻擊）
  for (const h of R.FRONT) { if (!R.alive(state, h)) continue; const ls = []; if (state.wok === h && state.charging) ls.push(['背鍋中：防禦就彈回去', '#ffcf8a']); if (state.ward[h] > 0) ls.push([`護盾 ${state.ward[h]}`, '#9af0ff']); if (state.up[h] > 0) ls.push([`攻↑ ${state.up[h]}`, '#ffb0d0']); if (state.regen[h] && state.regen[h].n > 0) ls.push([`再生 ${state.regen[h].n}`, '#a8f0b0']); if (R.smoked(state, h)) ls.push(['嗆到：普攻減半', '#dfe8b8']); if (state.hmark[h] > 0) ls.push([`列管 ${state.hmark[h]}：受傷 ＋30%`, '#ffb0a0']); if (state.hpoison[h] && state.hpoison[h].n > 0) ls.push([`中毒 ${state.hpoison[h].n}`, '#b8e07a']); if (state.guardian === h) ls.push(['吸引攻擊中', '#9af0ff']);
    const [px, py] = S.proj(h, 1); ls.forEach(([tx, col], q) => text(tx, px, py - 58 - q * 28, { px: 22, w: 900, align: 'center', col, stroke: 'rgba(20,10,4,.9)', sw: 5 })); } }
// 這一場最後幾步的紀錄（輸的時候放進結案報告）
let lastLog = [];
const logStep = s => { lastLog.push(`回合 ${state.round}｜${s}`); if (lastLog.length > 6) lastLog.shift(); }, sumV = hs => (hs || []).reduce((a, h) => a + (h && h.v > 0 ? h.v : 0), 0);
function act(r) {      // 玩家選完，演出然後換下一個
  { const nm = DEFS[r.id].name, what = r.kind === 'attack' ? '攻擊' : r.kind === 'skill' ? `「${r.name}」` : r.kind === 'unite' ? `合體技「${r.name}」` : r.kind === 'ult' ? `奧義「${DEFS[r.id].skill}」` : r.kind === 'defend' ? '防禦' : r.kind === 'item' ? `用了${R.ITEMS[r.key].name}` : '應援', v = sumV(r.hits); logStep(`${nm} ${what}` + (v ? `　打 ${v}` : '')); }
  phase = 'anim'; menu = null; tipNow = null; const t0 = now + .12;
  showFx(r.fxs, t0 + .7, r.id); for (const h of r.hits || []) if (h && h.fxs) showFx(h.fxs, t0 + .9, r.id);
  if (r.fee) num(t0 + .12, r.id, `服務費　SP －${r.fee}`, 'text', { col: '#8fc0ff', px: 28, y: 1.55 });
  const te = r.kind === 'attack' ? playAttack(r, t0) : r.kind === 'defend' ? playDefend(r, t0) : r.kind === 'cheer' ? playCheer(r, t0) : r.kind === 'item' ? playItem(r, t0) : r.kind === 'skill' ? playSkill(r, t0) : r.kind === 'unite' ? playUnite(r, t0) : playUlt(r, t0);
  at(te, () => { syncBars(now); syncGuard(now); for (const id of [...R.HEROES, 'boss', ...R.MINIONS]) if (S.hp[id].at(-1).v !== state.hp[id]) S.hp[id].push({ t: now, v: state.hp[id] }); S.active.push({ t: now, v: null }); nextTurn(); });
}
// 指令選單的內容。每個按鈕：{ label, sub, off（不能按的原因）, go, target（要在誰頭上畫箭頭）, hint }
function openMenu(kind, arg) {
  const id = actor, d = DEFS[id], skills = R.SKILLS[id].filter(k => R.knows(state, id, k.key)), back = { label: '返回', sub: '', go: () => openMenu('root'), back: true }; let items = [];
  if (kind === 'root') {
    const needBp = state.mo < R.ultMo(run), needSp = state.sp[id] < R.STAT[id].cost, anyItem = Object.keys(R.ITEMS).some(k => state.items[k] > 0 && R.itemTargets(state, k).length), anySk = skills.some(k => R.skillOk(state, id, k));
    items = [id === 'vivi' ? { label: '應援', sub: `氣勢 ＋${R.MO.cheer}`, go: () => act(R.doCheer(state)), hint: `幫全隊加氣勢。氣勢到 ${R.ultMo(run)} 就能放奧義，全隊共用。` } : { label: '攻擊', sub: `${R.TYPES[R.ATK_TYPE[id]]}屬性・回 SP`, go: () => openMenu('target'), hint: `普攻附帶：${R.RIDER[id]}。` + (R.guarded(state) ? '小兵還在的時候打不到魔王。' : S.pot() ? '課長每回合被打的第一下會甩給小兵。' : '') },
      { label: '技能', sub: anySk ? skills.map(k => k.name).join('、') : skills.length ? '現在用不了' : '還沒學會', off: !anySk, go: () => openMenu('skills'), hint: '各自的招式：只花 SP，不用氣勢。' },
      { label: '奧義', sub: needBp ? `氣勢 ${state.mo}／${R.ultMo(run)}` : needSp ? 'SP 不足' : `${d.skill}　SP ${R.STAT[id].cost}`, off: needBp || needSp, go: () => act(R.doUlt(state, id)), hint: d.desc, gold: !needBp && !needSp },
      { label: '道具', sub: anyItem ? '補血、補 SP、復活' : '現在用不到', off: !anyItem, go: () => openMenu('items'), hint: '珍珠奶茶補 HP，黑咖啡補 SP，雞排便當讓倒下的同伴復活。' },
      { label: '防禦', sub: '受傷減半', go: () => act(R.doDefend(state, id)), hint: `到自己下一次行動前受到的傷害減半，氣勢 ＋${R.MO.defend}。` }];
  } else if (kind === 'target') { const sk = arg, bk = sk ? { ...back, go: () => openMenu('skills') } : back, blocked = R.guarded(state) && !(sk && sk.pierce), pot = S.pot() && !(sk && sk.pierce);      // arg＝招式（沒有就是普通攻擊）
    items = R.foes(state).filter(f => f !== 'boss').concat(R.alive(state, 'boss') ? ['boss'] : []).map(f => ({ label: NAME[f], sub: (f === 'boss' ? (blocked ? '護衛中　傷害無效' : pot ? '甩鍋中　第一下小兵背' : `HP ${Math.ceil(state.hp.boss / R.STAT.boss.hp * 100)}%`) : `HP ${state.hp[f]}`) + (() => { const pv = R.preview(state, id, f, sk && sk.key), wk = isKnownWeak(f, sk ? sk.type : R.ATK_TYPE[id]); return pv ? ` 約−${wk ? Math.round(pv * 1.3) : pv}${wk ? '　弱點' : ''}` : ''; })(), wk: isKnownWeak(f, sk ? sk.type : R.ATK_TYPE[id]), warn: f === 'boss' && blocked, target: f, go: () => act(sk ? (sk.unite ? R.doUnite(state, id, sk.key, f) : R.doSkill(state, id, sk.key, f)) : R.doAttack(state, id, f)) })); items.push(bk);
  } else if (kind === 'skills') { items = skills.map(k => { const pv = k.target === 'all' && R.foes(state).length ? R.preview(state, id, R.foes(state).find(f => f !== 'boss') || 'boss', k.key) : null; return ({ label: k.name + (R.isPlus(run, id, k.key) ? '＋' : ''), sub: `${k.type ? '〔' + R.TYPES[k.type] + '〕' : ''}SP ${R.skCost(run, id, k)}${state.L && state.L.fee && state.sign > 0 ? '＋' + state.L.fee : ''}　${k.note}` + (pv ? `　每個約 ${pv}` : ''), off: !R.skillOk(state, id, k), hint: k.desc, go: () => k.target === 'foe' ? openMenu('target', k) : k.target === 'ally' ? openMenu('allySkill', k) : act(R.doSkill(state, id, k.key)) }); });
    for (const U of R.unitesOf(id)) { const ok = R.uniteOk(state, id, U), mates = U.who.filter(h => h !== id), acted = mates.find(h => R.alive(state, h) && !state.queue.includes(h)), poor = U.who.find((h, q) => state.sp[h] < R.uniteCost(run, U, q));
      items.push({ label: U.name, unite: true, gold: ok, sub: `合體・${mates.map(h => DEFS[h].name).join('、')}　SP ${U.who.map((h, q) => R.uniteCost(run, U, q)).join('／')}`, off: !ok, hint: `【合體技】${U.desc}（${U.who.map(h => DEFS[h].name).join('、')}的行動都用掉）` + (ok ? '' : mates.some(h => !R.alive(state, h)) ? '　夥伴倒下了。' : acted ? `　${DEFS[acted].name}這回合已經動過了。` : poor ? `　${DEFS[poor].name}的 SP 不夠。` : ''), go: () => U.target === 'foe' ? openMenu('target', { ...U, unite: true }) : act(R.doUnite(state, id, U.key)) }); }
    items.push(back);
  } else if (kind === 'allySkill') { items = R.allyTargets(state, id, arg).map(h => ({ label: DEFS[h].name, sub: arg.ally === 'sp' ? `SP ${state.sp[h]}／${R.STAT[h].sp}` : `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doSkill(state, id, arg.key, h)) })); items.push({ ...back, go: () => openMenu('skills') });
  } else if (kind === 'items') { items = Object.keys(R.ITEMS).map(k => { const it = R.ITEMS[k], ok = state.items[k] > 0 && R.itemTargets(state, k).length; return { label: it.name, sub: `${it.note}　×${state.items[k]}` + (run.ot >= 1 ? `（這場還能用 ${R.itemsLeft(state)} 次）` : ''), off: !ok, go: () => openMenu('ally', k) }; }); items.push(back);
  } else if (kind === 'ally') { items = R.itemTargets(state, arg).map(h => ({ label: DEFS[h].name, sub: R.ITEMS[arg].sp ? `SP ${state.sp[h]}／${R.STAT[h].sp}` : `HP ${state.hp[h]}／${R.STAT[h].hp}`, target: h, go: () => act(R.doItem(state, id, arg, h)) })); items.push({ ...back, go: () => openMenu('items') }); }
  menu = { kind, items }; focus = Math.max(0, items.findIndex(i => !i.off));
}
// 進一關：換頭目、擺好敵人與我方站位、把畫面上的血條等軌道重設成這一關的狀態
const resetUnit = (u, vis, pose) => { u.dead = null; u.poseK.length = 0; u.moveK.length = 0; u.hitK.length = 0; u.hopK.length = 0; u.showK = [{ t: -1e9, v: vis }]; if (pose) u.pose(-1e9, pose); };
// 前排站位（依人數）；Vivi 固定在後排
const FORM = { 1: [[2.3, -.2]], 2: [[1.7, -1.0], [3.0, .5]], 3: [[1.4, -1.5], [2.4, -.3], [3.5, .9]], 4: [[1.4, -1.6], [2.25, -.5], [3.35, .5], [4.25, 1.5]] }, BACK = [5.55, -.55];
function enterStage() {
  const st = R.STAGES[R.stageOf(run, run.node)], L = st.boss; todo.length = 0; lastLog = []; for (const f of [...aegisFx, ...bulwarkFx]) f.end = now - f.o.t; aegisFx = []; bulwarkFx = [];
  if (L && L.hero) mirrorBoss(L.hero); for (const m of R.SLOTS) { const K = R.KINDS[state.kind[m]]; if (K.hero) mirrorMinions(K.hero); }
  for (const u of [bossU, chiefU, auditU, ...Object.values(eliteU), ...Object.values(mirrorBossU)]) if (u) resetUnit(u, false, 'idle');
  units.boss = (L && (L.hero ? mirrorBossU[L.hero] : { chief: chiefU, audit: auditU, ...eliteU }[eliteU[L.id] ? L.id : L.like || L.id])) || bossU; if (L) { resetUnit(units.boss, true, 'idle'); DEFS.boss.name = L.name; DEFS.boss.hp = L.hp; DEFS.boss.pos = units.boss.home.slice(); A.face.boss = L.hero && A.face[L.hero] ? A.face[L.hero] : Object.keys(eliteU).some(k => eliteU[k] === units.boss) ? eliteFace[Object.keys(eliteU).find(k => eliteU[k] === units.boss)] : units.boss === chiefU ? A.faceChief : units.boss === auditU ? A.faceAudit : A.faceBoss; }
  // 敵人站的位置：平常第三個人站後面中間；有頭目又帶三四個手下的時候（鏡像 Vivi），第三、第四個站到頭目的左前、左後
  const SPOT = L && R.MINIONS.length > 2 ? { mc: [-3.55, 1.5], md: [-3.6, -1.65] } : { mc: [-2.7, -.3], md: [-3.7, 1.4] };
  for (const m of R.SLOTS) { for (const k in minionU) resetUnit(minionU[k][m], false, 'idle'); const want = state.kind[m], like = R.KINDS[want].like, kind = minionU[want] ? want : minionU[like] ? like : 'drone'; units[m] = minionU[kind][m]; DEFS[m].name = R.KINDS[state.kind[m]].name; A.face[m] = minionFace[kind]; if (SPOT[m]) { DEFS[m].pos = SPOT[m].slice(); units[m].home = SPOT[m].slice(); } }
  for (const m of R.SLOTS) { resetUnit(units[m], R.MINIONS.includes(m), 'idle'); S.hp[m] = [{ t: -1, v: state.hp[m] }]; S.shield[m] = [{ t: -1, v: 2 }]; delete minionShield[m]; }
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
  playMusic(R.isFinal(run) && buf['bgm/boss'] ? 'bgm/boss' : 'bgm/battle');      // 魔王那一站換魔王曲（使用者的歌：一般戰鬥〈月底吃土〉、魔王〈幽靈舞步〉）
  phase = 'anim'; const st = R.STAGES[R.stageOf(run, run.node)], L = st.boss, t0 = now + .1, seenIt = (PREF.seen || (PREF.seen = [])).includes(R.stageOf(run, run.node)); if (seenIt) introBoost = t0 + 4.3; else { PREF.seen.push(R.stageOf(run, run.node)); savePref(); } SFX.add('encounter', t0, 1.3); snd(t0 + .05, 'encounter'); S.stageCard = { t0: t0 + 1.0, t1: t0 + 3.5, n: run.floor + 1, name: st.name, sub: st.sub };
  if (L && L.id === 'boss') { cam.to(t0 - .01, 0, { x: -3.0, y: 1.9, z: -.5, d: 7.2, pitch: 3, blur: 10 }).to(t0 + .7, 2.6, { d: 8.4, y: 1.75 }, easeOut); snd(t0 + 1.15, 'boss_appear'); cam.shake(t0 + 1.2, .16, .6);
    units.boss.anim(t0 + 1.9, 'swing', [0, .1, .22, .38, 9, 9, 9, 9]).pose(t0 + 3.2, 'idle'); if (!seenIt) say(t0 + 1.95, 'boss_intro', 'boss'); cam.shake(t0 + 2.25, .2, .9); SFX.add('lines', t0 + 2.25, .9, { cx: 190, cy: 120, c: [255, 120, 100], a: .55, r0: 150 }); }
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
// 開局先選路線（網址加 ?map=office 或 ?map=mirror 就跳過這一步，測試用）
let mapKey = 'office';
function start() { AC.resume(); playMusic('bgm/map'); saved = null; if (Q.has('map')) { mapKey = R.MAPS[Q.get('map')] ? Q.get('map') : 'office'; return pickStarter(); }
  openCards({ title: '今天走哪一條路線？', sub: '招募、休息、事件每條路線都有；差別在對手、站數和岔路。', foot: '選一條路線', items: [
    { label: '一般行程', tag: '討伐奧客總經理', icon: 'boss', big: true, lines: ['十站', '社畜小兵、甩鍋課長、奧客總經理', '第一次玩選這個'], go: () => { mapKey = 'office'; pickOt(); } },
    { label: '台灣篇', tag: '颱風天，照常上班', icon: 'chief', big: true, lines: ['十二站，三條支線', '廟埕燈會、不夜城夜市、頂樓加蓋', '比一般行程難一點'], go: () => { mapKey = 'taiwan'; pickOt(); } },
    { label: '地獄分公司', tag: '離職申請處理中', icon: 'elite', big: true, lines: ['十三站，三條支線選了就走到底', '敵人會上護盾、下毒、點名列管', '難；有補給站和免費特訓'], go: () => { mapKey = 'hell'; pickOt(); } },
    { label: '鏡像內戰', tag: '難度很高', icon: 'elite', big: true, lines: ['十站', '對面站的是自己人的鏡像', '最後是鏡像 Vivi，帶著阿傑和小葵'], go: () => { mapKey = 'mirror'; pickOt(); } }] }); }
// 加班等級：通關過的地圖可以選更難的版本（每通關一次最高等級多解鎖一級）
let otKey = 0;
function pickOt() { const mx = Math.min(R.OT_MAX, (PREF.ot || {})[mapKey] || 0); otKey = 0; if (!mx) return pickStarter(); const lv = [...new Set([0, mx > 1 ? mx - 1 : null, mx].filter(v => v != null))];
  openCards({ title: '今天要加班到幾級？', sub: '加班等級越高，對我方不利的規則越多（往上累加）。通關最高等級會再解鎖下一級。', foot: '選一個', items: lv.map(v => ({ label: v ? `加班等級 ${v}` : '準時下班', tag: v ? `共 ${v} 條規則` : '正常難度', icon: v ? 'elite' : 'rest', big: true, lines: v ? R.OVERTIME.slice(Math.max(0, v - 3), v).map(o => `${o[0]}：${o[1]}`) : ['沒有額外規則'], go: () => { otKey = v; pickStarter(); } })) }); }
function pickStarter() {
  openCards({ title: '今天誰先去上班？', sub: '從一個人開始。路上會遇到同事，最多帶四個人上場。', foot: '選一位主角', items: R.STARTERS.map(id => heroCard(id, () => pickSkill(id), true)) }); }
function pickSkill(id) { openCards({ title: `${DEFS[id].name}的第一招`, sub: '三個招式先帶一個。其他的之後可以靠強化「在職進修」學會。', foot: '選一個招式就出發', items: R.SKILLS[id].map(k => ({ label: k.name, tag: `SP ${k.sp}　${k.note}`, icon: 'sk_' + k.key, lines: [k.desc], go: () => beginRun(id, k.key) })) }); }
// 測試用：網址加 ?stage=chief 或 ?floor=5（第幾站）直接跳過去，隊伍用 ?team=kevin,mi
function beginRun(id, key) { run = R.newRun(RAND, id, key, mapKey, Q.has('ot') ? +Q.get('ot') : otKey); if (Q.has('stage') || Q.has('floor')) { const f = Q.has('floor') ? Math.min(R.MAP.length - 1, +Q.get('floor') - 1) : R.MAP.findIndex(fl => fl.some(nd => nd.stage === Q.get('stage') || (nd.pool || []).includes(Q.get('stage')))); { const nd = Q.has('stage') && R.MAP.flat().find(nd => (nd.pool || []).includes(Q.get('stage'))); if (nd) run.alt[nd.stage] = Q.get('stage'); } if (f > 0) { for (const h of (Q.get('team') || 'kevin,mi,vivi').split(',')) if (units[h]) R.join(run, h); run.floor = f; for (let k = 0; k < f; k++) run.path[k] = 0; } }
  R.prepare(run); snd(now, 'buff', .8); openHub(`${DEFS[id].name}出發，第一招「${R.SKILLS[id].find(k => k.key === key).name}」`); }
function openRecruit(i) { const nd = run.node, list = (run.offers[run.floor] || {})[i] || []; if (!list.length) { R.advance(run); return openHub('名冊已經滿了，這一站沒有人可以帶'); }
  openCards({ title: nd.name, sub: '選一位同事同行。' + (run.roster.length >= 4 ? '出戰最多四人，多的人當候補，可以在行程表調整順序。' : ''), foot: '選完回到行程表', items: list.map(id => heroCard(id, () => { R.join(run, id); met(id); snd(now, 'buff', .8); R.advance(run); openHub(`${DEFS[id].name}加入隊伍`); })) }); }
// 事件站：抽到的事件攤開成兩張選項卡，代價與好處都寫在卡上；選不了的（東西不夠）是舊紙
function openEvent() { const key = run.events[run.floor], ev = R.EVENTS[key];
  openCards({ title: ev.name, sub: ev.text, foot: '選一個，選完回到行程表', items: ev.opts.map((o, j) => ({ label: o.label, icon: o.icon, lines: o.lines, big: true, off: !R.eventOk(run, key, j), go: () => { const msg = R.applyEvent(run, key, j); if (msg == null) return; snd(now, 'buff', .8); R.advance(run); openHub(`${ev.name}：${msg}`); } })) }); }
// 休息站二選一：休息（回血、補 SP），或特訓（三個招式挑一個升級成「＋」：傷害與回復量 ＋25%、SP 消耗 －20%，每招一次）
function openRest(nd, free) { const place = nd.name || '茶水間', tr = R.offerTrain(run), hurt = run.roster.filter(id => id !== 'vivi').reduce((a, id) => a + (R.STAT[id].hp - run.hp[id]), 0);
  const rest = () => { const v = R.rest(run); snd(now, 'heal', .8); R.advance(run); openHub(v > 0 ? `在${place}休息：全隊共回復 ${v} HP，SP 補滿` : `在${place}休息：SP 補滿（HP 本來就是滿的）`); };
  const train = () => openCards({ title: free ? place : '特訓', sub: '挑一個招式升級成「＋」（每個招式只能升一次）：', foot: '選完回到行程表', items: tr.map(([id, key]) => { const k = R.SKILLS[id].find(q => q.key === key); return { label: k.name + '＋', tag: `${DEFS[id].name}　SP ${k.sp} → ${Math.ceil(k.sp * .8)}`, icon: 'sk_' + key, lines: [k.desc, '傷害與回復量 ＋25%'], go: () => { R.applyTrain(run, id, key); snd(now, 'buff', .8); R.advance(run); openHub(`特訓完成：${DEFS[id].name}的「${k.name}」升級成「${k.name}＋」`); } }; }) });
  if (free) { if (tr.length) return train(); for (const id of run.roster) run.sp[id] = Math.min(R.STAT[id].sp, run.sp[id] + 40); R.advance(run); return openHub(`${place}：招式都升級過了，全員 SP ＋40`); }
  if (!tr.length) return rest();
  openCards({ title: place, sub: '休息一下，還是趁空檔練一招？只能選一個。', foot: '選一個', items: [
    { label: '休息', tag: '回血、補 SP', icon: 'rest', big: true, lines: ['全員 HP 回復一半', '全員 SP 補滿', hurt > 0 ? `現在全隊少了 ${hurt} HP` : '現在大家都是滿血'], go: rest },
    { label: '特訓', tag: '升級一個招式', icon: 'up_learn', big: true, lines: ['三個招式挑一個升級成「＋」', '傷害、回復量 ＋25%', 'SP 消耗 －20%；這一站不回血'], go: train }] }); }
function openUpgrade(gift) { const offers = R.offerUpgrades(run);
  openCards({ title: gift ? '福委會' : '過關獎勵', sub: gift ? '這個月的福利，選一個：' : (rescued ? `救出了${DEFS[rescued].name}！` : '') + '全員回復兩成五 HP、三成 SP，倒下的人也站起來了。再選一個強化：', foot: '選完回到行程表', items: offers.map(k => { const U = R.UPGRADES[k], who = (U.need || []).filter(id => run.roster.includes(id)).map(id => DEFS[id].name); return { label: U.name, tag: [R.UP_TAG[k], who.length ? `配合${who.join('、')}的招式` : ''].filter(Boolean).join('　'), icon: 'up_' + k, lines: U.desc.split('，'), big: true, go: () => pickUpgrade(k) }; }) }); }
function pickUpgrade(k, opt) {
  if (k === 'learn' && !opt) { const u = R.unlearned(run), id = run.starter; if (u.length > 1) return openCards({ title: '在職進修', sub: `${DEFS[id].name}要學哪一招？`, foot: '選一個招式，選完回到行程表', items: R.SKILLS[id].filter(q => u.includes(q.key)).map(q => ({ label: q.name, tag: `SP ${q.sp}　${q.note}`, icon: 'sk_' + q.key, lines: [q.desc], go: () => pickUpgrade(k, q.key) })) }); }
  R.applyUpgrade(run, k, opt); snd(now, 'buff', .8); R.advance(run); const r = rescued; rescued = null; openHub((k === 'learn' ? `${DEFS[run.starter].name}學會「${R.SKILLS[run.starter].find(q => q.key === run.skills[run.starter].at(-1)).name}」` : `拿到強化「${R.UPGRADES[k].name}」`) + (r ? `　${DEFS[r].name}加入隊伍` : '')); }

// ---------- 大地圖（行程表）：攤在會議桌上的公司剖面圖。選下一站、調整隊伍順序、看道具強化與夥伴名冊 ----------
let hubMsg = null, hubSel = -1, sheet = null, panel = false, panelTab = 0, sheetReal = false, sheetFlipT = -1e9, sheetRect = null, drag = null;      // sheet＝正在看資料卡的那個人；panel＝「隊伍與道具」選單開著（行程表和戰鬥中都叫得出來）；sheetReal＝資料卡的立繪滑到原型那一張
function hubItems() { const fl = R.MAP[run.floor], ok = R.reachable(run), items = fl.map((nd, i) => ({ label: R.nodeName(nd, run), node: i, off: !ok.includes(i), go: () => { if (hubSel === i) chooseNode(i); else hubSel = i; } }));
  items.push({ label: '出發', depart: true, get off() { return hubSel < 0; }, go: () => chooseNode(hubSel) });
  items.push({ label: '隊伍與道具', panelBtn: true, go: openPanel });
  return items; }
// 資料卡：素質、招式、奧義。這一輪同行的人可以用「上一位／下一位」翻；名冊裡沒同行的人只看基本資料
// 「隊伍與道具」選單：隊伍順序（只有在行程表能調）、每個人的資料卡、道具、強化、夥伴名冊。行程表與戰鬥中輪到自己時都能叫出來
const inBattle = () => phase !== 'hub', curHp = id => inBattle() && R.HEROES.includes(id) ? Math.max(0, state.hp[id]) : run.hp[id], curSp = id => inBattle() && R.HEROES.includes(id) ? state.sp[id] : run.sp[id];
function panelItems() { const items = [];
  if (!inBattle()) run.roster.forEach((id, r) => { if (r > 0) items.push({ label: '上移', re: r, d: -1, go: () => { R.reorder(run, r, -1); refreshPanel(); } }); if (r < run.roster.length - 1) items.push({ label: '下移', re: r, d: 1, go: () => { R.reorder(run, r, 1); refreshPanel(); } }); });
  run.roster.forEach((id, r) => items.push({ label: '資料', view: id, row: r, go: () => openSheet(id) }));
  for (const t of [0, 1]) items.push({ label: t ? '夥伴名冊' : '道具與強化', tab: t, go: () => { panelTab = t; refreshPanel(); focus = menu.items.findIndex(m => m.tab === t); } });
  if (panelTab === 1) for (const id of DEX) if ((PREF.met || []).includes(id)) items.push({ label: '資料', view: id, dex: true, go: () => openSheet(id) });
  items.push({ label: '關閉', back: true, go: closePanel }); return items; }
const refreshPanel = () => { const f = focus; menu = { kind: 'panel', items: panelItems() }; focus = Math.min(f, menu.items.length - 1); };
function openPanel() { panel = true; panelTab = 0; menu = { kind: 'panel', items: panelItems() }; focus = menu.items.length - 1; }
function closePanel() { panel = false; if (phase === 'hub') { menu = { kind: 'hub', items: hubItems() }; focus = 0; } else openMenu('root'); }
const sheetList = () => run.roster.includes(sheet) ? run.roster : DEX.filter(id => (PREF.met || []).includes(id));
function openSheet(id) { sheet = id; menu = { kind: 'sheet', items: [{ label: '上一位', go: () => stepSheet(-1) }, { label: '下一位', go: () => stepSheet(1) }, { label: '返回', back: true, go: closeSheet }, { label: '換立繪', go: () => flipSheet() }] }; focus = 2; }
// 立繪左右滑：像素版 ↔ 真人版（重畫的上半身，art/cutin/real_<代號>.jpg，第一次看才下載；兩隻老鼠是寫實版）
const REAL3D = ['hui', 'zong']; A.real = {};
function flipSheet(to = !sheetReal) { if (to === sheetReal) return; sheetReal = to; sheetFlipT = performance.now(); uiSound('move'); }
function stepSheet(d) { const l = sheetList(); sheet = l[(l.indexOf(sheet) + d + l.length) % l.length]; }
function closeSheet() { sheet = null; sheetRect = null; if (panel) { menu = { kind: 'panel', items: panelItems() }; focus = menu.items.length - 1; } else { menu = { kind: 'hub', items: hubItems() }; focus = 0; } }
const refreshHub = () => { const f = focus; menu = { kind: 'hub', items: hubItems() }; focus = Math.min(f, menu.items.length - 1); };
function openHub(msg) { playMusic('bgm/map'); phase = 'hub'; sheet = null; panel = false; hubMsg = msg ? { text: msg, t: performance.now() } : null; if (S.ui.length) S.ui.at(-1).t1 = Math.min(S.ui.at(-1).t1, now); S.stageCard = null; { const ok = R.reachable(run); hubSel = ok.length === 1 ? ok[0] : -1; menu = { kind: 'hub', items: hubItems() }; focus = ok[0]; mapHome(mapOwner !== run); mapOwner = run; } for (const id of run.roster) met(id); saveGame(); }
function chooseNode(i) { if (i < 0) return; const nd = R.enterNode(run, i); menu = null;
  if (nd.type === 'battle') { phase = 'anim'; SFX.add('black', now + .05, .5, { from: 0, to: 1 }); at(now + .5, () => { state = R.newState(run); enterStage(); startStage(); }); }
  else if (nd.type === 'rest') openRest(nd);
  else if (nd.type === 'supply') { R.supply(run, nd); snd(now, 'buff', .8); R.advance(run); openHub(`${nd.name}：${nd.sub}`); }
  else if (nd.type === 'train') openRest(nd, true);
  else if (nd.type === 'recruit') openRecruit(i);
  else if (nd.type === 'event') openEvent();
  else openUpgrade(true); }
function finish() {
  endFx(aegisFx); endFx(bulwarkFx);      // 護盾罩不要留到結算畫面
  phase = 'end'; menu = null; actor = null; const t0 = now + .2, last = R.isFinal(run), hud = S.ui.at(-1), L = state.L;
  if (state.over === 'win' && !last) {      // 過關：敵人退場、擺個姿勢，然後選強化
    if (L) { const u = units.boss; if (L.text.down) box(t0 + .1, 2.3, `「${L.text.down}」`, true); u.pose(t0, 'hurt'); for (let i = 0; i < 4; i++) u.hit(t0 + i * .2, .7 - i * .1); u.die(t0 + .9, 1.6); snd(t0 + .9, 'boss_down', .8); for (let i = 0; i < 3; i++) fx('spawn/poof', t0 + 1.2 + i * .3, 'boss', { scale: 1.6, dx: -.6 + i * .6, y: .3 + (i % 2) * .8, seed: i + 2 }); }
    for (const m of R.MINIONS) if (R.alive(state, m)) kill(t0 + .5, m);
    at(t0 + .1, () => playMusic(null)); hud.t1 = t0 + 1.6; const tv = t0 + (L ? 2.6 : 1.3); snd(tv, 'fanfare', .8);      // 戰鬥一結束戰鬥曲就停，號角響完到選強化時換地圖曲
    S.stageCard = { t0: tv, t1: tv + 2.3, n: run.floor + 1, name: '過關', sub: R.STAGES[R.stageOf(run, run.node)].name + '　擺平了', clear: true };
    R.HEROES.forEach((id, i) => { if (!ko[id]) units[id].pose(tv + i * .1, 'win').hop(tv + i * .1, .24, .34); }); fx('ui/confetti', tv + .2, [3.4, 1.0], { scale: 2.0, y: .6 });
    at(tv + 2.4, () => { rescued = R.endStage(state, run); for (const id of R.HEROES) ko[id] = false; if (rescued) met(rescued); saveGame({ pend: 'upgrade', rescued }); openUpgrade(false); playMusic('bgm/map'); });
  } else if (state.over === 'win') { clearSave(); { const o = PREF.ot || (PREF.ot = {}); if ((run.ot || 0) >= (o[run.map] || 0) && (o[run.map] || 0) < R.OT_MAX) { o[run.map] = (run.ot || 0) + 1; savePref(); } } const u = units.boss; for (let i = 0; i < 6; i++) u.hit(t0 + i * .25, .7 - i * .08); say(t0 + .4, 'boss_down', 'boss'); cam.to(t0, 1.4, { x: -2.6, d: 9.6, y: 1.7 }); hud.t1 = t0 + .3;
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
  const col = off ? 'rgba(43,31,24,.36)' : dn ? INK : sel ? '#fff8e6' : INK, lx = x + (sel ? 50 : 24); let px = h < 110 ? 38 : 44; font(px, 900, SERIF); while (px > 26 && c.measureText(it.label).width + it.label.length * 2 > x + w - lx - 14) { px -= 2; font(px, 900, SERIF); }
  text(it.label, lx, y + (h < 110 ? 50 : 64), { px: h < 110 ? Math.min(px, 38) : px, w: 900, fam: SERIF, col, ls: 2 });
  if (it.sub) text(fit(it.sub, w - 44, 22, 700), x + 24, y + h - (h < 110 ? 16 : 20), { px: 22, w: 700, col: it.warn ? (sel ? '#ffd0c8' : RED) : off ? 'rgba(43,31,24,.36)' : sel && !dn ? 'rgba(255,248,230,.85)' : INK2 });
  if (it.gold) skin.stamp('可發動', x + w - 52, y + 26, -.1, 17);
  c.restore();
}
// 小開關（聲音、畫質）
function toggle(label, x, y, key, w = 150) { const pe = pressed && pressed.opt === key ? (performance.now() - pressed.t) / PRESS_MS : -1; zones.push({ x, y, w, h: 38, opt: key }); c.save(); c.translate(0, pe >= 0 ? 3 : 0); skin.paper(x, y, w, 38, { old: !!PREF[key] === (key === 'mute') }); text(label, x + w / 2, y + 27, { px: 20, w: 700, align: 'center', col: INK }); c.restore(); }
const toggles = (x, y) => { toggle(PREF.mute ? '聲音　關' : '聲音　開', x, y, 'mute'); toggle(PREF.low ? '畫質　省電' : '畫質　一般', x + 162, y, 'low', 170); };
function drawMenu() {
  zones = []; if (sheet && menu) return drawSheet(); if (panel && menu) return drawPanel(); if (phase === 'hub' && menu) return drawHub(); if (phase === 'pick' && menu) return drawPick(); if (phase !== 'command' || !menu) return; drawIntents(); drawTip();
  const n = menu.items.length, two = n > 5 || (menu.kind === 'skills' && n > 4), per = two ? Math.ceil(n / 2) : n, X0 = 770, X1 = 1880, gap = 12, w = Math.min(two ? 362 : 290, (X1 - X0 - gap * (per - 1)) / per), h = two ? 98 : 116, y = two ? 852 : 944, x0 = X1 - (w * per + gap * (per - 1)), d = DEFS[actor];      // 選項超過五個（招式變多）就排兩排
  // 木頭資料夾：上面夾一張說明紙（輪到誰＋目前選項的說明），下面一排索引標籤
  const it = menu.items[focus] || {}, tip = it.hint || (menu.kind === 'target' ? '選攻擊對象（也可以直接點敵人）' : menu.kind === 'ally' || menu.kind === 'allySkill' ? '選要給誰' : menu.kind === 'items' ? '選道具' : menu.kind === 'skills' ? '選招式' : '');
  skin.wood(X0 - 16, y - 84, X1 - X0 + 32, 84 + (two ? h * 2 + 10 : h) + 30, { studs: false }); skin.paper(X0, y - 72, X1 - X0, 46); c.fillStyle = d.color; c.fillRect(X0 + 8, y - 64, 6, 30);
  text(d.name, X0 + 26, y - 39, { px: 28, w: 900, fam: SERIF, col: INK }); const nw = mw(d.name, 28, 900, SERIF); text(d.job, X0 + 36 + nw, y - 40, { px: 18, w: 700, col: INK2 }); const jw = mw(d.job, 18);
  text(fit(tip, X1 - X0 - nw - jw - 90, 20, 700), X0 + 62 + nw + jw, y - 40, { px: 20, w: 700, col: INK });
  menu.items.forEach((m, i) => button(x0 + (i % per) * (w + gap), y + (two && i >= per ? h + 10 : 0), w, h, m, i === focus, i));
  toggles(28, 148); toggle('隊伍・道具', 28, 194, 'panel', 170); toggle(`速度　×${SPEEDS[PREF.spd || 0]}`, 210, 194, 'spd', 150); skin.paper(364, 148, 150, 38); text(`第 ${run.floor + 1}／${R.MAP.length} 站`, 439, 175, { px: 20, w: 700, align: 'center', col: INK });
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
function mirrorBlueprint() { if (A.map.mirror || !A.map.blueprint) return A.map.mirror; const im = A.map.blueprint, cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d');
  x.translate(im.width, 0); x.scale(-1, 1); x.drawImage(im, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#8f86cf'; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(40,24,90,.35)'; x.fillRect(0, 0, cv.width, cv.height); return (A.map.mirror = cv); }
const STN = [[[430, 868]], [[760, 868]], [[1090, 868]], [[1090, 512], [1090, 612]], [[845, 606]], [[600, 606]], [[440, 318], [440, 418]], [[720, 368]], [[1000, 318], [1000, 418]], [[768, 190]]], VIA = { 2: [[1347, 868], [1347, 562]], 5: [[200, 606], [200, 368]] }, START = [296, 868];
// 行程表地圖：畫面＝(世界座標 − 鏡頭) × 倍率。每張地圖有一到三張「地圖紙」並排，各站位置寫在世界座標；可以用手指或滑鼠拖著看，右上角切換「放大／全覽」
// 台灣篇三張紙（廟埕燈會、不夜城夜市、頂樓加蓋）；三條支線由上到下是 a、b、c
const ZBIG = 1.5, VIEW = { x0: 270, x1: 1906, y0: 8, y1: 908 }, MAPNAME = { mirror: '鏡像', taiwan: '台灣篇', hell: '地獄分公司' };      // VIEW＝沒被隊伍欄、下方說明蓋住的範圍
const TWX = [0, 1580, 3160];
const sx = (k, pts) => pts.map(([x, y]) => [TWX[k] + x, y]);      // 各站位置照地圖紙上留的空位（design/taiwan/README.md 的座標）
const TW_STN = [sx(0, [[363, 628]]), sx(0, [[641, 351], [643, 628], [644, 874]]), sx(0, [[927, 351], [918, 628], [938, 874]]), sx(0, [[1213, 351], [1211, 628], [1241, 874]]), sx(0, [[1400, 600]]),
  sx(1, [[277, 315], [271, 586], [271, 846]]), sx(1, [[610, 315], [1000, 590], [611, 847]]), sx(1, [[935, 315], [1338, 587], [935, 847]]), sx(1, [[1297, 315]]),
  sx(2, [[361, 388], [434, 601], [384, 803]]), sx(2, [[808, 350], [925, 549], [910, 751]]), sx(2, [[1300, 330]])];
const LAY = { office: { sheets: [['blueprint', 0, 0]], stn: STN, via: VIA, start: START }, mirror: { sheets: [['blueprint', 0, 0]], stn: STN, via: VIA, start: START, flip: true },
  hell: { sheets: [['hell', 0, 0], ['hell', 1580, 0]], via: {}, start: [296, 868], titles: ['地下十九樓', '地下三十樓'],
    stn: [[[430, 868]], [[720, 868]], [[990, 780], [990, 868], [990, 952]], [[1230, 780], [1230, 868], [1230, 952]], [[1090, 606]], [[845, 556], [845, 656]], [[600, 526], [600, 606], [600, 686]], [[1580 + 300, 788], [1580 + 300, 868], [1580 + 300, 948]], [[1580 + 620, 868]], [[1580 + 940, 868]], [[1580 + 1090, 526], [1580 + 1090, 606], [1580 + 1090, 686]], [[1580 + 760, 526], [1580 + 760, 606], [1580 + 760, 686]], [[1580 + 768, 190]]] },
  taiwan: { sheets: TWX.map((x, i) => ['tw_' + (i + 1), x, 0]), stn: TW_STN, via: {}, start: [150, 640], titles: ['廟埕燈會', '不夜城夜市', '頂樓加蓋'] } };
const lay = () => LAY[run.map] || LAY.office, laySize = () => [Math.max(...lay().sheets.map(s => s[1])) + 1536, 1024];
let mapCam = [0, 0], mapCamT = null, mapZ = ZBIG, mapDrag = null, mapFitWas = null, mapOwner = null;
const wpt = p => lay().flip ? [1536 - p[0], p[1]] : p, sp = p => { const [x, y] = wpt(p); return [(x - mapCam[0]) * mapZ, (y - mapCam[1]) * mapZ]; };
function clampCam(cm, z = mapZ) { const [ww, wh] = laySize(), ax = [-VIEW.x0 / z - 20, ww - VIEW.x1 / z + 20], ay = [-VIEW.y0 / z - 14, wh - VIEW.y1 / z + 14]; return [ax[0] > ax[1] ? (ax[0] + ax[1]) / 2 : Math.max(ax[0], Math.min(ax[1], cm[0])), ay[0] > ay[1] ? (ay[0] + ay[1]) / 2 : Math.max(ay[0], Math.min(ay[1], cm[1]))]; }
const mapZoomT = () => { if (!PREF.mapFit) return ZBIG; const [ww, wh] = laySize(); return Math.min((VIEW.x1 - VIEW.x0) / ww, (VIEW.y1 - VIEW.y0) / wh); };
// 把鏡頭帶到地圖上的某一點（放在沒被蓋住的範圍正中間）；snap＝不要滑過去，直接到位
function mapLook(p, snap) { const z = mapZoomT(), [x, y] = wpt(p); mapCamT = clampCam([x - (VIEW.x0 + VIEW.x1) / 2 / z, y - (VIEW.y0 + VIEW.y1) / 2 / z], z); if (snap) { mapZ = z; mapCam = mapCamT.slice(); mapCamT = null; } }
// 地圖紙用到才下載（台灣篇三張各 0.8MB）
function hellBlueprint() { const im = A.map.blueprint; if (!im) return null; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const x = cv.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#c0544a'; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(90,14,8,.32)'; x.fillRect(0, 0, cv.width, cv.height); x.globalCompositeOperation = 'source-over'; const g = x.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * .3, cv.width / 2, cv.height / 2, cv.height * .85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,0,0,.55)'); x.fillStyle = g; x.fillRect(0, 0, cv.width, cv.height); return cv; }
function mapArt() { if (lay() === LAY.hell && !A.map.hell) A.map.hell = hellBlueprint(); for (const [key] of lay().sheets) if (!(key in A.map)) { A.map[key] = null; loadImg(`art/map/${key}.jpg`).then(im => { A.map[key] = im; }).catch(() => {}); } }
function mapHome(snap) { mapArt(); const L = lay(), pts = R.reachable(run).map(k => L.stn[run.floor][k]), at0 = run.floor === 0 ? L.start : L.stn[run.floor - 1][run.path[run.floor - 1]], cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length; mapLook([(cx * 2 + at0[0]) / 3, (cy * 2 + at0[1]) / 3], snap); }
const TAGCOL = { 補給: '#9a6a1c', 特訓: '#1f6a5c', 戰鬥: INK2, 事件: '#7a4a8a', 休息: TEAL, 福利: '#9a6a1c', 招募: '#27507e', 救援: '#27507e', 菁英: RED, 頭目: RED, 魔王: RED };
const DEX = ['kui', 'jie', 'kevin', 'mi', 'vivi', ...EXTRA];
const nodeDesc = nd => { if (nd.type !== 'battle') return [nd.sub || '', '這一站不用戰鬥']; const st = R.STAGES[R.stageOf(run, nd)], cnt = {}; for (const m of st.minions) { const kd = (st.kinds || {})[m] || 'drone', n = kd === 'random' ? '隨機的鏡像同事' : R.KINDS[kd].name; cnt[n] = (cnt[n] || 0) + 1; } return [nd.sub || st.sub, `敵人：${st.boss ? st.boss.name + '、' : ''}${Object.entries(cnt).map(([n, k]) => k > 1 ? `${n} ×${k}` : n).join('、')}　打贏可以三選一強化`]; };
// 「隊伍與道具」選單的畫面：左邊隊伍常駐，右邊兩個頁籤（道具與強化／夥伴名冊）。整頁用滿 1920 寬，字級以手機橫向看得清楚為準（最小 26）
function drawPanel() { const fight = inBattle(); if (fight) { c.fillStyle = 'rgba(8,5,4,.93)'; c.fillRect(0, 0, W, H); } else drawTable(.62);
  const act = R.active(run), bag = fight ? state.items : run.items, n = run.roster.length, seen = PREF.met || [];
  text('隊伍與道具', 64, 104, { px: 54, w: 900, fam: SERIF, col: CREAM, ls: 10, stroke: 'rgba(20,10,4,.8)', sw: 8 });
  sheetBtn(fight ? '回戰鬥' : '回行程表', 1584, 30, 280, 100, menu.items.length - 1, true);
  // 左：隊伍
  const LX = 56, LY = 140, LW = 1024; skin.wood(LX, LY, LW, 924); text('隊伍', LX + 28, LY + 45, { px: 32, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.7)', sw: 5 });
  text(`出戰 ${act.length}／4　候補 ${n - act.length}／2`, LX + 128, LY + 44, { px: 26, w: 700, col: BRASS }); text(fight ? '點人看資料（戰鬥中不能換順序）' : '點人看資料　箭頭調順序', LX + LW - 28, LY + 44, { px: 26, w: 700, align: 'right', col: 'rgba(239,230,207,.78)' });
  for (let i = 0; i < 6; i++) { const id = run.roster[i], x = LX + 16, w = LW - 32, h = 134, y = LY + 60 + i * 142 + (i >= 4 ? 8 : 0);
    if (i === 4) { c.fillStyle = 'rgba(216,178,90,.5)'; c.fillRect(x + 6, y - 9, w - 12, 2); }
    if (!id) { c.strokeStyle = 'rgba(239,230,207,.22)'; c.setLineDash([10, 10]); c.lineWidth = 2; c.strokeRect(x + 2, y + 2, w - 4, h - 4); c.setLineDash([]); text(i < 4 ? '出戰空位' : '候補空位', x + w / 2, y + 78, { px: 28, w: 700, align: 'center', col: 'rgba(239,230,207,.36)' }); continue; }
    const d = DEFS[id], on = act.includes(id), hp = curHp(id), mx = R.STAT[id].hp, low = hp / mx < .3, viv = id === 'vivi'; skin.paper(x, y, w, h, { old: !on });
    { const vi = menu.items.findIndex(m => m.view === id && m.row === i); if (vi >= 0) { zones.push({ x, y, w: fight ? w : 764, h, i: vi, off: false }); if (focus === vi) { c.strokeStyle = TEAL; c.lineWidth = 5; c.strokeRect(x + 3, y + 3, w - 6, h - 6); } } }
    c.fillStyle = on ? TEAL : '#8a7a66'; c.fillRect(x, y, 10, h); skin.face(A.face[id], x + 26, y + 15, 104);
    text(d.name, x + 150, y + 56, { px: 40, w: 900, fam: SERIF, col: INK }); text(viv ? '公主・後排' : d.job, x + 166 + mw(d.name, 40, 900, SERIF), y + 54, { px: 26, w: 700, col: INK2 });
    c.fillStyle = on ? '#1f6a5c' : '#8a7a66'; c.fillRect(x + 668, y + 18, 88, 42); text(on ? '出戰' : '候補', x + 712, y + 49, { px: 26, w: 900, align: 'center', col: '#fff8e6' });
    if (!viv) { skin.bar(x + 150, y + 84, 250, 26, hp / mx, low ? '#c8443a' : '#4f9a4a'); text(`${hp}／${mx}`, x + 416, y + 110, { px: 34, w: 900, col: low ? RED : INK }); }
    text(`SP ${curSp(id)}`, x + 756, y + 110, { px: 32, w: 900, col: '#27507e', align: 'right' });
    for (const dd of [-1, 1]) { const idx = menu.items.findIndex(m => m.re === i && m.d === dd); if (idx < 0) continue; const ax = x + w - 16 - (dd < 0 ? 200 : 96), pe = pressK(idx), dn = pe >= 0, hov = focus === idx, ay = y + 19 + (dn ? 4 : 0); zones.push({ x: ax - 4, y, w: 104, h, i: idx, off: false });
      c.fillStyle = '#2b1f18'; c.fillRect(ax, ay, 96, 96); c.fillStyle = dn ? '#fff0c8' : hov ? '#d8b25a' : '#b08a4a'; c.fillRect(ax + 6, ay + 6, 84, 84); c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(ax + 6, ay + 6, 84, 6); c.fillStyle = '#2b1f18'; c.beginPath(); const cx = ax + 48, cy = ay + 48; if (dd < 0) { c.moveTo(cx, cy - 22); c.lineTo(cx + 26, cy + 18); c.lineTo(cx - 26, cy + 18); } else { c.moveTo(cx, cy + 22); c.lineTo(cx + 26, cy - 18); c.lineTo(cx - 26, cy - 18); } c.fill(); } }
  // 右：頁籤
  const RX = 1096, RW = 768, RY = 244, met9 = DEX.filter(id => seen.includes(id)).length;
  [['道具與強化'], [`夥伴名冊　${met9}／${DEX.length}`]].forEach(([lab], t) => { const idx = menu.items.findIndex(m => m.tab === t), x = RX + t * 388, y = 140, w = 380, h = 100, cur = panelTab === t, pe = pressK(idx), dn = pe >= 0; zones.push({ x, y, w, h, i: idx, off: false });
    if (cur) skin.paper(x, y, w, h + 10); else skin.wood(x, y + 8, w, h - 8, { studs: false }); if (focus === idx && !cur) { c.strokeStyle = TEAL; c.lineWidth = 5; c.strokeRect(x + 4, y + 12, w - 8, h - 16); } if (dn) { c.fillStyle = 'rgba(255,246,216,.45)'; c.fillRect(x, y + 8, w, h - 8); }
    text(lab, x + w / 2, y + (cur ? 64 : 68), { px: 34, w: 900, fam: SERIF, align: 'center', ls: 3, col: cur ? INK : 'rgba(239,230,207,.82)' }); });
  skin.wood(RX, RY, RW, 820);
  if (panelTab === 0) {
    // 道具：這裡只看數量
    Object.keys(R.ITEMS).forEach((k, j) => { const x = RX + 16 + j * 248, y = RY + 18, w = 240, h = 168, im = A.items[k] || (k === 'bento' ? A.icons.up_bento : null), it = R.ITEMS[k]; skin.paper(x, y, w, h, { old: !bag[k] });
      if (im) pix(im, x + 14, y + 10, 78 * im.width / im.height, 78); text(`×${bag[k]}`, x + w - 18, y + 68, { px: 48, w: 900, align: 'right', col: bag[k] ? INK : RED }); text(it.name, x + 16, y + 124, { px: 32, w: 900, fam: SERIF, col: INK }); text(fit(it.note, w - 28, 26, 700), x + 16, y + 156, { px: 26, w: 700, col: INK2 }); });
    text('道具在戰鬥中輪到自己時，從「道具」指令使用', RX + 22, RY + 226, { px: 26, w: 700, col: 'rgba(239,230,207,.72)' });
    // 強化：名字和效果都寫出來
    const cnt = {}; for (const k of run.picks) cnt[k] = (cnt[k] || 0) + 1; const ks = Object.keys(cnt), UY = RY + 304;
    text('這一輪的強化', RX + 22, RY + 284, { px: 32, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.7)', sw: 5 }); text(`${run.picks.length} 個`, RX + RW - 24, RY + 284, { px: 28, w: 700, align: 'right', col: BRASS });
    if (!ks.length) text('還沒有。打贏戰鬥或到福委會可以三選一', RX + 22, UY + 48, { px: 28, w: 700, col: 'rgba(239,230,207,.6)' });
    else if (ks.length <= 6) ks.forEach((k, j) => { const u = R.UPGRADES[k], x = RX + 16, y = UY + j * 84, w = RW - 32, im = A.icons['up_' + k]; skin.paper(x, y, w, 78); if (im) pix(im, x + 10, y + 7, 64, 64);
      text(u.name, x + 88, y + 36, { px: 30, w: 900, fam: SERIF, col: INK }); if (cnt[k] > 1) text(`×${cnt[k]}`, x + 100 + mw(u.name, 30, 900, SERIF), y + 36, { px: 30, w: 900, col: RED }); text(fit(u.desc, w - 104, 26, 700), x + 88, y + 68, { px: 26, w: 700, col: INK2 }); });
    else ks.forEach((k, j) => { const u = R.UPGRADES[k], w = 364, x = RX + 16 + (j % 2) * 372, y = UY + (j >> 1) * 63, im = A.icons['up_' + k]; skin.paper(x, y, w, 58); if (im) pix(im, x + 8, y + 5, 48, 48); text(u.name, x + 66, y + 40, { px: 28, w: 900, fam: SERIF, col: INK }); if (cnt[k] > 1) text(`×${cnt[k]}`, x + w - 14, y + 40, { px: 28, w: 900, align: 'right', col: RED }); });
  } else {
    // 夥伴名冊：這一輪同行的是亮的；以前遇過的是暗的；還沒遇過的是問號
    DEX.forEach((id, j) => { const x = RX + 16 + (j % 4) * 186, y = RY + 18 + (j >> 2) * 198, w = 178, h = 190, inRun = run.roster.includes(id), known = seen.includes(id) && A.face[id]; skin.paper(x, y, w, h, { old: !inRun });
      if (known) { const vi = menu.items.findIndex(m => m.view === id && m.dex); if (vi >= 0) { zones.push({ x, y, w, h, i: vi, off: false }); if (focus === vi) { c.strokeStyle = TEAL; c.lineWidth = 5; c.strokeRect(x + 3, y + 3, w - 6, h - 6); } }
        c.save(); c.globalAlpha = inRun ? 1 : .6; skin.face(A.face[id], x + 37, y + 12, 104); c.restore(); text(fit(DEFS[id].name, w - 12, 30, 900, SERIF), x + w / 2, y + 150, { px: 30, w: 900, fam: SERIF, align: 'center', col: INK }); text(inRun ? '同行中' : '遇過', x + w / 2, y + 180, { px: 26, w: 900, align: 'center', col: inRun ? '#1f6a5c' : INK2 }); }
      else { c.fillStyle = 'rgba(43,31,24,.16)'; c.fillRect(x + 37, y + 12, 104, 104); text('？', x + w / 2, y + 90, { px: 72, w: 900, fam: SERIF, align: 'center', col: 'rgba(43,31,24,.36)' }); text('還沒遇到', x + w / 2, y + 166, { px: 26, w: 700, align: 'center', col: 'rgba(43,31,24,.5)' }); } });
  }
}
// 每一種站「得到什麼／代價是什麼」，給行程表下方的說明用
const nodeTrade = nd => nd.type === 'supply' ? [nd.sub, '這一站沒有強化'] : nd.type === 'train' ? ['免費把一個招式升級成＋', '不補血、不補 SP'] : nd.type === 'battle' ? ['贏了三選一強化' + (nd.rescue ? '，並救出一位夥伴' : '') + (nd.bonus ? '，多拿奶茶、咖啡、便當各一' : ''), ['菁英', '頭目', '魔王'].includes(nd.tag) ? '要打一場硬仗' : '要打一場'] : nd.type === 'rest' ? ['HP 回復一半、SP 補滿', '這一站沒有強化']
  : nd.type === 'gift' ? ['直接三選一強化', '不補血、不補 SP'] : nd.type === 'recruit' ? ['多一位夥伴（三位選一位）', '這一站沒有強化'] : ['兩個選項挑一個', '各有代價，到了才知道是什麼事'];
const nextStops = () => R.MAP.slice(run.floor + 1, run.floor + 4).map(fl => [...new Set(fl.map(nd => nd.tag))].join('或')).join(' → ');
function drawHub() {
  if (sheet) return drawSheet();
  drawTable(.3); const nF = R.MAP.length, fl = R.MAP[run.floor], tp = performance.now() / 1000, L = lay(), reach = R.reachable(run), big = !PREF.mapFit;
  // 鏡頭：倍率與位置慢慢靠過去；切換「全覽／放大」時重新對準現在這一站
  if (mapFitWas !== !!PREF.mapFit) { if (mapFitWas !== null) mapHome(); mapFitWas = !!PREF.mapFit; }
  { const zt = mapZoomT(); mapZ = Math.abs(zt - mapZ) < .002 ? zt : mapZ + (zt - mapZ) * .2; if (mapCamT && !mapDrag) { mapCam[0] += (mapCamT[0] - mapCam[0]) * .16; mapCam[1] += (mapCamT[1] - mapCam[1]) * .16; if (Math.abs(mapCamT[0] - mapCam[0]) + Math.abs(mapCamT[1] - mapCam[1]) < .5) { mapCam = mapCamT; mapCamT = null; } } mapCam = clampCam(mapCam); }
  const tiny = mapZ < .6, NK = big ? 1.36 : tiny ? .72 : 1;
  // 地圖紙（還沒有圖的先用一張白紙頂著）
  L.sheets.forEach(([key, sx, sy], q) => { const x = (sx - mapCam[0]) * mapZ, y = (sy - mapCam[1]) * mapZ, w = 1536 * mapZ, h = 1024 * mapZ, im = L.flip ? mirrorBlueprint() : A.map[key]; if (x > W || x + w < 0) return; c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x + 10, y + 12, w, h);
    if (im) c.drawImage(im, x, y, w, h); else { skin.paper(x, y, w, h); if (L.titles) text(L.titles[q], x + w / 2, y + 96 * mapZ, { px: Math.round(60 * mapZ), w: 900, fam: SERIF, align: 'center', col: 'rgba(43,31,24,.5)', ls: 12 }); } });
  // 路線：走過的是紅線、現在可以走的是會動的金線、還沒到的是灰色虛線。有 to 的站只連得到它走得到的下一站
  const segs = [[[L.start, L.stn[0][0]], run.floor > 0 ? 'walked' : 'open']];
  for (let i = 0; i < nF - 1; i++) R.MAP[i].forEach((nd, a) => (nd.to || R.MAP[i + 1].map((_, b) => b)).forEach(b => { if (!R.MAP[i + 1][b]) return; const mine = i < run.floor && run.path[i] === a, st = i + 1 < run.floor ? (mine && run.path[i + 1] === b ? 'walked' : 'dead') : i + 1 === run.floor ? (mine ? 'open' : 'dead') : (i < run.floor && !mine) || (i === run.floor && !reach.includes(a)) ? 'dead' : 'future'; segs.push([[L.stn[i][a], ...((L.via || {})[i] || []), L.stn[i + 1][b]], st]); }));
  c.lineJoin = 'round'; c.lineCap = 'round'; const LK = big ? 1.3 : tiny ? .7 : 1;
  for (const pass of [0, 1]) for (const [pts, st] of segs) { if ((st === 'walked' || st === 'open') !== !!pass) continue; c.beginPath(); pts.forEach((p, i) => { const [x, y] = sp(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    if (st === 'walked') { c.strokeStyle = 'rgba(40,16,10,.85)'; c.lineWidth = 11 * LK; c.stroke(); c.strokeStyle = '#c23b2e'; c.lineWidth = 6 * LK; c.stroke(); }
    else if (st === 'open') { c.strokeStyle = 'rgba(40,24,6,.85)'; c.lineWidth = 11 * LK; c.stroke(); c.setLineDash([16 * LK, 13 * LK]); c.lineDashOffset = -tp * 34; c.strokeStyle = '#f0c24a'; c.lineWidth = 6 * LK; c.stroke(); c.lineDashOffset = 0; }
    else if (st === 'dead') { c.setLineDash([4, 12]); c.strokeStyle = 'rgba(239,230,207,.16)'; c.lineWidth = 4 * LK; c.stroke(); } else { c.setLineDash([2, 13 * LK]); c.strokeStyle = 'rgba(28,18,12,.75)'; c.lineWidth = 9 * LK; c.stroke(); c.strokeStyle = 'rgba(239,230,207,.8)'; c.lineWidth = 5 * LK; c.stroke(); } c.setLineDash([]); }
  // 起點：打卡鐘
  { const [x, y] = sp(L.start), r = 30 * NK; c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r - 3, 0, 7); c.stroke(); pix(A.icons.clock, x - r * .77, y - r * .77, r * 1.54, r * 1.54); }
  // 各站的徽章與名牌（全覽而且地圖很長的時候，只有現在這一層寫名字）
  R.MAP.forEach((flr, i) => flr.forEach((nd, k) => { const [x, y] = sp(L.stn[i][k]); if (x < -420 || x > W + 80 || y < -90 || y > H + 90) return; const cur = i === run.floor, open = cur && reach.includes(k), done = i < run.floor && run.path[i] === k, skipped = (i < run.floor && !done) || (cur && !open), sel = open && hubSel === k, hov = open && focus === k, bigN = nd.icon === 'boss' || nd.icon === 'chief', r = ((bigN ? 40 : 33) + (hov ? 3 : 0)) * NK, pe = open ? pressK(k) : -1, dn = pe >= 0;
    const named = !tiny || cur, npx = Math.round(21 * NK), tpx = big ? 20 : 13, nm = R.nodeName(nd, run), lw = Math.max(mw(nm, npx, 900, SERIF), mw(nd.tag, tpx, 900) + 8) + 26 * NK, lh = 50 * NK, lx = x + r + 4, hid = y > VIEW.y1 - 6 || (x < VIEW.x0 - 8 && y > 118);      // hid＝被隊伍欄或下方說明蓋住，拖出來才點得到
    if (open && !hid) zones.push({ x: x - r - 10, y: y - r - 8, w: r * 2 + (named ? lw : 0) + 20, h: r * 2 + 16, i: k, off: false, map: true });
    c.save(); c.globalAlpha = skipped ? .32 : i > run.floor ? .9 : 1; c.translate(0, dn ? 4 : 0);
    if (named) { skin.paper(lx, y - lh / 2, lw, lh, { old: !open }); if (sel) { c.fillStyle = TEAL; c.fillRect(lx + 4, y - lh / 2 + 4, lw - 8, lh - 8); }
      text(nd.tag, lx + 13 * NK, y - 6 * NK, { px: tpx, w: 900, col: sel ? 'rgba(255,248,230,.85)' : TAGCOL[nd.tag] || INK2, ls: 2 }); text(nm, lx + 13 * NK, y + 17 * NK, { px: npx, w: 900, fam: SERIF, col: sel ? '#fff8e6' : INK }); }
    if (open) { const pu = Math.sin(tp * 5); c.strokeStyle = `rgba(240,194,74,${.55 + .35 * pu})`; c.lineWidth = 6; c.beginPath(); c.arc(x, y, r + 9 + pu * 2, 0, 7); c.stroke(); }
    c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); c.fillStyle = bigN ? '#6e1c16' : done ? '#5a4c3c' : '#33241a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = sel ? '#7fe0c8' : BRASS; c.lineWidth = sel ? 5 : 3; c.beginPath(); c.arc(x, y, r - 2, 0, 7); c.stroke();
    const im = A.icons[nd.icon], iw = r * 1.56; if (im) pix(im, x - iw / 2, y - iw / 2, iw, iw); else text(nd.tag[0], x, y + 12, { px: 32, w: 900, fam: SERIF, align: 'center', col: CREAM });
    if (dn) { c.fillStyle = `rgba(255,246,216,${.7 - .5 * Math.min(1, pe)})`; c.beginPath(); c.arc(x, y, r + 4, 0, 7); c.fill(); }
    if (done) skin.stamp('結案', x + r * .55, y - r * .7, -.14, 14 * NK);
    c.restore(); if (open && (sel || (hubSel < 0 && hov))) { const ay = y - r - 16 + Math.sin(tp * 7) * 5; c.fillStyle = sel ? '#7fe0c8' : '#f0c24a'; c.strokeStyle = 'rgba(20,10,4,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 14, ay - 18); c.lineTo(x + 14, ay - 18); c.lineTo(x, ay); c.closePath(); c.stroke(); c.fill(); } }));
  // 隊伍現在在哪：主角的頭像
  { const at0 = run.floor === 0 ? L.start : L.stn[run.floor - 1][run.path[run.floor - 1]], [x, y0] = sp(at0), k = tiny ? .8 : NK, y = y0 - 78 * k + Math.sin(tp * 3) * 4, h = 27 * k; c.fillStyle = '#1c120c'; c.fillRect(x - h, y - h, h * 2, h * 2); c.fillStyle = BRASS; c.fillRect(x - h + 3, y - h + 3, h * 2 - 6, h * 2 - 6); skin.face(A.face[run.roster[0]], x - h + 6, y - h + 6, h * 2 - 12); c.fillStyle = '#1c120c'; c.beginPath(); c.moveTo(x - 9, y + h); c.lineTo(x + 9, y + h); c.lineTo(x, y + h + 11); c.fill(); }
  // 上面壓一條暗邊，標題與開關才看得清楚
  { const g = c.createLinearGradient(0, 0, 0, 130); g.addColorStop(0, 'rgba(8,5,4,.7)'); g.addColorStop(1, 'rgba(8,5,4,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 130); }
  text('上班旅人', 22, 64, { px: 46, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.9)', sw: 8 }); text(`第 ${run.floor + 1}／${nF} 站` + (MAPNAME[run.map] ? '　' + MAPNAME[run.map] : '') + (run.ot ? `　加班 ${run.ot}` : ''), 26, 102, { px: 24, w: 700, col: run.map === 'mirror' ? '#c9b8ff' : BRASS, ls: 3, stroke: 'rgba(20,10,4,.8)', sw: 5 });
  toggle(PREF.mute ? '聲音　關' : '聲音　開', 1670, 18, 'mute', 236); toggle(PREF.low ? '畫質　省電' : '畫質　一般', 1670, 64, 'low', 236); toggle(PREF.mapFit ? '地圖　全覽' : '地圖　放大', 1670, 110, 'mapFit', 236);
  if (big && !PREF.dragged) { const tx = VIEW.x1 - 330, ty = VIEW.y1 - 62; skin.paper(tx, ty, 318, 48); text('按住地圖可以拖著看', tx + 159, ty + 33, { px: 26, w: 900, align: 'center', col: INK }); }
  // 下方：選到的那一站的說明＋出發
  { const IX = 269, IY = 916, IW = 1637, IH = 152, nd = hubSel >= 0 ? fl[hubSel] : null, di = fl.length, BW2 = 236; skin.wood(IX, IY, IW, IH, { studs: false }); skin.paper(IX + 10, IY + 10, IW - 30 - BW2, IH - 20);
    const nxt = nextStops();
    if (!nd) { const cw = (IW - 40 - BW2) / reach.length; reach.map(k => fl[k]).forEach((o, q) => { const x = IX + 26 + q * cw, tr = nodeTrade(o); pix(A.icons[o.icon], x, IY + 16, 64, 64); text(fit(R.nodeName(o, run), cw - 150, 30, 900, SERIF), x + 76, IY + 46, { px: 30, w: 900, fam: SERIF, col: INK }); text(o.tag, x + 88 + mw(fit(R.nodeName(o, run), cw - 150, 30, 900, SERIF), 30, 900, SERIF), IY + 44, { px: 20, w: 900, col: TAGCOL[o.tag] || INK2, ls: 2 });
        text(fit('得到：' + tr[0], cw - 96, 24, 900), x + 76, IY + 80, { px: 24, w: 900, col: '#1f6a5c' }); text(fit('代價：' + tr[1], cw - 96, 22), x + 76, IY + 108, { px: 22, w: 700, col: RED }); if (q) { c.fillStyle = 'rgba(43,31,24,.2)'; c.fillRect(x - 14, IY + 18, 2, 96); } });
      if (nxt) text(fit('之後：' + nxt, IW - 80 - BW2, 20), IX + 102, IY + 134, { px: 20, w: 700, col: INK2 }); }
    else { const tr = nodeTrade(nd), nm = R.nodeName(nd, run); pix(A.icons[nd.icon], IX + 26, IY + 30, 92, 92); text(nd.tag, IX + 136, IY + 52, { px: 24, w: 900, col: TAGCOL[nd.tag] || INK2, ls: 4 }); text(nm, IX + 136, IY + 104, { px: 44, w: 900, fam: SERIF, col: INK, ls: 2 }); const nx = IX + 136 + mw(nm, 44, 900, SERIF) + 44, ds = nodeDesc(nd), who = (run.offers[run.floor] || {})[hubSel] || [];
      const room = IX + IW - 30 - BW2 - nx - who.length * 100 - 10; text(fit('得到：' + tr[0], room, 26, 900), nx, IY + 48, { px: 26, w: 900, col: '#1f6a5c' }); text(fit('代價：' + tr[1] + (nd.type === 'battle' ? '　' + ds[1].split('　')[0] : ''), room, 24), nx, IY + 86, { px: 24, w: 700, col: RED }); if (nxt) text(fit('之後：' + nxt, room, 20), nx, IY + 122, { px: 20, w: 700, col: INK2 });
      who.forEach((id, j) => { const fx0 = IX + IW - 30 - BW2 - (who.length - j) * 100 + 6; skin.face(A.face[id], fx0 + 6, IY + 20, 76); text(DEFS[id].name, fx0 + 44, IY + 126, { px: 22, w: 900, fam: SERIF, align: 'center', col: INK }); }); }
    const it = menu.items[di], bx = IX + IW - BW2 - 8, by = IY + 12, bh2 = IH - 24, off = it.off, pe = pressK(di), dn = pe >= 0 && !off, on = focus === di && !off; zones.push({ x: bx, y: by, w: BW2, h: bh2, i: di, off });
    c.save(); c.translate(pe >= 0 && off ? Math.sin(pe * 22) * 6 * (1 - Math.min(1, pe)) : 0, dn ? 5 : 0); skin.paper(bx, by, BW2, bh2, { old: off }); if (!off) { c.fillStyle = '#1e3b36'; c.fillRect(bx + 6, by + 6, BW2 - 12, bh2 - 12); c.fillStyle = on ? '#3f9c88' : TEAL; c.fillRect(bx + 8, by + 8, BW2 - 16, bh2 - 16); c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(bx + 8, by + 8, BW2 - 16, 5); }
    if (dn) { c.fillStyle = `rgba(255,246,216,${.8 - .5 * Math.min(1, pe)})`; c.fillRect(bx, by, BW2, bh2); } text('出發', bx + BW2 / 2, by + bh2 / 2 + 17, { px: 46, w: 900, fam: SERIF, align: 'center', ls: 12, col: off ? 'rgba(43,31,24,.36)' : '#fff8e6' }); c.restore(); }
  // 左邊：隊伍的狀態（頭像＋血條）與道具數量。整塊是一顆按鈕，按了叫出「隊伍與道具」選單
  { const pi = menu.items.findIndex(m => m.panelBtn), LX = 14, LY = 128, LW = 242, n = run.roster.length, LH = 158 + n * 62, pe = pressK(pi), dn = pe >= 0, on = focus === pi, act = R.active(run); zones.push({ x: LX, y: LY, w: LW, h: LH, i: pi, off: false });
    c.save(); c.translate(0, dn ? 4 : 0); skin.wood(LX, LY, LW, LH); text('隊伍', LX + 18, LY + 40, { px: 26, w: 900, fam: SERIF, col: CREAM, ls: 6, stroke: 'rgba(20,10,4,.7)', sw: 5 }); text(`${n}／6 人`, LX + LW - 18, LY + 38, { px: 17, w: 700, align: 'right', col: 'rgba(239,230,207,.72)' });
    run.roster.forEach((id, k) => { const y = LY + 54 + k * 62, on4 = act.includes(id), hp = run.hp[id], mx = R.STAT[id].hp, low = hp / mx < .3; skin.paper(LX + 10, y, LW - 20, 56, { old: !on4 }); c.fillStyle = on4 ? TEAL : '#8a7a66'; c.fillRect(LX + 10, y, 7, 56); skin.face(A.face[id], LX + 22, y + 5, 46);
      text(fit(DEFS[id].name, 96, 19, 900, SERIF), LX + 76, y + 25, { px: 19, w: 900, fam: SERIF, col: INK }); text(on4 ? '出戰' : '候補', LX + LW - 20, y + 24, { px: 13, w: 900, align: 'right', col: on4 ? '#1f6a5c' : INK2 }); if (id !== 'vivi') skin.bar(LX + 76, y + 37, LW - 106, 9, hp / mx, low ? '#c8443a' : '#4f9a4a'); else text('後排應援', LX + 76, y + 46, { px: 13, w: 700, col: INK2 }); });
    { const iy = LY + 58 + n * 62; Object.keys(R.ITEMS).forEach((k, q) => { const x = LX + 12 + q * 76, im = A.items[k] || (k === 'bento' ? A.icons.up_bento : null); if (im) pix(im, x, iy, 36 * im.width / im.height, 36); text(`×${run.items[k]}`, x + 40, iy + 27, { px: 20, w: 900, col: CREAM, stroke: 'rgba(20,10,4,.7)', sw: 4 }); }); }
    skin.paper(LX + 10, LY + LH - 54, LW - 20, 44); if (on) { c.fillStyle = TEAL; c.fillRect(LX + 14, LY + LH - 50, LW - 28, 36); } text('隊伍・道具・名冊', LX + LW / 2, LY + LH - 24, { px: 19, w: 900, align: 'center', col: on ? '#fff8e6' : INK, ls: 1 });
    if (dn) { c.fillStyle = `rgba(255,246,216,${.5 - .4 * Math.min(1, pe)})`; c.fillRect(LX, LY, LW, LH); } c.restore(); }
  // 訊息橫幅放地圖下緣，不擋最上面的魔王站
  if (hubMsg) { const el = (performance.now() - hubMsg.t) / 1000; if (el < 4.5) { const a = Math.min(1, el / .2, (4.5 - el) / .5), w = Math.min(1100, mw(hubMsg.text, 28, 900, SERIF) + 90), mx = 1088; c.save(); c.globalAlpha = a; skin.paper(mx - w / 2, 846 + (1 - Math.min(1, el / .2)) * 20, w, 64, { clips: [mx] }); text(hubMsg.text, mx, 890, { px: 28, w: 900, fam: SERIF, align: 'center', col: INK }); c.restore(); } }
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
    { if (!(id in A.real)) { A.real[id] = null; loadImg(`art/cutin/real_${id}.jpg`).then(r => { A.real[id] = r; }); }      // 立繪兩張並排，左右滑：像素版 ↔ 原型
      const k0 = Math.min(1, (performance.now() - sheetFlipT) / 260), e = 1 - (1 - k0) ** 3, k = sheetReal ? e : 1 - e, iw = aw - 8, ih = AH - 8, re = A.real[id]; sheetRect = { x: ax, y: ay, w: aw, h: AH };
      c.save(); c.beginPath(); c.rect(ax + 4, ay + 4, iw, ih); c.clip();
      if (im && k < 1) { const bh = 620, bw = bh * im.width / im.height, by = Math.min(ay + 8, ay + 4 + ih * .43 - (EYE[id] || .38) * bh); pix(im, ax + aw / 2 - bw / 2 - k * iw, by, bw, bh); }
      if (k > 0) { const x0 = ax + 4 + (1 - k) * iw; c.fillStyle = '#e4e1dc'; c.fillRect(x0, ay + 4, iw, ih); if (re) { const sc = Math.max(iw / re.width, ih / re.height), rw = re.width * sc, rh = re.height * sc; c.drawImage(re, x0 + iw / 2 - rw / 2, ay + 4, rw, rh); } else text('載入中', x0 + iw / 2, ay + AH / 2, { px: 22, w: 700, align: 'center', col: INK2 }); }
      c.restore();
      const tag = sheetReal ? (REAL3D.includes(id) ? '寫實版' : '真人版') : '像素版', tw = mw(tag, 18, 900) + 28; skin.paper(ax + 12, ay + AH - 46, tw, 34); text(tag, ax + 26, ay + AH - 22, { px: 18, w: 900, col: INK });
      for (const q of [0, 1]) { c.fillStyle = '#1c120c'; c.fillRect(ax + aw / 2 - 19 + q * 24, ay + AH - 30, 14, 14); c.fillStyle = (q === 1) === sheetReal ? CREAM : '#6a5846'; c.fillRect(ax + aw / 2 - 16 + q * 24, ay + AH - 27, 8, 8); }
      text('左右滑換立繪', ax + aw - 14, ay + AH - 20, { px: 16, w: 700, align: 'right', col: CREAM, stroke: 'rgba(20,10,4,.8)', sw: 4 }); }
    c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(ax + 2.5, ay + 2.5, aw - 5, AH - 5);
    let ty = ay + AH + 84; text(d.name, lx + lw / 2, ty, { px: 64, w: 900, fam: SERIF, align: 'center', col: INK, ls: 6 }); ty += 44; text(`${viv ? '公主' : d.job}　${R.ROLE[id]}`, lx + lw / 2, ty, { px: 24, w: 900, align: 'center', col: RED, ls: 3 }); c.fillStyle = RED; c.fillRect(lx + lw / 2 - 70, ty + 14, 140, 4); ty += 58;
    text(inRun ? (on ? '出戰中' : '候補（排到前四位才會上場）') : '這一輪沒有同行', lx + lw / 2, ty, { px: 22, w: 900, align: 'center', col: on ? '#1f6a5c' : INK2 }); ty += 26;
    if (d.shout) wrap(`「${d.shout}」`, lw - 80, 24).slice(0, 3).forEach((ln, k) => text(ln, lx + lw / 2, ty + 44 + k * 36, { px: 24, w: 700, fam: SERIF, align: 'center', col: INK2 }));
    if (on) skin.stamp('出戰', lx + lw - 84, ay + AH + 2, -.12, 22); }
  // 右：素質、招式、奧義
  const rx = lx + lw + 30, rw = X + PW - 40 - rx, rh = lh - 124; skin.paper(rx, ly, rw, rh); const cx = rx + 40, cw = rw - 80; let y = ly + 58;
  const head = (s, note) => { c.fillStyle = RED; c.fillRect(cx, y - 24, 7, 28); text(s, cx + 20, y, { px: 26, w: 900, fam: SERIF, col: INK, ls: 8 }); const x1 = cx + 40 + mw(s, 26, 900, SERIF) + s.length * 8; c.fillStyle = 'rgba(43,31,24,.22)'; c.fillRect(x1, y - 10, cx + cw - x1 - (note ? mw(note, 18) + 18 : 0), 2); if (note) text(note, cx + cw, y - 3, { px: 18, w: 700, align: 'right', col: INK2 }); y += 20; };
  head('素質', inRun && run.picks.length ? `已拿 ${run.picks.length} 個強化` : '');
  { const up = run.atk > 1.001 ? `強化 ＋${Math.round((run.atk - 1) * 100)}%` : '', cut = run.def < .999 ? `強化 －${Math.round((1 - run.def) * 100)}%` : '', cells = viv ? [['位置', '後排', '不會被攻擊'], ['應援', `氣勢 ＋${R.MO.cheer}`, '每次行動替全隊加氣勢'], ['速度', st.spd, '數字大的先行動'], ['SP', inRun ? `${curSp(id)}／${st.sp}` : st.sp, '放招式用'], ['奧義', `SP ${st.cost}`, `氣勢要 ${R.ultMo(run)}`]]
      : [['HP', inRun ? `${curHp(id)}／${st.hp}` : st.hp, '', inRun ? curHp(id) / st.hp : null, '#4f9a4a'], ['SP', inRun ? `${curSp(id)}／${st.sp}` : st.sp, '放招式與奧義用', inRun ? curSp(id) / st.sp : null, '#3d6fa8'], ['攻擊', Math.round(st.atk * (inRun ? run.atk : 1)), inRun ? up : ''], ['速度', st.spd, '數字大的先行動'], ['受到的傷害', inRun && cut ? `×${run.def.toFixed(2)}` : '×1', inRun ? cut : ''], ['奧義', `SP ${st.cost}`, `氣勢要 ${R.ultMo(run)}`]];
    const colW = cw / 3; cells.forEach(([k, v, note, bar, bcol], i) => { const x = cx + (i % 3) * colW, yy = y + 4 + Math.floor(i / 3) * 66; text(k, x, yy + 18, { px: 20, w: 900, col: INK2, ls: 3 }); text(String(v), x + mw(k, 20, 900) + k.length * 3 + 14, yy + 22, { px: 32, w: 900, col: INK }); if (bar != null) skin.bar(x, yy + 34, colW - 60, 10, bar, bar < .3 && k === 'HP' ? '#c8443a' : bcol); else if (note) text(fit(note, colW - 20, 18), x, yy + 50, { px: 18, w: 700, col: note.startsWith('強化') ? '#1f6a5c' : INK2 }); }); y += 4 + Math.ceil(cells.length / 3) * 66 + 18; }
  // 特性：普攻的屬性與附帶效果、被動特質
  if (!viv) { head('特性'); const tp = R.ATK_TYPE[id]; typeChip(tp, cx, y + 6, 36); text(fit(`普攻：回 SP，${R.RIDER[id]}`, cw - 60, 24, 700), cx + 50, y + 33, { px: 24, w: 700, col: INK }); y += 44; }
  else head('特性');
  if (R.PASSIVE[id]) { text(`被動「${R.PASSIVE[id][0]}」`, cx, y + 30, { px: 24, w: 900, col: '#1f6a5c' }); text(fit(R.PASSIVE[id][1], cw - mw(`被動「${R.PASSIVE[id][0]}」`, 24, 900) - 16, 24, 700), cx + mw(`被動「${R.PASSIVE[id][0]}」`, 24, 900) + 14, y + 30, { px: 24, w: 700, col: INK }); y += 44; } y += 22;
  // 招式（兩欄）與合體技
  const sk = R.SKILLS[id] || [], known = k => !inRun || (run.skills[id] || []).includes(k.key), un = R.UNITES.filter(U => U.who.includes(id)), cells = [...sk.map(k => ({ k })), ...un.map(U => ({ U }))], colW2 = cw / 2, rowH = cells.length > 6 ? 56 : 62;
  head('招式', id === run.starter && sk.some(k => !known(k)) ? '蓋章的還沒學：強化「在職進修」可以學' : un.length ? '金框是合體技：指定的夥伴同場才能放' : '只花 SP，不用氣勢');
  cells.forEach(({ k, U }, i) => { const x = cx + (i % 2) * colW2, yy = y + Math.floor(i / 2) * rowH, ok = k ? known(k) : U.who.every(h => !inRun || run.roster.includes(h)), im = k ? A.icons['sk_' + k.key] : A.icons.sk_ult, nm = k ? k.name + (inRun && R.isPlus(run, id, k.key) ? '＋' : '') : U.name, tp = (k || U).type;
    c.save(); c.globalAlpha = ok ? 1 : .42; if (U) { c.fillStyle = '#6e5a1c'; c.fillRect(x, yy + 6, 50, 50); } if (im) pix(im, x + (U ? 5 : 0), yy + 6 + (U ? 5 : 0), U ? 40 : 50, U ? 40 : 50);
    text(fit(nm, colW2 - 76 - (tp ? 40 : 0), 26, 900, SERIF), x + 62, yy + 28, { px: 26, w: 900, fam: SERIF, col: INK }); if (tp) typeChip(tp, x + colW2 - 56, yy + 4, 30);
    text(fit(k ? `SP ${inRun ? R.skCost(run, id, k) : k.sp}　${k.note}` : `合體・${U.who.filter(h => h !== id).map(h => DEFS[h].name).join('、')}　SP ${U.sp[U.who.indexOf(id)]}`, colW2 - 80, 20, 700), x + 62, yy + 52, { px: 20, w: 700, col: k ? INK2 : '#8a6a12' }); c.restore();
    if (k && !ok) skin.stamp('還沒學', x + colW2 - 110, yy + 30, -.1, 15); });
  y += Math.ceil(cells.length / 2) * rowH + 30;
  head('奧義', `SP ${st.cost}　氣勢 ${R.ultMo(run)}`);
  { const im = A.icons.sk_ult || A.icons.up_morale; c.fillStyle = '#6e1c16'; c.fillRect(cx, y + 4, 50, 50); c.strokeStyle = BRASS; c.lineWidth = 3; c.strokeRect(cx + 1.5, y + 5.5, 47, 47); if (im) pix(im, cx + 5, y + 9, 40, 40); text(`「${d.skill}」`, cx + 58, y + 30, { px: 28, w: 900, fam: SERIF, col: INK, ls: 2 }); if (R.ULT_TYPE[id]) typeChip(R.ULT_TYPE[id], cx + cw - 36, y + 6, 30);
    text(fit(d.desc || (R.ULTS[id] || [])[1] || '', cw - 70, 20, 700), cx + 62, y + 56, { px: 20, w: 700, col: INK2 }); }
  // 下方按鈕
  const by = ly + lh - 100, n = sheetList().length; if (n > 1) { sheetBtn('上一位', rx, by, 230, 100, 0); sheetBtn('下一位', rx + 250, by, 230, 100, 1); text(`${sheetList().indexOf(id) + 1}／${n}`, rx + 580, by + 50, { px: 26, w: 900, align: 'center', col: CREAM }); text(inRun ? '隊伍' : '名冊', rx + 580, by + 80, { px: 18, w: 700, align: 'center', col: 'rgba(239,230,207,.7)' }); }
  sheetBtn(panel ? '回選單' : '回行程表', rx + rw - 330, by, 330, 100, 2, true);
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
const STYLE_TAG = { ember: '灼燒', bounty: '標記', riposte: '反擊', dossier: '證據', crunch: '加班', tempo: '氣勢', morale: '氣勢', weakpoint: '抓理虧', raise: '火力', chair: '耐久', leave: '耐久', firstaid: '耐久', learn: '多招', drinks: '補給', coffee: '補給', bento: '補給' };
function openReport(t0, win) { const rounds = run.rounds + (state.round || 0), cnt = {}; for (const k of run.picks) cnt[k] = (cnt[k] || 0) + 1; if (!win) R.addTally(state, run);
  const tg = {}; for (const k of run.picks) { const w = STYLE_TAG[k] || R.UP_TAG[k]; if (w) tg[w] = (tg[w] || 0) + (R.UPGRADES[k].once ? 2 : 1); }
  report = { t0, win, rounds, style: Object.entries(tg).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]), brk: run.tally.brk, ult: run.tally.ult, log: win ? [] : lastLog.slice(-4), bonus: win ? Math.max(1000, 16000 - rounds * 400) : 0, floor: run.floor, stage: R.nodeName(run.node, run), bossHp: !win && state.hasBoss ? Math.ceil(state.hp.boss / R.STAT.boss.hp * 100) : null, ups: Object.entries(cnt),
    route: R.MAP.map((fl, k) => k <= run.floor && run.path[k] != null && fl[run.path[k]] ? fl[run.path[k]] : null), party: run.roster.map(id => { const on = R.HEROES.includes(id); return { id, on, down: id !== 'vivi' && !((on ? state.hp[id] : run.hp[id]) > 0) }; }) };
  for (let i = 0; i < 4; i++) snd(t0 + .5 + i * .3, 'stat', .7); snd(t0 + 1.9, 'card', .9); }
function drawReport() { const k = report; if (!k || now < k.t0) return; zones = [];
  const el = now - k.t0, u = easeOut(sat(el / .4)), PW = 940, PH = 1008, X = (k.win ? 46 : W / 2 - PW / 2) - (1 - u) * 60, Y = 36, L = X + 64, IW = PW - 128, nF = R.MAP.length, show = i => easeOut(sat((el - .45 - i * .3) / .3));
  const head = (s, y, i) => { c.globalAlpha = show(i); c.fillStyle = RED; c.fillRect(L, y - 18, 6, 22); text(s, L + 16, y, { px: 21, w: 900, col: INK, ls: 6 }); c.fillStyle = 'rgba(43,31,24,.18)'; c.fillRect(L + 22 + mw(s, 21, 900) + s.length * 6, y - 8, IW - 22 - mw(s, 21, 900) - s.length * 6, 2); };
  c.save(); c.globalAlpha = sat(el / .25); skin.wood(X, Y, PW, PH); skin.paper(X + 20, Y + 20, PW - 40, PH - 40, { clips: [X + 130, X + PW - 130] });
  text('結案報告', L, Y + 130, { px: 78, w: 900, fam: SERIF, col: INK, ls: 10 }); text(k.win ? `討伐${DEFS.boss.name}　${nF} 站全部走完` : `倒在第 ${k.floor + 1} 站「${k.stage}」` + (k.bossHp != null ? `　對方還剩 ${k.bossHp}% 的血` : ''), L + 4, Y + 174, { px: 24, w: 700, col: INK2, ls: 2 }); c.fillStyle = INK; c.fillRect(L, Y + 192, IW, 3); text('打法：' + (k.style.length ? k.style.join('・') : '還看不出來'), L + IW, Y + 174, { px: 22, w: 900, align: 'right', col: RED });
  // 路線：走過的站連成紅線；倒下的那一站打叉；沒走到的是虛線圈
  { const y0 = Y + 244, gap = (IW - 68) / (nF - 1), cy = y0 + 62, cx = i => L + 34 + i * gap, last = k.win ? nF - 1 : k.floor; head('路線', y0, 0);
    c.strokeStyle = 'rgba(43,31,24,.3)'; c.lineWidth = 4; c.setLineDash([3, 9]); c.beginPath(); c.moveTo(cx(0), cy); c.lineTo(cx(nF - 1), cy); c.stroke(); c.setLineDash([]); if (last > 0) { c.strokeStyle = '#c23b2e'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx(0), cy); c.lineTo(cx(last), cy); c.stroke(); }
    k.route.forEach((nd, i) => { const x = cx(i), r = 30, fell = !k.win && i === k.floor;
      if (!nd) { c.fillStyle = '#e9dfc6'; c.beginPath(); c.arc(x, cy, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(43,31,24,.4)'; c.lineWidth = 3; c.setLineDash([5, 6]); c.beginPath(); c.arc(x, cy, r - 2, 0, 7); c.stroke(); c.setLineDash([]); text('？', x, cy + 11, { px: 28, w: 900, fam: SERIF, align: 'center', col: 'rgba(43,31,24,.4)' }); return; }
      c.fillStyle = '#1c120c'; c.beginPath(); c.arc(x, cy, r + 4, 0, 7); c.fill(); c.fillStyle = nd.icon === 'boss' || nd.icon === 'chief' ? '#6e1c16' : '#33241a'; c.beginPath(); c.arc(x, cy, r, 0, 7); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 3; c.beginPath(); c.arc(x, cy, r - 2, 0, 7); c.stroke();
      const im = A.icons[nd.icon]; if (im) pix(im, x - 23, cy - 23, 46, 46); else text(nd.tag[0], x, cy + 11, { px: 28, w: 900, fam: SERIF, align: 'center', col: CREAM });
      if (fell) { c.strokeStyle = 'rgba(20,6,4,.9)'; c.lineWidth = 12; c.lineCap = 'round'; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x - 22, cy - 22 * d); c.lineTo(x + 22, cy + 22 * d); c.stroke(); } c.strokeStyle = '#e0483a'; c.lineWidth = 7; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x - 22, cy - 22 * d); c.lineTo(x + 22, cy + 22 * d); c.stroke(); } c.lineCap = 'butt'; }
      text(fit(R.nodeName(nd, run), gap - 6, 15, 900, SERIF), x, cy + 58, { px: 15, w: 900, fam: SERIF, align: 'center', col: fell ? RED : INK }); }); }
  // 同行夥伴
  { const y0 = Y + 416; head('同行夥伴', y0, 1); k.party.forEach((p, i) => { const x = L + 6 + i * 136, y = y0 + 22, d = DEFS[p.id]; skin.face(A.face[p.id], x + 20, y, 76, p.down ? .55 : 0);
      text(d.name, x + 58, y + 104, { px: 21, w: 900, fam: SERIF, align: 'center', col: INK }); text(p.down ? '倒下' : p.on ? '出戰' : '候補', x + 58, y + 126, { px: 15, w: 900, align: 'center', col: p.down ? RED : p.on ? '#1f6a5c' : INK2 }); }); }
  // 強化
  { const y0 = Y + 600; head('拿到的強化', y0, 2); if (!k.ups.length) text('這一輪沒有拿強化', L + 16, y0 + 60, { px: 20, w: 700, col: INK2 });
    k.ups.forEach(([key, n], i) => { const x = L + 6 + i * 104, y = y0 + 18, im = A.icons['up_' + key]; c.fillStyle = '#1c120c'; c.fillRect(x + 12, y - 2, 68, 68); c.fillStyle = '#3a2a1e'; c.fillRect(x + 15, y + 1, 62, 62); if (im) pix(im, x + 18, y + 4, 56, 56);
      if (n > 1) { c.fillStyle = RED; c.fillRect(x + 60, y + 46, 32, 24); text(`×${n}`, x + 76, y + 64, { px: 17, w: 900, align: 'center', col: '#fff8e6' }); } text(fit(R.UPGRADES[key].name, 100, 15, 900), x + 46, y + 88, { px: 15, w: 900, align: 'center', col: INK }); }); }
  // 數字
  { const y0 = Y + 748, cu = easeOut(sat((el - 1.35) / .6)), cells = k.win ? [['總回合數', Math.round(k.rounds * cu), INK], ['打到理虧', `${k.brk} 次`, INK], ['放奧義', `${k.ult} 次`, INK], ['獎金', Math.round(k.bonus * cu).toLocaleString('en-US'), '#a8741a']] : [['總回合數', Math.round(k.rounds * cu), INK], ['走到', `第 ${k.floor + 1} 站`, INK], ['打到理虧', `${k.brk} 次`, INK], ['放奧義', `${k.ult} 次`, INK]]; head('統計', y0, 3);
    cells.forEach(([lab, v, col], i) => { const x = L + i * (IW / 4); text(lab, x + 16, y0 + 44, { px: 18, w: 700, col: INK2, ls: 3 }); text(String(v), x + 16, y0 + 88, { px: 40, w: 900, col }); if (i) { c.fillStyle = 'rgba(43,31,24,.18)'; c.fillRect(x - 4, y0 + 24, 2, 84); } }); }
  c.globalAlpha = sat(el / .25);
  if (k.win) text('今天，準時下班。', L + 8, Y + PH - 74, { px: 38, w: 900, fam: SERIF, col: INK, ls: 6 }); else if (k.log.length) { text('最後幾步', L + 8, Y + PH - 136, { px: 16, w: 900, col: RED, ls: 4 }); k.log.forEach((ln, i) => text(fit(ln, IW - 384, 17), L + 8, Y + PH - 110 + i * 24, { px: 17, w: 700, col: INK2 })); }
  else wrap('提示：看到「蓄力」就防禦或用坦克的奧義；血少先喝珍珠奶茶；岔路多去茶水間。', IW - 400, 20).forEach((ln, i) => text(ln, L + 8, Y + PH - 100 + i * 30, { px: 20, w: 700, col: INK2 }));
  { const se = el - 1.9; if (se > 0) skin.stamp(k.win ? '討伐完成' : '未結案', X + PW - 210, Y + 112, -.12, 46, se < .2 ? lerp(2.4, 1, easeOut(se / .2)) : 1); }
  c.restore(); if (phase === 'over') bigButton(k.win ? '再玩一次' : '再挑戰一次', X + PW - 64 - 180, Y + PH - 88, 360, 92);
}
// 封面上另外開的兩張紙：玩法說明、更新紀錄（新版本往最上面加一筆，留最近八筆）
let titleInfo = null, bootClosed = false;
const HELP = ['一個人出發，照行程表一站一站走到最後；路上招募同事，最多四人上場', '打贏戰鬥可以三選一強化；岔路自己選：休息、福利、救人或找新同事', '行動會累積全隊共用的「氣勢」，夠了就能放奧義', '手下還在場上的時候頭目不會受傷；把頭目的「底氣」打到歸零，他會理虧', '頭目蓄力之後下一次行動放大招：用防禦、坦克的招式或奧義撐過去', '行程表左邊的隊伍可以點開：調順序、看每個人的素質與招式；戰鬥中也能開', '進度會自動存在這台裝置上，下次打開可以「繼續上班」'];
const CHANGES = [['v0.19.0', '加班等級：通關後可以挑更難的版本，一共五級', ''], ['v0.18.0', '第三張地圖「地獄分公司」：十三站、補給站與免費特訓站', '敵人會上護盾、點名列管、下毒；三個新頭目'], ['v0.17.0', '台灣篇換上新美術：三張地圖紙、三個頭目、六種小兵', '休息站可以改成「特訓」把招式升級；十五個新的辦公小物'], ['v0.16.0', '每個人多兩招、一個被動、普攻各有附帶效果；十一組合體技', '新狀態：護盾、再生、中毒、暈眩、攻擊提升；資料卡重排'], ['v0.15.0', '新路線「台灣篇」十二站三條支線；行程表地圖放大、可以拖著看', '六種屬性與弱點、頭目蓄力的屬性鎖；普攻和防禦會回 SP'], ['v0.14.0', '五個新壞人：鸚鵡長官、猴子長官、豬腦長官、大媽同事、臭臭阿北', '第 3、4、6、9 站每一輪會抽不同的對手，各有各的打法'], ['v0.13.1', '「隊伍與道具」重新排版：用滿整個畫面、字放大', '強化直接寫出名字和效果；夥伴名冊收到第二個頁籤'], ['v0.13.0', '敵人頭上會預告下一步；選目標時顯示大約打多少', '戰鬥可以調 1.5／2 倍速；岔路寫明得到與代價；結案報告多了打法與最後幾步'] ];
function drawOverlay() {
  if (phase === 'title' || phase === 'load') { zones = []; if (phase === 'title' && !bootClosed) { bootClosed = true; window.__bootDone && window.__bootDone(); }
    // 封面：整張主視覺（art/map/cover.jpg），上面只放標題與按鈕；玩法說明、更新紀錄另外開
    if (A.map.cover) c.drawImage(A.map.cover, 0, 0, W, H); else { c.fillStyle = 'rgba(10,7,6,.76)'; c.fillRect(0, 0, W, H); }
    text('不 想 上 班 RPG', W / 2, 96, { px: 30, w: 700, align: 'center', col: '#f0d48a', ls: 12, stroke: 'rgba(20,10,4,.9)', sw: 6 });
    text('上班旅人', W / 2, 262, { px: 176, w: 900, fam: SERIF, align: 'center', ls: 26, col: '#fff3d6', stroke: 'rgba(24,10,4,.96)', sw: 22 }); text('上班旅人', W / 2, 262, { px: 176, w: 900, fam: SERIF, align: 'center', ls: 26, col: '#fff3d6', stroke: BRASS, sw: 5 }); text('上班旅人', W / 2, 262, { px: 176, w: 900, fam: SERIF, align: 'center', ls: 26, col: '#fff3d6' });
    c.fillStyle = 'rgba(20,10,4,.85)'; c.fillRect(W / 2 - 330, 296, 660, 9); c.fillStyle = BRASS; c.fillRect(W / 2 - 328, 298, 656, 5); text('討伐奧客總經理', W / 2, 356, { px: 40, w: 900, fam: SERIF, align: 'center', col: CREAM, ls: 14, stroke: 'rgba(20,10,4,.9)', sw: 8 }); skin.stamp(`試玩版 ${VERSION}`, W / 2 + 520, 204, -.08, 24);
    if (phase === 'title' && saved === undefined) saved = readSave();
    // 按鈕放右下角、小開關放左下角，中間留給封面上的主角群
    if (phase === 'title' && saved) { const r = saved.run; bigButton('繼續上班', 1660, 846, 420, 108, 'cont'); bigButton('重新開始', 1660, 968, 340, 84, 'new');
      text(`上次的進度：第 ${r.floor + 1} 站` + (r.map === 'mirror' ? '（鏡像內戰）' : ''), 1870, 744, { px: 22, w: 900, align: 'right', col: CREAM, stroke: 'rgba(20,10,4,.9)', sw: 6 }); text(`${r.roster.slice(0, 4).map(id => DEFS[id].name).join('、')}${r.roster.length > 4 ? ` 等 ${r.roster.length} 人` : ''}`, 1870, 774, { px: 20, w: 700, align: 'right', col: CREAM, stroke: 'rgba(20,10,4,.9)', sw: 6 }); }
    else if (phase === 'title') bigButton('開始上班', 1650, 930, 430, 118); else text(loadMsg + '…', 1650, 940, { px: 30, w: 500, align: 'center', col: COL.dim });
    toggles(28, 1016); toggle('玩法說明', 28, 966, 'help', 150); toggle('更新紀錄', 190, 966, 'log', 170);
    if (titleInfo) { zones = []; zones.push({ x: 0, y: 0, w: W, h: H, opt: 'infoClose' }); c.fillStyle = 'rgba(8,5,4,.72)'; c.fillRect(0, 0, W, H); const help = titleInfo === 'help', rows = help ? HELP : CHANGES, PWd = 1240, PHt = 150 + rows.length * (help ? 60 : 74), PX0 = W / 2 - PWd / 2, PY0 = H / 2 - PHt / 2;
      skin.wood(PX0, PY0, PWd, PHt); skin.paper(PX0 + 26, PY0 + 26, PWd - 52, PHt - 52, { clips: [PX0 + 120, PX0 + PWd - 120] }); text(help ? '玩法說明' : '更新紀錄', W / 2, PY0 + 92, { px: 44, w: 900, fam: SERIF, align: 'center', col: INK, ls: 10 }); c.fillStyle = RED; c.fillRect(W / 2 - 70, PY0 + 108, 140, 4);
      rows.forEach((r, i) => { const y = PY0 + 164 + i * (help ? 60 : 74); if (help) { gem(PX0 + 78, y - 8, 6, RED); text(r, PX0 + 100, y, { px: 26, w: 700, col: INK }); } else { text(r[0], PX0 + 70, y, { px: 24, w: 900, col: RED }); text(fit(r[1], PWd - 300, 24), PX0 + 210, y, { px: 24, w: 900, col: INK }); if (r[2]) text(fit(r[2], PWd - 300, 20), PX0 + 210, y + 30, { px: 20, w: 700, col: INK2 }); } });
      text('點任何地方關閉', W / 2, PY0 + PHt + 40, { px: 22, w: 700, align: 'center', col: 'rgba(239,230,207,.8)' }); }
    { const tip = a2hs(); if (tip) { const x = 1392, y = 52, w = 492, h = 150, pe = pressed && pressed.opt === 'a2hs' ? 1 : 0; zones.push({ x, y, w, h, opt: 'a2hs' }); c.save(); c.translate(0, pe ? 4 : 0); skin.paper(x, y, w, h, { clips: [x + 60, x + w - 60] });
        if (iconImg) { c.imageSmoothingEnabled = false; c.drawImage(iconImg, x + 20, y + 22, 106, 106); c.imageSmoothingEnabled = true; } text(tip[0], x + 144, y + 62, { px: 28, w: 900, fam: SERIF, col: INK }); text(tip[1], x + 144, y + 98, { px: 20, w: 700, col: INK2 }); text(installEvt ? '' : '點一下這張紙就不再提醒', x + 144, y + 128, { px: 16, w: 500, col: 'rgba(43,31,24,.55)' }); c.restore(); } } text('滑鼠／觸控點選，或用方向鍵與 Enter', 1870, 1060, { px: 18, w: 700, align: 'right', col: 'rgba(239,230,207,.85)', stroke: 'rgba(20,10,4,.8)', sw: 4 }); }
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
  if (z.opt === 'help' || z.opt === 'log' || z.opt === 'infoClose') { pressed = { opt: z.opt, t: performance.now() }; uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; titleInfo = z.opt === 'infoClose' ? null : z.opt; }, PRESS_MS); return; }
  if (z.opt === 'spd') { pressed = { opt: 'spd', t: performance.now() }; PREF.spd = ((PREF.spd || 0) + 1) % SPEEDS.length; savePref(); uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; }, PRESS_MS); return; }
  if (z.opt === 'panel') { pressed = { opt: 'panel', t: performance.now() }; uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; if (phase === 'command' && menu && !panel) openPanel(); }, PRESS_MS); return; }
  if (z.opt) { pressed = { opt: z.opt, t: performance.now() }; PREF[z.opt] = !PREF[z.opt]; PREF.set = true; savePref(); if (z.opt === 'mute') master.gain.value = PREF.mute ? 0 : .9; else applyQuality(); uiSound('ok'); buzz(8); setTimeout(() => { pressed = null; }, PRESS_MS); return; }
  if (z.off) { pressed = { i: z.i, t: performance.now() }; uiSound('no'); buzz([8, 40, 8]); setTimeout(() => { pressed = null; }, 260); return; }
  pressed = { i: z.i, big: z.big, act: z.act, t: performance.now() }; uiSound('ok'); buzz(14); if (!z.big) focus = z.i;
  const m = menu, ph = phase; setTimeout(() => { pressed = null; if (z.big) { if (ph === 'title') { phase = 'anim'; audioReady.then(z.act === 'cont' ? resume : start); } else if (ph === 'over') location.reload(); return; } if (menu === m && ['command', 'pick', 'hub'].includes(phase)) m.items[z.i].go(); }, PRESS_MS);
}
const mapFree = () => phase === 'hub' && !panel && !sheet && menu;
stage.addEventListener('pointermove', e => { pointer = toStage(e); if (mapDrag) { const dx = pointer[0] - mapDrag.p[0], dy = pointer[1] - mapDrag.p[1]; if (Math.hypot(dx, dy) > 14) mapDrag.moved = true; if (mapDrag.moved) { mapCamT = null; mapCam = clampCam([mapDrag.cam[0] - dx / mapZ, mapDrag.cam[1] - dy / mapZ]); if (!PREF.dragged) { PREF.dragged = true; savePref(); } } return; } const z = hitZone(pointer); if (z && !z.big && !z.opt && !z.off && ['command', 'pick', 'hub'].includes(phase) && z.i !== focus) { focus = z.i; } });
const inRect = (p, r) => p && r && p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
stage.addEventListener('pointerdown', e => { e.preventDefault(); pointer = toStage(e); if (AC.state !== 'running') AC.resume(); if (sheet && inRect(pointer, sheetRect)) { drag = pointer; return; } const z = hitZone(pointer); if (mapFree() && (!z || z.map)) { mapDrag = { p: pointer, cam: mapCam.slice(), z, moved: false }; return; } press(z); });      // 行程表：按在地圖上先當成要拖，放開時沒移動才算點那一站
// 資料卡的立繪：往左滑看原型、往右滑回像素版；只點一下就是換另一張
addEventListener('pointerup', e => { if (mapDrag) { const m = mapDrag; mapDrag = null; if (!m.moved && m.z && mapFree()) press(m.z); return; } if (!drag) return; const p = toStage(e), dx = p[0] - drag[0]; drag = null; if (sheet) flipSheet(Math.abs(dx) > 40 ? dx < 0 : !sheetReal); });
addEventListener('keydown', e => { if (phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (phase === 'over' && (e.code === 'Enter' || e.code === 'Space')) return press(zones.find(z => z.big)); if (!['command', 'pick', 'hub'].includes(phase) || !menu) return; const n = menu.items.length;
  const step = d => { let i = focus; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!menu.items[i].off) break; } if (i !== focus) { focus = i; uiSound('move'); if (mapFree() && menu.items[i].node != null) mapLook(lay().stn[run.floor][i]); } };
  if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { step(1); e.preventDefault(); } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { step(-1); e.preventDefault(); } else if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); press({ i: focus, off: !!menu.items[focus]?.off }); } else if (e.code === 'Escape' || e.code === 'Backspace') { const b = menu.items.find(i => i.back); if (b) b.go(); } });
// 擋掉縮放、選取、長按選單
for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu', 'selectstart']) addEventListener(ev, e => e.preventDefault(), { passive: false });
addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); else if (mapFree()) { mapCamT = null; mapCam = clampCam([mapCam[0] + e.deltaX / mapZ, mapCam[1] + e.deltaY / mapZ]); } }, { passive: false }); addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// ---------- 主迴圈 ----------
let last = performance.now(), pruneAt = 0, slowN = 0, slowSum = 0;
function frame(ts) {
  const dt = Math.min(.1, (ts - last) / 1000); last = ts;
  if (!PREF.set && !PREF.low && (phase === 'title' || phase === 'load') && ++slowN > 20) { slowSum += dt; if (slowN === 70 && slowSum / 50 > .03) { PREF.low = true; applyQuality(); } }
  now += dt * speedNow();      // ↑ 開始畫面平均不到 33 格：自動切省電畫質
  while (todo.length && todo[0].t <= now) todo.shift().fn();
  arena.update(now); for (const id in units) units[id].update(now); for (const u of spareUnits()) u.update(now);
  for (const id of R.FRONT) if (ko[id]) { const m = units[id].mesh; if (units[id].frames.ko) m.material.color.multiplyScalar(.82); else { m.material.color.multiplyScalar(.3); m.scale.y *= .62; } }
  FXL.update(now); cam.update(now); for (const id in units) { const u = units[id]; u.x = u.group.position.x; }
  if (!((phase === 'hub' || phase === 'pick') && A.map.table)) E.render(1); ui.draw(now, SFX); c.globalAlpha = 1; { const mv = S.mo.filter(k => k.t <= now).at(-1)?.v ?? state.mo; moShown += (mv - moShown) * .18; } drawStageCard(); drawMenu(); drawOverlay();
  if (now > pruneAt) { pruneAt = now + 2; FXL.prune(now); S.nums = S.nums.filter(n => n.t > now - 4); S.boxes = S.boxes.filter(b => b.t1 > now - 1); S.items = S.items.filter(k => k.t0 > now - 3); S.subs = S.subs.filter(k => k.t0 > now - 8); S.cutins = S.cutins.filter(k => k.t0 > now - 4); S.cards = S.cards.filter(k => k.t1 > now - 1); S.menus.length = 0; }
  requestAnimationFrame(frame);
}
units.md.show(-2, false); cam.to(-1, 0, WIDE); enterStage();
window.__game = { get state() { return state; }, get mapCam() { return [...mapCam, mapZ]; }, mapLook: (p, snap) => mapLook(p, snap), sheet: id => openSheet(id), get sheetId() { return sheet; }, openPanel: () => openPanel(), tab: t => { panelTab = t; refreshPanel(); }, flip: () => flipSheet(), get panel() { return panel; }, get run() { return run; }, go: i => chooseNode(i), get front() { return R.FRONT.slice(); }, S, units, get phase() { return phase; }, testReport: win => { phase = 'over'; menu = null; if (S.ui.length) S.ui.at(-1).t1 = now; if (!win) SFX.add('black', now, 1e9, { from: .72, to: .72 }); openReport(now, win); }, get saved() { return saved; }, resume: () => press(zones.find(z => z.act === 'cont')), get now() { return now; }, get menu() { return menu; }, get actor() { return actor; }, press: i => { focus = i; menu.items[i].go(); }, tap: i => press({ i, off: !!menu.items[i].off }), start: () => press(zones.find(z => z.big)) };
booted = true; requestAnimationFrame(frame); loadMsg = '聲音載入中'; phase = 'load'; audioReady.then(() => { if (phase === 'load') phase = 'title'; });
// 等聲音太久（網路慢）也讓玩家先開始
setTimeout(() => { if (phase === 'load') phase = 'title'; }, 6000);
