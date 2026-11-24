// 共用的房間骨架：地板、三面牆、柱子橫樑、拱窗＋光束、壁燈、主光、塵粒。
// 各場景（workshop.js 或各集自己的場景）在這上面擺自己的道具。
import { THREE, PPU, box, boxMulti, floorPlane, sprite, blob, loadTex, canvasTex, rnd, VERT } from './engine.js';

function shaftTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 64);
  const h = x.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(.25, 'rgba(0,0,0,0)'); h.addColorStop(.75, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 32, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 地板大圖：把兩張石板貼圖拼成 4×3 格，每格隨機選一張、隨機左右上下翻，整張再平鋪。回傳貼圖。
const floorMosaic = async urls => mosaicFrom((await Promise.all(urls.map(u => loadTex(u)))).map(t => t.image));
export function mosaicFrom(ims) {      // 換場景用的地板（scene.js 的 setBackdrop）也走這裡：圖要跟原本的石板一樣大（201×201），地板的貼圖座標才不用重算
  const n = ims[0].width, c = document.createElement('canvas'); c.width = n * 4; c.height = n * 3; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  // 相鄰格用同一張圖的鏡像，接縫才接得起來：位置 (i,j) 的翻轉由奇偶決定，選哪張圖才是隨機的
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { const im = ims[Math.floor(rnd(i * 7 + j * 13 + 3) * ims.length)], fx = i % 2 ? -1 : 1, fy = j % 2 ? -1 : 1;
    x.save(); x.translate(i * n + (fx < 0 ? n : 0), j * n + (fy < 0 ? n : 0)); x.scale(fx, fy); x.drawImage(im, 0, 0); x.restore(); }
  const t = canvasTex(c); t.wrapS = THREE.MirroredRepeatWrapping; t.wrapT = THREE.MirroredRepeatWrapping; return t;
}
const TEX = { wall: 'art/tex/stone_wall2.png', floor: 'art/tex/stone_floor2.png', wood: 'art/tex/wood2.png', plaster: 'art/tex/plaster.png' };
const cache = {};
export const tex = (url, repeat = false) => (cache[url + repeat] ||= loadTex(url, { repeat, mirror: /2\.png$/.test(url) }));      // 第二版大張材質（檔名結尾 2）用鏡像平鋪
// 小工具：一條由深到透明的陰影帶（6 階，保持像素感），貼在牆腳、樑下、桌底當接觸陰影
function aoTex() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 24; const x = c.getContext('2d');
  for (let j = 0; j < 24; j++) { x.fillStyle = `rgba(6,7,20,${[.62, .5, .38, .27, .17, .08][Math.floor(j / 4)]})`; x.fillRect(0, j, 4, 1); }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; return t;
}
// 窗光落在地板上的亮區：拱窗的形狀、有窗櫺的影子，邊緣一階一階淡掉
function windowLightTex() {
  const W = 40, H = 64, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const u = (i - W / 2 + .5) / (W / 2), v = j / H; let a = 0;
    const arch = v > .28 ? Math.abs(u) < .86 : Math.hypot(u / .86, (v - .28) / .28) < 1;      // 上面是拱、下面是方
    if (arch) { const e = v > .28 ? .86 - Math.abs(u) : 1 - Math.hypot(u / .86, (v - .28) / .28); a = e < .1 ? .45 : e < .22 ? .7 : .9; if (Math.abs(u) < .05 || Math.abs(Math.abs(u) - .45) < .035 || Math.abs(v - .52) < .012 || Math.abs(v - .76) < .012) a = .28; a *= .55 + .45 * v; }
    else { const d = v > .28 ? Math.abs(u) - .86 : Math.hypot(u / .86, (v - .28) / .28) - 1; a = d < .07 ? .3 : d < .14 ? .12 : 0; }
    if (a) { x.fillStyle = `rgba(255,255,255,${a})`; x.fillRect(i, j, 1, 1); }
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function haloTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d');
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const d = Math.hypot(i - 15.5, j - 15.5) / 16; if (d < 1) { x.fillStyle = `rgba(255,255,255,${d < .2 ? .7 : d < .4 ? .36 : d < .62 ? .18 : d < .82 ? .09 : .04})`; x.fillRect(i, j, 1, 1); } }
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SUN = new THREE.Vector3(7, -11, 10).normalize();      // 主光方向：從後牆的窗外、左上方斜射進來，影子落向鏡頭這一側

// o：{ wall, floor, wood（貼圖路徑，可換成自己的）, wallTint, floorTint, x0, x1（房間左右邊界）, windows:[x…], pillars:[x…], lamps:[x…],
//      ambient:[色,強度], sun:[色,強度], shaft:色, shaftOpacity, dust:色, lampColor, bg }
export async function buildRoom(E, o = {}) {
  const x0 = o.x0 ?? -11, x1 = o.x1 ?? 15, cx = (x0 + x1) / 2, w = x1 - x0;
  const T = { wall: await tex(o.wall || TEX.wall, true), floor: o.floor ? await tex(o.floor, true) : await floorMosaic(['art/tex/floor3a.png', 'art/tex/floor3b.png']), wood: await tex(o.wood || TEX.wood, true), plaster: await tex(TEX.plaster, true) };
  const g = new THREE.Group(); E.scene.add(g);
  if (o.bg !== undefined) E.scene.background = new THREE.Color(o.bg);
  const add = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); return m; };
  const P = {};
  T.tabletop = await tex('art/tex/tabletop.png', true); T.tableside = await tex('art/tex/tableside.png', true); T.pedestal = await tex('art/tex/pedestal.png');
  // 載入道具圖（art/props/名字.png 或完整路徑）→ P[名字]
  const load = names => Promise.all(names.map(async k => { P[k.split('/').pop().replace('.png', '')] = await tex(k.includes('/') ? k : `art/props/${k}.png`); }));
  await load(['window', 'lantern']);
  // 窗戶拆成三層：石窗框（把玻璃挖空）、窗外遠景（一張很寬的全景圖，每扇窗看到不同段落，鏡頭左右移動時有視差）、玻璃形狀的遮罩。
  // 這樣幾扇窗看出去不會是同一張圖，窗外也帶一點模糊和過曝，像真的在室外。
  const WIN = (() => {
    const im = P.window.image, w = im.width, h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, w, h), px = d.data, mc = document.createElement('canvas'); mc.width = w; mc.height = h; const mx = mc.getContext('2d'), md = mx.createImageData(w, h);
    const sat = k => Math.max(px[k], px[k + 1], px[k + 2]) - Math.min(px[k], px[k + 1], px[k + 2]), lum = k => px[k] * .3 + px[k + 1] * .59 + px[k + 2] * .11;
    // 每一列找出最左和最右的「有顏色」像素（窗外風景），中間就是玻璃的範圍；再跟上下幾列取中位數，避免灰色的懸崖、白雲讓邊界內縮
    const L = [], R = [];
    for (let j = 0; j < h; j++) { let l = -1, r = -1; for (let i = 0; i < w; i++) { const k = (j * w + i) * 4; if (px[k + 3] > 128 && sat(k) > 60) { if (l < 0) l = i; r = i; } } L.push(l); R.push(r); }
    const med = (a, j) => { const v = []; for (let q = -3; q <= 3; q++) if (a[j + q] >= 0) v.push(a[j + q]); v.sort((p, q) => p - q); return v.length ? v[v.length >> 1] : -1; };
    // 窗洞的範圍：下半是長方形（左右邊界取最常出現的值），上半是拱（用各列偵測到的值）。整個窗洞清成玻璃，不留原圖的任何像素
    const Ls = L.map((_, j) => med(L, j)), Rs = R.map((_, j) => med(R, j)), rows = Ls.map((l, j) => (l >= 0 && Rs[j] - l >= 4 ? j : -1)).filter(j => j >= 0), yTop = rows[0], yBot = rows[rows.length - 1];
    const mode = a => { const c = {}; let best = a[0]; for (const v of a) { c[v] = (c[v] || 0) + 1; if (c[v] > c[best]) best = v; } return best; };
    const lower = rows.filter(j => j > (yTop + yBot) / 2), xL = mode(lower.map(j => Ls[j])), xR = mode(lower.map(j => Rs[j])), ySpring = rows.find(j => Ls[j] <= xL + 1 && Rs[j] >= xR - 1);
    const glass = new Uint8Array(w * h);
    for (const j of rows) { const l = j >= ySpring ? xL : Math.max(Ls[j], xL), r = j >= ySpring ? xR : Math.min(Rs[j], xR); for (let i = l; i <= r; i++) glass[j * w + i] = 1; }
    // 重新畫窗櫺（整齊的像素線）：兩根直的、三根橫的，拱裡面兩個小尖拱
    const bar = new Uint8Array(w * h), W3 = (xR - xL + 1) / 3, x1 = Math.round(xL + W3) - 1, x2 = Math.round(xL + 2 * W3) - 1, cx = (xL + xR) / 2, aH = ySpring - yTop, yMid = Math.round(ySpring - aH * .3);
    const dot = (i, j, v = 1) => { i = Math.round(i); j = Math.round(j); if (i >= 0 && j >= 0 && i + 1 < w && j < h) { if (glass[j * w + i]) bar[j * w + i] = v; if (glass[j * w + i + 1]) bar[j * w + i + 1] = v + 1; } };
    const line = (ax, ay, bx, by) => { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2 + 1; for (let k = 0; k <= n; k++) dot(ax + (bx - ax) * k / n, ay + (by - ay) * k / n); };
    for (const bx of [x1, x2]) line(bx, yMid, bx, yBot);
    line(x1, yMid, cx - .5, yMid - aH * .34); line(x2, yMid, cx - .5, yMid - aH * .34); line(x1, yMid, xL - 2, yMid - aH * .36); line(x2, yMid, xR + 2, yMid - aH * .36);
    for (const by of [ySpring, Math.round(ySpring + (yBot - ySpring) / 3), Math.round(ySpring + (yBot - ySpring) * 2 / 3)]) for (let i = xL; i <= xR; i++) for (const q of [0, 1]) if (glass[(by + q) * w + i]) bar[(by + q) * w + i] = q + 1;
    for (let n = 0; n < w * h; n++) { const k = n * 4; if (!glass[n]) continue;
      if (bar[n]) { const c2 = bar[n] === 1 ? [70, 70, 82] : [34, 34, 44]; px[k] = c2[0]; px[k + 1] = c2[1]; px[k + 2] = c2[2]; px[k + 3] = 255; }
      else { px[k + 3] = 0; md.data[k] = md.data[k + 1] = md.data[k + 2] = md.data[k + 3] = 255; } }
    x.putImageData(d, 0, 0); mx.putImageData(md, 0, 0);
    const mk = cv => { const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; return t; };
    const frame = mk(c); frame.colorSpace = THREE.SRGBColorSpace; return { frame, mask: mk(mc) };
  })();
  // 遠景全景圖：縮小後再糊一點、往暖白提亮（空氣感），線性取樣
  const PANO = await (async () => {
    const src = (await tex(o.pano || 'art/tex/panorama.png')).image, c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d');
    x.filter = `blur(${o.panoBlur ?? 1.6}px) saturate(80%)`; x.drawImage(src, 0, 0); x.filter = 'none'; x.globalAlpha = .16; x.fillStyle = '#fff4dc'; x.fillRect(0, 0, c.width, c.height);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.MirroredRepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
  })();
  P.window = WIN.frame; const panes = [];
  // 放一個像素看板道具；shadow:true 會加腳下陰影
  const prop = (k, x, y, z, opt = {}) => { const s = sprite(typeof k === 'string' ? P[k] : k, opt); add(s, x, y, z); if (opt.shadow) { const b = blob(opt.shadow === true ? .8 : opt.shadow); b.position.set(x, .012, z); g.add(b); s.userData.blob = b; } return s; };

  // 直式看得到比較多前景地板和比較高的牆，地板往鏡頭方向加長、後牆往上加高
  const f = add(floorPlane(w + 4, VERT ? 28 : 12, T.floor), cx, 0, VERT ? 8.5 : .5); f.material.color.set(o.floorTint ?? 0xf6e6d4);      // 地板預設帶一點暖色，冷色環境光下才不會整片發青
  const walls = [add(box(w + 4, 6.4, .4, T.wall, { cast: false }), cx, 3.2, -4.9), add(box(.4, 6.4, 12, T.wall, { cast: false }), x0, 3.2, .5), add(box(.4, 6.4, 12, T.wall, { cast: false }), x1, 3.2, .5)];
  if (VERT) walls.push(add(box(w + 4, 8, .4, T.wall, { cast: false, color: 0x8f8a96 }), cx, 10.4, -4.9));
  walls.forEach(m => m.material.color.set(o.wallTint ?? 0xffffff).multiplyScalar(.9));      // 後牆整體退一點，細節對比留給中景
  add(box(w + 4, .34, .2, T.wood, { cast: false }), cx, .17, -4.62);
  const AO = aoTex(), aoMat = op => new THREE.MeshBasicMaterial({ map: AO, transparent: true, opacity: op, depthWrite: false });
  const ao = (wd, ht, x, y, z, rx = 0, op = 1, flipV = false) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), aoMat(op)); m.position.set(x, y, z); m.rotation.x = rx; if (flipV) m.scale.y = -1; m.renderOrder = 1; g.add(m); return m; };
  for (const x of o.pillars ?? [-9, -4, 1, 6, 11]) {
    add(box(.42, 6.4, .42, T.wood), x, 3.2, -4.5);
    add(box(.66, .34, .62, T.wall, { color: 0xb8b0a8 }), x, .17, -4.42); add(box(.56, .12, .54, T.wood, { color: 0xd8c8b0 }), x, .4, -4.44);      // 石柱腳＋木墊
    add(box(.6, .2, .56, T.wood, { color: 0xd8c8b0 }), x, 4.32, -4.44); add(box(.3, .5, .5, T.wood, { color: 0xb8a890 }), x, 4.05, -4.2).rotation.x = .5;      // 柱頭與斜撐
    ao(1.5, .9, x, .02, -3.75, -Math.PI / 2, .55, true);      // 柱腳前的地板陰影
  }
  // 接觸陰影：牆腳的地板、牆面下緣、橫樑下方
  ao(w + 4, 1.3, cx, .018, -4.05, -Math.PI / 2, .7, true); ao(w + 4, 1.0, cx, .5, -4.685, 0, .5, true); ao(w + 4, 1.1, cx, 3.88, -4.685, 0, .6);
  add(box(w + 4, .36, .5, T.wood, { cast: false }), cx, 4.6, -4.45);
  const shaft = shaftTex(), shafts = [], sOp = (o.shaftOpacity ?? .28) * .8;
  const wl = windowLightTex(), wins = o.windows ?? [-6.5, -1.5, 3.5, 8.5], winH = P.window.image.height / PPU * 1.42, winW = P.window.image.width / PPU * 1.42; let nShaft = 0;
  for (const x of wins) {
    add(sprite(P.window, { scale: 1.42, shadow: false }), x, .78, -4.66);
    // 窗外：跟窗框同大小的一片，貼全景圖的其中一段（依這扇窗在房間裡的位置選），只在玻璃的形狀裡顯示
    { const pt = PANO.clone(); pt.needsUpdate = true; const uw = Math.min(.3, winW * PPU / 1.42 / PANO.image.width * 1.0), u0 = .04 + (x - x0) / w * (.92 - uw);
      pt.repeat.set(uw, 1); pt.offset.set(u0, 0);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), new THREE.MeshBasicMaterial({ map: pt, alphaMap: WIN.mask, alphaTest: .5, color: new THREE.Color(o.sky ?? 0xffffff).multiplyScalar(1.28) }));
      pm.position.set(x, .78 + winH / 2, -4.672); g.add(pm); panes.push({ pt, x, u0 }); }
    add(box(winW + .3, .12, .34, T.wall, { color: 0xd0c8c0 }), x, .74, -4.56);      // 窗台
    // 窗光落在地板上：照主光方向投下去的平行四邊形（y 越高落得越遠、越偏右）
    { const hit = y => [SUN.x / -SUN.y * y, -4.86 + SUN.z / -SUN.y * y], [sx0, z0] = hit(.86), [sx1, z1] = hit(.78 + winH), hw = winW * .44;
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([x - hw + sx1, .022, z1, x + hw + sx1, .022, z1, x - hw + sx0, .022, z0, x + hw + sx0, .022, z0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2)); geo.setIndex([0, 2, 1, 2, 3, 1]);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: wl, color: o.shaft ?? 0xffe2ae, transparent: true, opacity: o.winLight ?? .24, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 2; g.add(m); }
    if (nShaft++ % 2 || wins.length < 2 && nShaft > 1) continue;      // 光束只留隔一扇窗的那幾組，來源才清楚
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 6.2), new THREE.MeshBasicMaterial({ map: shaft, color: o.shaft ?? 0xffe0a0, transparent: true, opacity: sOp, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    s.position.set(x + .9, 1.7, -2.9); s.rotation.set(-.62, 0, -.3); s.renderOrder = 3; g.add(s); shafts.push(s);
  }
  const lamps = [], halos = [], halo = haloTex();
  for (const x of o.lamps ?? [-4, 1, 6, 11]) { add(sprite(P.lantern, { glow: true }), x + .12, 2.85, -4.25); const l = new THREE.PointLight(o.lampColor ?? 0xffb060, 7.5, 4.4, 1.9); l.position.set(x + .1, 3.0, -4.0); g.add(l); lamps.push(l);
    // 燈的柔光暈：外圈大、淡；牆上會有一圈暖色亮斑
    const h = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: halo, color: o.lampColor ?? 0xffb060, transparent: true, opacity: .24, blending: THREE.AdditiveBlending, depthWrite: false })); h.position.set(x + .12, 3.05, -4.2); h.renderOrder = 2; g.add(h); halos.push(h); }
  const amb = o.ambient ?? [0x8a9ad0, 1.55], sn = o.sun ?? [0xffdca6, 2.5];
  // 明暗結構：環境光壓到原本的六成、偏冷（天光藍灰、地面反光暖棕）；主光是窗外日光，從後上方斜射，亮面更亮、背光面留暗
  const ac = new THREE.Color(amb[0]), sky = ac.clone().lerp(new THREE.Color(0x9aa2c8), .35), gnd = ac.clone().lerp(new THREE.Color(0x5a4636), .55);
  g.add(new THREE.HemisphereLight(sky, gnd, amb[1] * (o.ambientK ?? 1.42)));
  const sun = new THREE.DirectionalLight(new THREE.Color(sn[0]).lerp(new THREE.Color(0xfff2d8), .4), sn[1] * (o.sunK ?? .72)); sun.position.set(cx - SUN.x * 24, -SUN.y * 24, -1 - SUN.z * 24); sun.target.position.set(cx, 0, -1); g.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536); const sc = sun.shadow.camera; sc.left = -w / 2 - 4; sc.right = w / 2 + 4; sc.top = 9; sc.bottom = -9; sc.near = 4; sc.far = 50; sun.shadow.bias = -.0012; sun.shadow.normalBias = .03; sun.shadow.radius = 3; sun.shadow.intensity = o.shadowK ?? .3;      // 大面積的投影只壓暗三成；腳底、桌腳的接觸陰影另外用深一點的小影子
  if (o.fog !== false) E.scene.fog = new THREE.FogExp2(o.fog ?? 0x232a48, .021);      // 一點空氣透視：後牆的對比降一些
  // ---------- 前景：靠鏡頭這一側、畫面最下緣的一排矮東西（箱子、木桶、書堆、盆栽、燭台），壓暗、被景深糊掉，增加層次 ----------
  // 高度限制在 1.15 以內：以一般鏡頭（距離 8 左右）來看只會露在人物腳底以下，不會擋到人、說明窗或字幕上的內容。o.foreground:false 可以關掉
  if (o.foreground !== false && !VERT) {      // 直式版下半部是說明窗，不放前景
    const FG = ['crate', 'barrel', 'books', 'sacks', 'fern', 'candelabra', 'cart', 'sidetable']; await load(FG.filter(k => !P[k]));
    const skip = o.fgSkip || [], fgs = [];      // [[x0,x1],…] 這些範圍不放（某一集的鏡頭剛好會擋到時用）
    for (let x = x0 + 1.2, i = 0; x < x1 - 1; i++) {
      const k = FG[Math.floor(rnd(i * 5 + 11) * FG.length)], im = P[k].image, sc = Math.min(1.5 + rnd(i + 40) * .35, 1.12 * PPU / im.height), z = 2.7 + rnd(i + 70) * .35;
      if (!skip.some(([a, b]) => x > a && x < b)) { const sp = sprite(P[k], { scale: sc, tint: 0x59607e, shadow: false }); add(sp, x, 0, z); fgs.push(sp); }
      x += 2.3 + rnd(i + 90) * 2.6;      // 間隔不固定，留空隙
    }
    // 鏡頭拉遠時（全景）這排東西會跑到畫面中間的空地上，很突兀：鏡頭越遠就讓它們沉到地板下收起來
    E.hooks.push(cam => { const k = Math.min(1, Math.max(0, (cam.position.z - 8.8) / 1.8)); for (const sp of fgs) sp.position.y = -1.3 * k * k * (3 - 2 * k); });
  }
  // 視差：鏡頭往右移，窗外的景往左退（遠景退得慢）
  E.hooks.push(cam => { for (const q of panes) q.pt.offset.x = q.u0 - (cam.position.x - q.x) * .011; });
  const N = 150, pos = new Float32Array(N * 3), dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(dustG, new THREE.PointsMaterial({ color: o.dust ?? 0xffe9b8, size: .04, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false })));
  return {
    group: g, T, P, add, prop, load, x0, x1, floor: f, shafts,
    shelf: (x, y, wd) => add(box(wd, .1, .5, T.wood), x, y, -4.4),
    update(t) {
      shafts.forEach((s, i) => { s.material.opacity = sOp * (.9 + .2 * Math.sin(t * .6 + i * 1.7)); });
      lamps.forEach((l, i) => { const f = Math.sin(t * 7.3 + i * 2.1) * Math.sin(t * 3.7 + i); l.intensity = 7.5 + 1.1 * f; halos[i].material.opacity = .24 + .03 * f; });
      for (let i = 0; i < N; i++) { const sp = .05 + rnd(i) * .08; pos[i * 3] = x0 + 1 + rnd(i + 100) * (w - 2) + Math.sin(t * .23 + i) * .5; pos[i * 3 + 1] = .3 + ((rnd(i + 200) * 4 + t * sp) % 4); pos[i * 3 + 2] = -4 + rnd(i + 300) * 4.5 + Math.cos(t * .19 + i * 2) * .3; }
      dustG.attributes.position.needsUpdate = true;
    },
  };
}
// 一座示範台（石座＋木檯面）。回傳檯面高度。
export function pedestal(R, x, z, { w = 1.1, h = .62, d = .9 } = {}) {
  // 石座每一面都是雕過的石板（整張貼一次），上面一塊有邊飾的木檯面
  R.add(boxMulti(w, h, d, { front: [R.T.pedestal, 'fit'], side: [R.T.pedestal, 'fit'], top: [R.T.wall] }, { color: 0xe6e0d8, rough: .9 }), x, h / 2, z);
  R.add(boxMulti(w + .14, .1, d + .14, { top: [R.T.tabletop], front: [R.T.wood], side: [R.T.wood] }, { rough: .6 }), x, h + .05, z);
  const b = blob(w * 1.9); b.position.set(x + .12, .014, z + d * .5 + .12); R.group.add(b); return h + .1;
}
// 一張木桌。回傳桌面高度。
export function bench(R, x, z, { w = 3.4, d = 1.3, top = .82 } = {}) {
  // 桌面：木板拼的面（有邊飾、刮痕），四周一圈雕花側板，車過的桌腳，底下一根橫撐
  const m = R.add(boxMulti(w, .1, d, { top: [R.T.tabletop], front: [R.T.wood], side: [R.T.wood] }, { rough: .55 }), x, top - .05, z);
  m.material.forEach(q => { q.emissive = new THREE.Color(0x1c120a); });
  const lift = q => { (Array.isArray(q.material) ? q.material : [q.material]).forEach(k => { k.emissive = new THREE.Color(0x33241a); }); return q; };      // 桌下不要黑成一片
  lift(R.add(boxMulti(w - .24, .3, d - .2, { front: [R.T.tableside, 'tileX'], side: [R.T.tableside, 'tileX'], top: [R.T.wood] }, { color: 0xe8dccc }), x, top - .25, z));      // 側板高 .3＝貼圖 23 像素，像素密度跟角色一致
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const lx = x + dx * (w / 2 - .22), lz = z + dz * (d / 2 - .18);
    lift(R.add(box(.15, top - .4, .15, R.T.wood, { color: 0xc8b49c }), lx, (top - .4) / 2, lz)); lift(R.add(box(.21, .09, .21, R.T.wood, { color: 0xe0d0b8 }), lx, .045, lz)); lift(R.add(box(.2, .06, .2, R.T.wood, { color: 0xe0d0b8 }), lx, top - .43, lz));
  }
  lift(R.add(box(w - .5, .08, .1, R.T.wood, { color: 0xb8a48c }), x, .26, z + d / 2 - .18)); lift(R.add(box(w - .5, .08, .1, R.T.wood, { color: 0xb8a48c }), x, .26, z - d / 2 + .18));
  const b = blob(w * 1.25); b.position.set(x + .15, .014, z + .2); b.scale.z = 1.6; R.group.add(b); return top;
}
