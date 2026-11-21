// 戰鬥單位（像素看板）、鏡頭軌道、時間軸小工具。所有狀態都是時間 t 的純函式，逐格錄影才接得起來。
import { THREE, PPU, sat, lerp, ease, easeOut, rnd, sprite, blob, rimLit } from './engine.js';

// 取軌道在時間 t 的值：keys＝[{t, v}]，回傳最後一個 t<=現在的 key
export const stepAt = (keys, t, def) => { let v = def; for (const k of keys) { if (k.t > t) break; v = k.v; } return v; };
// 一段時間內的進度 0→1（外面是 -1）
export const span = (t, t0, d) => (t < t0 || t > t0 + d ? -1 : (t - t0) / d);

function noiseTex(w, h, seed) {
  // 溶解用的雜訊：每個像素一個 0.52～1 的值，下面的像素值比較低（從腳往上散掉），加一點隨機
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = .54 + .44 * sat(.62 * (1 - j / h) + .38 * rnd(i * 13.1 + j * 7.7 + seed)), k = (j * w + i) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = v * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace; return t;
}

export class Unit {
  // frames：{ 名字: 貼圖 或 貼圖陣列 }；o：{ x, z, scale, tint, phase, rim }
  constructor(parent, frames, o = {}) {
    this.frames = frames; this.o = o; this.s = o.scale ?? 1; this.home = [o.x ?? 0, o.z ?? 0];
    this.poseK = []; this.moveK = []; this.hitK = []; this.hopK = []; this.dead = null; this.showK = [{ t: -1, v: true }]; this.tintK = [];
    this.group = new THREE.Group(); parent.add(this.group);
    const first = frames.ready || frames.idle; this.mesh = sprite(first, { tint: o.tint ?? 0xffffff }); this.group.add(this.mesh);
    this.baseColor = this.mesh.material.color.clone();
    // 受擊閃白：同一張圖用加亮疊一層
    this.flash = new THREE.Mesh(this.mesh.geometry, new THREE.MeshBasicMaterial({ map: first, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
    this.flash.renderOrder = 3; this.group.add(this.flash);
    this.shadow = blob((first.image.width / PPU) * this.s * (o.shadowK ?? .78)); this.group.add(this.shadow);
    this.noise = null; this.x = this.home[0]; this.z = this.home[1]; this.h = first.image.height / PPU * this.s;
  }
  pose(t, v) { this.poseK.push({ t, v }); this.poseK.sort((a, b) => a.t - b.t); return this; }
  // 動作：frames[name] 是陣列，從 t 開始每格 dt 秒（或給 times 陣列＝每格開始的相對時間）
  anim(t, name, times) { this.poseK.push({ t, v: name, times }); this.poseK.sort((a, b) => a.t - b.t); return this; }
  move(t, x, z, dur = .2, fn = ease) { this.moveK.push({ t, x, z, dur, fn }); this.moveK.sort((a, b) => a.t - b.t); return this; }
  hit(t, pow = 1, dir = -1) { this.hitK.push({ t, pow, dir }); return this; }      // dir：被打退的方向（-1 往左）
  hop(t, h = .22, dur = .34) { this.hopK.push({ t, h, dur }); return this; }
  die(t, dur = 1.1) { this.dead = { t, dur }; return this; }
  show(t, v) { this.showK.push({ t, v }); this.showK.sort((a, b) => a.t - b.t); return this; }
  posAt(t) { let [x, z] = this.home; for (const k of this.moveK) { if (k.t > t) break; const u = k.fn(sat((t - k.t) / k.dur)); x = lerp(x, k.x, u); z = lerp(z, k.z, u); } return [x, z]; }
  update(t) {
    const g = this.group, m = this.mesh; let vis = stepAt(this.showK, t, true);
    // 姿勢
    let pk = null; for (const k of this.poseK) { if (k.t > t) break; pk = k; }
    const pv = pk?.v, resting = !pv || pv === 'ready' || pv === 'idle'; let tex = (resting && this.weak && this.frames.hurt) || this.frames[pv] || this.frames.ready || this.frames.idle;
    if (Array.isArray(tex)) { const el = t - pk.t, times = pk.times || tex.map((_, i) => i * .09); let i = 0; while (i + 1 < tex.length && el >= times[i + 1]) i++; tex = tex[i]; }
    if (this.o.rim !== false) tex = rimLit(tex)[0];
    if (m.material.map !== tex) { m.material.map = tex; m.material.needsUpdate = true; this.flash.material.map = tex; this.flash.material.needsUpdate = true; if (m.customDepthMaterial) { m.customDepthMaterial.map = tex; m.customDepthMaterial.needsUpdate = true; } }
    const w = tex.image.width / PPU * this.s, h = tex.image.height / PPU * this.s;
    // 位置、受擊抖動、跳
    let [x, z] = this.posAt(t), dx = 0, fl = 0, hop = 0;
    for (const k of this.hitK) { const el = t - k.t; if (el < 0 || el > .5) continue; const e = 1 - el / .5; dx += (Math.sin(el * 78) * .06 + k.dir * .1 * Math.sin(Math.PI * Math.min(1, el / .25))) * k.pow * e; fl = Math.max(fl, sat(1 - el / .14) * Math.min(1, k.pow)); }
    for (const k of this.hopK) { const u = (t - k.t) / k.dur; if (u >= 0 && u < 1) hop = Math.max(hop, Math.sin(Math.PI * u) * k.h); }
    const idle = !pk || pk.v === 'ready' || pk.v === 'idle', breathe = idle ? 1 - .012 * (Math.floor(t * 1.9 + (this.o.phase || 0)) % 2) : 1;
    m.scale.set(w, h * breathe, 1); this.flash.scale.copy(m.scale); g.position.set(x + dx, 0, z); m.position.y = hop; this.flash.position.set(0, hop, .004);
    this.flash.material.opacity = fl * .9; this.flash.visible = fl > .01;
    // 倒下：先閃白，再從腳往上一粒一粒散掉，顏色轉暗紫
    let alphaTest = .5, col = this.baseColor, shadowA = 1;
    if (this.dead && t >= this.dead.t) {
      const u = sat((t - this.dead.t) / this.dead.dur);
      if (!this.noise) this.noise = noiseTex(tex.image.width, tex.image.height, this.home[0] * 3.1);
      if (m.material.alphaMap !== this.noise) { m.material.alphaMap = this.noise; m.material.needsUpdate = true; }
      alphaTest = lerp(.5, 1.0, u * u * (3 - 2 * u)); col = this.baseColor.clone().lerp(new THREE.Color(0x5a2a8a), sat(u * 1.6)); shadowA = 1 - u;
      this.flash.visible = u < .35; this.flash.material.opacity = Math.max(this.flash.material.opacity, (1 - u / .35) * .8); if (u >= 1) vis = false;
    } else if (m.material.alphaMap) { m.material.alphaMap = null; m.material.needsUpdate = true; }
    m.material.alphaTest = alphaTest; m.material.color.copy(col);
    this.shadow.material.opacity = shadowA; this.shadow.scale.setScalar(Math.max(.2, 1 - hop * 1.1));
    g.visible = vis; this.x = x; this.z = z; this.h = h; this.w = w; this.alive = vis && !(this.dead && t >= this.dead.t);
  }
}

// 鏡頭軌道：key＝{ t, dur, x, y, z, d, pitch, fov, fn }，從上一個姿勢花 dur 秒移到這個姿勢。shake(t, amp, dur) 加震動。
export function makeCam(E, start) {
  const keys = [], shakes = [], F = ['x', 'y', 'z', 'd', 'pitch', 'fov', 'focusOff', 'blur'];
  const base = { x: 0, y: 1.3, z: -.3, d: 13, pitch: 9, fov: 28, focusOff: 0, blur: 8, ...start };
  return {
    to(t, dur, p, fn = ease) { keys.push({ t, dur, p, fn }); keys.sort((a, b) => a.t - b.t); return this; },
    shake(t, amp = .12, dur = .4) { shakes.push({ t, amp, dur }); return this; },
    update(t) {
      const c = { ...base };
      for (const k of keys) { if (k.t > t) break; const u = k.fn(sat((t - k.t) / Math.max(.001, k.dur))); for (const f of F) if (k.p[f] !== undefined) c[f] = lerp(c[f], k.p[f], u); }
      let sx = 0, sy = 0;
      for (const s of shakes) { const el = t - s.t; if (el < 0 || el > s.dur) continue; const e = (1 - el / s.dur) ** 1.6 * s.amp; sx += Math.sin(el * 91 + s.t) * e; sy += Math.cos(el * 113 + s.t * 2) * e * .8; }
      E.setCamera({ ...c, x: c.x + sx, y: c.y + sy }); return c;
    },
  };
}
