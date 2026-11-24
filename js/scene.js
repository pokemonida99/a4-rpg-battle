// 戰鬥場景「奧客總經理的會議大廳」：夜裡的石造大廳，月光從拱窗斜進來，火盆的暖光、深紅旗幟、堆成山的文件。
// 用 room.js 的房間骨架蓋，再擺自己的道具。回傳 { group, update(t), fires }。
import { THREE, PPU, sprite, blob, canvasTex, normalFrom, rnd } from './engine.js';
import { buildRoom, mosaicFrom } from './room.js';

// 紅地毯：深紅底、金邊、菱形暗紋（像素材質，沿 x 方向鋪）。pal＝[底色, 亮紋, 暗紋, 邊條, 邊條亮線, 最外緣]，別的場景換顏色用
const RUG_RED = ['#5c1420', '#74202a', '#4a0e18', '#b08a3c', '#e0c06a', '#3a0a12'];
function carpetTex(pal = RUG_RED) {
  const w = 64, h = 40, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = pal[0]; x.fillRect(0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const d = (Math.abs((i % 16) - 8) + Math.abs((j % 16) - 8)); if (d === 6) { x.fillStyle = pal[1]; x.fillRect(i, j, 1, 1); } else if (d < 2) { x.fillStyle = pal[2]; x.fillRect(i, j, 1, 1); } }
  x.fillStyle = pal[3]; x.fillRect(0, 2, w, 2); x.fillRect(0, h - 4, w, 2); x.fillStyle = pal[4]; x.fillRect(0, 2, w, 1); x.fillRect(0, h - 4, w, 1);
  x.fillStyle = pal[5]; x.fillRect(0, 0, w, 2); x.fillRect(0, h - 2, w, 2);
  const t = canvasTex(c); t.wrapS = THREE.RepeatWrapping; return t;
}
function glowTex() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d');
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const d = Math.hypot(i - 15.5, j - 15.5) / 16; if (d < 1) { x.fillStyle = `rgba(255,255,255,${d < .25 ? .8 : d < .45 ? .42 : d < .65 ? .2 : d < .85 ? .09 : .04})`; x.fillRect(i, j, 1, 1); } }
  return canvasTex(c);
}

export async function buildArena(E) {
  const R = await buildRoom(E, {
    x0: -14, x1: 14, pillars: [-11, -6, -1, 4, 9], windows: [-8.5, -3.5, 1.5, 6.5, 11.5], lamps: [],
    ambient: [0x5a62b4, 1.0], ambientK: .62, sun: [0x9db4ff, 2.6], sunK: .8, shaft: 0x9fb6ff, shaftOpacity: .3, winLight: .3, sky: 0x5a6cc0, panoBlur: 2.4,
    wallTint: 0x6a6486, floorTint: 0x9a8ca4, dust: 0xbfd0ff, bg: 0x04050b, fog: 0x080a1a, foreground: false, shadowK: .42,
  });
  const { group: g, add, prop: prop0, P } = R, decor = [], prop = (...a) => { const o = prop0(...a); decor.push(o); return o; };      // decor＝大廳專屬的擺設，換場景時收起來
  await R.load(['throne', 'banner', 'papers', 'brazier', 'crate', 'bookshelf', 'cabinet', 'chandelier', 'candelabra']);
  const far = 0x6c6888, mid = 0xb0aac4;
  // 紅地毯從魔王腳下一路鋪到隊伍
  const RUG_W = 22, rugTex = new Map(), rugOf = pal => { const k = pal.join(); if (!rugTex.has(k)) { const t = carpetTex(pal); t.repeat.set(RUG_W / (64 / PPU * 1.4), 1); rugTex.set(k, t); } return rugTex.get(k); };
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG_W, 2.9), new THREE.MeshStandardMaterial({ map: rugOf(RUG_RED), roughness: .95 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .012, -.25); rug.receiveShadow = true; g.add(rug);
  // 魔王身後：王座辦公桌（放在矮平台上）、兩側文件山
  { const m = add(new THREE.Mesh(new THREE.BoxGeometry(5.2, .22, 2.2), new THREE.MeshStandardMaterial({ map: R.T.wall, color: 0xa098b4, roughness: .9 })), -6.6, .11, -3.3); m.receiveShadow = true; decor.push(m); }
  prop('throne', -6.6, .22, -3.5, { scale: 3.0, tint: mid, shadow: 2.4 });
  prop('papers', -10.2, 0, -3.2, { scale: 2.3, tint: far, shadow: 1.6 }); prop('papers', -3.2, 0, -3.9, { scale: 1.7, tint: far, shadow: 1.2 }).scale.x *= -1;
  prop('papers', 5.6, 0, -3.9, { scale: 1.9, tint: far, shadow: 1.3 }); prop('papers', 11.4, 0, -3.3, { scale: 2.2, tint: far, shadow: 1.5 }).scale.x *= -1;
  prop('cabinet', 8.4, 0, -4.2, { scale: 1.8, tint: far }); prop('bookshelf', 12.9, 0, -4.2, { scale: 1.8, tint: far }); prop('bookshelf', -12.6, 0, -4.2, { scale: 1.8, tint: far });
  // 後牆的旗幟（掛在柱子之間的牆上、窗戶上方兩側）
  for (const x of [-6, -1, 4, 9]) prop('banner', x, 2.35, -4.2, { scale: 2.0, tint: 0xb4aac4, shadow: false });
  prop('chandelier', -3.5, 4.05, -2.6, { scale: 1.7, tint: 0x9c96b0, shadow: false }); prop('chandelier', 4.5, 4.05, -2.6, { scale: 1.7, tint: 0x9c96b0, shadow: false });
  // 火盆：道具＋暖色點光＋光暈（火焰用 pixelfx，由 battle.js 加在 fires 的位置）
  const fires = [], halo = glowTex();
  for (const [x, z, s] of [[-9.0, -1.9, 2.1], [-2.6, -3.3, 1.9], [2.6, -3.5, 1.9], [8.2, -2.4, 2.1]]) {
    const b = prop0('brazier', x, 0, z, { scale: s, shadow: .9 }), top = P.brazier.image.height / PPU * s;
    const l = new THREE.PointLight(0xff8a3c, 16, 7.5, 1.7); l.position.set(x, top + .5, z + .5); g.add(l);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: halo, color: 0xff7a30, transparent: true, opacity: .3, blending: THREE.AdditiveBlending, depthWrite: false })); h.position.set(x, top + .35, z - .1); h.renderOrder = 2; g.add(h);
    fires.push({ x, z, top, s, l, h, b });
  }
  // 前景：靠鏡頭的暗色文件堆和箱子，被景深糊掉，只露在畫面兩側下緣
  const fg = []; for (const [k, x, z, s] of [['papers', -7.4, 3.6, 2.6], ['crate', -4.9, 3.9, 1.7], ['papers', 8.6, 3.7, 2.7], ['candelabra', 6.2, 3.9, 1.7], ['crate', 11.2, 3.4, 2.0], ['candelabra', -10.4, 3.3, 1.9]]) fg.push(prop0(k, x, 0, z, { scale: s, tint: 0x1c1d30, shadow: false }));
  // 戰場中央的聚光：一盞很大的冷白光打在地毯中段，人物站的地方最亮、四周暗下去
  const key = new THREE.SpotLight(0xe8e2ff, 150, 28, .5, .85, 1.1); key.position.set(.5, 9.5, 5.5); key.target.position.set(.5, 0, -.6); g.add(key, key.target);
  // 換場景：別張地圖的戰鬥把大廳的擺設收起來，後牆前面掛一張大背景圖。圖取中間一條（寬：高＝30：7.2），tint 把它壓暗一點融進夜色；cy＝取圖的哪個高度當中心（0 最上、1 最下）
  let drop = null; const dropTex = new Map();
  // rep＝這張圖橫向鋪幾次（1＝一張圖撐滿 30 單位寬，畫面上只看得到中間四成，東西會很大；室內景用 2，家具才不會比人大）。
  // 多出來的用左右鏡射接上；牆腳線的位置不變（圖的 cy 往下半條橫帶），上面不夠的部分用圖最上面那一行補
  // look＝整個場景一起換（11/22 使用者：地板也要換，才算整個背景換掉）：{ floor: 地板圖（201×201，從正上方看的材質）, ft: 地板色調, carpet: 地毯配色（沒寫＝不鋪）, light: 原本火盆位置的燈改什麼顏色, lk: 亮度倍率 }。
  // 有 look 的場景：地板換掉、地毯換色或收起來、火盆（道具、影子、光暈、火焰）、前景的文件堆、窗戶的光柱都收起來。沒有 look 或沒掛圖就全部還原成大廳
  const floor0 = { map: R.floor.material.map, nm: R.floor.material.normalMap, tint: R.floor.material.color.getHex() }, floorTex = new Map(); let lightK = 1;
  function dress(L) { const on = !!(L && L.floor), fm = R.floor.material; if (on && !floorTex.has(L.floor)) { const map = mosaicFrom([L.floor]); floorTex.set(L.floor, { map, nm: normalFrom(map) }); }
    fm.map = on ? floorTex.get(L.floor).map : floor0.map; fm.normalMap = on ? floorTex.get(L.floor).nm : floor0.nm; fm.color.setHex(on ? L.ft ?? 0xb8b2c4 : floor0.tint); fm.needsUpdate = true;
    rug.visible = !on || !!L.carpet; rug.material.map = rugOf(on && L.carpet ? L.carpet : RUG_RED); rug.material.needsUpdate = true;
    for (const f of fires) { f.b.visible = !on; if (f.b.userData.blob) f.b.userData.blob.visible = !on; f.h.visible = !on; if (f.fx) f.fx.hide = on; f.l.color.setHex(on ? L.light ?? 0xff8a3c : 0xff8a3c); }
    lightK = on ? L.lk ?? 1 : 1; for (const o of fg) o.visible = !on; for (const s of R.shafts || []) s.visible = !on; }
  function setBackdrop(img, tint = 0xa8a4bc, cy = .5, rep = 1, look = null) { for (const o of decor) o.visible = !img; dress(img ? look : null); if (!img) { if (drop) drop.visible = false; return; }
    if (!drop) { drop = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.2), new THREE.MeshBasicMaterial({ color: tint })); drop.position.set(0, 3.6, -4.0); g.add(drop); }
    if (!dropTex.has(img)) { const b1 = Math.round(img.width * 7.2 / 30), bh = Math.round(b1 * rep), y1 = rep === 1 ? Math.max(0, Math.min(img.height - b1, Math.round(img.height * cy - b1 / 2))) + b1 : Math.min(img.height, Math.round(img.height * cy + b1 / 2)), y0 = y1 - bh, c = document.createElement('canvas'), x = c.getContext('2d'); c.width = img.width; c.height = bh;
      if (y0 < 0) x.drawImage(img, 0, 0, img.width, 1, 0, 0, img.width, -y0 + 1); x.drawImage(img, 0, Math.max(0, y0), img.width, y1 - Math.max(0, y0), 0, Math.max(0, -y0), img.width, y1 - Math.max(0, y0));
      const t = canvasTex(c); if (rep !== 1) { t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(rep, 1); t.offset.set((1 - rep) / 2, 0); t.needsUpdate = true; } dropTex.set(img, t); }
    drop.material.map = dropTex.get(img); drop.material.color.set(tint); drop.material.needsUpdate = true; drop.visible = true; }
  return {
    group: g, R, fires, key, setBackdrop,
    update(t) {
      R.update(t);
      fires.forEach((f, i) => { const k = Math.sin(t * 9.1 + i * 2.3) * Math.sin(t * 4.3 + i * 1.1); f.l.intensity = (16 + 3 * k) * lightK; f.h.material.opacity = .3 + .05 * k; });
    },
  };
}
