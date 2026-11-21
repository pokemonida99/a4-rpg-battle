// HD-2D 引擎：真的 3D 場景（方塊貼像素材質）＋像素看板角色＋景深、泛光、光束、塵粒
// 所有動畫都是時間 t 的純函式，錄影時逐格呼叫才不會跳格
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 網址加 ?v 就是直式（1080×1920）：同樣距離下角色大小不變，只是左右變窄、上下變長
export const VERT = new URLSearchParams(location.search).has('v');
export const W = VERT ? 1080 : 1920, H = VERT ? 1920 : 1080;
export const PPU = 77;                       // 一個世界單位＝77 個素材像素（角色 115 px 高＝1.5 單位）
export const sat = x => Math.min(1, Math.max(0, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = k => { k = sat(k); return k * k * (3 - 2 * k); };
export const easeOut = k => 1 - (1 - sat(k)) ** 3;
export const back = k => { k = sat(k); const c = 1.70158; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
export const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const loader = new THREE.TextureLoader();
export async function loadTex(url, { repeat = false, mirror = false } = {}) {
  const t = await loader.loadAsync(url);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = mirror ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;      // mirror：鏡像平鋪，接縫一定接得起來
  return t;
}
export function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- 材質：像素貼圖＋從貼圖明暗算出來的法線起伏，斜光下磚縫、木紋才有立體感 ----------
const _nrm = new WeakMap();
export function normalFrom(tex, strength = 1.6) {
  if (!tex?.image) return null; if (_nrm.has(tex)) return _nrm.get(tex);
  const w = tex.image.width, h = tex.image.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.drawImage(tex.image, 0, 0); const src = x.getImageData(0, 0, w, h).data, out = x.createImageData(w, h), L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (src[i * 4] * .3 + src[i * 4 + 1] * .59 + src[i * 4 + 2] * .11) / 255;
  const at = (i, j) => L[((j + h) % h) * w + ((i + w) % w)];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength, n = 1 / Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
    out.data[k] = (-dx * n * .5 + .5) * 255; out.data[k + 1] = (dy * n * .5 + .5) * 255; out.data[k + 2] = (n * .5 + .5) * 255; out.data[k + 3] = 255;
  }
  x.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  _nrm.set(tex, t); return t;
}
const surface = (tex, color, rough) => new THREE.MeshStandardMaterial({ map: tex || null, color, roughness: rough, metalness: 0, normalMap: tex ? normalFrom(tex) : null, normalScale: new THREE.Vector2(.55, .55) });

// ---------- 幾何小工具 ----------
// 方塊：每個面的貼圖依實際大小平鋪，像素密度才會一致
export function box(w, h, d, tex, { color = 0xffffff, cast = true, receive = true, tile } = {}) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const ts = tile || (tex ? tex.image.width / PPU : 1);
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / ts, uv.getY(i) * dims[f][1] / ts); }
  const m = new THREE.Mesh(g, surface(tex, color, .88));
  m.castShadow = cast; m.receiveShadow = receive; return m;
}
// 每一面用不同貼圖的方塊。faces：{ top, front, side, bottom } 各是 [貼圖, 模式]；模式 'fit'＝整張貼一次、'tileX'＝左右平鋪上下貼滿、不寫＝照像素密度平鋪
export function boxMulti(w, h, d, faces, { color = 0xffffff, rough = .8, cast = true } = {}) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const pick = [faces.side, faces.side, faces.top, faces.bottom || faces.side, faces.front, faces.front].map(f => f || faces.front || faces.top);
  const mats = pick.map(([tex, mode], f) => {
    const ts = tex.image.width / PPU, th = tex.image.height / PPU, fx = mode === 'fit' ? 1 : dims[f][0] / ts, fy = mode === 'fit' || mode === 'tileX' ? 1 : dims[f][1] / th;
    for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * (mode === 'tileX' ? Math.max(1, Math.round(dims[f][0] / (dims[f][1] * tex.image.width / tex.image.height))) : fx), uv.getY(i) * fy); }
    return surface(tex, color, rough);
  });
  const m = new THREE.Mesh(g, mats); m.castShadow = cast; m.receiveShadow = true; return m;
}
export function floorPlane(w, d, tex) {
  const g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv, ts = tex.image.width / PPU;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / ts, uv.getY(i) * d / ts);
  const m = new THREE.Mesh(g, surface(tex, 0xffffff, .72)); m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
// 像素看板：底部中央是原點
export function sprite(tex, { scale = 1, glow = false, tint = 0xffffff, shadow } = {}) {
  const g = new THREE.PlaneGeometry(1, 1); g.translate(0, .5, 0);
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, color: tint });
  if (glow) mat.color.multiplyScalar(glow === true ? 1.6 : glow);
  const m = new THREE.Mesh(g, mat); m.scale.set(tex.image.width / PPU * scale, tex.image.height / PPU * scale, 1);
  // 照輪廓投影（不是整張矩形）：主光從後上方來，影子落在腳前的地板上。發光的東西不投影
  if (!glow && shadow !== false) { m.castShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: .5, side: THREE.DoubleSide }); }
  return m;
}
function blobTex() {
  const c = document.createElement('canvas'); c.width = 24; c.height = 10; const x = c.getContext('2d');
  for (let j = 0; j < 10; j++) for (let i = 0; i < 24; i++) { const d = ((i - 11.5) / 12) ** 2 + ((j - 4.5) / 5) ** 2; if (d < 1) { x.fillStyle = `rgba(8,9,24,${d < .22 ? .5 : d < .55 ? .3 : .14})`; x.fillRect(i, j, 1, 1); } }
  return canvasTex(c);
}
let _blob;
export function blob(w = .62) {
  _blob ||= blobTex();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * .42), new THREE.MeshBasicMaterial({ map: _blob, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = .012; m.renderOrder = 1; return m;
}

// ---------- 表情氣泡（24×24 像素，程式畫）----------
const GLYPH = {
  '!': ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..', '..##..'],
  '?': ['.####.', '##..##', '....##', '...##.', '..##..', '......', '..##..', '..##..'],
  '…': ['........', '........', '........', '........', '........', '........', '#..#..#.', '#..#..#.'],
  '♪': ['...###', '...#.#', '...#.#', '...#..', '...#..', '.###..', '####..', '.##...'],
  'v': ['......#', '.....##', '....##.', '#..##..', '##.#...', '.###...', '..#....', '.......'],
  '汗': ['...#...', '..###..', '..###..', '.#####.', '.#####.', '.#####.', '..###..', '.......'],
  '燈': ['.####.', '######', '######', '######', '.####.', '..##..', '.####.', '..##..'],
};
const GCOL = { '!': '#e0483c', '?': '#3a78d8', '…': '#454a5c', '♪': '#c2569a', 'v': '#3c9a57', '汗': '#4aa0e0', '燈': '#e0a81c' };
const _emo = {};
export function emoteTex(sym) {
  if (_emo[sym]) return _emo[sym];
  const c = document.createElement('canvas'); c.width = 22; c.height = 24; const x = c.getContext('2d');
  const px = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  for (let j = 0; j < 18; j++) for (let i = 0; i < 22; i++) {
    const cx = Math.min(i, 21 - i), cy = Math.min(j, 17 - j), cut = cx + cy < 3;
    if (cut) continue;
    const edge = i === 0 || i === 21 || j === 0 || j === 17 || cx + cy === 3;
    px(i, j, edge ? '#25283a' : '#fff8e8');
  }
  for (let k = 0; k < 5; k++) { for (let i = 8 - 0; i <= 8 + (4 - k); i++) px(i, 17 + k, i === 8 || i === 8 + (4 - k) ? '#25283a' : '#fff8e8'); }
  const g = GLYPH[sym] || GLYPH['!'], gw = g[0].length, ox = Math.round((22 - gw) / 2), oy = 5;
  g.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') px(ox + i, oy + j, GCOL[sym] || '#333'); }));
  return (_emo[sym] = canvasTex(c));
}

// ---------- 角色 ----------
// keys：[{ t, x, z, walk(秒), pose, flip, hop, emote, emoteDur }]，依時間排序。
// 有 walk 的 key：從前一個位置走到 (x,z)，走完才換 pose。
// 逐格動畫：art/chars/anim/名字_walk1~4.png（走路循環）、名字_cast1~4.png（施法：預備、舉手、出手、收招）。沒有圖就回空物件。
const animCache = {};
export function charAnims(name) {
  return (animCache[name] ||= (async () => {
    const out = {};
    let meta = {}; try { const r = await fetch(`art/chars/anim/${name}.json?${Date.now()}`); if (r.ok) meta = await r.json(); } catch (e) { /* 沒有就用預設 */ }
    const nW = meta.walk?.n || 4;
    for (const [kind, n] of [['walk', nW], ['cast', 4]]) {
      try { out[kind] = await Promise.all(Array.from({ length: n }, (_, i) => loadTex(`art/chars/anim/${name}_${kind}${i + 1}.png`))); } catch (e) { /* 這個角色還沒有這組圖 */ }
    }
    if (out.walk) out.walk.cycle = meta.walk?.cycle || 1.48;      // 走完一輪（左右各一步）前進的距離，tools/anim.py 從著地格量出來的
    if (out.cast) out.cast.cuts = [.2, .38, .6];      // 各格切換的時間（秒）；出手是第 3 格，從 CAST_HIT 秒開始
    return out;
  })());
}
export const CAST_HIT = .38;                           // 施法出手的時間點（秒）
// 亮邊：主光從畫面左後上方來，角色朝光那一側（左邊和上緣）的輪廓像素染一點暖色，角色才像站在這個光裡。
// 只動最外圈 1 個像素、保持像素階梯；回傳 [朝左受光版, 朝右受光版]（角色左右翻面時換另一張，亮邊才會一直在畫面左邊）
const _rim = new WeakMap();
export function rimLit(tex) {
  if (!tex?.image) return [tex, tex]; if (_rim.has(tex)) return _rim.get(tex);
  const w = tex.image.width, h = tex.image.height, out = [-1, 1].map(dir => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(tex.image, 0, 0);
    const im = x.getImageData(0, 0, w, h), d = im.data, src = new Uint8ClampedArray(d), A = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : src[(j * w + i) * 4 + 3]);
    for (let j = 0; j < h * .86; j++) for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4; if (src[k + 3] < 128) continue;
      const side = A(i + dir, j) < 128, top = A(i, j - 1) < 128 && A(i + dir, j - 1) < 128; if (!side && !top) continue;
      const lum = (src[k] * .3 + src[k + 1] * .59 + src[k + 2] * .11) / 255, f = (side ? .42 : .26) * (.55 + .45 * lum);      // 深色的描邊只提亮一點，不然會變成白框
      d[k] = src[k] + (255 - src[k]) * f; d[k + 1] = src[k + 1] + (232 - src[k + 1]) * f; d[k + 2] = src[k + 2] + (184 - src[k + 2]) * f * .8;
    }
    x.putImageData(im, 0, 0); const t = canvasTex(c); return t;
  });
  _rim.set(tex, out); return out;
}
export class Actor {
  constructor(frames, { phase = 0 } = {}) {
    this.frames = frames; this.phase = phase; this.keys = [];
    this.group = new THREE.Group();
    this.mesh = sprite(frames.idle); this.group.add(this.mesh);
    this.shadow = blob(); this.group.add(this.shadow);
    this.emote = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: emoteTex('!'), alphaTest: .5, side: THREE.DoubleSide, color: 0xd6d6d6 }));
    this.emote.visible = false; this.group.add(this.emote);
  }
  key(k) { this.keys.push(k); this.keys.sort((a, b) => a.t - b.t); return this; }
  update(t) {
    let x = 0, z = 0, pose = 'idle', poseT = 0, flip = false, walking = 0, hopY = 0, emo = null, dist = 0, wdx = 0;
    for (const k of this.keys) {
      if (k.t > t) break;
      const nx = k.x ?? x, nz = k.z ?? z;
      if (k.walk) {
        const u = sat((t - k.t) / k.walk), e = ease(u), d = Math.hypot(nx - x, nz - z);
        if (u < 1) { walking = 1; dist = d * e; wdx = d > .01 ? (nx - x) / d : 0; if (Math.abs(nx - x) > .05) flip = nx < x; pose = 'idle'; x = lerp(x, nx, e); z = lerp(z, nz, e); continue; }
      }
      x = nx; z = nz;
      if (k.pose) { pose = k.pose; poseT = k.t + (k.walk || 0); }
      if (k.flip !== undefined) flip = k.flip;
      if (k.hop) { const u = (t - k.t - (k.walk || 0)) / .34; if (u >= 0 && u < 1) hopY = Math.sin(Math.PI * u) * .22; }
      if (k.emote) { const u = t - k.t - (k.walk || 0), d = k.emoteDur || 1.4; if (u >= 0 && u < d) emo = { sym: k.emote, u, d }; }
    }
    // 走路用逐格循環（照走過的距離換格，腳步才跟得上移動）；陣列型的動作（施法）照時間播、停在最後一格
    let tex = this.frames[pose] || this.frames.idle; const m = this.mesh, wk = walking && this.frames.walk;
    // 換格照「走了多遠」算（一輪＝wk.cycle），腳才踩得住地；再把身體往那一格該在的位置拉回一半，滑步更少
    let lockX = 0;
    if (wk) { const per = wk.cycle / wk.length, fi = Math.floor(dist / per + .5); tex = wk[fi % wk.length]; lockX = -(dist - fi * per) * .5 * wdx; }
    else if (Array.isArray(tex)) { const el = t - poseT, cut = tex.cuts || [.2, .4, .6]; let i = 0; while (i < cut.length && el >= cut[i]) i++; tex = tex[Math.min(i, tex.length - 1)]; }
    tex = rimLit(tex)[flip ? 1 : 0];      // 受光的亮邊永遠在畫面左邊（朝窗）
    if (m.material.map !== tex) { m.material.map = tex; m.material.needsUpdate = true; if (m.customDepthMaterial) { m.customDepthMaterial.map = tex; m.customDepthMaterial.needsUpdate = true; } }
    const w = tex.image.width / PPU, h = tex.image.height / PPU;
    const breathe = walking ? 1 : 1 - .009 * (Math.floor(t * 2 + this.phase) % 2);
    const bob = wk ? 0 : walking ? Math.abs(Math.sin(dist * Math.PI * 2.6)) * .07 : 0;
    m.scale.set(w * (flip ? -1 : 1), h * breathe, 1);
    this.group.position.set(x + lockX, 0, z); m.position.y = hopY + bob;
    this.shadow.scale.setScalar(1 - (hopY + bob) * 1.2);
    if (emo) {
      const s = back(emo.u / .22) * sat((emo.d - emo.u) / .15), e = this.emote;
      if (e.material.map !== emoteTex(emo.sym)) { e.material.map = emoteTex(emo.sym); e.material.needsUpdate = true; }
      e.visible = s > .02; e.scale.set(22 / PPU * 1.25 * s, 24 / PPU * 1.25 * s, 1); e.position.set(.1, h + .2 + hopY + Math.sin(emo.u * 5) * .012, .02);
    } else this.emote.visible = false;
    this.x = x; this.z = z; this.h = h;
  }
}

// ---------- 後製：景深（用真的深度圖，像素看板的透明處才不會被算進去）----------
class DofPass extends Pass {
  constructor(scene, camera) {
    super(); this.scene = scene; this.camera = camera;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(W, H), samples: 0 });
    this.rt.depthTexture.type = THREE.FloatType; this.rt.texture.minFilter = THREE.LinearFilter;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tC: { value: this.rt.texture }, tD: { value: this.rt.depthTexture }, near: { value: camera.near }, far: { value: camera.far }, focus: { value: 9 }, range: { value: 1.6 }, fall: { value: 5 }, maxR: { value: 9 }, tilt: { value: 1.3 }, cy: { value: .5 }, res: { value: new THREE.Vector2(W, H) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        #include <packing>
        varying vec2 vUv; uniform sampler2D tC, tD; uniform float near, far, focus, range, fall, maxR, tilt, cy; uniform vec2 res;
        float coc(vec2 uv){ float d = -perspectiveDepthToViewZ(texture2D(tD, uv).x, near, far); float nearSide = step(d, focus); float c = clamp((abs(d - focus) - range * mix(1., .75, nearSide)) / mix(fall, fall * .32, nearSide), 0., 1.) * maxR * mix(1., 1.9, nearSide);
          return max(c, tilt * smoothstep(.36, .5, abs(uv.y - cy))); }
        void main(){
          float c = coc(vUv); vec3 sum = texture2D(tC, vUv).rgb; float ws = 1.;
          if (c > .35) { for (int i = 1; i <= 28; i++) { float fi = float(i); float r = sqrt(fi / 28.); float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * r * c / res; float cs = coc(vUv + o); float w = smoothstep(0., 1., cs - r * c * .55 + .9);
            sum += texture2D(tC, vUv + o).rgb * w; ws += w; } }
          gl_FragColor = vec4(sum / ws, 1.);
        }`, depthTest: false, depthWrite: false,
    });
    this.fsq = new FullScreenQuad(this.mat);
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.fsq.render(renderer);
  }
}
class GradePass extends Pass {
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, fade: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      // 色彩分級：暗部偏藍紫、亮部偏暖金，棕色的中間調收一點飽和，四角只壓暗一成
      fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float fade;
        void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; vec2 q = vUv - .5; float v = smoothstep(.9, .3, length(q * vec2(1., .86)));
          float l = dot(c, vec3(.299, .587, .114));
          c = mix(vec3(l), c, .93 + .12 * smoothstep(.25, .8, l));
          c += vec3(-.012, -.004, .03) * (1. - smoothstep(0., .45, l));
          c *= mix(vec3(1.), vec3(1.07, 1.02, .9), smoothstep(.45, 1., l));
          vec3 k = clamp(c, 0., 1.); c = mix(c, k * k * (3. - 2. * k) + (c - k), .16);      // 對比曲線只作用在 0～1，過亮的部分照原樣留著（不然會變色）
          c *= mix(.86, 1., v); gl_FragColor = vec4(c * fade, 1.); }`, depthTest: false, depthWrite: false,
    });
    this.fsq = new FullScreenQuad(this.mat);
  }
  render(renderer, writeBuffer, readBuffer) { this.mat.uniforms.tDiffuse.value = readBuffer.texture; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.fsq.render(renderer); }
}

// 直式自動鏡頭的設定：pa＝這一格說明窗出現的程度（main.js 每格先量一次）；cy0/d0 沒有說明窗時、cy1/d1 說明窗全開時。橫式講解時右邊有說明窗，鏡頭都故意看偏右、讓主體落在左半；直式窗子在下面，所以說明窗出現時鏡頭要往左移回來（xs×距離）。各集鏡頭可以加 vx（左右再移幾單位）、vcy（再往下推幾成）、vd（距離再乘幾倍）微調
export const vert = { pa: 0, used: false, cy0: .46, cy1: .27, d0: 1.12, d1: 1.3, xs: .15 };
export function makeEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false); renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0d18);
  const camera = new THREE.PerspectiveCamera(28, W / H, 1, 60);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
  const dof = new DofPass(scene, camera), bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .36, .62, .84), grade = new GradePass();
  composer.addPass(dof); composer.addPass(bloom); composer.addPass(grade); composer.addPass(new OutputPass());
  const v = new THREE.Vector3(), hooks = [];
  return {
    renderer, scene, camera, dof, bloom, grade,
    // 鏡頭姿勢：{ x, y, z 看的點, d 距離, pitch 俯角(度), fov, cy 看的點落在畫面由上往下幾成的位置（預設 .5 正中）}
    setCamera(p) {
      // 直式、而且這一集沒有自己寫直式鏡頭（沒給 cy）：自動把看的點推到畫面上方、鏡頭拉遠一點。說明窗出現時（vert.pa→1）推得更高、拉得更遠，人才不會被窗子蓋住
      if (VERT && p.cy == null) { vert.used = true; p = { ...p, x: p.x - (p.d ?? 8.4) * vert.xs * vert.pa + (p.vx || 0), cy: lerp(vert.cy0, vert.cy1, vert.pa) + (p.vcy || 0), d: (p.d ?? 8.4) * lerp(vert.d0, vert.d1, vert.pa) * (p.vd || 1) }; }
      const a = (p.pitch ?? 13) * Math.PI / 180, d = p.d ?? 8.4;
      camera.position.set(p.x, (p.y ?? 1.25) + d * Math.sin(a), (p.z ?? -.8) + d * Math.cos(a)); camera.lookAt(p.x, p.y ?? 1.25, p.z ?? -.8);
      // 直式時 fov 指的是左右視角（跟橫式的上下視角一樣大）；cy 用偏移視窗把看的點往上或往下推
      const cy = p.cy ?? .5, sh = (.5 - cy) * H, Hf = H + 2 * Math.abs(sh), tv = Math.tan((p.fov ?? 28) * Math.PI / 360) * (VERT ? H / W : 1);
      camera.fov = 2 * Math.atan(tv * Hf / H) * 180 / Math.PI; camera.aspect = W / Hf;
      if (sh) camera.setViewOffset(W, Hf, 0, sh > 0 ? 2 * sh : 0, W, H); else camera.clearViewOffset();
      dof.mat.uniforms.cy.value = 1 - cy;
      camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      dof.mat.uniforms.focus.value = d + (p.focusOff || 0); dof.mat.uniforms.range.value = p.range ?? 1.7; dof.mat.uniforms.maxR.value = (p.blur ?? 9) * .72;      // 背景模糊收一點，材質的結構才看得到
    },
    project(x, y, z) { v.set(x, y, z).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; },
    hooks,      // 每次算圖前會被叫的函式（拿得到最後的鏡頭位置），例如前景依鏡頭遠近收起來
    render(fade = 1) { for (const h of hooks) h(camera); grade.mat.uniforms.fade.value = fade; composer.render(); },
  };
}
export { THREE };
