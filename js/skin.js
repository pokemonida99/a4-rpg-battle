// 試玩版的介面外觀（使用者選的方案 5b「董事會」）：胡桃木板、米白議程紙、氧化銅夾子、紅色印章。
// 材質用程式畫成小張的像素圖再放大三倍（顆粒感跟場景一致），不用漸層大圓角。
// 版位：左上「議程」紙條排行動順序（頭像，輪到的人用綠筆圈起來）；上方一整塊木板分五欄放隊伍（名字在上面，不擋下面的角色）；
// 敵人腳下「底氣」條，歸零蓋「理虧」章；左下魔王木牌；下方指令是木頭資料夾的索引標籤（game.js 畫，材質從這裡拿）。
import { W, H, sat, lerp, easeOut, back, rnd } from './engine.js';
import { stepAt } from './units.js';

export const INK = '#2b1f18', INK2 = '#6a5846', CREAM = '#efe6cf', TEAL = '#3f7f72', RED = '#b23a30', BRASS = '#caa24c';
const SANS = '"Noto Sans TC", sans-serif', SERIF = '"Songti TC", "Noto Serif TC", "PMingLiU", serif';
const fmt = n => Math.round(n).toLocaleString('en-US');
const valAt = (keys, t, dur = .5) => { let p = keys[0], q = keys[0]; for (const k of keys) { if (k.t > t) break; p = q; q = k; } return p === q ? q.v : lerp(p.v, q.v, easeOut(sat((t - q.t) / dur))); };
const lastChange = (keys, t) => { let q = keys[0]; for (const k of keys) { if (k.t > t) break; q = k; } return t - q.t; };

// 精簡版介面（11/21 使用者：字太多，能省的省、能改圖示的改圖示，「圖示比較好」）：現在是預設；網址加 ?hud1 看舊版
export const HUD = { lean: true };
export function makeSkin(c, A, S, D) {
  // ---------- 材質 ----------
  const tex = (w, h, paint, k = 3) => { const lo = document.createElement('canvas'); lo.width = w; lo.height = h; paint(lo.getContext('2d'), w, h); const up = document.createElement('canvas'); up.width = w * k; up.height = h * k; const x = up.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(lo, 0, 0, w * k, h * k); return c.createPattern(up, 'repeat'); };
  const WOOD = tex(128, 64, (x, w, h) => { for (let j = 0; j < h; j++) { const v = rnd(j * 3.7) * .5 + rnd(Math.floor(j / 3) * 9.1) * .5, r = 70 + v * 22, g = 43 + v * 14, b = 28 + v * 10; x.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`; x.fillRect(0, j, w, 1); }
    for (let i = 0; i < 70; i++) { const y = Math.floor(rnd(i * 5.3) * h), x0 = Math.floor(rnd(i * 2.9) * w), len = 6 + Math.floor(rnd(i * 7.7) * 40); x.fillStyle = rnd(i) < .6 ? 'rgba(30,16,8,.45)' : 'rgba(150,104,66,.35)'; x.fillRect(x0, y, len, 1); if (x0 + len > w) x.fillRect(0, y, x0 + len - w, 1); } });
  const PAPER = tex(64, 64, (x, w, h) => { x.fillStyle = '#e6dcc2'; x.fillRect(0, 0, w, h); for (let i = 0; i < 520; i++) { const px = Math.floor(rnd(i * 3.1) * w), py = Math.floor(rnd(i * 7.3) * h), v = rnd(i * 1.7); x.fillStyle = v < .5 ? 'rgba(120,100,70,.14)' : 'rgba(255,250,235,.3)'; x.fillRect(px, py, 1 + (v > .9), 1); } });
  const PAPER2 = tex(64, 64, (x, w, h) => { x.fillStyle = '#c9bfa6'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(90,76,56,.16)'; x.fillRect(Math.floor(rnd(i * 3.3) * w), Math.floor(rnd(i * 6.1) * h), 1, 1); } });      // 不能按的標籤用的舊紙
  const font = (px, w = 700, fam = SERIF) => { c.font = `${w} ${px}px ${fam}`; };
  const text = (s, x, y, o = {}) => { font(o.px ?? 28, o.w ?? 700, o.fam ?? SERIF); c.textAlign = o.align ?? 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = `${o.ls ?? 0}px`; if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + 2, y + 2); } c.fillStyle = o.col ?? INK; c.fillText(s, x, y); const w = c.measureText(s).width; c.letterSpacing = '0px'; return w; };
  const measure = (s, px, w = 700, fam = SERIF) => { font(px, w, fam); return c.measureText(s).width; };
  // 木板：木紋＋深色邊＋四角銅釘
  function wood(x, y, w, h, o = {}) {
    c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x + 4, y + 6, w, h); c.fillStyle = WOOD; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,214,160,.16)'; c.fillRect(x, y, w, 3); c.fillStyle = 'rgba(20,10,4,.5)'; c.fillRect(x, y + h - 4, w, 4); c.strokeStyle = '#24130b'; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
    if (o.studs !== false) for (const [sx, sy] of [[x + 13, y + 13], [x + w - 13, y + 13], [x + 13, y + h - 13], [x + w - 13, y + h - 13]]) { c.fillStyle = '#3a240e'; c.fillRect(sx - 5, sy - 5, 10, 10); c.fillStyle = BRASS; c.fillRect(sx - 4, sy - 4, 8, 8); c.fillStyle = '#f2dc96'; c.fillRect(sx - 3, sy - 3, 3, 3); }
  }
  // 紙：紙紋＋四角缺一小塊＋淡淡的邊；clips＝夾子的 x 位置
  function paper(x, y, w, h, o = {}) {
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(x + 3, y + 5, w, h); c.fillStyle = o.old ? PAPER2 : PAPER; c.beginPath(); const k = 6; c.moveTo(x + k, y); c.lineTo(x + w - k, y); c.lineTo(x + w, y + k); c.lineTo(x + w, y + h - k); c.lineTo(x + w - k, y + h); c.lineTo(x + k, y + h); c.lineTo(x, y + h - k); c.lineTo(x, y + k); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(120,100,70,.55)'; c.lineWidth = 2; c.stroke(); if (o.tint) { c.fillStyle = o.tint; c.fill(); }
    for (const cx of o.clips || []) clip(cx, y);
  }
  // 氧化銅的長尾夾
  function clip(cx, y) { c.strokeStyle = '#1e3b36'; c.lineWidth = 4; c.beginPath(); c.arc(cx, y - 14, 8, 0, 7); c.stroke(); c.strokeStyle = '#5fa596'; c.lineWidth = 2; c.beginPath(); c.arc(cx, y - 14, 8, 3.4, 5.6); c.stroke();
    c.fillStyle = '#1e3b36'; c.fillRect(cx - 19, y - 9, 38, 20); c.fillStyle = TEAL; c.fillRect(cx - 17, y - 7, 34, 16); c.fillStyle = '#6fb3a4'; c.fillRect(cx - 17, y - 7, 34, 3); c.fillStyle = '#2c5e55'; c.fillRect(cx - 17, y + 6, 34, 3); }
  // 紅色印章（斜蓋、雙框）
  function stamp(s, cx, cy, rot = -.14, px = 30, k = 1) { c.save(); c.translate(cx, cy); c.rotate(rot); c.scale(k, k); const w = measure(s, px, 900) + 26, h = px + 16; c.globalAlpha *= .9; c.fillStyle = 'rgba(230,220,194,.5)'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = RED; c.lineWidth = 4; c.strokeRect(-w / 2, -h / 2, w, h); c.lineWidth = 1.5; c.strokeRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12); text(s, 0, px * .36, { px, w: 900, align: 'center', col: RED, ls: 2 }); c.restore(); }
  function bar(x, y, w, h, k, col, hi = 'rgba(255,255,255,.3)') { c.fillStyle = '#1d120b'; c.fillRect(x - 2, y - 2, w + 4, h + 4); c.fillStyle = '#5b4a3a'; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x, y, Math.round(w * sat(k)), h); c.fillStyle = hi; c.fillRect(x, y, Math.round(w * sat(k)), Math.max(2, h / 3 | 0)); }
  function face(img, x, y, s, dark = 0) { c.fillStyle = '#1d120b'; c.fillRect(x - 3, y - 3, s + 6, s + 6); c.imageSmoothingEnabled = false; if (img) c.drawImage(img, x, y, s, s); c.imageSmoothingEnabled = true; if (dark) { c.fillStyle = `rgba(40,30,20,${dark})`; c.fillRect(x, y, s, s); } }

  // ---------- 左上：議程（行動順序） ----------
  function order(t, a) {
    if (a <= 0) return; let cur = null; for (const k of S.order) { if (k.t > t) break; cur = k; } if (!cur || !cur.v.length) return; const list = cur.v.slice(0, 7), u = easeOut(sat((t - cur.t) / .28));
    c.save(); c.globalAlpha *= a; const X = 28, Y = 30, LB = HUD.lean ? 20 : 108, PW = Math.min(606, LB + 84 + Math.max(0, list.length - 1) * 61 + 16), PH = 96; paper(X, Y, PW, PH, { clips: PW > 240 ? [X + 34, X + PW - 34] : [X + 34] });
    if (!HUD.lean) { text('議程', X + 20, Y + 58, { px: 30, w: 900, ls: 4 }); c.fillStyle = RED; c.fillRect(X + 20, Y + 68, 66, 3); }
    let x = X + LB; list.forEach((id, i) => { const s = i === 0 ? 70 : 54, y = Y + (PH - s) / 2, ox = i ? (1 - u) * 30 : 0; face(A.face[id], x + ox, y, s, i ? .12 : 0); if (D[id].enemy) { c.strokeStyle = RED; c.lineWidth = 3; c.strokeRect(x + ox - 1.5, y - 1.5, s + 3, s + 3); }
      if (i === 0) { c.save(); c.translate(x + s / 2, y + s / 2); c.rotate(-.12); c.strokeStyle = TEAL; c.lineWidth = 5; c.beginPath(); c.ellipse(0, 0, (s / 2 + 10) * lerp(1.3, 1, u), (s / 2 + 7) * lerp(1.3, 1, u), 0, .3, 6.5); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.ellipse(2, 1, s / 2 + 13, s / 2 + 9, .1, 2.2, 5.6); c.stroke(); c.restore(); }
      x += s + (i === 0 ? 14 : 7); });
    c.restore();
  }
  // ---------- 上方：隊伍木板（五欄，輪到的人那欄墊一張紙） ----------
  function party(t, a) {
    if (a <= 0) return; c.save(); c.globalAlpha *= a; const n = S.party.length, Y = 20, CW = 249, BW = CW * n + 2, X = 1895 - BW, BH = 110, active = stepAt(S.active, t, null); wood(X, Y, BW, BH);
    S.party.forEach((id, i) => { const d = D[id], x = X + 1 + i * CW, hp = valAt(S.hp[id], t), sp = valAt(S.sp[id], t), on = active === id, down = hp <= 0, low = hp / d.hp < .26, since = lastChange(S.hp[id], t), jit = since < .45 && S.hp[id].length > 1 ? Math.sin(since * 60) * 5 * (1 - since / .45) : 0;
      if (i) { c.fillStyle = '#24130b'; c.fillRect(x - 1, Y + 10, 2, BH - 20); c.fillStyle = 'rgba(255,214,160,.12)'; c.fillRect(x + 1, Y + 10, 1, BH - 20); }
      if (on) paper(x + 7, Y + 7, CW - 14, BH - 14, { clips: [x + CW / 2] });
      const ink = on ? INK : CREAM, dim = on ? INK2 : 'rgba(239,230,207,.62)', sh = on ? null : 'rgba(20,10,4,.7)', tx = x + 22, w = CW - 44; c.globalAlpha = a * (down ? .55 : 1);
      const nw = text(d.name, tx, Y + 42, { px: 28, w: 900, col: ink, shadow: sh }); if (d.isBack || !HUD.lean) text(d.isBack ? '後排' : d.job, tx + nw + 8, Y + 41, { px: 16, w: 700, col: dim, fam: SANS });
      // 第二行：左邊 HP 數字，右邊 SP。不同手機的字寬不一樣，「／上限」只有放得下才畫（血條本身就看得出比例）
      const spS = String(Math.round(sp)), spW = measure(spS, 20, 900), spL = tx + w - spW - 6 - measure('SP', 12, 700, SANS);
      text('HP', tx, Y + 74, { px: 13, w: 700, col: dim, fam: SANS }); const hw = text(down ? '倒下' : fmt(hp).replace(/,/g, ''), tx + 26 + jit, Y + 77, { px: down ? 24 : 30, w: 900, col: down || low ? (on ? RED : '#ff8a78') : ink, shadow: sh });
      if (!HUD.lean && !down && tx + 30 + hw + measure('/' + d.hp, 15, 700, SANS) < spL - 8) text('/' + d.hp, tx + 30 + hw, Y + 76, { px: 15, w: 700, col: dim, fam: SANS });
      text(spS, tx + w, Y + 77, { px: 20, w: 900, align: 'right', col: on ? '#27507e' : '#bcd8f6', shadow: sh }); text('SP', tx + w - spW - 6, Y + 75, { px: 12, w: 700, col: dim, align: 'right', fam: SANS });
      bar(tx, Y + 88, w - 80, 7, hp / d.hp, low ? '#c8443a' : '#4f9a4a'); bar(tx + w - 68, Y + 88, 68, 7, sp / d.sp, '#4a82c4'); c.globalAlpha = a; });
    c.restore();
  }
  // ---------- 木板下面：氣勢條（全隊共用） ----------
  function momentum(t, a, v, MO) {
    if (a <= 0) return; c.save(); c.globalAlpha *= a; const X = 648, Y = 142, ok = v >= MO.ult - .5, NW = HUD.lean ? 118 : 74, bx = X + 96, bw = 1247 - 96 - 10 - NW; paper(X, Y - 4, 84, 30); text('氣勢', X + 42, Y + 19, { px: 20, w: 900, align: 'center', ls: 3 });
    bar(bx, Y + 4, bw, 14, v / MO.max, ok ? '#d9a62e' : '#9a6a3c', ok ? `rgba(255,244,190,${.35 + .25 * Math.sin(t * 6)})` : 'rgba(255,255,255,.22)');
    for (let m = MO.ult; m < MO.max; m += MO.ult) { const tx = bx + bw * m / MO.max; c.fillStyle = '#1d120b'; c.fillRect(tx - 2, Y, 4, 22); c.fillStyle = BRASS; c.fillRect(tx - 1, Y + 1, 2, 20); }
    paper(X + 1247 - NW, Y - 4, NW, 30, { tint: ok ? 'rgba(217,166,46,.35)' : null }); text(HUD.lean && !ok ? `${Math.round(v)}／${MO.ult}` : String(Math.round(v)), X + 1247 - NW / 2, Y + 19, { px: 22, w: 900, align: 'center' });
    if (!HUD.lean) text(ok ? '可以放奧義' : `到 ${MO.ult} 可以放奧義`, bx + bw * MO.ult / MO.max + 10, Y + 42, { px: 15, w: 700, fam: SANS, col: ok ? '#ffd84a' : 'rgba(239,230,207,.7)', shadow: 'rgba(0,0,0,.8)' }); c.restore();
  }
  // ---------- 敵人腳下：底氣條；歸零蓋「理虧」。左下：魔王木牌 ----------
  function enemies(t, a, MAXSH) {
    if (a <= 0) return; c.save(); c.globalAlpha *= a; const guard = stepAt(S.guard, t, false);
    for (const id of S.foes) { const u = S.units[id]; if (!u.alive) continue; const boss = id === 'boss', [px, py] = S.proj(id, 0), sh = stepAt(S.shield[id], t, 0), mx = boss ? MAXSH : 2, w = boss ? 250 : 176, y = Math.round(py + (boss ? 30 : 22)), x = Math.min(Math.round(px - w / 2 - (boss ? 40 : 0)), !boss && y > 840 ? 742 - w : 9999);      // 前排小兵的底氣條不要壓到下方的指令列
      const bx0 = HUD.lean ? 44 : 64, bw0 = w - bx0 - 14; paper(x, y, w, 34); if (HUD.lean) { c.save(); c.strokeStyle = INK; c.lineWidth = 3; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 12, y + 7); c.lineTo(x + 34, y + 7); c.lineTo(x + 34, y + 17); c.quadraticCurveTo(x + 33, y + 25, x + 23, y + 29); c.quadraticCurveTo(x + 13, y + 25, x + 12, y + 17); c.closePath(); c.stroke(); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + 25, y + 8); c.lineTo(x + 21, y + 14); c.lineTo(x + 26, y + 18); c.lineTo(x + 22, y + 27); c.stroke(); c.restore(); } else text('底氣', x + 12, y + 25, { px: 20, w: 900 }); bar(x + bx0, y + 11, bw0, 12, sh / mx, '#b23a30');
      for (let k = 1; k < mx; k++) { c.fillStyle = '#1d120b'; c.fillRect(x + bx0 + bw0 * k / mx - 1, y + 9, 2, 16); }
      if (sh <= 0) { const el = lastChange(S.shield[id], t); stamp('理虧', x + w - 46, y + 12, -.2, 30, el < .2 ? lerp(2.2, 1, easeOut(el / .2)) : 1); }
      if (guard && boss) { paper(x, y + 42, w, 30, { tint: 'rgba(178,58,48,.14)' }); text('護衛中　傷害無效', x + w / 2, y + 64, { px: 18, w: 900, align: 'center', col: RED, ls: 1 }); }
      if (boss && !guard && S.pot && S.pot()) { paper(x, y + 42, w, 30, { tint: 'rgba(202,162,76,.2)' }); text('甩鍋中　第一下小兵背', x + w / 2, y + 64, { px: 18, w: 900, align: 'center', col: INK, ls: 1 }); }
      if (guard && !boss) { const [hx, hy] = S.proj(id, 1.12), by = hy - 6 + Math.sin(t * 4 + px) * 3; paper(hx - 28, by - 22, 56, 24); text('護衛', hx, by - 4, { px: 16, w: 900, align: 'center', col: RED }); } }
    if (S.units.boss.alive || stepAt(S.bossBar, t, false)) { const hp = valAt(S.hp.boss, t, .7), d = D.boss, x = 48, y = 944, w = 620, since = lastChange(S.hp.boss, t), jit = since < .4 && S.hp.boss.length > 1 ? Math.sin(since * 70) * 6 * (1 - since / .4) : 0;
      wood(x, y, w, 100); const nw = text(d.name, x + 34 + jit, y + 46, { px: 34, w: 900, col: CREAM, shadow: 'rgba(20,10,4,.75)', ls: 2 }); stamp('BOSS', x + 34 + nw + 62, y + 34, -.1, 20); bar(x + 34, y + 62, w - 68, 16, hp / d.hp, '#c8443a'); }
    c.restore();
  }
  // ---------- 上方中央：行動名稱（夾著的紙條） ----------
  function boxes(t) {
    for (const b of S.boxes) { if (t < b.t0 || t > b.t1) continue; const a = Math.min(sat((t - b.t0) / .14), sat((b.t1 - t) / .2)), w = measure(b.text, 36, 900) + 96, x = Math.round(W / 2 - w / 2), y = 196 - (1 - a) * 12;
      c.save(); c.globalAlpha = a; paper(x, y, w, 64, { clips: [W / 2] }); if (b.enemy) { c.fillStyle = RED; c.fillRect(x + 10, y + 10, 5, 44); c.fillRect(x + w - 15, y + 10, 5, 44); } text(b.text, W / 2, y + 44, { px: 36, w: 900, align: 'center', col: b.enemy ? RED : INK, ls: 2 }); c.restore(); }
  }
  // 大印章：魔王底氣歸零的那一下，一顆「理虧」蓋在他身上
  function bigStamps(t) { for (const k of S.stamps || []) { const el = t - k.t; if (el < 0 || el > 1.5) continue; const [px, py] = S.proj(k.id, .55), sc = el < .14 ? lerp(3.2, 1, easeOut(el / .14)) : 1, sh = el < .4 ? Math.sin(el * 90) * 7 * (1 - el / .4) : 0;
      c.save(); c.globalAlpha = sat((1.5 - el) / .3); stamp('理虧', px + sh, py, -.16, 130, sc); text('底氣歸零　下次行動取消', px, py + 130, { px: 30, w: 900, align: 'center', col: CREAM, shadow: 'rgba(20,6,6,.9)', ls: 4 }); c.restore(); } }
  return { wood, paper, clip, stamp, bar, face, text, measure, order, party, momentum, enemies, boxes,
    hud(t, a, cardOn, mo, MO, maxShield) { enemies(t, a, maxShield); party(t, a); momentum(t, a, mo, MO); order(t, a * (1 - cardOn)); bigStamps(t); } };
}
