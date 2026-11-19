// 主程式：預覽（空白鍵播放／暫停、左右鍵跳 2 秒、點畫面下緣跳時間、網址 ?t=12 從第 12 秒開始）；?capture 給 export.mjs 逐格錄影
import { makeEngine, W, H } from './engine.js';
import { buildBattle } from './battle.js';

const Q = new URLSearchParams(location.search), CAPTURE = Q.has('capture');
const gl = document.getElementById('gl'), hudCv = document.getElementById('hud');
await Promise.all(['500 40px "Noto Sans TC"', '700 40px "Noto Sans TC"', '900 40px "Noto Sans TC"', '700 40px "Songti TC"', '900 40px "Songti TC"'].map(f => document.fonts.load(f, '奧客總經理吐槽一閃').catch(() => 0)));
const E = makeEngine(gl), B = await buildBattle(E, hudCv), TOTAL = B.dur;
function frame(T) { T = Math.min(Math.max(T, 0), TOTAL - 1 / 60); B.update(T); E.render(1); B.hud(T); }
const comp = document.createElement('canvas'); comp.width = W; comp.height = H; const cctx = comp.getContext('2d');
window.__E = E; window.__B = B; window.__frame = frame;
window.DURATION = TOTAL; window.sfx = B.sfx; window.music = B.music;
window.capture = async (T, q = .93) => { frame(T); cctx.drawImage(gl, 0, 0); cctx.drawImage(hudCv, 0, 0); return comp.toDataURL('image/jpeg', q); };

if (CAPTURE) { frame(0); window.ready = true; }
else {
  const audio = new Audio('out/preview.mp3'); let playing = false, t0 = 0, base = 0, tNow = +(Q.get('t') || 0), hasAudio = false;
  audio.addEventListener('canplaythrough', () => { hasAudio = true; }, { once: true });
  const play = () => { playing = true; base = tNow; t0 = performance.now(); if (hasAudio) { audio.currentTime = tNow; audio.play().catch(() => 0); } };
  const pause = () => { playing = false; audio.pause(); };
  addEventListener('keydown', e => { if (e.code === 'Space') { playing ? pause() : play(); e.preventDefault(); } if (e.code === 'ArrowRight') { tNow = Math.min(TOTAL, tNow + 2); if (playing) play(); } if (e.code === 'ArrowLeft') { tNow = Math.max(0, tNow - 2); if (playing) play(); } });
  document.getElementById('stage').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); if ((e.clientY - r.top) / r.height > .9) { tNow = (e.clientX - r.left) / r.width * TOTAL; if (playing) play(); } else playing ? pause() : play(); });
  const tick = () => { if (playing) { tNow = base + (performance.now() - t0) / 1000; if (tNow >= TOTAL) { tNow = 0; pause(); } } frame(tNow); requestAnimationFrame(tick); };
  window.seek = t => { tNow = t; }; window.ready = true; tick();
}
