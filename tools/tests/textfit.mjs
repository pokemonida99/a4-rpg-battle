// 卡片文字會不會放不下（不開瀏覽器的估算：全形字算 1 格、半形算 0.56 格）。對象：事件、強化、職位、招式卡。
import * as R from '../../js/rules.js';
const wd = s => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) < 0x2000 ? .56 : 1), 0);
const rowsOf = (lines, cols) => lines.filter(Boolean).reduce((n, s) => n + Math.max(1, Math.ceil(wd(s) / cols)), 0);
let bad = 0; const flag = (c, m) => { if (c) { bad++; console.log('✗ ' + m); } };
const card = (nCards, o) => { const CW = nCards <= 2 ? 520 : 450, lp = o.big ? 28 : 21, lh = o.big ? 40 : 30, maxRows = Math.floor((640 - 30 - (346 + (o.tag ? 30 : 0))) / lh), cols = (CW - 64) / lp * .97, need = rowsOf(o.lines, cols);
  flag(need > maxRows, `${o.where}「${o.label}」內文 ${need} 行，只放得下 ${maxRows} 行：${o.lines.join('｜')}`); flag(wd(o.label) * 34 > CW - 50, `${o.where}「${o.label}」名字太長（會縮到最小還是擠）`); if (o.tag) flag(wd(o.tag) * 20 > CW - 50, `${o.where}「${o.label}」小標會被截斷：${o.tag}`); };
const sub = (nCards, text, where) => { const CW = nCards <= 2 ? 520 : 450, room = CW * nCards + 36 * (nCards - 1) - 40; flag(wd(text) * 25 > room * 2 * .97, `${where} 說明超過兩行（${Math.round(wd(text))} 字，放得下約 ${Math.floor(room * 2 / 25)} 字）：${text.slice(0, 30)}…`); };
for (const [k, ev] of Object.entries(R.EVENTS)) { sub(ev.opts.length, ev.text, `事件 ${ev.name}`); for (const o of ev.opts) card(ev.opts.length, { where: `事件 ${ev.name}`, label: o.label, lines: o.lines, big: true }); }
for (const [k, U] of Object.entries(R.UPGRADES)) for (const n of [3, 2]) card(n, { where: `強化${n === 2 ? '（二選一）' : ''}`, label: U.name, tag: `${R.UP_TAG[k] || ''}（已有 2／3）　配合阿傑、小葵的招式`.slice(0, U.need ? 99 : 9), lines: U.desc.split('，'), big: true });
for (const [k, J] of Object.entries(R.JOBS)) card(4, { where: '職位', label: J[0], tag: `「${J[3]}」`, lines: ['好處：' + J[1], '限制：' + J[2]] });
for (const id of Object.keys(R.SKILLS)) for (const q of R.SKILLS[id]) card(3, { where: `招式卡 ${R.NAME[id]}`, label: q.name + '＋', tag: `${R.NAME[id]}　SP ${q.sp} → ${Math.ceil(q.sp * .8)}`, lines: [q.desc, '傷害與回復量 ＋25%'] });
console.log(bad ? `有 ${bad} 處可能放不下` : '全部通過'); process.exit(0);
