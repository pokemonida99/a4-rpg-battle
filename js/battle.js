// 這一場戰鬥的全部內容：角色與敵人的設定、時間軸（誰在什麼時候做什麼）、特效、鏡頭、音效事件。
// 改演出只要改這個檔。時間軸用一個往前走的游標 T 排，改前面的長度後面會自動順延。
import { THREE, PPU, W, H, sat, lerp, ease, easeOut, rnd, loadTex } from './engine.js';
import { loadFx, makeFxLayer } from './fx.js';
import { buildArena } from './scene.js';
import { Unit, makeCam, stepAt } from './units.js';
import { makeScreenFx } from './screenfx.js';
import { makeUI } from './ui.js';

// ---------- 設定 ----------
const ST = (hp, sp, a, m, d, r, s, c) => [['HP', hp, 6000], ['SP', sp, 500], ['物攻', a, 500], ['魔攻', m, 500], ['物防', d, 500], ['魔防', r, 500], ['速度', s, 500], ['會心', c, 500]];
export const DEFS = {
  kui: { name: '小葵', job: '劍士', tag: '新人設計師', lv: 36, hp: 2680, sp: 142, color: '#ff7a3c', pal: 'fire', skill: '吐槽一閃', en: 'TSUKKOMI FLASH', cost: 30, eyeY: .56, pos: [1.4, -1.6], hgt: 1.5,
    stats: ST(2680, 142, 412, 96, 238, 180, 356, 298), desc: '看不下去的事，一刀說破。對敵方全體連續斬擊，並削減護盾。', trait: '新人的直覺', traitDesc: '戰鬥開始時必定最先行動。', face: [120, 230, 420] },
  kevin: { name: 'Kevin', job: '坦克', tag: '總經理特助', lv: 39, hp: 4860, sp: 118, color: '#3cd8e8', pal: 'cyber', skill: '鐵壁・AI 護盾', en: 'IRON WALL : AI SHIELD', cost: 24, eyeY: .56, pos: [2.25, -.5], hgt: 1.62,
    stats: ST(4860, 118, 286, 64, 472, 388, 142, 120), desc: '「這個用 AI 擋就好了。」替全隊擋下敵人的下一次攻擊。', trait: '特助的職責', traitDesc: '同伴受到攻擊時，由自己代為承受。', face: [270, 160, 420] },
  jie: { name: '阿傑', job: '黑魔法師', tag: '資深設計師', lv: 41, hp: 2140, sp: 388, color: '#a45cff', pal: 'arcane', skill: '深淵死線', en: 'ABYSSAL DEADLINE', cost: 180, eyeY: .52, pos: [3.35, .5], hgt: 1.72,
    stats: ST(2140, 388, 118, 468, 164, 342, 228, 206), desc: '把截稿日前夜的絕望化為暗屬性魔法，攻擊敵方全體。', trait: '老鳥的餘裕', traitDesc: 'SP 消耗減半，倒數越少威力越高。', face: [320, 280, 400] },
  mi: { name: '小米', job: '白魔法師', tag: '客服專員', lv: 37, hp: 2320, sp: 356, color: '#ffd45a', pal: 'holy', skill: '聖光專線', en: 'HOLY HOTLINE', cost: 160, eyeY: .52, pos: [4.25, 1.5], hgt: 1.5,
    stats: ST(2320, 356, 92, 398, 186, 420, 264, 150), desc: '「很高興為您服務。」全隊 HP 完全回復，並以聖光攻擊敵方單體。', trait: '客服的平常心', traitDesc: '不受任何異常狀態影響。', face: [120, 210, 420] },
  vivi: { name: 'Vivi', job: '公主', tag: '老闆', lv: 50, hp: 9999, sp: 999, color: '#ff6aa8', pal: 'neon', skill: '皇家敕令・準時下班', en: 'ROYAL DECREE : CLOCK OUT ON TIME', cost: 99, eyeY: .56, pos: [5.55, -.55], hgt: 1.62,
    stats: ST(9999, 999, 1, 1, 500, 500, 12, 500), desc: '「全員準時下班！」全隊攻擊力大幅提升，並發動總攻擊。', trait: '老闆的加油', traitDesc: '站在後排，不會被攻擊。平常只負責說加油。', face: [90, 210, 420] },
  boss: { name: '奧客總經理', enemy: true, hp: 120000, pos: [-3.0, -.5], hgt: 3.35, face: [110, 58, 80] },
  ma: { name: '社畜小兵', enemy: true, hp: 3800, pos: [-.6, 1.05], hgt: 1.36, face: [19, 5, 34] },
  mb: { name: '社畜小兵', enemy: true, hp: 3800, pos: [-1.55, -1.7], hgt: 1.36, face: [19, 5, 34] },
  // 魔王大招之後叫來的第二批（一開始不在場上）
  mc: { name: '加班小兵', enemy: true, hp: 3800, pos: [-.6, 1.05], hgt: 1.36, face: [19, 5, 34] },
  md: { name: '加班小兵', enemy: true, hp: 3800, pos: [-1.55, -1.7], hgt: 1.36, face: [19, 5, 34] },
};
// 道具：n＝持有數；hp／sp＝回復量
const BAG = { tea: { name: '珍珠奶茶', n: 3, note: 'HP 回復 2000', hp: 2000 }, coffee: { name: '黑咖啡', n: 2, note: 'SP 回復 150', sp: 150 }, bento: { name: '雞排便當', n: 1, note: '戰鬥不能回復' } };
// 喊招台詞與錄音長度（秒）
export const LINES = { kui: ['吐槽一閃！', 1.67], jie: ['深淵……死線！', 2.45], kevin: ['這個，用 AI 擋就好了！', 2.88], mi: ['聖光專線，很高興為您服務！', 2.84], vivi: ['全員準時下班！', 2.47],
  boss_intro: ['我要找你們主管！', 1.66], boss_attack: ['再改一版！', 1.05], boss_down: ['我……要客訴……', 3.06] };
export const PARTY = ['kui', 'kevin', 'jie', 'mi', 'vivi'], FOES = ['boss', 'ma', 'mb', 'mc', 'md'];
export const WIDE = { x: .65, y: 1.5, z: -.3, d: 12.9, pitch: 10, fov: 28, blur: 7 };
const ULT_T = [0, .13, .28, .44, .51, .58, .92, 1.12], PEAK = .58;      // 大招 8 格各自開始的時間；第 6 格是出手的頂點

// 場景、角色、特效層、狀態軌道：影片（buildBattle）和試玩版（game.js）共用
export async function setupStage(E) {
  const arena = await buildArena(E), g = arena.group;
  // ---------- 載入素材 ----------
  const tryTex = async url => { try { return await loadTex(url); } catch (e) { return null; } };
  const img = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('載不到 ' + url)); im.src = url; });
  const units = {}, A = { face: {}, bust: {}, eyes: {}, items: {} };
  for (const k of ['tea', 'coffee']) { try { A.items[k] = await img(`art/items/${k}.png`); } catch (e) { A.items[k] = null; } }
  for (const id of PARTY) {
    const d = DEFS[id], f = {}; for (const k of ['ready', 'wind', 'act', 'win']) f[k] = await loadTex(`art/chars/${id}_${k}.png`);
    const ult = await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(i => tryTex(`art/chars/anim/${id}_${i}.png`)));
    f.ult = ult.every(Boolean) ? ult : [f.ready, f.wind, f.wind, f.act, f.act, f.act, f.act, f.ready];
    for (const k of ['hurt', 'guard', 'cheer']) { if ((k === 'cheer') !== (id === 'vivi') && k !== 'guard') continue; const tx = await tryTex(`art/chars/pose/${id}_${k}.png`); if (tx) f[k] = tx; }      // 試玩版用：受擊、防禦（Vivi 是應援、防禦）
    if (id === 'kui') { const h3 = await Promise.all(Array.from({ length: 24 }, (_, i) => tryTex(`art/chars/h3/kui_${String(i + 1).padStart(2, '0')}.png`))); if (h3.every(Boolean)) f.h3 = h3; }      // 試驗：影片抽格的 24 格揮劍（試玩版的普攻與直球吐槽用）
    if (id !== 'vivi') { const ko = await Promise.all([1, 2].map(i => tryTex(`art/chars/ko/${id}_${i}.png`))); if (ko.every(Boolean)) f.ko = ko; }      // 倒地：跪倒 → 趴在地上（試玩版用，沒有圖就不放）
    const s = d.hgt * PPU / f.ready.image.height; f.ult.k = ult.every(Boolean) ? f.ready.image.height / ult[0].image.height : 1;      // 逐格圖的像素密度可能跟站姿圖不同，用第一格的高度對齊
    units[id] = new Unit(g, f, { x: d.pos[0], z: d.pos[1], scale: s, tint: 0xf2ecff, phase: PARTY.indexOf(id) * .37 });
    A.bust[id] = await img(`art/cutin/bust_${id}.png`); A.eyes[id] = await img(`art/cutin/eyes_${id}.jpg`);
  }
  { const d = DEFS.boss, idle = await loadTex('art/enemy/boss_idle.png'), atk = await loadTex('art/enemy/boss_atk.png');
    const seq = await Promise.all([1, 2, 3, 4, 5, 6].map(i => tryTex(`art/enemy/anim/boss_${i}.png`)));
    const hurt = await tryTex('art/enemy/boss_hurt.png'), stun = await tryTex('art/enemy/boss_stun.png');
    const f = { idle, atk, ...(hurt && { hurt }), ...(stun && { stun }), swing: seq.every(Boolean) ? [idle, seq[0], seq[1], atk, seq[2], seq[3], seq[4], seq[5]] : [idle, atk, atk, atk, atk, atk, idle, idle] };
    units.boss = new Unit(g, f, { x: d.pos[0], z: d.pos[1], scale: d.hgt * PPU / idle.image.height, tint: 0xf0e8f4, shadowK: .7 }); }
  { const f = {}; for (const k of ['idle', 'atk', 'hit']) f[k] = await loadTex(`art/enemy/minion_${k}.png`);
    for (const id of ['ma', 'mb', 'mc', 'md']) { const d = DEFS[id], front = id === 'ma' || id === 'mc'; units[id] = new Unit(g, f, { x: d.pos[0], z: d.pos[1], scale: d.hgt * PPU / f.idle.image.height, tint: front ? 0xf0e8f4 : 0xd8d4ee, phase: front ? .2 : .7 }); }
    units.mc.show(-1, false); units.md.show(-1, false); }
  // 頭像：隊友從半身像裁臉，敵人從像素圖裁
  const crop = (im, [x, y, s]) => { const c = document.createElement('canvas'); c.width = c.height = 96; const k = c.getContext('2d'); k.imageSmoothingEnabled = false; k.drawImage(im, x, y, s, s, 0, 0, 96, 96); return c; };
  for (const id of PARTY) A.face[id] = crop(A.bust[id], DEFS[id].face);
  A.face.boss = crop(units.boss.frames.idle.image, DEFS.boss.face); A.face.ma = A.face.mb = A.face.mc = A.face.md = crop(units.ma.frames.idle.image, DEFS.ma.face);

  // ---------- 特效 ----------
  const FXIDS = ['fire/brazier', 'arcane/spell-charge', 'arcane/rune-circle', 'arcane/magic-circle-cast', 'arcane/mana-burst', 'melee/sword-slash', 'melee/double-slash', 'melee/dagger-flurry', 'melee/heavy-cleave', 'melee/spin-slash', 'melee/hammer-smash',
    'impacts/hit-spark', 'impacts/crit-hit', 'impacts/shield-block', 'impacts/parry', 'impacts/blunt-hit', 'impacts/ground-slam', 'shadow/dark-explosion', 'shadow/grasping-hands', 'shadow/shadow-tendrils', 'shadow/shadow-flames', 'shadow/void-orb', 'shadow/black-hole',
    'holy/blessing', 'holy/divine-shield', 'holy/heal', 'holy/heal-aoe', 'holy/holy-pillar', 'holy/smite', 'holy/sunburst', 'holy/feather-burst', 'explosions/big-explosion', 'explosions/plasma-explosion', 'explosions/small-explosion', 'explosions/firework-burst',
    'lightning/charge-up', 'lightning/thunderclap', 'lightning/lightning-strike', 'spawn/poof', 'spawn/soul-rise', 'status/stunned', 'status/rage', 'status/haste', 'ui/level-up', 'ui/confetti', 'arcane/star-fall'];
  await loadFx(FXIDS);
  const FXL = makeFxLayer(g), SFX = makeScreenFx();
  // 在某個單位（或 [x,z]）的位置放特效。o：{ dx, y, dz, scale, palette, flip, dur, glow, seed }
  const fx = (id, t, at, o = {}) => { const [x, z] = Array.isArray(at) ? at : (units[at].posAt(t)); return FXL.add({ id, t, x: x + (o.dx || 0), y: o.y || 0, z: z + (o.dz ?? .1), scale: o.scale, palette: o.palette, flip: o.flip, dur: o.dur, glow: o.glow, seed: o.seed }); };
  arena.fires.forEach((f, i) => { const k = f.s * .6; FXL.add({ id: 'fire/brazier', t: -5, dur: 9999, x: f.x, y: f.top - .1 - .8 * k, z: f.z - .12, scale: k, seed: 3 + i }); });      // 特效自己也畫了火盆，把它藏在我們的火盆後面，只露出碗口上面的火

  // ---------- 狀態軌道 ----------
  const S = { defs: DEFS, party: PARTY, foes: FOES, units, ui: [], order: [], active: [{ t: -1, v: null }], hp: {}, sp: {}, bp: {}, shield: { boss: [{ t: -1, v: 6 }], ma: [{ t: -1, v: 2 }], mb: [{ t: -1, v: 2 }], mc: [{ t: -1, v: 2 }], md: [{ t: -1, v: 2 }] }, guard: [{ t: -1, v: true }], items: [], reveal: [{ t: -1, v: 0 }], bossBar: [{ t: -1, v: true }],
    menus: [], boxes: [], cards: [], cutins: [], subs: [], nums: [], breaks: [], show: [], results: [], proj: (id, k = 0) => { const u = units[id]; return E.project(u.x, u.h * k, u.z); } };
  const cur = {}; for (const id of [...PARTY, ...FOES]) { cur[id] = DEFS[id].hp; S.hp[id] = [{ t: -1, v: DEFS[id].hp }]; }
  const curSp = {}; for (const id of PARTY) { curSp[id] = DEFS[id].sp; S.sp[id] = [{ t: -1, v: DEFS[id].sp }]; S.bp[id] = [{ t: -1, v: 3 }]; }
  const sfx = [], snd = (t, id, v = 1) => sfx.push({ t: +t.toFixed(3), id, v });
  const cam = makeCam(E, WIDE);
  const num = (t, id, v, kind = 'dmg', o = {}) => S.nums.push({ t, id, v, kind, ...o });
  return { arena, g, units, A, FXL, SFX, fx, S, cur, curSp, sfx, snd, cam, num };
}

export async function buildBattle(E, hudCv) {
  const { arena, g, units, A, FXL, SFX, fx, S, cur, curSp, sfx, snd, cam, num } = await setupStage(E);
  // 喊招：聲音＋字幕（字幕不用破折號；魔王說遺言時戰鬥介面先收掉，畫面留給字幕）。LINES 的秒數是該句錄音的長度（換錄音要跟著改），字幕會多留一下再淡出。
  const say = (t, line, who, v = 1.25) => { snd(t, 'vo/' + line, v); const [text, len] = LINES[line]; S.subs.push({ t0: t, len, text, name: DEFS[who].name, color: DEFS[who].enemy ? '#e2463f' : DEFS[who].color }); };
  // 打中：扣血、受擊抖動、數字、音效
  const hurt = (t, id, v, kind = 'dmg', o = {}) => { cur[id] = Math.max(0, cur[id] - v); S.hp[id].push({ t, v: cur[id] }); units[id].hit(t, o.pow ?? 1, DEFS[id].enemy ? -1 : 1); num(t, id, v, kind, o); if (o.snd !== false) snd(t, o.snd || 'hit', o.vol ?? .8); };
  // 補血：只補得回缺的血，數字顯示實際補回的量（沒受傷就不跳數字）
  const heal = (t, id, v, o = {}) => { const d = Math.min(v, DEFS[id].hp - cur[id]); if (d <= 0) return 0; cur[id] += d; S.hp[id].push({ t, v: cur[id] }); num(t, id, d, 'heal', o); return d; };
  const useSp = (t, id) => { curSp[id] = Math.max(0, curSp[id] - DEFS[id].cost); S.sp[id].push({ t, v: curSp[id] }); S.bp[id].push({ t, v: 0 }); };
  const kill = (t, id) => { units[id].pose(t - .05, 'hit').die(t, 1.0); fx('spawn/poof', t + .55, id, { scale: 1.3, y: .2 }); snd(t + .05, 'defeat', .9); };
  let ORDER = []; const setOrder = (t, list) => { ORDER = list; S.order.push({ t, v: list.filter(id => !units[id].dead || units[id].dead.t > t) }); };
  const scr = id => { const u = units[id]; return [u.x, u.z]; };      // 註：只在排時間軸時用 posAt，不用這個
  // 世界座標 → 480×270 的畫面特效座標（鏡頭固定在 WIDE 時的近似值；全畫面特效只需要大概的位置）
  const P480 = (x, y, z) => { E.setCamera(WIDE); const [px, py] = E.project(x, y, z); return [px / 4, py / 4]; };

  // ==================== 時間軸 ====================
  let T = 0;
  // ---- A 遭遇 ----
  SFX.add('encounter', 0, 1.3); snd(.05, 'encounter');
  cam.to(-1, 0, { x: -3.0, y: 1.9, z: -.5, d: 7.2, pitch: 3, blur: 10 }).to(.7, 3.2, { d: 8.4, y: 1.75 }, easeOut);
  snd(1.15, 'boss_appear'); cam.shake(1.2, .16, .6); SFX.add('ring', 1.2, .7, { cx: 180, cy: 190, r: 330, c: [255, 90, 70], w: 4 });
  S.intro = { t0: 1.35, t1: 4.2 };
  units.boss.anim(2.0, 'swing', [0, .1, .22, .38, 9, 9, 9, 9]).pose(3.5, 'idle'); say(2.05, 'boss_intro', 'boss', 1); cam.shake(2.35, .2, .9); SFX.add('lines', 2.35, .9, { cx: 190, cy: 120, c: [255, 120, 100], a: .55, r0: 150 }); 
  for (const id of ['ma', 'mb']) units[id].hop(2.5 + (id === 'ma' ? 0 : .12), .16, .3);
  // 鏡頭甩到我方：五個人依序擺出架式
  cam.to(4.0, 1.25, { x: 3.4, y: 1.15, z: -.1, d: 8.6, pitch: 7, blur: 8 }); snd(4.0, 'whoosh', .7);
  PARTY.forEach((id, i) => { units[id].pose(-1, 'wind').pose(4.75 + i * .14, 'ready').hop(4.75 + i * .14, .14, .26); snd(4.75 + i * .14, 'cursor', .5); });
  cam.to(5.9, 1.2, WIDE);
  const R1 = ['kui', 'jie', 'ma', 'mb', 'kevin', 'boss', 'mi', 'vivi'];
  T = 6.6; S.ui.push({ t0: T - .3, t1: 9999 }); setOrder(T - .3, R1);

  // ---------- 共用的回合零件 ----------
  const endTurn = (t, id) => { units[id].pose(t, 'ready'); S.active.push({ t, v: null }); T = t + .3; };
  const round = n => { S.boxes.push({ t0: T, t1: T + 1.25, text: `第 ${'一二三'[n - 1]} 回合` }); snd(T, 'card', .7); T += 1.4; };
  // 指令選單：row＝游標停在第幾列（0 攻擊、1 技能、3 道具）；sub＝{ title, note } 或 { list, pick }（道具清單再選一次）；target＝目標頭上的箭頭。回傳行動開始的時間
  function openMenu(id, order, row, sub = {}, target) {
    const t0 = T; setOrder(t0, order); S.active.push({ t: t0, v: id });
    const moves = Array.from({ length: row }, (_, i) => t0 + .5 + i * .18), confirm = t0 + .62 + row * .18 + .2, m = { t0: t0 + .15, id, moves, confirm, ...sub, target };
    snd(m.t0, 'cursor', .55); moves.forEach(mt => snd(mt, 'cursor', .7)); snd(confirm, 'confirm', .9); let last = confirm;
    if (sub.list) { m.listMoves = Array.from({ length: sub.pick }, (_, i) => confirm + .3 + i * .2); m.confirm2 = confirm + .42 + sub.pick * .2 + .2; m.listMoves.forEach(mt => snd(mt, 'cursor', .7)); snd(m.confirm2, 'confirm', .9); last = m.confirm2; }
    m.t1 = last + .62; S.menus.push(m); return last + .8;
  }
  // 大招回合的開頭：指令選單 → 斜切眼神 → 喊招。回傳出招開始的時間
  function heroTurn(id, order) {
    const d = DEFS[id], t0 = T, [hx] = units[id].posAt(t0); setOrder(t0, order); S.active.push({ t: t0, v: id });
    cam.to(t0, .5, { x: lerp(WIDE.x, hx, .08), d: 12.5, y: 1.48 });
    const m = { t0: t0 + .2, id, moves: [t0 + .72, t0 + 1.0], confirm: t0 + 1.4, t1: t0 + 1.75, skill: d.skill, cost: d.cost }; S.menus.push(m);
    snd(m.t0, 'cursor', .55); m.moves.forEach(mt => snd(mt, 'cursor', .7)); snd(m.confirm, 'confirm', .9);
    const tc = t0 + 1.9; S.cutins.push({ t0: tc, dur: 1.7, id }); snd(tc, 'cutin', 1); say(tc + .22, id, id); useSp(tc, id);
    S.active.push({ t: tc, v: id }); cam.to(tc + 1.5, .35, WIDE);
    return tc + 1.78;
  }
  // 用道具：舉起來 → 丟給對象 → 回復（數字是實際補回的量）
  function useItem(id, order, key, target, pose = 'act') {
    const keys = Object.keys(BAG), list = keys.map(k => ({ name: BAG[k].name, n: BAG[k].n, note: BAG[k].note })), it = BAG[key];
    const ta = openMenu(id, order, 3, { list, pick: keys.indexOf(key) }, target), th = ta + 1.05; it.n--;
    units[id].pose(ta, pose); S.items.push({ t0: ta, from: id, to: target, key, name: it.name }); snd(ta, 'card', .8);
    if (it.hp) { fx('holy/heal', th - .1, target, { scale: 1.25 }); snd(th, 'heal', .9); heal(th + .15, target, it.hp); }
    if (it.sp) { fx('arcane/mana-burst', th - .05, target, { scale: 1.0, palette: 'cyber', y: .5 }); snd(th, 'buff', .8); const d = Math.min(it.sp, DEFS[target].sp - curSp[target]); curSp[target] += d; S.sp[target].push({ t: th + .15, v: curSp[target] }); num(th + .15, target, d, 'sp'); }
    units[target].hop(th + .2, .16, .3); if (target !== id) units[target].pose(th + .2, 'ready'); endTurn(th + 1.2, id);
  }
  // 小兵打人：衝過去敲一下再回來
  const foeAtk = (id, target, dmg, t0) => { const u = units[id], [hx, hz] = u.home, [tx, tz] = units[target].posAt(t0); S.active.push({ t: t0, v: id });
    u.pose(t0, 'atk').move(t0, tx - .95, tz + .02, .2, easeOut); snd(t0, 'whoosh', .45); const th = t0 + .26;
    fx('impacts/blunt-hit', th, target, { y: .7, dx: -.2, scale: 1.2 }); hurt(th, target, dmg, 'foe', { pow: .9 }); u.move(th + .3, hx, hz, .28).pose(th + .62, 'idle'); };
  const guardOff = t => { S.guard.push({ t, v: false }); num(t + .1, 'boss', '護衛解除！', 'text', { col: '#ffe27a', px: 38, y: .78 }); snd(t, 'break', .7); };
  // 魔王蓄力（之後接大招）
  function bossCharge() {
    const t0 = T, u = units.boss; S.active.push({ t: t0, v: 'boss' }); cam.to(t0, .6, { x: -1.3, d: 11.4, y: 1.7 }); S.boxes.push({ t0: t0 + .3, t1: t0 + 2.9, text: '蓄力　再改一版！', enemy: true });
    u.anim(t0 + .4, 'swing', [0, .2, .5, 9, 9, 9, 9, 9]); snd(t0 + .4, 'boss_charge', 1); say(t0 + .75, 'boss_attack', 'boss');
    fx('lightning/charge-up', t0 + .5, 'boss', { palette: 'blood', scale: 2.0, y: 2.2, dx: .2 });
    SFX.add('vignette', t0 + .5, 2.5, { c: [220, 30, 30], a: .8, pulse: 14 }); SFX.add('embers', t0 + .5, 2.5, { c: [255, 80, 50], x0: 0, w: 260 }); cam.shake(t0 + 1.2, .08, 1.6);
    num(t0 + 1.6, 'boss', '下一擊：全體大傷害', 'text', { col: '#ff8a70', y: .5, px: 32 }); S.active.push({ t: t0 + 3.0, v: null }); T = t0 + 3.1;
  }

  // ==================== 第一回合：互相試探。小兵還在的時候打不到魔王 ====================
  round(1);
  // 小葵：普攻 → 小兵 A
  { const ta = openMenu('kui', R1, 0, { title: '攻擊', note: '目標：社畜小兵' }, 'ma'), u = units.kui, h = DEFS.kui.pos, th = ta + .3;
    u.pose(ta, 'wind').move(ta + .08, .45, 1.0, .14, easeOut).pose(ta + .22, 'act'); SFX.add('speed', ta + .05, .2, { a: .45 }); snd(ta + .08, 'whoosh', .5);
    fx('melee/sword-slash', th - .06, [.45, 1.0], { flip: true, palette: 'fire', scale: 1.2 }); snd(th - .04, 'slash', .9); cam.shake(th, .1, .25);
    hurt(th, 'ma', 1286, 'dmg', { weak: true, snd: false }); S.shield.ma.push({ t: th, v: 1 }); S.reveal.push({ t: th, v: 1 });
    u.move(th + .5, h[0], h[1], .26); endTurn(th + .9, 'kui'); }
  // 阿傑：普攻（暗影彈）→ 小兵 B
  { const ta = openMenu('jie', R1.slice(1), 0, { title: '攻擊', note: '目標：社畜小兵' }, 'mb'), u = units.jie, th = ta + .62;
    u.pose(ta, 'wind').pose(ta + .3, 'act'); fx('arcane/spell-charge', ta, 'jie', { palette: 'shadow', scale: .6, y: .9, dx: -.4, flip: true, dur: .4 }); snd(ta, 'dark_charge', .45);
    const [x0, y0] = P480(2.9, 1.25, .5), [x1, y1] = P480(-1.55, .7, -1.7); SFX.add('slash', ta + .36, .34, { x0, y0, x1, y1, c: [190, 120, 255], w: 5 });
    fx('explosions/small-explosion', th - .1, 'mb', { scale: 1.2, y: .3, palette: 'arcane' }); fx('impacts/crit-hit', th, 'mb', { y: .7, scale: 1.3, palette: 'arcane' }); snd(th - .05, 'dark_blast', .55);
    hurt(th, 'mb', 1540, 'dmg', { weak: true, snd: 'hit' }); S.shield.mb.push({ t: th, v: 1 }); S.reveal.push({ t: th, v: 2 }); endTurn(th + 1.0, 'jie'); }
  // 小兵反擊
  { const t0 = T; setOrder(t0, R1.slice(2)); S.boxes.push({ t0: t0 + .05, t1: t0 + 2.3, text: '加班連打', enemy: true });
    foeAtk('ma', 'kui', 412, t0 + .35); foeAtk('mb', 'jie', 388, t0 + 1.3); S.active.push({ t: t0 + 2.3, v: null }); T = t0 + 2.6; }
  // Kevin：普攻魔王 → 被小兵擋下（說明規則）
  { const ta = openMenu('kevin', R1.slice(4), 0, { title: '攻擊', note: '目標：奧客總經理' }, 'boss'), u = units.kevin, h = DEFS.kevin.pos, th = ta + .32, mh = DEFS.ma.pos;
    u.anim(ta, 'ult', [0, .04, .1, .2, .26, .3, 1.0, 1.2]).move(ta + .06, -.7, -.45, .2, easeOut); snd(ta + .06, 'whoosh', .5); SFX.add('speed', ta + .05, .22, { a: .4 });
    units.ma.pose(ta + .1, 'atk').move(ta + .1, -1.5, -.4, .16, easeOut).move(th + .7, mh[0], mh[1], .3).pose(th + 1.0, 'idle');
    fx('impacts/shield-block', th, [-1.2, -.45], { palette: 'blood', scale: 1.7, y: .3 }); fx('impacts/parry', th, [-1.2, -.45], { palette: 'blood', scale: 1.5, y: .3 }); snd(th, 'shield_block', .9); cam.shake(th, .14, .3);
    num(th, 'boss', 0, 'guard', { y: .5 }); num(th + .2, 'ma', '護衛', 'text', { col: '#ff9a8a', px: 30, y: 1.25 });
    S.boxes.push({ t0: th + .25, t1: th + 2.2, text: '小兵護衛中　魔王不受傷害', enemy: true });
    u.move(th + .5, h[0], h[1], .3); endTurn(th + 1.9, 'kevin'); T += .4; }
  // 魔王：退件重擊 → 小葵
  { const t0 = T, u = units.boss, bh = DEFS.boss.pos, kh = DEFS.kui.pos; setOrder(t0, R1.slice(5)); S.active.push({ t: t0, v: 'boss' }); S.boxes.push({ t0: t0 + .1, t1: t0 + 2.5, text: '退件重擊', enemy: true });
    cam.to(t0, .5, { x: -.2, d: 12.3, y: 1.5 }); const ts = t0 + .35, th = ts + .58; u.move(ts, -.7, -1.3, .45).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.3, 1.6]); snd(ts, 'whoosh', .6);
    fx('melee/hammer-smash', th - .5, [.2, -1.5], { scale: 1.5, palette: 'blood' }); snd(th - .05, 'hit', 1); snd(th, 'explosion', .7); cam.shake(th, .3, .6); SFX.add('flash', th, .25, { c: [255, 120, 100], a: .6 });
    hurt(th + .02, 'kui', 1480, 'foe', { pow: 1.6, snd: false, big: true }); units.kui.move(th + .02, kh[0] + .55, kh[1], .2, easeOut).move(th + 1.0, kh[0], kh[1], .3);
    SFX.add('vignette', th, 1.6, { c: [220, 30, 30], a: .5 }); u.move(ts + 1.3, bh[0], bh[1], .55).pose(ts + 1.9, 'idle'); cam.to(ts + 1.3, .6, WIDE); S.active.push({ t: ts + 2.0, v: null }); T = ts + 2.3; }
  // 小米：道具 珍珠奶茶 → 小葵（把剛剛扣的血補回來）
  useItem('mi', R1.slice(6), 'tea', 'kui');
  // Vivi：應援，全員 BP 全滿，下一回合可以放奧義
  { const ta = openMenu('vivi', R1.slice(7), 1, { title: '應援', note: '全員 BP ＋2' }), u = units.vivi; u.pose(ta, 'wind').pose(ta + .35, 'act'); snd(ta + .35, 'buff', .9);
    fx('holy/feather-burst', ta + .35, 'vivi', { scale: 1.0, y: 1.6, palette: 'neon' }); num(ta + .4, 'vivi', '加油！', 'text', { col: '#ffc0dc', px: 34, y: 1.0, dx: -130 });
    ['kui', 'kevin', 'jie', 'mi'].forEach((id, i) => { const tb = ta + .6 + i * .1; fx('arcane/mana-burst', tb, id, { scale: .8, palette: 'gold', y: .5 }); num(tb + .2, id, 'BP MAX', 'text', { col: '#ffe27a', px: 26, y: 1.15 }); S.bp[id].push({ t: tb + .2, v: 5 }); units[id].hop(tb + .2, .16, .28); });
    S.bp.vivi.push({ t: ta + .8, v: 5 }); endTurn(ta + 2.1, 'vivi'); }

  // ==================== 第二回合：我方連放奧義清掉小兵 → 魔王大招命中 → 召喚第二批護衛 ====================
  round(2);
  const R2 = ['kui', 'jie', 'boss', 'boss', 'mi', 'kevin', 'vivi'];
  // ---- 小葵：吐槽一閃（兩隻小兵都砍掉，最後一刀劈到魔王） ----
  { const ta = heroTurn('kui', R2), u = units.kui, home = DEFS.kui.pos; S.cards.push({ t0: ta - .12, t1: ta + 4.1, id: 'kui' });
    u.anim(ta, 'ult', [0, .14, .3, .5, .56, .62, 3.2, 3.4]); fx('arcane/spell-charge', ta, 'kui', { palette: 'fire', scale: .7, y: .5, dx: -.3, flip: true, dur: .55 }); snd(ta, 'buff', .5);
    // 第一段：衝到小兵 A 面前，兩刀
    const d1 = ta + .5; u.move(d1, .4, 1.0, .1, easeOut); SFX.add('speed', d1 - .04, .22, { a: .6 }); snd(d1, 'slash_multi', 1);
    const [ax, ay] = P480(-.6, .8, 1.05); SFX.add('slash', d1 + .06, .32, { x0: ax + 90, y0: ay - 40, x1: ax - 80, y1: ay + 42, c: [255, 190, 110] });
    fx('melee/sword-slash', d1 + .04, [.4, 1.0], { flip: true, palette: 'fire', scale: 1.25 }); hurt(d1 + .12, 'ma', 1186, 'dmg', { weak: true, snd: false });
    u.anim(d1 + .22, 'ult', [0, 0, 0, 0, .02, .08, 9, 9]); fx('melee/double-slash', d1 + .24, [.4, 1.0], { flip: true, palette: 'fire', scale: 1.25 }); hurt(d1 + .4, 'ma', 1328, 'dmg', { weak: true, dx: 90, dy: -92 }); S.shield.ma.push({ t: d1 + .4, v: 0 }); kill(d1 + .5, 'ma');
    // 第二段：閃到小兵 B 面前，連斬
    const d2 = d1 + .78; u.move(d2, -.55, -1.7, .1, easeOut); SFX.add('speed', d2 - .04, .2, { a: .5 }); u.anim(d2, 'ult', [0, 0, 0, .02, .1, .18, 9, 9]);
    fx('melee/dagger-flurry', d2 + .1, [-.55, -1.7], { flip: true, palette: 'fire', scale: 1.3 }); snd(d2 + .1, 'slash_multi', .9);
    [512, 548, 575, 625].forEach((v, i) => { const th = d2 + .2 + i * .17; hurt(th, 'mb', v, 'dmg', { weak: true, dx: [-120, 70, -60, 130][i], dy: [-110, -40, 30, -130][i], pow: .6, snd: 'slash', vol: .55 }); fx('impacts/hit-spark', th, 'mb', { y: .5 + i * .2, dx: .3 - (i % 2) * .3, scale: 1.2, palette: 'fire', flip: true }); });
    S.shield.mb.push({ t: d2 + .71, v: 0 }); kill(d2 + .8, 'mb'); guardOff(d2 + .95);
    // 收刀的一閃：護衛沒了，整個畫面一條斜線劈到魔王
    const d3 = d2 + 1.25; u.anim(d3, 'ult', [0, 0, .06, .12, .17, .22, .9, 1.15]).move(d3 + .12, -4.6, -.25, .1, easeOut); SFX.add('dim', d3 - .05, .5, { a: .55, fade: .06 });
    SFX.add('slash', d3 + .14, .55, { x0: 300, y0: 60, x1: 20, y1: 215, c: [255, 170, 80], w: 11 }); SFX.add('flash', d3 + .2, .3, { a: .8 }); snd(d3 + .14, 'slash_b', 1.1); snd(d3 + .5, 'explosion', .6);
    fx('melee/heavy-cleave', d3 + .1, [-1.8, -.25], { flip: true, palette: 'fire', scale: 1.9 }); fx('impacts/crit-hit', d3 + .46, 'boss', { y: 1.2, scale: 2.2, palette: 'fire' });
    hurt(d3 + .5, 'boss', 4380, 'crit', { pow: 1.5, snd: 'hit' }); S.shield.boss.push({ t: d3 + .5, v: 5 }); cam.shake(d3 + .5, .3, .7);
    u.move(d3 + 1.45, home[0], home[1], .28).hop(d3 + 1.45, .5, .3); endTurn(d3 + 1.85, 'kui'); }

  // ---- 阿傑：深淵死線（全部打在魔王身上） ----
  { const ta = heroTurn('jie', R2.slice(1)), u = units.jie; S.cards.push({ t0: ta - .12, t1: ta + 4.4, id: 'jie' });
    u.anim(ta, 'ult', [0, .25, .55, 1.15, 1.32, 1.42, 3.2, 3.55]); snd(ta, 'dark_charge', 1);
    fx('arcane/magic-circle-cast', ta - .1, 'jie', { palette: 'arcane', scale: 1.15, dz: -.05 }); fx('arcane/spell-charge', ta + .2, 'jie', { palette: 'shadow', scale: .8, y: .9, dx: -.35, flip: true, dur: 1.1 });
    SFX.add('dim', ta + .15, 4.0, { c: [22, 6, 44], a: .5, fade: .4 }); SFX.add('embers', ta + .3, 3.4, { c: [170, 90, 255], n: 60 });
    fx('shadow/black-hole', ta + .5, 'boss', { scale: 2.2, y: .1, dur: 2.5, dz: -.2 }); fx('shadow/grasping-hands', ta + 1.2, 'boss', { scale: 2.0, dx: .9 }); fx('shadow/shadow-tendrils', ta + 1.1, 'boss', { scale: 1.8, dx: .3 });
    fx('shadow/dark-explosion', ta + .98, 'boss', { scale: 2.0, y: .2, dx: .2 }); const tp = ta + .98 + 1.84; snd(tp - .1, 'dark_blast', 1.1); SFX.add('flash', tp, .45, { c: [200, 150, 255], a: .9 }); cam.shake(tp, .34, .9);
    SFX.add('lines', tp, .7, { cx: 150, cy: 130, c: [200, 150, 255], a: .6 }); hurt(tp + .05, 'boss', 7777, 'crit', { pow: 1.6, snd: false }); S.shield.boss.push({ t: tp + .05, v: 4 });
    hurt(tp + .3, 'boss', 6240, 'dmg', { weak: true, dx: 150, dy: 120, pow: .8, snd: false }); S.shield.boss.push({ t: tp + .3, v: 3 }); fx('shadow/shadow-flames', tp + .2, 'boss', { scale: 2.2, dur: 1.5, dx: .2 });
    endTurn(ta + 4.2, 'jie'); }

  // ---- 魔王連續行動：蓄力 → 大招「無限改稿」命中全隊 → 召喚 ----
  setOrder(T, R2.slice(2)); bossCharge();
  { const t0 = T, u = units.boss, bh = DEFS.boss.pos, front = ['kui', 'kevin', 'jie', 'mi']; setOrder(t0, R2.slice(3)); S.active.push({ t: t0, v: 'boss' }); S.boxes.push({ t0: t0 + .1, t1: t0 + 3.3, text: '奧義　無限改稿', enemy: true });
    cam.to(t0, .5, { x: .6, d: 13.2, y: 1.4 }); SFX.add('vignette', t0 + .3, 4.2, { c: [220, 30, 30], a: .75, pulse: 10 });
    // 第一波：紙張風暴掃過全隊
    snd(t0 + .3, 'paper_storm', 1); SFX.add('papers', t0 + .3, 2.5, { n: 200 }); SFX.add('speed', t0 + .3, 2.4, { dir: 1, a: .3, n: 26 }); cam.shake(t0 + .4, .1, 2.0);
    const W1 = { kui: 720, kevin: 890, jie: 640, mi: 610 }, W2 = { kui: 900, kevin: 1260, jie: 840, mi: 780 };
    front.forEach((id, i) => { const th = t0 + .85 + i * .15; hurt(th, id, W1[id], 'foe', { pow: 1, snd: i % 2 ? false : 'hit', vol: .7, dy: i % 2 ? -60 : 0 }); fx('impacts/hit-spark', th, id, { y: .8, scale: 1.2 }); });
    num(t0 + 1.1, 'vivi', '後排', 'text', { col: '#ffc0dc', px: 26, y: .9, dx: -110 });
    // 第二波：衝過來一鎚砸在地上，震波把四個人掀退
    const ts = t0 + 1.75, th = ts + .58; u.move(ts, -1.1, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]);
    fx('melee/hammer-smash', th - .5, [-.5, -.4], { scale: 1.8, palette: 'blood' }); fx('impacts/ground-slam', th, [.9, -.3], { scale: 2.6, palette: 'blood' }); snd(th - .05, 'hit', 1); snd(th, 'explosion', 1.1);
    SFX.add('flash', th, .45, { c: [255, 140, 110], a: .95 }); SFX.add('ring', th, .7, { cx: 215, cy: 190, r: 460, c: [255, 120, 90], w: 6 }); SFX.add('lines', th, .5, { cx: 215, cy: 180, c: [255, 150, 120], a: .6 }); cam.shake(th, .5, 1.0);
    front.forEach((id, i) => { const h = DEFS[id].pos, tt = th + .05 + i * .07; hurt(tt, id, W2[id], 'foe', { pow: 1.7, snd: false, big: true, dy: i % 2 ? -150 : -50 }); units[id].move(tt, h[0] + .5, h[1], .2, easeOut).move(tt + 1.2, h[0], h[1], .4); });
    num(th + .9, 'jie', '瀕死', 'text', { col: '#ff6a5a', px: 30, y: 1.28 });
    u.move(ts + 1.5, bh[0], bh[1], .6).pose(ts + 2.1, 'idle'); T = ts + 2.5; }
  { const t0 = T, u = units.boss; S.boxes.push({ t0: t0 + .1, t1: t0 + 2.7, text: '召喚　加班大隊', enemy: true }); cam.to(t0, .5, { x: -.9, d: 12.0, y: 1.5 });
    u.pose(t0 + .2, 'atk').pose(t0 + 1.9, 'idle'); snd(t0 + .2, 'boss_charge', .6); SFX.add('embers', t0 + .3, 2.0, { c: [255, 80, 50], x0: 60, w: 220 });
    ['mc', 'md'].forEach((id, i) => { const ts = t0 + .8 + i * .32; fx('arcane/rune-circle', ts - .5, DEFS[id].pos, { palette: 'blood', scale: 1.2 }); fx('spawn/poof', ts - .08, DEFS[id].pos, { scale: 1.5, y: .3 }); units[id].show(ts, true).hop(ts, .34, .42); snd(ts, 'boss_appear', .55); });
    S.guard.push({ t: t0 + 1.5, v: true }); num(t0 + 1.6, 'boss', '護衛中：不受傷害', 'text', { col: '#ff9a8a', px: 32, y: .62 }); snd(t0 + 1.5, 'shield_up', .7);
    cam.to(t0 + 2.3, .6, WIDE); S.active.push({ t: t0 + 2.8, v: null }); T = t0 + 3.1; }

  // ---- 小米：聖光專線（每個人缺多少補多少），聖光打新來的小兵 ----
  { const ta = heroTurn('mi', ['mi', 'vivi', 'kevin', 'mc', 'md']), u = units.mi; S.cards.push({ t0: ta - .12, t1: ta + 4.3, id: 'mi' });
    u.anim(ta, 'ult', [0, .2, .45, .95, 1.1, 1.22, 3.4, 3.7]); snd(ta, 'holy_cast', 1); fx('holy/blessing', ta, 'mi', { scale: 1.3, dur: 3.3 }); fx('holy/sunburst', ta + 1.0, 'mi', { scale: .9, y: 2.0, dx: -.3, dur: 1.6 });
    SFX.add('rays', ta + .3, 3.4, {}); SFX.add('embers', ta + .5, 3.0, { c: [255, 230, 140], n: 50 });
    const th = ta + 1.25; fx('holy/heal-aoe', th - .2, [3.4, -.1], { scale: 2.3, palette: 'heal' }); snd(th, 'heal', 1); SFX.add('flash', th, .4, { c: [255, 245, 190], a: .45 });
    PARTY.forEach((id, i) => { fx('holy/heal', th + .1 + i * .09, id, { scale: 1.25 }); if (id !== 'vivi') { heal(th + .35 + i * .09, id, 9999, { dy: i % 2 ? -76 : 0 }); units[id].hop(th + .4 + i * .09, .18, .3); } else num(th + .35 + i * .09, id, '不需要', 'text', { col: '#ffc0dc', px: 26, y: .9, dx: -120 }); });
    const ts = ta + 2.1; fx('holy/smite', ts, 'mc', { scale: 1.3 }); fx('holy/holy-pillar', ts + .7, 'mc', { scale: 1.2, dz: -.1 }); snd(ts + .85, 'explosion', .6); snd(ts + .8, 'holy_cast', .5);
    SFX.add('flash', ts + .9, .4, { c: [255, 245, 200], a: .8 }); cam.shake(ts + .9, .18, .5); hurt(ts + .95, 'mc', 1960, 'dmg', { weak: true, pow: 1.2, snd: false }); S.reveal.push({ t: ts + .95, v: 3 }); S.shield.mc.push({ t: ts + .95, v: 1 });
    endTurn(ta + 3.9, 'mi'); }

  // ==================== 第三回合：這次擋下魔王大招，清掉護衛，總攻擊 ====================
  round(3);
  const R3 = ['jie', 'mc', 'md', 'boss', 'kevin', 'boss', 'kui', 'mi', 'vivi'];
  // 阿傑：道具 黑咖啡，把放奧義用掉的 SP 喝回來
  useItem('jie', R3, 'coffee', 'jie', 'win');
  // 加班小兵出手
  { const t0 = T; setOrder(t0, R3.slice(1)); S.boxes.push({ t0: t0 + .05, t1: t0 + 2.3, text: '加班連打', enemy: true });
    foeAtk('mc', 'kui', 356, t0 + .35); foeAtk('md', 'mi', 402, t0 + 1.3); S.active.push({ t: t0 + 2.3, v: null }); T = t0 + 2.6; }
  // 魔王又蓄力了
  setOrder(T, R3.slice(3)); bossCharge();
  // ---- Kevin：鐵壁・AI 護盾 ----
  let shieldFx;
  { const ta = heroTurn('kevin', R3.slice(4)), u = units.kevin; S.cards.push({ t0: ta - .12, t1: ta + 2.3, id: 'kevin' });
    u.move(ta, .55, -.35, .34).anim(ta + .1, 'ult', [0, .12, .28, .46, .56, .64, 99, 99]); snd(ta + .1, 'whoosh', .6);
    const tk = ta + .1 + .64; snd(tk, 'shield_up', 1.1); cam.shake(tk, .14, .4); fx('impacts/ground-slam', tk - .05, [.55, -.35], { palette: 'cyber', scale: 1.3 });
    SFX.add('flash', tk, .3, { c: [120, 240, 255], a: .5 }); SFX.add('ring', tk, .6, { cx: 262, cy: 185, r: 300, c: [120, 240, 255], w: 3 });
    shieldFx = { t: tk }; num(tk + .3, 'kevin', '全體掩護', 'text', { col: '#9af0ff', y: 1.25 }); for (const id of ['kui', 'jie', 'mi', 'vivi']) num(tk + .45, id, '掩護', 'text', { col: '#9af0ff', px: 26, y: 1.12 });
    S.active.push({ t: ta + 1.9, v: null }); T = ta + 2.1; }
  // ---- 魔王第二次大招：被護盾擋下 ----
  { const t0 = T, u = units.boss; setOrder(t0, R3.slice(5)); S.active.push({ t: t0, v: 'boss' }); S.boxes.push({ t0: t0 + .1, t1: t0 + 2.6, text: '奧義　無限改稿', enemy: true });
    cam.to(t0, .5, { x: .6, d: 13.2, y: 1.4 });
    FXL.add({ id: 'holy/divine-shield', t: shieldFx.t, dur: t0 + 5.0 - shieldFx.t, x: 3.3, y: -.2, z: 1.9, scale: 5.2, palette: 'cyber', glow: 1.2 }); FXL.add({ id: 'holy/divine-shield', t: shieldFx.t, dur: t0 + 5.0 - shieldFx.t, x: .1, y: 0, z: -.2, scale: 1.7, palette: 'cyber' });
    snd(t0 + .3, 'paper_storm', 1); SFX.add('papers', t0 + .3, 2.9, { n: 190 }); SFX.add('speed', t0 + .3, 2.8, { dir: 1, a: .3, n: 26 }); cam.shake(t0 + .4, .07, 2.6);
    const hits = [[.75, 1188], [1.25, 1402], [1.8, 1070]]; hits.forEach(([dt, v], i) => { const th = t0 + dt; fx('impacts/shield-block', th, [.05, -.35], { palette: 'cyber', scale: 1.7, flip: true, y: .1 + i * .15 }); snd(th, 'shield_block', .8); SFX.add('flash', th, .16, { c: [150, 240, 255], a: .35 });
      hurt(th, 'kevin', v, 'foe', { pow: .5, snd: false, dx: 20 * i, dy: -30 * i }); for (const id of ['kui', 'jie', 'mi', 'vivi']) if ((i + PARTY.indexOf(id)) % 2 === 0) num(th + .05, id, 0, 'guard', { y: id === 'vivi' ? .3 : .9 }); });
    const ts = t0 + 2.6; u.move(ts, -1.5, -.4, .5).anim(ts, 'swing', [0, .1, .22, .36, .5, .58, 1.5, 1.8]); const th = ts + .58; snd(th - .05, 'shield_block', 1.2); snd(th, 'explosion', .8);
    fx('melee/hammer-smash', th - .5, [-1.0, -.4], { scale: 1.6, palette: 'blood' }); fx('impacts/parry', th, [.1, -.35], { scale: 2.2, palette: 'cyber', y: .2 }); SFX.add('flash', th, .35, { a: .9 }); SFX.add('lines', th, .5, { cx: 250, cy: 170, c: [150, 240, 255] }); cam.shake(th, .36, .8);
    hurt(th + .03, 'kevin', 812, 'foe', { pow: 1.3, snd: false, big: true }); units.kevin.move(th + .03, 1.25, -.4, .28, easeOut); num(th + .5, 'kevin', '完全防禦！', 'text', { col: '#9af0ff', y: 1.5, px: 44 });
    u.move(ts + 1.5, DEFS.boss.pos[0], DEFS.boss.pos[1], .6).pose(ts + 2.1, 'idle');
    units.kevin.anim(th + .1, 'ult', [0, 0, 0, 0, 0, 0, .9, 1.2]).move(th + 1.3, DEFS.kevin.pos[0], DEFS.kevin.pos[1], .4).pose(th + 1.7, 'wind');
    S.active.push({ t: ts + 2.2, v: null }); T = ts + 2.4; }
  // 小葵：道具 珍珠奶茶 → Kevin
  useItem('kui', R3.slice(6), 'tea', 'kevin', 'win');
  // 小米：普攻（聖光）→ 打倒加班小兵 A
  { const ta = openMenu('mi', R3.slice(7), 0, { title: '攻擊', note: '目標：加班小兵' }, 'mc'), u = units.mi, th = ta + .92;
    u.pose(ta, 'wind').pose(ta + .35, 'act'); snd(ta, 'holy_cast', .6); fx('holy/blessing', ta, 'mi', { scale: .9, dur: .9 }); fx('holy/smite', ta, 'mc', { scale: 1.2 });
    SFX.add('flash', th - .05, .3, { c: [255, 245, 200], a: .6 }); cam.shake(th, .14, .3); hurt(th, 'mc', 1840, 'dmg', { weak: true, snd: 'hit' }); S.shield.mc.push({ t: th, v: 0 }); kill(th + .12, 'mc');
    endTurn(th + 1.0, 'mi'); }

  // ---- Vivi：皇家敕令・準時下班 → 全員總攻擊（先打掉最後一隻護衛，再集中打魔王） ----
  { const ta = heroTurn('vivi', ['vivi', 'md', 'boss']), u = units.vivi; S.cards.push({ t0: ta - .12, t1: ta + 2.25, id: 'vivi' });
    u.anim(ta, 'ult', [0, .18, .4, .62, .74, .84, 2.2, 2.45]); const tk = ta + .84; snd(tk, 'buff', 1.1); SFX.add('flash', tk, .35, { c: [255, 170, 210], a: .5 }); SFX.add('embers', tk, 2.2, { c: [255, 200, 120], n: 80 });
    fx('holy/feather-burst', tk, 'vivi', { scale: 1.3, y: 1.6, palette: 'neon' });
    ['kui', 'kevin', 'jie', 'mi'].forEach((id, i) => { const tb = tk + .15 + i * .13; fx('arcane/mana-burst', tb, id, { scale: 1.0, palette: 'gold', y: .5 }); fx('holy/blessing', tb + .1, id, { scale: 1.1, dur: 1.6 }); num(tb + .45, id, '攻擊力 ↑↑', 'text', { col: '#ffe27a', px: 28, y: 1.2 }); S.bp[id].push({ t: tb + .3, v: 5 }); units[id].hop(tb + .5, .2, .3); });
    S.bp.vivi.push({ t: tk + .3, v: 5 });
    const t1 = ta + 2.5; S.boxes.push({ t0: t1 - .2, t1: t1 + 4.6, text: '全員總攻擊' }); cam.to(t1 - .2, .6, { x: -.6, d: 12.2, y: 1.45 }); SFX.add('speed', t1, 2.8, { a: .32, n: 34 }); snd(t1 - .1, 'whoosh', .8);
    const B = [-1.5, -.45], M = DEFS.md.pos;
    // 小葵、Kevin：打掉最後一隻護衛
    units.kui.anim(t1, 'ult', [0, .05, .1, .16, .22, .28, .8, 1.0]).move(t1 + .14, M[0] + 1.0, M[1], .1, easeOut).move(t1 + 1.0, DEFS.kui.pos[0], DEFS.kui.pos[1], .3); fx('melee/double-slash', t1 + .2, [M[0] + 1.0, M[1]], { flip: true, palette: 'fire', scale: 1.4 }); snd(t1 + .2, 'slash', 1);
    hurt(t1 + .36, 'md', 2105, 'crit', { dx: -40, dy: -60, pow: 1, snd: false });
    units.kevin.anim(t1 + .45, 'ult', [0, .04, .08, .14, .2, .26, .7, .9]).move(t1 + .55, M[0] + 1.1, M[1] + .35, .12, easeOut).move(t1 + 1.4, DEFS.kevin.pos[0], DEFS.kevin.pos[1], .3); fx('impacts/blunt-hit', t1 + .7, 'md', { y: .6, dx: .4, scale: 1.8, palette: 'cyber' }); snd(t1 + .7, 'shield_block', .9);
    hurt(t1 + .74, 'md', 1695, 'dmg', { dx: 70, dy: 30, pow: 1, snd: 'hit' }); S.shield.md.push({ t: t1 + .74, v: 0 }); cam.shake(t1 + .74, .16, .3); kill(t1 + .82, 'md'); guardOff(t1 + 1.0);
    // 阿傑、小米：護衛沒了，直接打魔王
    const t3 = t1 + .45;
    units.jie.anim(t3 + .85, 'ult', [0, .05, .1, .18, .26, .34, 1.4, 1.7]); fx('explosions/plasma-explosion', t3 + 1.15, 'boss', { y: 1.5, dx: .2, scale: 2.3, palette: 'arcane' }); snd(t3 + 1.15, 'dark_blast', .8);
    hurt(t3 + 1.3, 'boss', 8640, 'crit', { dx: -30, dy: 60, pow: 1.2, snd: false }); S.shield.boss.push({ t: t3 + 1.3, v: 0 }); S.breaks.push({ t: t3 + 1.3 }); snd(t3 + 1.3, 'break', .9); SFX.add('flash', t3 + 1.2, .3, { c: [200, 150, 255], a: .6 }); fx('status/stunned', t3 + 1.6, 'boss', { y: 2.35, dx: .45, scale: 2.2, dur: 2.2 });
    units.mi.anim(t3 + 1.35, 'ult', [0, .05, .1, .18, .26, .34, 1.3, 1.6]); fx('lightning/lightning-strike', t3 + .95, 'boss', { scale: 1.7, palette: 'holy', dx: .1 }); fx('arcane/star-fall', t3 + 1.3, 'boss', { scale: 2.0, palette: 'holy', dx: .3 }); snd(t3 + 1.8, 'holy_cast', .6);
    hurt(t3 + 1.95, 'boss', 6980, 'dmg', { weak: true, dx: 80, dy: -70, pow: 1, snd: 'hit' }); SFX.add('flash', t3 + 1.9, .3, { c: [255, 245, 190], a: .6 }); S.reveal.push({ t: t3 + 1.95, v: 4 });
    // Vivi 一指：大爆炸
    const t2 = t3 + 2.35; u.anim(t2 - .3, 'ult', [0, 0, .03, .08, .14, .2, 3.4, 3.7]); SFX.add('dim', t2 - .3, .45, { a: .7, fade: .1 }); SFX.add('lines', t2 - .3, .45, { cx: 150, cy: 130, c: [255, 190, 220], a: .7 });
    fx('explosions/big-explosion', t2, 'boss', { scale: 2.2, dx: .2 }); fx('explosions/firework-burst', t2 + .5, 'boss', { scale: 2.0, y: 2.4, palette: 'candy' }); fx('explosions/small-explosion', t2 + .35, 'boss', { scale: 1.5, dx: -1.2, dz: .3 }); fx('explosions/small-explosion', t2 + .6, 'boss', { scale: 1.5, dx: 1.5, dz: .3 });
    snd(t2, 'explosion_big', 1.2); SFX.add('flash', t2, .9, { a: 1, pow: 1.5 }); cam.shake(t2, .5, 1.6); SFX.add('ring', t2 + .05, .9, { cx: 150, cy: 170, r: 520, w: 6 });
    hurt(t2 + .25, 'boss', 99999, 'big', { pow: 2, snd: false, fixed: [860, 520] }); cur.boss = 0; S.hp.boss[S.hp.boss.length - 1].v = 0;
    // 魔王倒下
    const tdn = t2 + 2.1; for (let i = 0; i < 6; i++) units.boss.hit(t2 + .6 + i * .25, .7 - i * .08); say(tdn - .2, 'boss_down', 'boss'); cam.to(t2 + 1.0, 1.4, { x: -2.6, d: 9.6, y: 1.7 });
    units.boss.die(tdn + 1.2, 2.4); snd(tdn + 1.2, 'boss_down', 1); for (let i = 0; i < 5; i++) fx('spawn/poof', tdn + 1.5 + i * .35, 'boss', { scale: 1.8, dx: -1 + i * .5, y: .3 + (i % 2) * 1.2, seed: i + 2 }); fx('spawn/poof', tdn + 3.2, 'boss', { scale: 3, y: .6 });
    S.bossBar.push({ t: tdn + 2.0, v: false }); S.active.push({ t: tdn, v: null }); S.ui[0].t1 = tdn - .1; T = tdn + 3.9; }

  // ---- H 勝利 ----
  { const t0 = T; snd(t0, 'fanfare', 1); cam.to(t0 - .4, 1.2, { x: .98, y: 1.25, z: -.1, d: 10.9, pitch: 7 });
    PARTY.forEach((id, i) => units[id].pose(t0 + .15 + i * .12, 'win').hop(t0 + .15 + i * .12, .26, .36).hop(t0 + 1.2 + i * .1, .14, .3));
    fx('ui/confetti', t0 + .3, [3.4, 1.0], { scale: 2.4, y: .6 }); fx('ui/confetti', t0 + .9, [4.6, -.8], { scale: 2.2, y: .8, seed: 5 }); fx('explosions/firework-burst', t0 + .4, [1.6, -3.2], { scale: 1.6, y: 1.6 }); fx('explosions/firework-burst', t0 + 1.3, [5.8, -3.2], { scale: 1.5, y: 1.9, palette: 'candy', seed: 4 });
    S.victory = { t0: t0 + .2, t1: t0 + 6.6 }; S.results = [{ k: '經驗值', v: 12800 }, { k: '職業點數', v: 420 }, { k: '獎金', v: 6600, c: COLGOLD }, { k: '戰利品', v: '準時下班券 ×5' }, { k: '', v: '奧客的退件章 ×1' }];
    S.results.forEach((r, i) => snd(t0 + 1.4 + i * .32, 'stat', .7)); T = t0 + 6.8; }

  // ---- I 角色介紹 ----
  { const each = 5.0; ['kui', 'jie', 'kevin', 'mi', 'vivi'].forEach((id, i) => { const t0 = T + i * each; S.show.push({ t0, t1: t0 + each, id }); snd(t0 + .05, 'card', .9); for (let k = 0; k < 8; k++) snd(t0 + .5 + k * .09, 'stat', .45); snd(t0 + 1.3, 'confirm', .5);
      const [hx, hz] = DEFS[id].pos; cam.to(t0, each, { x: hx - 1.4, y: 1.2, z: hz, d: 7.6 + (i % 2) * .5, pitch: 6 }, easeOut); });
    T += each * 5; }
  // ---- J 片尾 ----
  S.end = { t0: T - .1 }; snd(T, 'confirm', .6); T += 3.2;
  const DUR = T, ui = makeUI(hudCv, A, S);
  // 配樂：戰鬥曲到魔王倒下，之後換勝利曲
  const music = [{ id: 'bgm/battle', t0: .9, t1: S.victory.t0 - .9 }, { id: 'bgm/victory', t0: S.victory.t0 + 4.2, t1: DUR }];

  return {
    dur: DUR, sfx, music, S,
    update(t) { arena.update(t); for (const id in units) units[id].update(t); FXL.update(t); cam.update(t); for (const id in units) { const u = units[id]; u.x = u.group.position.x; } },
    hud(t) { ui.draw(t, SFX); },
  };
}
const COLGOLD = '#e2bf6c';
