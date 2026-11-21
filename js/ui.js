// 戰鬥介面（1920×1080 的 2D 畫布，疊在場景上）：行動順序、隊伍狀態、指令選單、招式名、傷害數字、
// 大招的斜切眼神特寫、魔王登場名條、勝利結算、角色介紹卡、片尾。資料全部來自 battle.js 的 S，這裡只管畫。
import { W, H, sat, lerp, ease, easeOut, back, rnd } from './engine.js';
import { stepAt } from './units.js';

export const COL = { ink: '#0d0b16', text: '#f3ecda', dim: '#a9a08e', gold: '#e2bf6c', goldD: '#9c7a34', hp: '#6fd07a', sp: '#62a8ee', red: '#e2463f', line: 'rgba(243,236,218,.55)' };
const SANS = '"Noto Sans TC", sans-serif', SERIF = '"Songti TC", "Noto Serif TC", "PMingLiU", serif';
const fmt = n => Math.round(n).toLocaleString('en-US');
// 數值軌道：到新數值時用 dur 秒滾過去
const valAt = (keys, t, dur = .5) => { let p = keys[0], q = keys[0]; for (const k of keys) { if (k.t > t) break; p = q; q = k; } return p === q ? q.v : lerp(p.v, q.v, easeOut(sat((t - q.t) / dur))); };
const lastChange = (keys, t) => { let q = keys[0]; for (const k of keys) { if (k.t > t) break; q = k; } return t - q.t; };

export function makeUI(cv, A, S) {
  const c = cv.getContext('2d'), D = S.defs;
  const font = (px, w = 700, fam = SANS) => { c.font = `${w} ${px}px ${fam}`; };
  const txt = (s, x, y, o = {}) => {
    font(o.px ?? 28, o.w ?? 700, o.fam ?? SANS); c.textAlign = o.align ?? 'left'; c.textBaseline = o.base ?? 'alphabetic'; c.letterSpacing = `${o.ls ?? 0}px`;
    if (o.shadow) { c.fillStyle = o.shadow; c.fillText(s, x + (o.sx ?? 3), y + (o.sy ?? 3)); }
    if (o.stroke) { c.lineJoin = 'round'; c.lineWidth = o.sw ?? 6; c.strokeStyle = o.stroke; c.strokeText(s, x, y); }
    c.fillStyle = o.col ?? COL.text; c.fillText(s, x, y); const wd = c.measureText(s).width; c.letterSpacing = '0px'; return wd;
  };
  const measure = (s, px, w = 700, fam = SANS, ls = 0) => { font(px, w, fam); c.letterSpacing = `${ls}px`; const m = c.measureText(s).width; c.letterSpacing = '0px'; return m; };
  const gem = (x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.fill(); };
  // 菱形頭像
  function diamond(cx, cy, r, img, border, dark = 0) {
    c.save(); c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath();
    c.fillStyle = '#16131f'; c.fill(); c.clip(); c.imageSmoothingEnabled = false; if (img) c.drawImage(img, cx - r, cy - r, r * 2, r * 2); c.imageSmoothingEnabled = true;
    if (dark) { c.fillStyle = `rgba(10,8,18,${dark})`; c.fillRect(cx - r, cy - r, r * 2, r * 2); } c.restore();
    c.beginPath(); c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath(); c.lineWidth = r > 44 ? 4 : 3; c.strokeStyle = border; c.stroke();
  }

  // ---------- 左上：行動順序 ----------
  function turnOrder(t, a) {
    if (a <= 0) return; let cur = null; for (const k of S.order) { if (k.t > t) break; cur = k; } if (!cur) return;
    const u = easeOut(sat((t - cur.t) / .28)), ox = (1 - u) * 46; c.save(); c.globalAlpha *= a;
    const H_ = S.partyMode === 'h', list = H_ ? cur.v.slice(0, 7) : cur.v, R0 = H_ ? 44 : 58, R1 = H_ ? 27 : 36, SP_ = H_ ? 61 : 80, x0 = H_ ? 78 : 118, y0 = H_ ? 66 : 112; let x = x0 + R0 + (H_ ? 14 : 22) + R1; const n = list.length;
    c.strokeStyle = COL.line; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x + (n - 2) * SP_ + (H_ ? 40 : 60), y0); c.stroke();
    list.forEach((id, i) => { const e = D[id].enemy, bd = e ? '#c8423c' : COL.text;
      if (i === 0) { c.save(); c.shadowColor = e ? 'rgba(255,70,60,.8)' : 'rgba(255,225,150,.8)'; c.shadowBlur = 22; diamond(x0, y0, R0 * lerp(.8, 1, u), A.face[id], e ? '#ff6a5a' : COL.gold); c.restore(); }
      else diamond(x + (i - 1) * SP_ + ox, y0, R1, A.face[id], bd, .18); });
    if (!H_) txt('行動順序', x0 - 58, y0 + 96, { px: 20, w: 500, col: COL.dim, ls: 6 });
    c.restore();
  }

  // ---------- 隊伍狀態（橫排版）：畫面最上面一排五欄，不會蓋到站在右邊的角色。試玩版用 ----------
  function partyH(t, a) {
    c.save(); c.globalAlpha *= a; const g = c.createLinearGradient(0, 0, 0, 150); g.addColorStop(0, 'rgba(8,6,16,.78)'); g.addColorStop(.75, 'rgba(8,6,16,.5)'); g.addColorStop(1, 'rgba(8,6,16,0)'); c.fillStyle = g; c.fillRect(560, 0, W - 560, 150);
    const active = stepAt(S.active, t, null), XL = 632, CW = 252;
    S.party.forEach((id, i) => { const d = D[id], x = XL + i * CW, y = 46, hp = valAt(S.hp[id], t), sp = valAt(S.sp[id], t), bp = stepAt(S.bp[id], t, 1), w = CW - 26;
      const since = lastChange(S.hp[id], t), jit = since < .45 && S.hp[id].length > 1 ? Math.sin(since * 60) * 5 * (1 - since / .45) : 0, low = hp / d.hp < .26, on = active === id, down = hp <= 0;
      if (on) { c.fillStyle = 'rgba(226,191,108,.16)'; c.fillRect(x - 12, 10, CW - 6, 112); c.fillStyle = COL.gold; c.fillRect(x - 12, 10, CW - 6, 3); gem(x - 12, 11, 6, '#fff6d8'); gem(x - 12 + CW - 6, 11, 6, '#fff6d8'); }
      if (i) { c.fillStyle = 'rgba(243,236,218,.14)'; c.fillRect(x - 16, 22, 1, 92); }
      c.globalAlpha = a * (down ? .5 : 1);
      const nw = txt(d.name, x, y, { px: 27, w: 700, col: on ? COL.gold : COL.text, shadow: 'rgba(0,0,0,.7)', sx: 2, sy: 2 }); txt(i === 4 ? '後排' : d.job, x + nw + 8, y - 1, { px: 15, w: 500, col: COL.dim });
      if (!S.noBp) for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + w - 62 + k * 14, y - 9, 4.5, 0, 7); if (k < bp) { c.fillStyle = bp >= 5 ? '#ffd84a' : '#ff6a4a'; c.fill(); } else { c.strokeStyle = 'rgba(243,236,218,.4)'; c.lineWidth = 1.2; c.stroke(); } }
      txt('HP', x, y + 36, { px: 12, w: 700, col: COL.dim, ls: 1 });
      const hw = txt(down ? '倒下' : fmt(hp).replace(/,/g, ''), x + 26 + jit, y + 40, { px: down ? 26 : 32, w: 900, col: down || low ? '#ff7a6a' : COL.text, shadow: 'rgba(0,0,0,.7)', sx: 2, sy: 2 }); if (!down) txt('/' + d.hp, x + 30 + hw, y + 39, { px: 15, w: 500, col: COL.dim });
      txt(String(Math.round(sp)), x + w, y + 40, { px: 20, w: 700, align: 'right', col: '#cfe4ff' }); txt('SP', x + w - measure(String(Math.round(sp)), 20, 700) - 6, y + 38, { px: 11, w: 700, col: COL.dim, align: 'right', ls: 1 });
      const bw = w - 78; c.fillStyle = 'rgba(243,236,218,.2)'; c.fillRect(x, y + 50, bw, 6); c.fillStyle = low ? COL.red : COL.hp; c.fillRect(x, y + 50, bw * sat(hp / d.hp), 6);
      c.fillStyle = 'rgba(243,236,218,.2)'; c.fillRect(x + w - 68, y + 50, 68, 6); c.fillStyle = COL.sp; c.fillRect(x + w - 68, y + 50, 68 * sat(sp / d.sp), 6); c.globalAlpha = a; });
    c.restore();
  }

  // ---------- 右上：隊伍狀態 ----------
  function party(t, a) {
    if (a <= 0) return; if (S.partyMode === 'h') return partyH(t, a); c.save(); c.globalAlpha *= a;
    const g = c.createLinearGradient(1380, 0, W, 0); g.addColorStop(0, 'rgba(8,6,16,0)'); g.addColorStop(1, 'rgba(8,6,16,.66)'); c.fillStyle = g; c.fillRect(1380, 0, W - 1380, 520);
    const active = stepAt(S.active, t, null), X1 = 1860, BW = 300;
    S.party.forEach((id, i) => { const d = D[id], y = 72 + i * 88 + (i === 4 ? 10 : 0), hp = valAt(S.hp[id], t), sp = valAt(S.sp[id], t), bp = stepAt(S.bp[id], t, 1), X0 = X1 - BW;
      const since = lastChange(S.hp[id], t), hurt = since < .45 && S.hp[id].length > 1 ? Math.sin(since * 60) * 5 * (1 - since / .45) : 0, low = hp / d.hp < .26, on = active === id;
      if (on) { c.fillStyle = 'rgba(226,191,108,.14)'; c.fillRect(X0 - 44, y - 28, BW + 56, 78); gem(X0 - 22, y - 8, 8, COL.gold); }
      // 第一行：名字、職業、BP；右邊 SP
      const nw = txt(d.name, X0, y, { px: 27, w: 700, col: on ? COL.gold : COL.text, shadow: 'rgba(0,0,0,.7)', sx: 2, sy: 2 });
      const jw = txt(i === 4 ? '後排' : d.job, X0 + nw + 9, y - 1, { px: 16, w: 500, col: COL.dim });
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(X0 + nw + jw + 26 + k * 14, y - 8, 4.5, 0, 7); if (k < bp) { c.fillStyle = bp >= 5 ? '#ffd84a' : '#ff6a4a'; c.fill(); } else { c.strokeStyle = 'rgba(243,236,218,.4)'; c.lineWidth = 1.2; c.stroke(); } }
      // 第二行：HP 大數字；右邊小的 SP
      txt('HP', X0, y + 33, { px: 13, w: 700, col: COL.dim, ls: 1 });
      const hw = txt(fmt(hp).replace(/,/g, ''), X0 + 28 + hurt, y + 36, { px: 33, w: 900, col: low ? '#ff7a6a' : COL.text, shadow: 'rgba(0,0,0,.7)', sx: 2, sy: 2 }); txt('/' + d.hp, X0 + 32 + hw, y + 35, { px: 17, w: 500, col: COL.dim });
      const sw = measure('/' + d.sp, 15, 500); txt('/' + d.sp, X1, y + 35, { px: 15, w: 500, col: COL.dim, align: 'right' }); const vw = measure(String(Math.round(sp)), 22, 700); txt(String(Math.round(sp)), X1 - sw - 3, y + 36, { px: 22, w: 700, align: 'right', col: '#cfe4ff' }); txt('SP', X1 - sw - vw - 10, y + 34, { px: 12, w: 700, col: COL.dim, align: 'right', ls: 1 });
      c.fillStyle = 'rgba(243,236,218,.2)'; c.fillRect(X0, y + 43, BW, 5); c.fillStyle = low ? COL.red : COL.hp; c.fillRect(X0, y + 43, (BW - 96) * sat(hp / d.hp), 5);
      c.fillStyle = 'rgba(10,8,18,.9)'; c.fillRect(X1 - 92, y + 43, 4, 5); c.fillStyle = COL.sp; c.fillRect(X1 - 88, y + 43, 88 * sat(sp / d.sp), 5);
    });
    c.restore();
  }

  // ---------- 敵人腳下：護盾數與弱點；左下：魔王名字與 HP ----------
  const WEAK = ['劍', '暗', '光', '令'];
  function enemies(t, a) {
    if (a <= 0) return; c.save(); c.globalAlpha *= a; const guard = stepAt(S.guard, t, false);
    for (const id of S.foes) { const u = S.units[id]; if (!u.alive) continue; const [px, py] = S.proj(id, 0), sh = stepAt(S.shield[id], t, 0), rev = stepAt(S.reveal, t, 0), boss = id === 'boss', x = px - (boss ? 110 : 60), y = py + (boss ? 34 : 26);
      // 盾形
      c.save(); c.translate(x, y); c.beginPath(); c.moveTo(-17, -20); c.lineTo(17, -20); c.lineTo(17, 4); c.quadraticCurveTo(14, 18, 0, 25); c.quadraticCurveTo(-14, 18, -17, 4); c.closePath();
      c.fillStyle = sh > 0 ? '#3a56a8' : '#5a2a30'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = sh > 0 ? '#dfe6ff' : '#ff8a80'; c.stroke(); c.restore();
      txt(sh > 0 ? String(sh) : '×', x, y + 10, { px: 26, w: 900, align: 'center', col: '#fff' });
      if (sh <= 0) txt('BREAK', x + 28, y - 4, { px: 20, w: 900, col: '#ff6a5a', ls: 3, stroke: 'rgba(20,6,10,.8)', sw: 5 });
      else txt('弱點', x + 28, y - 4, { px: 17, w: 700, col: COL.dim, ls: 3, stroke: 'rgba(10,8,18,.7)', sw: 4 });
      for (let k = 0; k < (boss ? 4 : 2); k++) { const bx = x + 28 + k * 34, by = y + 4, known = k < rev; c.fillStyle = 'rgba(12,10,22,.82)'; c.fillRect(bx, by, 30, 30); c.strokeStyle = known ? COL.gold : 'rgba(243,236,218,.35)'; c.lineWidth = 1.5; c.strokeRect(bx + .5, by + .5, 29, 29);
        txt(known ? WEAK[k] : '?', bx + 15, by + 23, { px: 20, w: 700, align: 'center', col: known ? COL.gold : COL.dim, fam: known ? SERIF : SANS }); }
      // 小兵還在：魔王旁邊掛「護衛中」的牌子；小兵頭上一個小盾
      if (guard && boss) { const gx = x + 28 + 4 * 34 + 12, gy = y + 4, pu = .75 + .25 * Math.sin(t * 5); c.fillStyle = 'rgba(40,10,14,.9)'; c.fillRect(gx, gy, 196, 30); c.strokeStyle = `rgba(255,120,100,${pu})`; c.lineWidth = 2; c.strokeRect(gx + 1, gy + 1, 194, 28);
        txt('護衛中　傷害無效', gx + 98, gy + 22, { px: 18, w: 700, align: 'center', col: '#ffb0a0', ls: 1 }); }
      if (guard && !boss) { const [hx, hy] = S.proj(id, 1.12); c.save(); c.translate(hx, hy - 6 + Math.sin(t * 4 + px) * 3); c.beginPath(); c.moveTo(-11, -13); c.lineTo(11, -13); c.lineTo(11, 2); c.quadraticCurveTo(9, 11, 0, 16); c.quadraticCurveTo(-9, 11, -11, 2); c.closePath(); c.fillStyle = '#a8322e'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffd0c8'; c.stroke(); c.restore(); }
    }
    // 魔王 HP
    if (S.units.boss.alive || stepAt(S.bossBar, t, false)) { const hp = valAt(S.hp.boss, t, .7), d = D.boss, x = 84, y = 992, bw = 560, since = lastChange(S.hp.boss, t), jit = since < .4 && S.hp.boss.length > 1 ? Math.sin(since * 70) * 6 * (1 - since / .4) : 0;
      txt('奧客總經理', x + jit, y - 16, { px: 30, w: 700, fam: SERIF, shadow: 'rgba(0,0,0,.8)', sx: 2, sy: 2 }); txt('BOSS', x + 172 + jit, y - 17, { px: 17, w: 900, col: '#ff6a5a', ls: 4 });
      c.fillStyle = 'rgba(10,8,18,.8)'; c.fillRect(x - 3, y - 3, bw + 6, 16); c.fillStyle = 'rgba(243,236,218,.16)'; c.fillRect(x, y, bw, 10);
      const k = sat(hp / d.hp), g = c.createLinearGradient(x, 0, x + bw, 0); g.addColorStop(0, '#b3262c'); g.addColorStop(1, '#ff7a4a'); c.fillStyle = g; c.fillRect(x, y, bw * k, 10); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, y, bw * k, 3);
      gem(x - 14, y + 5, 7, COL.gold); gem(x + bw + 14, y + 5, 7, COL.gold); }
    c.restore();
  }

  // ---------- 指令選單（跟著角色） ----------
  const ITEMS = ['攻擊', '技能', '奧義', '道具', '防禦'];
  function menu(t) {
    for (const m of S.menus) { if (t < m.t0 || t > m.t1 + .2) continue;
      const a = Math.min(easeOut(sat((t - m.t0) / .18)), sat((m.t1 + .2 - t) / .2)), [ax, ay] = S.proj(m.id, 1), d = D[m.id], w = 270, rh = 54, x = Math.max(560, Math.min(1180, ax - w - 150)) - (1 - a) * 30, y = 196;
      // 輪到誰：頭上一個往下指的金色箭頭，選單用一條細線連過去
      { const by = ay - 34 + Math.sin(t * 7) * 5; c.save(); c.globalAlpha = a; c.fillStyle = COL.gold; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(ax - 15, by - 22); c.lineTo(ax + 15, by - 22); c.lineTo(ax, by); c.closePath(); c.stroke(); c.fill();
        c.strokeStyle = 'rgba(226,191,108,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + w, y + rh * 5 + 15); c.lineTo(ax, y + rh * 5 + 15); c.lineTo(ax, by - 30); c.stroke(); c.restore(); }
      let idx = 0; for (const mt of m.moves) if (t >= mt) idx++;
      c.save(); c.globalAlpha = a;
      txt(d.name, x + 4, y - 16, { px: 24, w: 700, col: COL.gold, shadow: 'rgba(0,0,0,.8)', sx: 2, sy: 2 }); txt(d.job, x + 4 + measure(d.name, 24) + 10, y - 17, { px: 17, w: 500, col: COL.dim });
      c.fillStyle = 'rgba(11,9,20,.86)'; c.fillRect(x, y, w, rh * 5 + 16); c.fillStyle = COL.gold; c.fillRect(x, y, w, 2); c.fillRect(x, y + rh * 5 + 14, w, 2); gem(x, y + 1, 6, COL.gold); gem(x + w, y + 1, 6, COL.gold); gem(x, y + rh * 5 + 15, 6, COL.gold); gem(x + w, y + rh * 5 + 15, 6, COL.gold);
      ITEMS.forEach((s, i) => { const ry = y + 8 + i * rh, on = i === idx, picked = on && t >= m.confirm, fl = picked ? sat(1 - (t - m.confirm) / .25) : 0;
        if (on) { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, `rgba(226,191,108,${.42 + fl * .5})`); g.addColorStop(1, `rgba(226,191,108,${fl * .5})`); c.fillStyle = g; c.fillRect(x + 4, ry + 3, w - 8, rh - 6); gem(x + 26 + Math.sin(t * 9) * 3, ry + rh / 2, 8, '#fff6d8'); }
        txt(s, x + 52, ry + rh / 2 + 12, { px: 31, w: on ? 700 : 500, col: on ? '#fffaf0' : 'rgba(243,236,218,.62)' });
        if (i === 2) txt('MAX', x + w - 20, ry + rh / 2 + 8, { px: 16, w: 900, col: on ? '#ffd84a' : COL.goldD, align: 'right', ls: 2 }); });
      // 選下去之後，左邊帶出副框：招式名與說明，或道具清單（再選一次）
      if (t >= m.confirm) { const u = easeOut(sat((t - m.confirm) / .16)), row = m.moves.length; c.globalAlpha = a * u;
        if (m.list) { const lh = 52, bw = 440, bh = m.list.length * lh + 18, bx = x - bw - 18 + (1 - u) * 24, by = y + 8; let li = 0; for (const mt of m.listMoves) if (t >= mt) li++;
          c.fillStyle = 'rgba(11,9,20,.92)'; c.fillRect(bx, by, bw, bh); c.fillStyle = d.color; c.fillRect(bx, by, 5, bh); c.fillStyle = COL.gold; c.fillRect(bx, by, bw, 2);
          m.list.forEach((it, i) => { const ry = by + 9 + i * lh, on = i === li, fl = on && t >= m.confirm2 ? sat(1 - (t - m.confirm2) / .25) : 0;
            if (on) { const g = c.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, `rgba(226,191,108,${.4 + fl * .5})`); g.addColorStop(1, `rgba(226,191,108,${fl * .5})`); c.fillStyle = g; c.fillRect(bx + 8, ry + 3, bw - 14, lh - 6); gem(bx + 26 + Math.sin(t * 9) * 3, ry + lh / 2, 7, '#fff6d8'); }
            txt(it.name, bx + 46, ry + lh / 2 + 10, { px: 28, w: 700, fam: SERIF, col: on ? '#fffaf0' : 'rgba(243,236,218,.62)' }); txt('×' + it.n, bx + 196, ry + lh / 2 + 9, { px: 22, w: 700, col: on ? COL.gold : COL.goldD });
            txt(it.note, bx + bw - 16, ry + lh / 2 + 8, { px: 18, w: 500, col: COL.dim, align: 'right' }); }); }
        else { const title = m.skill ?? m.title, note = m.note ?? `消耗 SP ${m.cost}　BP ●●●`, bw = Math.max(320, measure(title, 34, 700, SERIF) + 70, measure(note, 18, 500) + 52), bx = x - bw - 18 + (1 - u) * 24, by = y + 8 + row * rh - (row ? 14 : 0);
          c.fillStyle = 'rgba(11,9,20,.9)'; c.fillRect(bx, by, bw, 84); c.fillStyle = d.color; c.fillRect(bx, by, 5, 84);
          txt(title, bx + 26, by + 42, { px: 34, w: 700, fam: SERIF }); txt(note, bx + 26, by + 70, { px: 18, w: 500, col: COL.dim }); } }
      // 目標：頭上一個跳動的箭頭（敵人紅、同伴綠）
      if (m.target && t >= (m.confirm2 ?? m.confirm)) { const [tx, ty] = S.proj(m.target, 1), foe = D[m.target].enemy, col = foe ? '#ff6a5a' : '#8cf09a', by = ty - 40 + Math.sin(t * 9) * 6; c.globalAlpha = a;
        c.fillStyle = col; c.strokeStyle = 'rgba(10,8,18,.9)'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx - 17, by - 24); c.lineTo(tx + 17, by - 24); c.lineTo(tx, by); c.closePath(); c.stroke(); c.fill();
        txt('目標', tx, by - 32, { px: 20, w: 900, align: 'center', col, stroke: 'rgba(10,8,18,.9)', sw: 5, ls: 3 }); }
      c.restore(); }
  }

  // ---------- 上方中央：招式名小框 ----------
  function boxes(t) {
    for (const b of S.boxes) { if (t < b.t0 || t > b.t1) continue; const a = Math.min(sat((t - b.t0) / .14), sat((b.t1 - t) / .2)), w = measure(b.text, 36, 700, SERIF) + 96, x = W / 2 - w / 2, y = (S.partyMode === 'h' ? 172 : 150) - (1 - a) * 10;
      c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(11,9,20,.88)'; c.fillRect(x, y, w, 66); c.strokeStyle = b.enemy ? '#e2463f' : COL.line; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, 64);
      gem(x, y + 33, 8, b.enemy ? '#e2463f' : COL.gold); gem(x + w, y + 33, 8, b.enemy ? '#e2463f' : COL.gold);
      txt(b.text, W / 2, y + 46, { px: 36, w: 700, fam: SERIF, align: 'center', col: b.enemy ? '#ffd9d2' : COL.text }); c.restore(); }
  }

  // ---------- 左上：大招名牌 ----------
  function cards(t) {
    for (const k of S.cards) { if (t < k.t0 || t > k.t1) continue; const d = D[k.id], el = t - k.t0, out = sat((k.t1 - t) / .22), u = easeOut(sat(el / .22)), x = 84, y = S.partyMode === 'h' ? 158 : 96;
      c.save(); c.globalAlpha = out; const nw = measure(d.skill, 92, 900, SERIF, 4), sx = x - 40, sw = (nw + 120) * u;
      // 色塊：斜切的平行四邊形（先掃進來），上面壓一條細的白線
      c.fillStyle = 'rgba(8,6,16,.72)'; c.beginPath(); c.moveTo(sx - 60, y + 22); c.lineTo(sx + sw + 34, y + 22); c.lineTo(sx + sw, y + 142); c.lineTo(sx - 60, y + 142); c.fill();
      c.fillStyle = d.color; c.beginPath(); c.moveTo(sx - 60, y + 112); c.lineTo(sx + sw + 9, y + 112); c.lineTo(sx + sw, y + 142); c.lineTo(sx - 60, y + 142); c.fill();
      c.fillStyle = '#fff'; c.fillRect(sx - 60, y + 20, (sw + 100) * u, 2);
      const tx = x + (1 - u) * -80; c.globalAlpha = out * sat(el / .2);
      txt(`${d.job}奧義`, tx, y + 6, { px: 24, w: 700, col: COL.gold, ls: 8, shadow: 'rgba(0,0,0,.8)', sx: 2, sy: 2 }); txt(d.name, tx + measure(`${d.job}奧義`, 24, 700, SANS, 8) + 16, y + 6, { px: 22, w: 500, col: COL.text, ls: 2 });
      txt(d.skill, tx, y + 106, { px: 92, w: 900, fam: SERIF, ls: 4, shadow: 'rgba(0,0,0,.85)', sx: 5, sy: 6, stroke: 'rgba(8,6,16,.9)', sw: 10 });
      txt(d.en, tx + 2, y + 135, { px: 17, w: 900, col: '#0d0b16', ls: 5 });
      c.restore(); }
  }

  // ---------- 傷害數字與狀態字 ----------
  function numbers(t) {
    for (const n of S.nums) { const el = t - n.t, life = n.life ?? (n.kind === 'big' ? 2.2 : n.kind === 'dmg' ? 1.05 : 1.4); if (el < 0 || el > life) continue;
      const [px, py] = n.fixed || S.proj(n.id, n.y ?? .62), s = back(el / .15), a = sat((life - el) / .3), rise = 50 * easeOut(el / life), k = n.kind;
      const px0 = Math.max(130, Math.min(c.canvas.width - 130, px + (n.dx || 0))), py0 = py + (n.dy || 0) - rise, shake = k === 'big' && el < .5 ? Math.sin(el * 80) * 10 * (1 - el / .5) : 0;
      c.save(); c.globalAlpha = a; c.translate(px0 + shake, py0); c.scale(s, s); c.transform(1, 0, -.16, 1, 0, 0);
      if (k === 'heal') txt('+' + fmt(n.v), 0, 0, { px: 60, w: 900, align: 'center', col: '#8cf09a', stroke: '#0c2a16', sw: 9 });
      else if (k === 'foe') txt('-' + fmt(n.v), 0, 0, { px: n.big ? 78 : 58, w: 900, align: 'center', col: n.big ? '#ff6a58' : '#ff9a88', stroke: '#2a0a0c', sw: n.big ? 11 : 9 });
      else if (k === 'sp') txt('+' + fmt(n.v) + ' SP', 0, 0, { px: 52, w: 900, align: 'center', col: '#8ccaff', stroke: '#0a1a30', sw: 9 });
      else if (k === 'guard') txt('GUARD', 0, 0, { px: 46, w: 900, align: 'center', col: '#bfeaff', stroke: '#0a2030', sw: 8, ls: 4 });
      else if (k === 'text') txt(n.v, 0, 0, { px: n.px ?? 34, w: 900, align: 'center', col: n.col ?? COL.gold, stroke: 'rgba(12,8,20,.9)', sw: 7, ls: 2 });
      else if (k === 'big') { const g = c.createLinearGradient(0, -130, 0, 0); g.addColorStop(0, '#fffbe0'); g.addColorStop(.55, '#ffd23c'); g.addColorStop(1, '#ff6a1e'); txt(fmt(n.v), 0, 0, { px: 170, w: 900, align: 'center', col: g, stroke: '#3a0a08', sw: 20 }); txt(fmt(n.v), 0, 0, { px: 170, w: 900, align: 'center', col: g, stroke: '#fff', sw: 5 }); txt('總攻擊', 0, -150, { px: 40, w: 900, align: 'center', col: '#fff', stroke: '#3a0a08', sw: 9, ls: 10 }); }
      else if (k === 'crit') { const g = c.createLinearGradient(0, -70, 0, 0); g.addColorStop(0, '#fff6c0'); g.addColorStop(1, '#ff9a2a'); txt(fmt(n.v) + '!', 0, 0, { px: 88, w: 900, align: 'center', col: g, stroke: '#2a1206', sw: 12 }); txt('會心一擊', 0, -80, { px: 24, w: 900, align: 'center', col: '#ffe9a0', stroke: '#2a1206', sw: 6, ls: 4 }); }
      else { txt(fmt(n.v), 0, 0, { px: 58, w: 900, align: 'center', col: '#fff', stroke: '#16101e', sw: 9 }); if (n.weak) txt('弱點', 0, -54, { px: 20, w: 900, align: 'center', col: '#ff8a70', stroke: '#16101e', sw: 6, ls: 4 }); }
      c.restore(); }
    for (const b of S.breaks) { const el = t - b.t; if (el < 0 || el > 1.5) continue; const [px, py] = S.proj('boss', .55), s = el < .12 ? lerp(2.6, 1, easeOut(el / .12)) : 1, a = sat((1.5 - el) / .3), sh = el < .4 ? Math.sin(el * 90) * 8 * (1 - el / .4) : 0;
      c.save(); c.globalAlpha = a; c.translate(px + sh, py); c.scale(s, s); c.rotate(-.07); c.transform(1, 0, -.2, 1, 0, 0);
      // 碎裂的短線
      c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 14; i++) { const ang = i / 14 * 6.283 + .2, r0 = 150 + rnd(i) * 40 + el * 160, r1 = r0 + 30 + rnd(i * 3) * 50; c.beginPath(); c.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0 * .5); c.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1 * .5); c.stroke(); }
      txt('BREAK', 0, 40, { px: 150, w: 900, align: 'center', col: '#ff4a3c', stroke: '#1a0608', sw: 22, ls: 6 }); txt('BREAK', 0, 40, { px: 150, w: 900, align: 'center', col: '#ff4a3c', stroke: '#fff', sw: 6, ls: 6 }); txt('防禦瓦解', 0, 86, { px: 30, w: 900, align: 'center', col: '#fff', stroke: '#1a0608', sw: 8, ls: 12 }); c.restore(); }
  }

  // ---------- 大招：一條斜線切開畫面，裂縫裡露出角色的眼神 ----------
  const ANG = -.19;
  function cutins(t) {
    for (const k of S.cutins) { const el = t - k.t0; if (el < 0 || el > k.dur) continue; const d = D[k.id], img = A.eyes[k.id], rem = k.dur - el;
      const openU = easeOut(sat((el - .16) / .2)), closeU = sat(rem / .14), hh = Math.max(0, 165 * (k.hk || 1) * openU * closeU * closeU), lineU = easeOut(sat(el / .14));
      // 時間暫停：整個畫面壓暗
      c.fillStyle = `rgba(6,5,14,${.62 * Math.min(sat(el / .12), sat(rem / .12))})`; c.fillRect(0, 0, W, H);
      c.save(); c.translate(W / 2, H / 2 - 20 + (k.dy || 0)); c.rotate(ANG);
      if (hh > 1) {
        c.save(); c.beginPath(); c.rect(-1300, -hh, 2600, hh * 2); c.clip();
        c.fillStyle = '#0a0812'; c.fillRect(-1300, -hh, 2600, hh * 2);
        // 眼睛：畫面不跟著斜（轉回來），慢慢往敵人那邊推、微微放大
        c.save(); c.rotate(-ANG); const z = 1.08 + .06 * sat(el / k.dur), iw = W * z, ih = iw * img.height / img.width, drift = lerp(30, -30, sat(el / k.dur));
        c.imageSmoothingEnabled = false; c.drawImage(img, -iw / 2 + drift + 70, -ih * (d.eyeY ?? .52), iw, ih); c.imageSmoothingEnabled = true; c.restore();
        // 速度線、上下內陰影、掃過眼睛的反光
        for (let i = 0; i < 26; i++) { const yy = (rnd(i * 3.1) * 2 - 1) * 165, len = 120 + rnd(i * 7.7) * 520, xx = ((rnd(i * 5.3) * 3200 - el * (2600 + rnd(i) * 2400)) % 3200 + 3200) % 3200 - 1600; c.fillStyle = `rgba(255,255,255,${.1 + rnd(i * 1.3) * .22})`; c.fillRect(xx, yy, len, rnd(i * 9.1) < .25 ? 4 : 2); }
        const g = c.createLinearGradient(0, -hh, 0, hh); g.addColorStop(0, 'rgba(6,4,12,.7)'); g.addColorStop(.2, 'rgba(6,4,12,0)'); g.addColorStop(.8, 'rgba(6,4,12,0)'); g.addColorStop(1, 'rgba(6,4,12,.7)'); c.fillStyle = g; c.fillRect(-1300, -hh, 2600, hh * 2);
        const gl = (el - .5) / .28; if (gl > 0 && gl < 1) { const gx = lerp(-1200, 1200, gl); c.fillStyle = 'rgba(255,255,255,.42)'; c.beginPath(); c.moveTo(gx, -hh); c.lineTo(gx + 150, -hh); c.lineTo(gx + 40, hh); c.lineTo(gx - 110, hh); c.fill(); }
        // 剛切開、要合上時整條白一下
        const wf = Math.max(sat(1 - (el - .16) / .22), sat(1 - rem / .14)); if (wf > 0) { c.fillStyle = `rgba(255,255,255,${wf * .9})`; c.fillRect(-1300, -hh, 2600, hh * 2); }
        // 名字：裂縫右下角
        c.globalAlpha = sat((el - .4) / .2) * sat(rem / .25); txt(d.name, 760, hh - 30, { px: 54, w: 900, fam: SERIF, align: 'right', ls: 6, stroke: 'rgba(8,6,16,.9)', sw: 9 }); txt(d.job, 780, hh - 34, { px: 22, w: 700, col: d.color, ls: 4, stroke: 'rgba(8,6,16,.9)', sw: 6 });
        c.restore();
        // 裂縫上下緣：色光＋白線＋鋸齒狀的能量刺
        for (const s of [-1, 1]) { c.save(); c.shadowColor = d.color; c.shadowBlur = 30; c.fillStyle = d.color; c.fillRect(-1300, s * hh - 5, 2600, 10); c.restore(); c.fillStyle = '#fff'; c.fillRect(-1300, s * hh - 2, 2600, 4);
          c.fillStyle = d.color; const f = Math.floor(el * 24); for (let i = 0; i < 44; i++) { const bx = -1250 + i * 58 + rnd(i * 2.2 + f) * 40, ht = 8 + rnd(i * 5.5 + f * 3.3) * 34; c.beginPath(); c.moveTo(bx, s * hh); c.lineTo(bx + 16, s * hh); c.lineTo(bx + 30 + rnd(i + f) * 30, s * (hh + ht)); c.fill(); } }
      }
      // 那一刀：白線從左下劈到右上
      if (el < .5) { const a = sat(1 - (el - .14) / .3), L = 2600 * lineU; c.save(); c.shadowColor = d.color; c.shadowBlur = 40; c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(-1300, -3 - 5 * a, L, 6 + 10 * a); c.restore(); }
      c.restore(); }
  }

  // ---------- 道具：圖示先在使用者頭上跳出來，再拋物線丟給對象（自己用就往下喝掉） ----------
  function items(t) {
    for (const k of S.items) { const el = t - k.t0; if (el < 0 || el > 1.12) continue; const [fx0, fy0] = S.proj(k.from, 1.0), [tx, ty] = S.proj(k.to, 1.0), img = A.items[k.key] || (k.key === 'bento' && A.icons ? A.icons.up_bento : null), self = k.from === k.to;
      let x = fx0, y = fy0 - 78 - 8 * Math.sin(el * 9), s = back(sat(el / .22)), al = 1;
      if (el > .58) { const u = ease(sat((el - .58) / .44)); if (self) { y = lerp(fy0 - 78, fy0 + 20, u); s = 1 - .45 * u; } else { x = lerp(fx0, tx, u); y = lerp(fy0 - 78, ty + 10, u) - Math.sin(u * Math.PI) * 140; s = 1 - .3 * u; } al = sat((1.1 - el) / .12); }
      c.save(); c.globalAlpha = al; c.translate(x, y); c.scale(s, s);
      const g = c.createRadialGradient(0, 0, 8, 0, 0, 78); g.addColorStop(0, 'rgba(255,240,190,.75)'); g.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = g; c.fillRect(-80, -80, 160, 160);
      for (let i = 0; i < 6; i++) { const an = el * 3 + i * 1.047, r = 62 + 6 * Math.sin(el * 8 + i); gem(Math.cos(an) * r, Math.sin(an) * r * .8, 4, '#fff6d8'); }
      if (img) { const h = 112, w = h * img.width / img.height; c.imageSmoothingEnabled = false; c.drawImage(img, -w / 2, -h / 2, w, h); c.imageSmoothingEnabled = true; }
      else { c.fillStyle = k.key === 'tea' ? '#d9a877' : '#5a3a2a'; c.fillRect(-24, -30, 48, 66); c.fillStyle = '#fff'; c.fillRect(-28, -38, 56, 10); }
      if (k.name && el < .7) { c.globalAlpha = al * sat(el / .15) * sat((.7 - el) / .12); txt(k.name, -70, 12, { px: 32, w: 700, fam: SERIF, align: 'right', col: '#fff3c8', stroke: 'rgba(12,8,20,.92)', sw: 7, ls: 2 }); }
      c.restore(); }
  }

  // ---------- 字幕（喊招台詞）：金線從中間展開、字一個一個由模糊浮上來定住；結束時整組單純淡出 ----------
  function subs(t) {
    for (const k of S.subs) { const el = t - k.t0, end = k.len + .3, OUT = .65; if (el < 0 || el > end + OUT) continue;
      const out = 1 - sat((el - end) / OUT), CX = W / 2, Y = 986, PX = 54, LS = 5, chars = [...k.text];
      font(PX, 700, SERIF); c.letterSpacing = '0px'; const ws = chars.map(ch => c.measureText(ch).width + LS), tw = ws.reduce((a, b) => a + b, 0) - LS, x0 = CX - tw / 2;
      c.save(); c.globalAlpha = out;
      // 底：左右羽化的暗帶，讓字在亮的特效上也讀得到
      const bu = easeOut(sat(el / .35)), bw = (tw / 2 + 300) * (.6 + .4 * bu), g = c.createLinearGradient(CX - bw, 0, CX + bw, 0); g.addColorStop(0, 'rgba(8,6,16,0)'); g.addColorStop(.25, 'rgba(8,6,16,.62)'); g.addColorStop(.75, 'rgba(8,6,16,.62)'); g.addColorStop(1, 'rgba(8,6,16,0)');
      c.globalAlpha = out * bu; c.fillStyle = g; c.fillRect(CX - bw, Y - 92, bw * 2, 124);
      // 上下兩條細金線從中間往兩邊長出去，中央一顆菱形
      const lu = easeOut(sat(el / .5)), lw = (tw / 2 + 110) * lu, lg = c.createLinearGradient(CX - lw, 0, CX + lw, 0); lg.addColorStop(0, 'rgba(226,191,108,0)'); lg.addColorStop(.5, 'rgba(226,191,108,.95)'); lg.addColorStop(1, 'rgba(226,191,108,0)');
      c.globalAlpha = out; c.fillStyle = lg; c.fillRect(CX - lw, Y + 24, lw * 2, 2); c.globalAlpha = out * .5; c.fillRect(CX - lw * .8, Y - 86, lw * 1.6, 1);
      c.globalAlpha = out * sat(el / .2); gem(CX, Y + 25, 7 * back(sat(el / .3)), COL.gold); gem(CX, Y + 25, 3, '#fff');
      // 說話的人：小字、拉開字距，角色代表色
      const nu = easeOut(sat((el - .05) / .3)); c.globalAlpha = out * nu; const nw = measure(k.name, 24, 700, SANS, 8);
      gem(CX - nw / 2 - 16 - (1 - nu) * 20, Y - 68, 5, k.color); gem(CX + nw / 2 + 10 + (1 - nu) * 20, Y - 68, 5, k.color);
      txt(k.name, CX - nw / 2, Y - 59, { px: 24, w: 700, col: k.color, ls: 8 + (1 - nu) * 10, stroke: 'rgba(8,6,16,.9)', sw: 5 });
      // 台詞：每個字晚一點點出現，從下面浮上來、由模糊變清楚、由代表色褪成白
      const step = Math.min(.07, k.len * .45 / chars.length); let x = x0;
      chars.forEach((ch, i) => { const u = sat((el - .12 - i * step) / .28), e = easeOut(u);
        if (u > 0) { c.globalAlpha = out * e; if (u < 1) c.filter = `blur(${((1 - e) * 7).toFixed(1)}px)`;
          const o = { px: PX, w: 700, fam: SERIF, col: '#fff7e8', stroke: 'rgba(8,6,16,.92)', sw: 8, shadow: 'rgba(0,0,0,.6)', sx: 0, sy: 4 }, yy = Y + (1 - e) * 16;
          txt(ch, x, yy, o); if (u < 1) { c.globalAlpha = out * e * (1 - e); txt(ch, x, yy, { px: PX, w: 700, fam: SERIF, col: k.color }); }
          c.filter = 'none'; }
        x += ws[i]; });
      c.restore(); }
  }

  // ---------- 魔王登場名條 ----------
  function intro(t) {
    const k = S.intro; if (!k || t < k.t0 || t > k.t1) return; const el = t - k.t0, a = Math.min(1, sat((k.t1 - t) / .4)), u = easeOut(sat(el / .5)), x = 130, y = 800;
    c.save(); c.globalAlpha = a; const g = c.createLinearGradient(0, y - 150, 0, y + 130); g.addColorStop(0, 'rgba(6,4,12,0)'); g.addColorStop(.5, 'rgba(6,4,12,.62)'); g.addColorStop(1, 'rgba(6,4,12,0)'); c.fillStyle = g; c.fillRect(0, y - 150, W, 280);
    c.fillStyle = '#e2463f'; c.fillRect(x, y - 96, 760 * u, 3); c.fillStyle = COL.line; c.fillRect(x, y + 34, 760 * u, 1.5); gem(x, y - 95, 9, '#e2463f');
    c.beginPath(); c.rect(x - 20, y - 200, 1100 * u, 400); c.clip();
    txt('BOSS', x + 24, y - 110, { px: 26, w: 900, col: '#ff6a5a', ls: 14 }); txt('奧客總經理', x, y, { px: 104, w: 900, fam: SERIF, ls: 8, shadow: 'rgba(0,0,0,.85)', sx: 5, sy: 6 });
    txt('會議大廳的暴君　口頭禪是「再改一版」', x + 6, y + 74, { px: 30, w: 500, col: COL.dim, ls: 3 }); c.restore();
  }

  // ---------- 勝利與結算 ----------
  function victory(t) {
    const k = S.victory, CX = 560; if (!k || t < k.t0 || t > k.t1) return; const el = t - k.t0, a = Math.min(sat(el / .3), sat((k.t1 - t) / .4));
    c.save(); c.globalAlpha = a; { const g0 = c.createLinearGradient(0, 0, 1250, 0); g0.addColorStop(0, 'rgba(6,4,12,.78)'); g0.addColorStop(.7, 'rgba(6,4,12,.5)'); g0.addColorStop(1, 'rgba(6,4,12,0)'); c.fillStyle = g0; c.fillRect(0, 0, 1250, H); }
    const s = el < .2 ? lerp(1.8, 1, easeOut(el / .2)) : 1, g = c.createLinearGradient(0, 150, 0, 300); g.addColorStop(0, '#fff6d0'); g.addColorStop(.5, '#f0c860'); g.addColorStop(1, '#b07a22');
    c.save(); c.translate(CX, 250); c.scale(s, s); txt('戰鬥勝利', 0, 40, { px: 140, w: 900, fam: SERIF, align: 'center', ls: 22, col: g, stroke: 'rgba(20,10,4,.9)', sw: 14, shadow: 'rgba(0,0,0,.6)', sx: 6, sy: 8 }); c.restore();
    const lw = 440 * easeOut(sat((el - .15) / .5)); c.fillStyle = COL.gold; c.fillRect(CX - lw, 330, lw * 2, 2); gem(CX - lw, 331, 9, COL.gold); gem(CX + lw, 331, 9, COL.gold); gem(CX, 331, 12, '#fff6d8');
    txt('VICTORY', CX, 372, { px: 24, w: 900, align: 'center', col: COL.gold, ls: 22 });
    // 結算
    const rows = S.results, px = CX - 400, py = 430, pw = 800; const pa = sat((el - 1.0) / .3);
    if (pa > 0) { c.globalAlpha = a * pa; c.fillStyle = 'rgba(11,9,20,.86)'; c.fillRect(px, py, pw, 76 * rows.length + 40); c.fillStyle = COL.gold; c.fillRect(px, py, pw, 2); c.fillRect(px, py + 76 * rows.length + 38, pw, 2);
      rows.forEach((r, i) => { const ru = sat((el - 1.2 - i * .32) / .4); if (ru <= 0) return; const y = py + 70 + i * 76; c.globalAlpha = a * pa * sat(ru * 3);
        txt(r.k, px + 56, y, { px: 30, w: 500, col: COL.dim, ls: 4 }); txt(typeof r.v === 'number' ? fmt(r.v * easeOut(ru)) : r.v, px + pw - 56, y, { px: typeof r.v === 'number' ? 44 : 32, w: typeof r.v === 'number' ? 900 : 700, align: 'right', col: r.c || COL.text, fam: typeof r.v === 'number' ? SANS : SERIF });
        c.fillStyle = 'rgba(243,236,218,.14)'; c.fillRect(px + 56, y + 20, pw - 112, 1); }); }
    c.restore();
  }

  // ---------- 角色介紹卡 ----------
  function wrap(s, maxW, px, w = 500) { font(px, w); const out = []; let line = ''; for (const ch of s) { if (c.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; } if (line) out.push(line); return out; }
  function showcase(t) {
    for (const k of S.show) { if (t < k.t0 || t > k.t1) continue; const d = D[k.id], el = t - k.t0, out = sat((k.t1 - t) / .28), u = easeOut(sat(el / .4)), bust = A.bust[k.id];
      c.save(); c.globalAlpha = out; c.fillStyle = 'rgba(7,5,14,.78)'; c.fillRect(0, 0, W, H);
      // 左邊：斜的色塊＋半身像
      c.save(); c.globalAlpha = out * .92; c.fillStyle = d.color; c.beginPath(); c.moveTo(-40, 0); c.lineTo(lerp(-40, 760, u), 0); c.lineTo(lerp(-240, 560, u), H); c.lineTo(-40, H); c.fill();
      c.fillStyle = 'rgba(8,6,16,.3)'; for (let i = 0; i < 9; i++) { const bx = -200 + i * 110 + (t * 26 % 110); c.beginPath(); c.moveTo(bx, 0); c.lineTo(bx + 34, 0); c.lineTo(bx - 166, H); c.lineTo(bx - 200, H); c.fill(); }
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(lerp(-40, 760, u), 0); c.lineTo(lerp(-40, 772, u), 0); c.lineTo(lerp(-240, 572, u), H); c.lineTo(lerp(-240, 560, u), H); c.fill(); c.restore();
      const bh = 930, bw = bh * bust.width / bust.height, bx = lerp(-bw, 60 + (d.bustX ?? 0), u) + Math.sin(t * .7) * 5; c.imageSmoothingEnabled = false; c.drawImage(bust, bx, H - bh + 14, bw, bh); c.imageSmoothingEnabled = true;
      // 右邊：資料
      const X = 930, a2 = sat((el - .15) / .3); c.globalAlpha = out * a2; const sl = (1 - easeOut(sat((el - .15) / .4))) * 60;
      c.fillStyle = d.color; const jw = measure(d.job, 30, 900, SANS, 6) + 44; c.fillRect(X + sl, 118, jw, 52); txt(d.job, X + 20 + sl, 156, { px: 30, w: 900, col: '#0d0b16', ls: 6 }); txt(`Lv ${d.lv}`, X + jw + 24 + sl, 158, { px: 34, w: 700, col: COL.gold, ls: 2 });
      txt(d.name, X - 6 + sl, 300, { px: 128, w: 900, fam: SERIF, ls: 10, shadow: 'rgba(0,0,0,.8)', sx: 5, sy: 6 }); const nw = measure(d.name, 128, 900, SERIF, 10); txt(d.tag, X + nw + 30 + sl, 296, { px: 28, w: 500, col: COL.dim, ls: 3 });
      c.fillStyle = COL.gold; c.fillRect(X, 332, 860 * easeOut(sat((el - .2) / .5)), 2); gem(X, 333, 8, COL.gold);
      // 能力值：兩欄四列
      d.stats.forEach(([lab, v, mx], i) => { const su = sat((el - .5 - i * .09) / .3); if (su <= 0) return; const col = i % 2, row = i >> 1, sx = X + col * 440, sy = 400 + row * 74; c.globalAlpha = out * sat(su * 2);
        txt(lab, sx, sy, { px: 26, w: 500, col: COL.dim, ls: 4 }); txt(fmt(v * easeOut(su)).replace(/,/g, ','), sx + 388, sy + 2, { px: 40, w: 900, align: 'right' });
        c.fillStyle = 'rgba(243,236,218,.16)'; c.fillRect(sx, sy + 16, 388, 6); c.fillStyle = d.color; c.fillRect(sx, sy + 16, 388 * sat(v / mx) * easeOut(su), 6); });
      // 奧義與特性
      const ku = sat((el - 1.3) / .35); if (ku > 0) { c.globalAlpha = out * ku; const y = 722;
        txt('奧義', X, y, { px: 24, w: 900, col: COL.gold, ls: 10 }); txt(d.skill, X + 110, y + 8, { px: 52, w: 900, fam: SERIF, ls: 4, col: '#fff', shadow: 'rgba(0,0,0,.7)', sx: 3, sy: 4 });
        wrap(d.desc, 850, 28).forEach((s, i) => txt(s, X, y + 62 + i * 40, { px: 28, w: 500, col: COL.text })); }
      const pu = sat((el - 1.7) / .35); if (pu > 0) { c.globalAlpha = out * pu; const y = 906; c.fillStyle = 'rgba(243,236,218,.1)'; c.fillRect(X, y - 36, 860, 104); c.fillStyle = d.color; c.fillRect(X, y - 36, 5, 104);
        txt('特性', X + 26, y, { px: 22, w: 900, col: COL.gold, ls: 8 }); txt(d.trait, X + 110, y + 2, { px: 30, w: 700 }); txt(d.traitDesc, X + 26, y + 46, { px: 24, w: 500, col: COL.dim }); }
      c.restore(); }
  }

  // ---------- 片尾 ----------
  function ending(t) {
    const k = S.end; if (!k || t < k.t0) return; const el = t - k.t0, a = sat(el / .6);
    c.save(); c.globalAlpha = a; c.fillStyle = '#07050c'; c.fillRect(0, 0, W, H); const u = easeOut(sat((el - .3) / .6)); c.globalAlpha = a * sat((el - .3) / .5);
    txt('不想上班 RPG', W / 2, 500 + (1 - u) * 20, { px: 150, w: 900, fam: SERIF, align: 'center', ls: 16 }); c.fillStyle = COL.gold; c.fillRect(W / 2 - 420 * u, 548, 840 * u, 2); gem(W / 2, 549, 11, COL.gold);
    txt('討伐奧客總經理', W / 2, 622, { px: 46, w: 500, align: 'center', col: COL.gold, ls: 18 }); txt('戰鬥畫面試作', W / 2, 700, { px: 28, w: 500, align: 'center', col: COL.dim, ls: 12 }); c.restore();
  }

  let vig = null;
  return {
    c,
    draw(t, fx) {
      c.clearRect(0, 0, W, H); c.globalAlpha = 1;
      let ua = 0; for (const w of S.ui) ua = Math.max(ua, Math.min(sat((t - w.t0) / .35), sat((w.t1 - t) / .3)));
      // 大招演出時，行動順序讓位給招式名牌
      let cardOn = 0; for (const k of S.cards) if (t >= k.t0 - .15 && t <= k.t1) cardOn = 1;
      if (!vig) { vig = c.createRadialGradient(W / 2, H * .56, H * .34, W / 2, H * .56, H * 1.02); vig.addColorStop(0, 'rgba(5,4,12,0)'); vig.addColorStop(.6, 'rgba(5,4,12,.34)'); vig.addColorStop(1, 'rgba(5,4,12,.86)'); }
      c.fillStyle = vig; c.fillRect(0, 0, W, H);
      fx.draw(c, t);
      if (S.skinHud) S.skinHud(t, ua, cardOn); else { enemies(t, ua); party(t, ua); turnOrder(t, ua * (1 - cardOn)); }
      items(t); numbers(t); menu(t); if (S.skinBoxes) S.skinBoxes(t); else boxes(t);
      cutins(t); cards(t); intro(t); victory(t); showcase(t); ending(t); subs(t);
    },
  };
}
