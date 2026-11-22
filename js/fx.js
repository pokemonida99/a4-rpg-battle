// 像素特效層：用 pixelfx（vendor/pixelfx，MIT，Patch 與 Hugo Duprez；授權檔在 vendor/pixelfx/LICENSE、NOTICE.md）
// 把特效畫在低解析度畫布上，貼成跟角色同樣像素密度的看板，放在 3D 場景裡（背面一層、正面一層，角色夾在中間）。
// 特效是有狀態的模擬，這裡固定每 1/60 秒走一步、時間倒退就重來，所以同一個時間點畫出來永遠一樣，分段錄影才接得起來。
import { THREE, PPU, CAST_HIT } from './engine.js';
import { createFrame, clearFrame, createFx, composite, PAL } from '../vendor/pixelfx/core/index.js';

const mods = {};
// 特效庫會拿一個示範小人的輪廓來畫（發紅、靈魂升天等），我們的角色是自己的像素圖，所以給它一個空白輪廓，只留特效本身
const blankActor = k => { const w = 12 * k, h = 19 * k; return { mask: { w, h, data: new Uint8Array(w * h) }, pixels: new Uint32Array(w * h), x: -w / 2, y: -h, w, h, k, head: [0, -h], chest: [0, -h + 11 * k] }; };
export async function loadFx(ids) { await Promise.all(ids.map(async id => { mods[id] ||= await import(`../vendor/pixelfx/fx/${id}.js`); })); }
export { PAL };

export function makeFxLayer(parent) {
  const casts = [];
  function plane(w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.renderOrder = 4; parent.add(m);
    return { cv, ctx: cv.getContext('2d'), img: new ImageData(w, h), frame: createFrame(w, h), tex, m };
  }
  return {
    // o：{ id:'arcane/magic-circle-cast', t 開始時間, x, y（腳底高度，預設 0）, z, palette（PAL 的名字或色階陣列）, seed, scale, flip, dur（循環特效播多久）, glow（亮度倍率）}
    add(o) {
      const mod = mods[o.id]; if (!mod) throw new Error('特效還沒載入：' + o.id);
      const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin, s = o.scale ?? 1;
      const c = { o, mod, w, h, ox, oy, s, back: plane(w, h), front: plane(w, h), inst: null, n: 0, end: o.dur ?? (mod.meta.loop ? 2 : mod.meta.duration) };
      for (const [L, dz] of [[c.back, -.06], [c.front, .06]]) {
        L.m.scale.set(w / PPU * s * (o.flip ? -1 : 1), h / PPU * s, 1);
        L.m.position.set(o.x + (w / 2 - ox) / PPU * s * (o.flip ? -1 : 1), (o.y ?? 0) + (oy - h / 2) / PPU * s, o.z + dz);
        if (o.glow) L.m.material.color.setScalar(o.glow);
      }
      casts.push(c); return c;
    },
    // 試玩版用：把播完的特效清掉（影片要能倒退重播，所以不清）
    prune(t) { for (let i = casts.length - 1; i >= 0; i--) { const c = casts[i]; if (t > c.o.t + c.end + .2) { for (const L of [c.back, c.front]) { parent.remove(L.m); L.tex.dispose(); L.m.material.dispose(); L.m.geometry.dispose(); } casts.splice(i, 1); } } },
    update(t) {
      for (const c of casts) {
        const el = t - c.o.t, on = el >= 0 && el < c.end + .05 && !c.hide;      // hide：先收起來不畫（換場景時大廳的火盆火焰）
        c.back.m.visible = c.front.m.visible = on;
        if (!on) { c.inst = null; continue; }
        const want = Math.floor(el * 60);
        if (!c.inst || c.n > want) {
          const opt = { x: c.ox, y: c.oy, seed: c.o.seed ?? 1 }; const pal = c.o.palette; if (pal) opt.palette = typeof pal === 'string' ? PAL[pal] : pal; if (c.mod.meta.actor) opt.actor = blankActor(c.mod.meta.actor === 2 ? 2 : 1);
          c.inst = createFx(c.mod, opt); c.n = 0; c.stopN = c.mod.meta.loop ? Math.floor((c.end - .3) * 60) : -1;
        }
        while (c.n < want) { c.inst.update(1 / 60); c.n++; if (c.n === c.stopN) c.inst.stop(); }
        for (const [L, layer] of [[c.back, 'back'], [c.front, 'front']]) {
          clearFrame(L.frame); c.inst.draw(L.frame, layer); composite(L.frame, L.img.data, null); L.ctx.putImageData(L.img, 0, 0); L.tex.needsUpdate = true;
        }
      }
    },
  };
}

// 把角色某個動作（預設 point「指」）升級成施法：先播施法逐格，再回到原本的動作；手邊聚光、出手時爆一下。
// 兩次施法至少隔 minGap 秒，才不會每指一次都放魔法。回傳出手的時間（給音效用）。要先 loadFx(CAST_FX)。
export const CAST_FX = ['arcane/spell-charge', 'pickups/collect-burst'];
export function autoCasts(actor, FX, { from = 'point', palette = 'arcane', minGap = 7, hold = 1.0, max = 99 } = {}) {
  if (!actor.frames.cast) return [];
  const keys = [...actor.keys], hits = []; let x = 0, z = 0, flip = false, last = -99;
  keys.forEach((k, i) => {
    const nx = k.x ?? x, nz = k.z ?? z; if (k.walk && Math.abs(nx - x) > .05) flip = nx < x; x = nx; z = nz; if (k.flip !== undefined) flip = k.flip;
    const t0 = k.t + (k.walk || 0), next = keys[i + 1];
    if (k.pose !== from || t0 - last < minGap || hits.length >= max || (next && next.t < t0 + .7) || (next && next.walk && next.t < t0 + hold)) return;
    last = t0; k.pose = 'cast'; const d = flip ? -1 : 1;
    if (!next || next.t > t0 + hold + .05) actor.key({ t: t0 + hold, pose: from });
    FX.add({ id: 'arcane/spell-charge', t: t0 - .05, dur: CAST_HIT + .2, x: x + d * .2, y: .8, z: z + .05, palette, scale: .5, flip });
    FX.add({ id: 'pickups/collect-burst', t: t0 + CAST_HIT - .12, x: x + d * .78, y: .55, z: z + .08, palette, scale: .8, seed: 1 + hits.length });
    hits.push(t0 + CAST_HIT);
  });
  return hits;
}
