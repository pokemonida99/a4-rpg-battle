// 全畫面的像素特效層：畫在 480×270 的小畫布上，再放大四倍貼到介面畫布（不平滑），所以跟場景一樣是像素顆粒。
// 所有特效都是時間的純函式（亂數用固定種子），逐格錄影才接得起來。
import { sat, lerp, ease, easeOut, rnd } from './engine.js';

export const PW = 480, PH = 270;
export function makeScreenFx() {
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  const ev = [];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  // 斜向的平行四邊形光條
  const streak = (x0, y0, len, th, ang, col) => { x.save(); x.translate(x0, y0); x.rotate(ang); x.fillStyle = col; x.fillRect(0, -th / 2, len, Math.max(1, th)); x.restore(); };
  const K = {
    // 整個畫面閃一下：{ c:[r,g,b], a, pow }
    flash(u, o) { x.fillStyle = rgba(o.c || [255, 255, 255], (o.a ?? 1) * (1 - u) ** (o.pow ?? 2)); x.fillRect(0, 0, PW, PH); },
    // 壓暗（或染色）：前後各 fade 秒淡入淡出
    dim(u, o, el, d) { const f = o.fade ?? .18, k = Math.min(sat(el / f), sat((d - el) / f)); x.fillStyle = rgba(o.c || [6, 5, 14], (o.a ?? .5) * k); x.fillRect(0, 0, PW, PH); },
    // 四角的色暈（危險的紅、聖光的金）
    vignette(u, o, el, d) { const k = Math.min(sat(el / .2), sat((d - el) / .3)) * (o.pulse ? .7 + .3 * Math.sin(el * o.pulse) : 1), c = o.c || [200, 30, 30];
      for (let i = 0; i < 9; i++) { const a = (o.a ?? .5) * k * ((9 - i) / 9) ** 2, w = i * 5; x.fillStyle = rgba(c, a * .28); x.fillRect(0, w, PW, 5); x.fillRect(0, PH - w - 5, PW, 5); x.fillRect(w * 1.6, 0, 8, PH); x.fillRect(PW - w * 1.6 - 8, 0, 8, PH); } },
    // 集中線：從四周往中心（cx, cy）的尖刺，每 1/15 秒換一組
    lines(u, o, el) { const n = o.n ?? 46, f = Math.floor(el * 15), cx = o.cx ?? PW / 2, cy = o.cy ?? PH / 2, k = Math.min(sat(el / .08), sat((o._d - el) / .12));
      for (let i = 0; i < n; i++) { const a = (i + rnd(i * 3.3 + f * 17.7)) / n * Math.PI * 2, r0 = (o.r0 ?? 95) + rnd(i + f * 5.1) * 60, r1 = 330, wd = (.012 + rnd(i * 7 + f) * .03) * (o.w ?? 1);
        x.fillStyle = rgba(o.c || [255, 255, 255], (o.a ?? .85) * k * (.5 + .5 * rnd(i + f * 2.2))); x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * .62); x.lineTo(cx + Math.cos(a - wd) * r1, cy + Math.sin(a - wd) * r1); x.lineTo(cx + Math.cos(a + wd) * r1, cy + Math.sin(a + wd) * r1); x.fill(); } },
    // 橫向速度線（衝刺、總攻擊）
    speed(u, o, el) { const n = o.n ?? 40, k = Math.min(sat(el / .06), sat((o._d - el) / .12)), dir = o.dir ?? -1;
      for (let i = 0; i < n; i++) { const y = rnd(i * 9.1) * PH, len = 40 + rnd(i * 4.4) * 160, sp = 900 + rnd(i * 2.2) * 900, px = ((rnd(i * 6.6) * (PW + 400) + el * sp * dir) % (PW + 400) + PW + 400) % (PW + 400) - 200;
        x.fillStyle = rgba(o.c || [255, 255, 255], (o.a ?? .5) * k * (.4 + .6 * rnd(i * 1.7))); x.fillRect(px, y, len, rnd(i * 3.1) < .3 ? 2 : 1); } },
    // 一刀：從 (x0,y0) 劈到 (x1,y1) 的白色長線，先伸長再變細消失，旁邊帶兩條副線和火花
    slash(u, o, el, d) { const g = easeOut(sat(el / (o.grow ?? .07))), fade = sat((d - el) / (d * .7)), ang = Math.atan2(o.y1 - o.y0, o.x1 - o.x0), L = Math.hypot(o.x1 - o.x0, o.y1 - o.y0), c = o.c || [255, 255, 255], th = (o.w ?? 7) * fade;
      streak(o.x0, o.y0, L * g, th * 2.4, ang, rgba(o.c2 || c, .35 * fade)); streak(o.x0, o.y0, L * g, th, ang, rgba(c, 1)); streak(o.x0, o.y0, L * g, Math.max(1, th * .4), ang, 'rgba(255,255,255,1)');
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      for (const s of [-1, 1]) streak(o.x0 + nx * s * (5 + 9 * u) + Math.cos(ang) * L * .12, o.y0 + ny * s * (5 + 9 * u) + Math.sin(ang) * L * .12, L * g * .7, 1, ang, rgba(c, .7 * fade));
      for (let i = 0; i < 26; i++) { const p = rnd(i * 5.5 + o.x0) * g, sx = o.x0 + (o.x1 - o.x0) * p, sy = o.y0 + (o.y1 - o.y0) * p, v = (rnd(i * 2.1) - .5) * 2, q = el * (40 + rnd(i) * 90);
        if (rnd(i * 8.8) > fade) continue; x.fillStyle = rgba(i % 3 ? c : [255, 255, 255], 1); x.fillRect(Math.round(sx + nx * v * q), Math.round(sy + ny * v * q + el * el * 60), 1 + (i % 4 === 0), 1); } },
    // 紙張風暴：一大堆白紙從左往右被吹過去，翻面時變窄變灰
    papers(u, o, el, d) { const n = o.n ?? 150, k = Math.min(sat(el / .25), sat((d - el) / .4));
      for (let i = 0; i < n; i++) { if (rnd(i * 3.7) > k) continue; const sp = 380 + rnd(i * 1.3) * 420, px = ((rnd(i * 7.9) * (PW + 120) + el * sp) % (PW + 120)) - 60, py = rnd(i * 5.1) * PH * 1.1 - 14 + Math.sin(el * (3 + rnd(i) * 4) + i) * 12 - px * .06;
        const ph = el * (7 + rnd(i * 2.9) * 9) + i, w = 4 + rnd(i * 6.1) * 7, fw = Math.max(1, Math.abs(Math.cos(ph)) * w), fh = Math.max(1, (3 + rnd(i * 4.3) * 5) * (.6 + .4 * Math.abs(Math.sin(ph * .7)))), far = rnd(i * 9.9);
        x.fillStyle = Math.cos(ph) > 0 ? (far < .3 ? '#b9b3c4' : '#f6f0e2') : '#9a94a8'; x.fillRect(Math.round(px), Math.round(py), Math.round(fw), Math.round(fh));
        if (fw > 4 && fh > 3 && far > .5) { x.fillStyle = '#8a8496'; x.fillRect(Math.round(px) + 1, Math.round(py) + 1, Math.round(fw) - 2, 1); } } },
    // 光柱雨（聖光）：幾道直的半透明光
    rays(u, o, el, d) { const k = Math.min(sat(el / .25), sat((d - el) / .35)), c = o.c || [255, 232, 150];
      for (let i = 0; i < (o.n ?? 9); i++) { const bx = rnd(i * 4.7 + 1) * PW, w = 6 + rnd(i * 2.3) * 22, a = (o.a ?? .22) * k * (.5 + .5 * Math.sin(el * (1.5 + rnd(i) * 2) + i * 2));
        x.fillStyle = rgba(c, Math.max(0, a)); x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + w, 0); x.lineTo(bx + w - 40, PH); x.lineTo(bx - 40, PH); x.fill(); } },
    // 往上飄的火星／光點（蓄力、強化）
    embers(u, o, el, d) { const k = Math.min(sat(el / .2), sat((d - el) / .3)), c = o.c || [255, 120, 50], n = o.n ?? 70;
      for (let i = 0; i < n; i++) { const sp = 40 + rnd(i * 3.1) * 110, py = PH + 10 - ((rnd(i * 5.3) * (PH + 20) + el * sp) % (PH + 20)), px = (o.x0 ?? 0) + rnd(i * 7.7) * (o.w ?? PW) + Math.sin(el * 2 + i) * 6;
        if (rnd(i * 1.9) > k) continue; x.fillStyle = rgba(i % 4 ? c : [255, 240, 200], .9); x.fillRect(Math.round(px), Math.round(py), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1); } },
    // 擴散的環（衝擊波）：{ cx, cy, r }
    ring(u, o) { const r = (o.r ?? 200) * easeOut(u), c = o.c || [255, 255, 255]; x.strokeStyle = rgba(c, (1 - u) ** 1.5); x.lineWidth = Math.max(1, (o.w ?? 5) * (1 - u));
      x.beginPath(); x.ellipse(o.cx, o.cy, r, r * (o.sy ?? .45), 0, 0, Math.PI * 2); x.stroke(); },
    // 遭遇戰轉場：黑畫面上白色集中線往中心收→白閃→淡出露出場景
    encounter(u, o, el) {
      if (el < .62) { x.fillStyle = '#05040a'; x.fillRect(0, 0, PW, PH); const f = Math.floor(el * 20), k = sat(el / .5);
        for (let i = 0; i < 70; i++) { const a = (i + rnd(i * 3.3 + f * 7.7)) / 70 * Math.PI * 2, r0 = lerp(300, 12, k) + rnd(i + f) * 40, r1 = r0 + 60 + rnd(i * 2 + f) * 120, wd = .008 + rnd(i * 7 + f) * .02;
          x.fillStyle = rgba(i % 5 === 0 ? [255, 90, 80] : [255, 255, 255], .5 + .5 * rnd(i + f * 2)); x.beginPath(); x.moveTo(PW / 2 + Math.cos(a) * r0, PH / 2 + Math.sin(a) * r0 * .6); x.lineTo(PW / 2 + Math.cos(a - wd) * r1, PH / 2 + Math.sin(a - wd) * r1 * .6); x.lineTo(PW / 2 + Math.cos(a + wd) * r1, PH / 2 + Math.sin(a + wd) * r1 * .6); x.fill(); } }
      else if (el < .8) { x.fillStyle = '#fff'; x.fillRect(0, 0, PW, PH); }
      else { x.fillStyle = `rgba(255,255,255,${(1 - sat((el - .8) / .5)) ** 2})`; x.fillRect(0, 0, PW, PH); } },
    // 淡到黑／從黑淡出：{ from, to }
    black(u, o) { x.fillStyle = `rgba(4,3,8,${lerp(o.from ?? 0, o.to ?? 1, ease(u))})`; x.fillRect(0, 0, PW, PH); },
  };
  return {
    // kind 見上面；t 開始、d 長度；o 參數。座標用 480×270。
    add(kind, t, d, o = {}) { if (!K[kind]) throw new Error('沒有這個畫面特效：' + kind); o._d = d; ev.push({ kind, t, d, o }); return this; },
    draw(c, t) {
      x.clearRect(0, 0, PW, PH); let any = false;
      for (const e of ev) { const el = t - e.t; if (el < 0 || el >= e.d) continue; any = true; x.globalAlpha = 1; K[e.kind](el / e.d, e.o, el, e.d); }
      if (any) { c.imageSmoothingEnabled = false; c.drawImage(cv, 0, 0, c.canvas.width, c.canvas.height); c.imageSmoothingEnabled = true; }
    },
  };
}
