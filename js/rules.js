// 《上班旅人》的戰鬥與肉鴿規則（純邏輯，不碰畫面）：game.js 拿結果去演，tools/sim.mjs 拿它跑幾百輪調數值。
// 規則摘要：
// ・開局從阿傑或小葵選一個人、三個招式選一個，一個人出發；路上在「招募站」三選一、或打贏「救援戰」收夥伴。名冊最多 6 人，排在前 4 個的上場（順序在行程表頁調）。
// ・每回合照速度排順序。全隊共用一條「氣勢」（0～100）：攻擊、招式、防禦、道具、應援都會加，氣勢夠（MO.ult）且 SP 夠才能放奧義，放完扣掉。
// ・敵人的血、攻擊力會照上場人數縮放（SCALE），一個人出發也打得動。
// ・場上有小兵時奧客總經理「護衛中」，打他傷害無效。甩鍋課長沒有護衛，但每回合第一次被打會甩給小兵（pot）。
// ・頭目被打中「底氣」-1（部分招式 -2），歸零就「理虧」：下一次行動取消（蓄好的大招只是延後），期間受到的傷害 1.5 倍，之後底氣回滿。
// ・頭目每幾次行動會蓄力一次，下一次行動放大招打全體，放完如果場上沒小兵就再叫兩隻。
// ・防禦：到自己下一次行動前受傷減半，氣勢加得比攻擊多一點。招式（SKILLS）只花 SP、不用氣勢。
// ・每一場的頭目共用 'boss' 這個位置（數值在進場時蓋到 STAT.boss），小兵名單 MINIONS、上場名單 HEROES／FRONT 也是進場時換。
export const ALL = ['kui', 'jie', 'kevin', 'mi', 'vivi', 'yan', 'heilun', 'cha', 'qiang', 'senpai', 'wu', 'you', 'fairy', 'zong', 'hui', 'xu'], STARTERS = ['kui', 'jie'];
export const HEROES = [], FRONT = [], MINIONS = ['ma', 'mb'];      // 這一場上場的人（FRONT＝站前排、會被打的；Vivi 在後排只負責應援）
export const STAT = {
  kui: { hp: 2680, sp: 142, atk: 1250, spd: 356, cost: 60 }, kevin: { hp: 4860, sp: 118, atk: 780, spd: 142, cost: 50 },
  jie: { hp: 2140, sp: 388, atk: 1500, spd: 228, cost: 180 }, mi: { hp: 2320, sp: 356, atk: 950, spd: 264, cost: 160 },
  vivi: { hp: 9999, sp: 999, atk: 0, spd: 12, cost: 99 },
  yan: { hp: 2200, sp: 320, atk: 900, spd: 300, cost: 140 }, heilun: { hp: 2500, sp: 200, atk: 1100, spd: 240, cost: 90 }, cha: { hp: 2000, sp: 300, atk: 800, spd: 280, cost: 120 },
  qiang: { hp: 4400, sp: 130, atk: 1000, spd: 150, cost: 60 }, senpai: { hp: 2300, sp: 220, atk: 1300, spd: 250, cost: 110 },
  wu: { hp: 2100, sp: 280, atk: 850, spd: 330, cost: 120 }, you: { hp: 2400, sp: 210, atk: 1150, spd: 340, cost: 100 }, fairy: { hp: 1900, sp: 360, atk: 1000, spd: 270, cost: 150 },
  zong: { hp: 3900, sp: 120, atk: 850, spd: 130, cost: 55 }, hui: { hp: 2300, sp: 180, atk: 1150, spd: 260, cost: 90 }, xu: { hp: 2200, sp: 300, atk: 800, spd: 290, cost: 130 },
  boss: { hp: 78000, spd: 200, spd2: 100, atk: 1150, shield: 8, cycle: 5 }, ma: { hp: 3800, spd: 180, atk: 400 }, mb: { hp: 3800, spd: 170, atk: 400 }, mc: { hp: 3800, spd: 160, atk: 400 }, md: { hp: 3800, spd: 150, atk: 400 },
};
export const SLOTS = ['ma', 'mb', 'mc', 'md'];      // 一般敵人最多站四個位置
// 夥伴的定位（招募時顯示，也用來保證第一次招募有坦或補可以選）
export const ROLE = { kui: '輸出', jie: '輸出', kevin: '坦', mi: '補', vivi: '應援', yan: '控場', heilun: '輔助', cha: '輔助', qiang: '坦', senpai: '輸出', wu: '輔助', you: '輸出', fairy: '輔助', zong: '坦', hui: '輸出', xu: '補' };
// 敵人照上場人數縮放：[血量倍率, 攻擊倍率]
export const SCALE = { 1: [.3, .52], 2: [.52, .7], 3: [.76, .86], 4: [1, 1] };
export let BOSS_ULT = {};      // 頭目大招對每個人的傷害（進場時算好）
export const ITEMS = { tea: { name: '珍珠奶茶', n: 3, note: 'HP 回復 2000', hp: 2000 }, coffee: { name: '黑咖啡', n: 2, note: 'SP 回復 150', sp: 150 }, bento: { name: '雞排便當', n: 1, note: '倒下的同伴復活', revive: .5 } };
// 招式：只花 SP。target：foe 選一個敵人、all 敵方全體、ally 選一個同伴、party 我方全體、self 自己
// ally 的對象：hurt 受傷的人（預設）、other 自己以外、any 誰都可以、sp 自己以外 SP 沒滿的人。pierce＝無視小兵護衛與甩鍋
export const SKILLS = {
  kui: [{ key: 'draft', name: '先出一版', sp: 20, note: '單體二連斬　底氣 -2', target: 'foe', desc: '對一個敵人連砍兩刀，每一刀都削底氣。' },
    { key: 'counter', name: '這需求我擋', sp: 18, note: '減傷並反擊', target: 'self', desc: '擺好架勢：下一次受到的傷害只剩四成，並且反擊回去。' },
    { key: 'sweep', name: '全部一起改', sp: 24, note: '敵方全體', target: 'all', desc: '一刀掃過所有敵人；只剩一個敵人時變成更重的一刀。' }],
  jie: [{ key: 'burn', name: '怒火另存新檔', sp: 40, note: '單體攻擊　灼燒兩回合', target: 'foe', desc: '火焰魔法，目標接下來兩回合每回合開始再燒一次。' },
    { key: 'freeze', name: '這案子先冷凍', sp: 46, note: '單體攻擊　攻擊力下降', target: 'foe', desc: '冰住一個敵人：接下來幾次行動的傷害減三成。' },
    { key: 'barrage', name: '全部砍掉重練', sp: 40, note: '敵方全體　回 15 SP', target: 'all', desc: '暗屬性魔法轟炸所有敵人，打完回復 15 SP。' }],
  kevin: [{ key: 'taunt', name: '這個我來', sp: 16, note: '吸引攻擊　受傷減三成', target: 'self', desc: '到下次行動前，敵人的單體攻擊都打 Kevin，而且他受的傷害減三成。' }, { key: 'bash', name: '盾擊', sp: 20, note: '單體攻擊　自己進入防禦', target: 'foe', desc: '用盾牌撞一個敵人，同時擺好防禦姿勢（受傷減半）。' }],
  mi: [{ key: 'mend', name: '治癒專線', sp: 36, note: '單體回復 1500', target: 'ally', ally: 'hurt', desc: '幫一個同伴回復 1500 HP。' }, { key: 'soothe', name: '安撫話術', sp: 48, note: '全體回復 700', target: 'party', desc: '前排全員各回復 700 HP。' }],
  vivi: [{ key: 'treat', name: '老闆請客', sp: 80, note: '全員 SP ＋60', target: 'party', desc: '請大家喝飲料，前排全員回復 60 SP。' }],
  yan: [{ key: 'delay', name: '這個時程我再喬', sp: 36, note: '敵人這回合最後才動', target: 'foe', desc: '把一個敵人這回合還沒做的行動排到最後面，並小幅攻擊。' }, { key: 'lock', name: '需求先凍結', sp: 40, note: '敵方全體攻擊力下降', target: 'all', desc: '所有敵人下一次行動的傷害減三成。' }],
  heilun: [{ key: 'mark', name: '這單業績算我的', sp: 22, note: '標記　受傷增三成', target: 'foe', desc: '標記一個敵人兩回合：它受到的傷害多三成；它被打倒時氣勢 ＋20。' }, { key: 'deal', name: '先給你友情價', sp: 18, note: '單體攻擊　氣勢多 ＋15', target: 'foe', desc: '用公事包敲一個敵人，順便多賺 15 點氣勢。' }],
  cha: [{ key: 'push', name: '阿強比較會啦', sp: 26, note: '指定同伴代擋下一擊', target: 'ally', ally: 'other', desc: '下一次單體攻擊改由你指定的同伴承受，而且傷害減半。' }, { key: 'chat', name: '陪我聊一下嘛', sp: 24, note: '下一次單體攻擊落空', target: 'self', desc: '拉住敵人聊天：敵人的下一次單體攻擊會打向茶茶，並且落空。' }],
  qiang: [{ key: 'carry', name: '這個我來搬', sp: 16, note: '吸引攻擊　累積扛責', target: 'self', desc: '到下次行動前，單體攻擊都打阿強，傷害減四成；每擋一次累積一層「扛責」（最多三層）。' }, { key: 'box', name: '整箱給你', sp: 22, note: '單體重擊　底氣 -2', target: 'foe', desc: '整箱砸下去。每一層扛責讓傷害多三成，砸完扛責歸零。' }],
  senpai: [{ key: 'probe', name: '這份需求誰簽的', sp: 20, note: '單體攻擊　證據 ＋1', target: 'foe', desc: '邊打邊蒐證，累積一層「證據」（最多三層），給奧義用。' }, { key: 'expose', name: '前後說法不一致', sp: 26, note: '單體攻擊　理虧時加倍', target: 'foe', desc: '抓對方的破綻。目標正在理虧時傷害加倍，並多拿一層證據。' }],
  wu: [{ key: 'encore', name: '安可，再來一次', sp: 34, note: '同伴立刻再動一次', target: 'ally', ally: 'other', desc: '讓一位同伴馬上再行動一次。' }, { key: 'dance', name: '尾牙熱舞', sp: 40, note: '全隊攻擊力提升兩回合', target: 'party', desc: '跳一段，全隊的傷害多五成，持續兩回合。' }],
  you: [{ key: 'slack', name: '帶薪摸魚', sp: 0, note: 'SP ＋40　閃過下一擊', target: 'self', desc: '躲去茶水間：回復 40 SP，到下次行動前閃過一次攻擊。' }, { key: 'backdoor', name: '我跟總經理很熟', sp: 26, note: '單體攻擊　無視護衛', target: 'foe', pierce: true, desc: '走後門：小兵護衛和甩鍋都擋不住這一下。' }],
  fairy: [{ key: 'mice', name: '老鼠們，上工', sp: 34, note: '隨機亂咬四下', target: 'all', desc: '叫社畜老鼠出來咬人：隨機打四下。隊上每多一隻老鼠多咬一下。' }, { key: 'wand', name: '仙女棒點一下', sp: 40, note: '同伴下一擊必爆擊加倍', target: 'ally', ally: 'any', desc: '點一位同伴：他的下一擊一定爆擊，而且傷害加倍。' }],
  zong: [{ key: 'sip', name: '續命咖啡', sp: 14, note: '自己回 900 HP 並防禦', target: 'self', desc: '喝一口：回復 900 HP，並擺好防禦（受傷減半）。' }, { key: 'news', name: '報紙蓋頭', sp: 18, note: '單體攻擊　攻擊力下降', target: 'foe', desc: '用報紙捲敲下去，目標下一次行動的傷害減三成。' }],
  hui: [{ key: 'overtime', name: '今天也加班', sp: 16, note: '單體攻擊　加班 ＋1', target: 'foe', desc: '邊打邊累積「加班」（最多四層）：每一層讓灰鼠之後的傷害多兩成，整場有效。' }, { key: 'allnight', name: '爆肝', sp: 10, note: '扣自己血　單體重擊', target: 'foe', desc: '拿自己一成五的 HP 換一記重擊，削兩點底氣。' }],
  xu: [{ key: 'transfer', name: '幫您轉接', sp: 40, note: '同伴 SP ＋80', target: 'ally', ally: 'sp', desc: '把電話轉過去：一位同伴回復 80 SP。' }, { key: 'mix', name: '特調一杯', sp: 32, note: '回復 1100 並減傷', target: 'ally', ally: 'any', desc: '一位同伴回復 1100 HP，到他下次行動前受傷減半。' }],
};
// 奧義的名字與一句話（新夥伴的；原本五個人的寫在 battle.js 的 DEFS）
export const ULTS = { yan: ['會議改到下週', '敵人這回合還沒做的行動全部排到我方後面，我方這回合受到的傷害減四成。'], heilun: ['VIP 大單，今天簽', '攻擊並標記所有敵人兩回合：受到的傷害多三成。'],
  cha: ['大家都是好朋友', '到茶茶下一次行動前，全隊受到的傷害減半；並削所有敵人的底氣。'], qiang: ['一個人扛整個部門', '到阿強下一次行動前，同伴受的傷害都由他扛下一半，並對打人的敵人反擊。'], senpai: ['紀錄我都留著', '對一個敵人造成重傷害，每一層證據讓傷害大幅增加，用完證據歸零。'],
  wu: ['全場跟著我跳', '前排其他同伴這回合各再行動一次。'], you: ['這我十年前就做過', '無視小兵護衛，直接重擊頭目並大幅削底氣。'], fairy: ['午夜前的魔法', '倒下的同伴以三成 HP 站起來，其他人回復兩成 HP。'],
  zong: ['再撐一下就下班', '到下一回合結束前，全隊再怎麼被打都會留下 1 HP。'], hui: ['報表全部交出去', '公事包連砸四下，隨機打向敵人，每一下都削底氣。'], xu: ['全部門下午茶', '前排全員回復四成 HP 與 60 SP，還多一杯珍珠奶茶。'] };
// 一般敵人的種類（每一場的 kinds 指定哪個位置站誰，沒寫就是社畜小兵）。hp／atk＝相對這一場小兵基準值的倍率；spd＝行動速度（沒寫用原本的）
// drain：打中扣對方多少 SP。armor：被「普通攻擊」打到只吃這個倍率的傷害（招式、奧義照常）。heal：場上有敵人受傷時不攻擊，改成幫傷最重的回這麼多血（照人數縮放）
export const KINDS = {
  drone: { name: '社畜小兵', hp: 1, atk: 1, move: '加班連打' },
  courier: { name: '催稿信差', hp: .75, atk: .75, spd: 330, drain: 25, move: '催稿', note: '動作快，被他打中會扣 25 SP' },
  knight: { name: '公文櫃重甲兵', hp: 1.2, atk: 1.0, spd: 90, armor: .5, move: '蓋章重擊', note: '普通攻擊打他只有一半傷害，用招式或奧義' },
  intern: { name: '續命實習生', hp: .7, atk: .5, spd: 210, heal: 900, move: '遞提神飲料', note: '會幫受傷的敵人回血，先解決他' },
};
// 鏡像內戰（第二張地圖）：對面站的是自己人的鏡像。血量、攻擊照本人換算，速度一樣，特長也帶過去：
// 坦克皮厚（普攻減半）、補師幫敵人回血、小燕與黑輪打中扣 SP、阿傑一次打全體（aoe＝對每個人的傷害倍率）。
export const NAME = { kui: '小葵', jie: '阿傑', kevin: 'Kevin', mi: '小米', vivi: 'Vivi', yan: '小燕', heilun: '黑輪', cha: '茶茶', qiang: '阿強', senpai: '學姊', wu: '小蝶', you: '老油條', fairy: '鼠仙女', zong: '棕鼠', hui: '灰鼠', xu: '許許' };
const MIRROR_TRAIT = { kevin: { armor: .5, note: '跟本人一樣皮厚：普通攻擊只有一半傷害' }, qiang: { armor: .5, note: '跟本人一樣皮厚：普通攻擊只有一半傷害' }, zong: { armor: .6, note: '皮厚：普通攻擊傷害打六折' },
  mi: { heal: 1100, note: '跟本人一樣會補血，先解決' }, xu: { heal: 900, note: '跟本人一樣會補血，先解決' }, fairy: { heal: 900, note: '會幫敵人回血，先解決' },
  yan: { drain: 30, note: '打中會扣 30 SP' }, heilun: { drain: 20, note: '打中會扣 20 SP' }, jie: { aoe: .55, note: '跟本人一樣，一次打全體' } };
for (const id of ALL) if (id !== 'vivi') KINDS['m_' + id] = { hero: id, name: '鏡像' + NAME[id], hp: Math.max(.75, Math.min(1.5, STAT[id].hp / 2600)), atk: Math.max(.7, STAT[id].atk / 1150), spd: STAT[id].spd, move: SKILLS[id][0].name, ...MIRROR_TRAIT[id] };
// 氣勢：起始值、放奧義要多少、各種行動加多少
export const MO = { start: 30, max: 100, ult: 40, attack: 14, skill: 14, defend: 16, item: 6, cheer: 35 };
// 戰鬥的種類。boss：這一場的頭目（沒有就是純小兵戰）；guard＝小兵在場時無敵；pot＝每回合第一次被打甩給小兵；ult＝大招傷害的基準；text＝招式名
export const STAGES = {
  intro: { name: '遲到的社畜', sub: '第一天上班', minions: ['ma', 'mb'], minion: { hp: 3400, atk: 330 }, boss: null },
  crowd: { name: '加班大隊', sub: '人越來越多了', minions: ['ma', 'mb', 'mc'], kinds: { mc: 'courier' }, minion: { hp: 4200, atk: 340 }, boss: null },
  night: { name: '夜班大隊', sub: '燈還亮著', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'knight', mc: 'intern' }, minion: { hp: 5600, atk: 430 }, boss: null },
  chief: { name: '甩鍋課長', sub: '這不是我的問題', minions: ['ma', 'mb'], minion: { hp: 3000, atk: 360 },
    boss: { id: 'chief', name: '甩鍋課長', hp: 45000, spd: 200, spd2: 0, atk: 950, shield: 5, cycle: 4, guard: false, pot: true, ult: 900, text: { charge: '蓄力　這不是我的問題', atk: '甩鍋', ult: '奧義　全體背鍋', summon: '召喚　找人背鍋' } } },
  // 菁英：沒有護衛也不甩鍋，但是大招會把氣勢扣掉（moDrain），身邊帶一個催稿的、一個會補血的
  audit: { name: '考績魔導士', sub: '請進，把門帶上', minions: ['ma', 'mb'], kinds: { ma: 'courier', mb: 'intern' }, minion: { hp: 4200, atk: 380 },
    boss: { id: 'audit', name: '考績魔導士', hp: 34000, spd: 230, spd2: 0, atk: 900, shield: 6, cycle: 4, guard: false, pot: false, ult: 900, moDrain: 40, text: { charge: '蓄力　年度考核', atk: '紅筆退件', ult: '奧義　考績丙等', summon: '召喚　找人來補件' } } },
  // ---- 鏡像內戰的關卡：hero＝這個頭目長得像誰（畫面拿那個夥伴的圖翻過來用） ----
  m1: { name: '鏡子裡的同事', sub: '那不是我嗎', minions: ['ma', 'mb'], kinds: { ma: 'm_heilun', mb: 'm_cha' }, minion: { hp: 4000, atk: 400 }, boss: null },
  m2: { name: '鏡像加班', sub: '連加班的樣子都一樣', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'm_qiang', mb: 'm_yan', mc: 'm_xu' }, minion: { hp: 4600, atk: 420 }, boss: null },
  m3: { name: '鏡像夜班', sub: '對面也還沒下班', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'm_zong', mb: 'm_senpai', mc: 'm_wu' }, minion: { hp: 5600, atk: 470 }, boss: null },
  m_kevin: { name: '鏡像 Kevin', sub: '這個，用 AI 擋就好了', minions: ['ma', 'mb'], kinds: { ma: 'm_you', mb: 'm_mi' }, minion: { hp: 3600, atk: 420 },
    boss: { id: 'm_kevin', hero: 'kevin', name: '鏡像 Kevin', hp: 58000, spd: 150, spd2: 0, atk: 1000, shield: 9, cycle: 4, guard: false, pot: false, ult: 1000, text: { charge: '蓄力　鐵壁展開', atk: '盾擊', ult: '奧義　用 AI 壓過去', summon: '召喚　叫鏡像來擋' } } },
  m_fairy: { name: '鏡像鼠仙女', sub: '午夜之前，都給我趴下', minions: ['ma', 'mb'], kinds: { ma: 'm_zong', mb: 'm_hui' }, minion: { hp: 4400, atk: 450 },
    boss: { id: 'm_fairy', hero: 'fairy', name: '鏡像鼠仙女', hp: 42000, spd: 270, spd2: 0, atk: 1000, shield: 6, cycle: 4, guard: false, pot: false, ult: 1050, moDrain: 40, text: { charge: '蓄力　午夜的鐘聲', atk: '仙女棒敲頭', ult: '奧義　魔法失效', summon: '召喚　老鼠們，上工' } } },
  m_vivi: { name: '鏡像 Vivi', sub: '全員，不准下班', minions: ['ma', 'mb', 'mc', 'md'], kinds: { ma: 'm_jie', mb: 'm_kui', mc: 'random', md: 'random' }, minion: { hp: 4000, atk: 430 },      // 阿傑、小葵之外，每次再隨機來兩位鏡像同事
    boss: { id: 'm_vivi', hero: 'vivi', name: '鏡像 Vivi', hp: 74000, spd: 210, spd2: 0, atk: 1250, shield: 8, cycle: 4, guard: true, pot: false, ult: 1400, text: { charge: '蓄力　皇家敕令', atk: '權杖制裁', ult: '奧義　全員不准下班', summon: '召喚　阿傑、小葵，回來' } } },
  boss: { name: '奧客總經理', sub: '我要找你們主管', minions: ['ma', 'mb'], minion: { hp: 3800, atk: 400 },
    boss: { id: 'boss', name: '奧客總經理', hp: 61000, spd: 200, spd2: 0, atk: 1100, shield: 8, cycle: 5, guard: true, pot: false, ult: 1100, text: { charge: '蓄力　再改一版！', atk: '退件重擊', ult: '奧義　無限改稿', summon: '召喚　加班大隊' } } },
};
// 肉鴿路線（行程表）：一層一站，有兩個選項的那一層要選一邊走。
// type：battle 戰鬥（打贏三選一強化）、rest 茶水間、gift 福委會（直接三選一）、recruit 招募（三個人選一個）、event 事件（EVENTS 抽一個，選一個選項）。rescue＝打贏救出一個夥伴。bonus＝打贏多拿的道具。
// 兩張地圖：office＝一般行程（討伐奧客總經理）；mirror＝鏡像內戰（很難，對面是自己人的鏡像，最後是鏡像 Vivi 帶著阿傑、小葵）。
// 兩張的站數與岔路形狀一樣（畫面上鏡像地圖是把藍圖左右翻過來），招募、事件、休息都照舊。MAP＝現在這一輪用的那一張（newRun／loadRun 會切）
export const MAPS = { office: [
  [{ type: 'battle', stage: 'intro', tag: '戰鬥', icon: 'battle' }],
  [{ type: 'recruit', name: '新人報到', tag: '招募', icon: 'recruit', sub: '三位同事選一位同行' }],
  [{ type: 'battle', stage: 'crowd', tag: '戰鬥', icon: 'battle' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'night', tag: '救援', icon: 'rescue', rescue: true, sub: '打贏救出一位夥伴' }],
  [{ type: 'event', name: '走廊轉角', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'battle', stage: 'chief', tag: '頭目', icon: 'chief' }],
  [{ type: 'gift', name: '福委會', tag: '福利', icon: 'gift', sub: '直接三選一強化' }, { type: 'recruit', name: '獵頭公司', tag: '招募', icon: 'hunt', sub: '三位同事選一位同行' }],
  [{ type: 'event', name: '樓梯間', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'audit', tag: '菁英', icon: 'elite', bonus: { tea: 1, coffee: 1, bento: 1 }, sub: '打贏多拿奶茶、咖啡、便當各一' }],
  [{ type: 'battle', stage: 'boss', tag: '魔王', icon: 'boss' }],
],
  mirror: [
  [{ type: 'battle', stage: 'm1', tag: '戰鬥', icon: 'battle' }],
  [{ type: 'recruit', name: '新人報到', tag: '招募', icon: 'recruit', sub: '三位同事選一位同行' }],
  [{ type: 'battle', stage: 'm2', tag: '戰鬥', icon: 'battle' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'm3', tag: '救援', icon: 'rescue', rescue: true, sub: '打贏救出一位夥伴' }],
  [{ type: 'event', name: '走廊轉角', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'battle', stage: 'm_kevin', tag: '頭目', icon: 'chief' }],
  [{ type: 'gift', name: '福委會', tag: '福利', icon: 'gift', sub: '直接三選一強化' }, { type: 'recruit', name: '獵頭公司', tag: '招募', icon: 'hunt', sub: '三位同事選一位同行' }],
  [{ type: 'event', name: '樓梯間', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'm_fairy', tag: '菁英', icon: 'elite', bonus: { tea: 1, coffee: 1, bento: 1 }, sub: '打贏多拿奶茶、咖啡、便當各一' }],
  [{ type: 'battle', stage: 'm_vivi', tag: '魔王', icon: 'boss' }],
] };
export let MAP = MAPS.office;
export const useMap = key => { MAP = MAPS[key] || MAPS.office; return MAP; };
export const nodeName = nd => nd.name || STAGES[nd.stage].name;
// 過關強化（三選一）
export const UPGRADES = {
  raise: { name: '加薪', desc: '全員攻擊力 ＋15%' }, leave: { name: '特休', desc: '全員 HP 上限 ＋20%，並且補滿' }, chair: { name: '人體工學椅', desc: '受到的傷害 －15%' },
  drinks: { name: '手搖飲團購', desc: '珍珠奶茶 ＋2' }, coffee: { name: '新咖啡機', desc: '黑咖啡 ＋2，全員 SP 補滿' }, morale: { name: '士氣大振', desc: '每場戰鬥開始時氣勢 ＋30' }, bento: { name: '加菜金', desc: '雞排便當 ＋1' },
  learn: { name: '在職進修', desc: '主角學會一個還不會的招式，自己挑' },
  // 流派強化：跟夥伴的招式互動。need＝隊上有其中一個人才會出現；once＝只能拿一次
  ember: { name: '火上加油', desc: '灼燒傷害 ＋60%，多燒一回合', need: ['jie'], once: true },
  bounty: { name: '業績獎金', desc: '被標記的敵人倒下時，全員 SP ＋25', need: ['heilun'], once: true },
  riposte: { name: '以牙還牙', desc: '反擊的傷害 ＋80%', need: ['kui', 'qiang'], once: true },
  dossier: { name: '存證信函', desc: '每場戰鬥開始就有 2 層證據', need: ['senpai'], once: true },
  crunch: { name: '責任制', desc: '每場戰鬥開始就有 2 層加班', need: ['hui'], once: true },
  tempo: { name: '準時開會', desc: '每回合開始時氣勢 ＋8', once: true },
  weakpoint: { name: '抓語病', desc: '頭目理虧時受到的傷害，從 1.5 倍變成 2 倍', once: true },
  firstaid: { name: '急救箱', desc: '每場戰鬥第一次有人要倒下時，改成留下三成 HP', once: true },
};
const BASE = JSON.parse(JSON.stringify(STAT));
// 事件站：到那一層時抽一個（prepare 抽好記在 run.events[樓層]，重開遊戲還是同一個）。每個選項把代價與好處寫在 lines 給玩家看；
// ok(run)＝現在選不選得了（沒寫就是一定可以）；go(run) 真的套用，回傳一句結果。kind 給模擬用：heal 補血、buff 永久加成、item 拿道具。
const crew = run => run.roster.filter(id => id !== 'vivi');
const hpAll = (run, k) => { for (const id of crew(run)) run.hp[id] = Math.max(1, Math.min(STAT[id].hp, run.hp[id] + Math.round(STAT[id].hp * k))); };
const spAll = (run, k) => { for (const id of run.roster) run.sp[id] = Math.max(0, Math.min(STAT[id].sp, run.sp[id] + Math.round(STAT[id].sp * k))); };
export const EVENTS = {
  lift: { name: '電梯故障', text: '電梯卡在兩層樓中間，門上貼著「維修中，預計完成時間：未定」。', opts: [
    { label: '爬樓梯', icon: 'up_raise', kind: 'buff', lines: ['全員 HP －15%', '全員攻擊力 ＋8%'], go: run => { hpAll(run, -.15); run.atk *= 1.08; return '爬了十二層樓，腿很痠，但是火氣上來了'; } },
    { label: '等維修', icon: 'clock', kind: 'rest', lines: ['全員 SP 補滿', '珍珠奶茶 －1（等太久喝掉了）'], ok: run => run.items.tea > 0, go: run => { spAll(run, 1); run.items.tea--; return '等了四十分鐘，奶茶喝完了，精神倒是補回來了'; } }] },
  box: { name: '匿名意見箱', text: '茶水間門口多了一個意見箱，旁邊寫著「歡迎暢所欲言（本箱完全匿名）」。箱子沒有鎖。', opts: [
    { label: '認真寫一張', icon: 'up_morale', kind: 'buff', lines: ['每場戰鬥開始時氣勢 ＋15'], go: run => { run.moStart += 15; return '把想講的都寫下來，心情好多了'; } },
    { label: '偷看別人寫的', icon: 'up_coffee', kind: 'item', lines: ['黑咖啡 ＋1', '全員 HP －10%（被抓到，罰站）'], go: run => { run.items.coffee++; hpAll(run, -.1); return '裡面夾著一張咖啡兌換券。然後就被人資看到了'; } }] },
  raffle: { name: '尾牙抽獎', text: '福委會提早辦抽獎，你手上剛好有一張獎券。頭獎是雞排便當。', opts: [
    { label: '抽！', icon: 'gift', kind: 'item', lines: ['四成：雞排便當 ＋1', '三成五：珍珠奶茶 ＋2', '兩成五：銘謝惠顧'], go: run => { const r = run.rand(); if (r < .4) { run.items.bento++; return '中了頭獎：雞排便當一個'; } if (r < .75) { run.items.tea += 2; return '中了參加獎：珍珠奶茶兩杯'; } return '銘謝惠顧。明年請早'; } },
    { label: '把獎券讓給同事', icon: 'up_leave', kind: 'heal', lines: ['全員 HP 回復 30%'], go: run => { hpAll(run, .3); return '同事中獎請大家吃點心，全隊都吃飽了'; } }] },
  chat: { name: '主管請喝咖啡', text: '別部門的主管端著兩杯咖啡走過來：「有空嗎？聊個五分鐘就好。」', opts: [
    { label: '陪聊半小時', icon: 'up_coffee', kind: 'item', lines: ['黑咖啡 ＋2', '全員 SP －30%（聽到耳朵長繭）'], go: run => { run.items.coffee += 2; spAll(run, -.3); return '五分鐘聊了半小時，咖啡倒是拿了兩杯'; } },
    { label: '說還有事先走', icon: 'up_chair', kind: 'buff', lines: ['受到的傷害 －6%'], go: run => { run.def *= .94; return '練習了一次拒絕，之後比較不怕被唸了'; } }] },
  meal: { name: '加班便當', text: '會議室桌上有一疊沒人領的加班便當，還是熱的。', opts: [
    { label: '現在吃掉', icon: 'up_leave', kind: 'heal', lines: ['全員 HP 回復 50%'], go: run => { hpAll(run, .5); return '全隊吃了一頓熱的，力氣回來了'; } },
    { label: '留著當存糧', icon: 'up_bento', kind: 'item', lines: ['雞排便當 ＋1'], go: run => { run.items.bento++; return '多帶了一個便當上路'; } }] },
  jam: { name: '影印機卡紙', text: '影印機卡紙，螢幕上的錯誤代碼沒有人看得懂。後面已經排了五個人。', opts: [
    { label: '自己修', icon: 'up_learn', kind: 'buff', lines: ['主角 HP －25%（手被夾到）', '主角學會一個還不會的招式；都會了就攻擊力 ＋6%'], go: run => { const id = run.starter || run.roster[0]; run.hp[id] = Math.max(1, run.hp[id] - Math.round(STAT[id].hp * .25)); const u = unlearned(run); if (u.length) { run.skills[run.starter].push(u[0]); return `修好了，還順便悟出一招「${SKILLS[run.starter].find(k => k.key === u[0]).name}」`; } run.atk *= 1.06; return '修好了。原來只是紙放反'; } },
    { label: '交給總務', icon: 'rest', kind: 'rest', lines: ['全員 SP 回復 50%（等的時候休息一下）'], go: run => { spAll(run, .5); return '總務十分鐘就修好了，大家趁機休息'; } }] },
};
Object.assign(EVENTS, {
  mentor: { name: '帶新人', text: '人資把一個新人帶到你面前：「他今天報到，先跟著你們。」新人手上只有一本空白筆記本。', opts: [
    { label: '認真教', icon: 'up_raise', kind: 'buff', lines: ['全員 SP －40%（講到口乾舌燥）', '全員攻擊力 ＋7%'], go: run => { spAll(run, -.4); run.atk *= 1.07; return '教了一輪，自己的觀念也順了一遍'; } },
    { label: '丟一疊文件給他', icon: 'up_coffee', kind: 'item', lines: ['黑咖啡 ＋1（新人買來孝敬的）'], go: run => { run.items.coffee++; return '新人看不懂，只好跑去買咖啡請大家'; } }] },
  checkup: { name: '年度健檢', text: '健檢車停在樓下，廣播第三次唸到你們部門的名字。', opts: [
    { label: '乖乖去做', icon: 'up_leave', kind: 'heal', lines: ['全員 HP 補滿', '珍珠奶茶 －1（醫生說少喝含糖飲料）'], ok: run => run.items.tea > 0, go: run => { hpAll(run, 1); run.items.tea--; return '抽血、量血壓、被唸了一頓。身體倒是調回來了'; } },
    { label: '翹掉去補眠', icon: 'rest', kind: 'rest', lines: ['全員 SP 補滿'], go: run => { spAll(run, 1); return '在會議室角落睡了二十分鐘，神清氣爽'; } }] },
  groupbuy: { name: '辦公室團購', text: '群組跳出訊息：「珍奶買十送二，還差三杯成團！」', opts: [
    { label: '跟團', icon: 'up_drinks', kind: 'item', lines: ['珍珠奶茶 ＋2', '全員 HP －8%（下樓搬貨）'], go: run => { run.items.tea += 2; hpAll(run, -.08); return '搬了三箱上樓，換到兩杯'; } },
    { label: '當主揪', icon: 'up_bento', kind: 'item', lines: ['雞排便當 ＋1（店家送的）', '全員 SP －25%（對帳對到眼花）'], go: run => { run.items.bento++; spAll(run, -.25); return '收錢、對帳、分飲料。店家多送一個便當'; } }] },
  drill: { name: '消防演習', text: '警鈴響了。廣播說：「這是演習，請各樓層依序從安全梯疏散。」', opts: [
    { label: '認真跑完', icon: 'up_chair', kind: 'buff', lines: ['全員 HP －12%', '受到的傷害 －7%'], go: run => { hpAll(run, -.12); run.def *= .93; return '跑了十二層樓。至少現在知道怎麼護住頭了'; } },
    { label: '躲在廁所', icon: 'rest', kind: 'rest', lines: ['全員 SP 回復 40%'], go: run => { spAll(run, .4); return '安靜的二十分鐘，沒有人找'; } }] },
  letter: { name: '老闆的勉勵信', text: '全公司都收到一封主旨是「致每一位夥伴」的長信，一共三千字。', opts: [
    { label: '讀完還回信', icon: 'up_morale', kind: 'buff', lines: ['每場戰鬥開始時氣勢 ＋12'], go: run => { run.moStart += 12; return '居然有一段寫得還不錯'; } },
    { label: '已讀不回', icon: 'up_leave', kind: 'heal', lines: ['全員 HP 回復 25%（省下來的時間拿去休息）'], go: run => { hpAll(run, .25); return '標成已讀，去泡了一杯茶'; } }] },
  lost: { name: '失物招領', text: '影印機旁邊有一個沒寫名字的紙袋，裡面好像是飲料。', opts: [
    { label: '送去櫃檯', icon: 'up_raise', kind: 'buff', lines: ['全員攻擊力 ＋5%（做了好事，心情好）'], go: run => { run.atk *= 1.05; return '失主剛好在櫃檯，連聲道謝'; } },
    { label: '自己留著', icon: 'gift', kind: 'item', lines: ['一半機會：黑咖啡 ＋2', '一半機會：珍珠奶茶 ＋2'], go: run => { if (run.rand() < .5) { run.items.coffee += 2; return '是兩杯黑咖啡'; } run.items.tea += 2; return '是兩杯珍珠奶茶'; } }] },
});
export const eventOk = (run, key, i) => { const o = EVENTS[key] && EVENTS[key].opts[i]; return !!o && (!o.ok || o.ok(run)); };
export function applyEvent(run, key, i) { return eventOk(run, key, i) ? EVENTS[key].opts[i].go(run) : null; }
export const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---------- 一輪遊戲的進度 ----------
// starter：開局選的人；skill：三選一的招式。沒給就用舊的五人隊（影片與舊測試用）。
export function newRun(rand = Math.random, starter = null, skill = null, map = 'office') {
  for (const id in BASE) Object.assign(STAT[id], BASE[id]); useMap(map);
  const run = { rand, map: MAPS[map] ? map : 'office', floor: 0, node: MAP[0][0], path: [], offers: {}, events: {}, atk: 1, def: 1, moStart: MO.start, items: {}, hp: {}, sp: {}, skills: {}, roster: [], starter, picks: [], rounds: 0, summons: 0 };
  for (const k in ITEMS) run.items[k] = ITEMS[k].n;
  if (starter) { join(run, starter); run.skills[starter] = [skill || SKILLS[starter][0].key]; } else for (const id of ['kui', 'kevin', 'jie', 'mi', 'vivi']) join(run, id);
  return run;
}
// 加入名冊（滿血滿 SP、會全部招式）
export function join(run, id) { if (run.roster.includes(id) || run.roster.length >= 6) return false; run.roster.push(id); run.hp[id] = STAT[id].hp; run.sp[id] = STAT[id].sp; run.skills[id] = SKILLS[id].map(k => k.key); return true; }
// 上場的人：名冊前四個（至少要有一個不是 Vivi 的人）
export function active(run) { const a = run.roster.slice(0, 4); if (!a.some(id => id !== 'vivi')) { const f = run.roster.find(id => id !== 'vivi'); if (f) a[a.length - 1] = f; } return a; }
// 名冊裡把第 i 個往前（d=-1）或往後（d=1）移
export function reorder(run, i, d) { const j = i + d; if (j < 0 || j >= run.roster.length) return false; [run.roster[i], run.roster[j]] = [run.roster[j], run.roster[i]]; return true; }
export const enterNode = (run, i) => { run.node = MAP[run.floor][i]; run.path[run.floor] = i; return run.node; };
export const isFinal = run => run.floor >= MAP.length - 1;
// 這一層的站有沒有要先決定的人選（招募的兩個候選、救援戰救誰）；到這一層時抽好，玩家選之前就看得到
export function prepare(run) { const fl = MAP[run.floor]; if (!fl || run.offers[run.floor]) return; const o = run.offers[run.floor] = {};
  if (fl.some(nd => nd.type === 'event') && !run.events[run.floor]) { const used = Object.values(run.events), pool = Object.keys(EVENTS).filter(k => !used.includes(k)); run.events[run.floor] = pool[Math.floor(run.rand() * pool.length)]; }
  const pool = () => { const p = ALL.filter(id => !run.roster.includes(id) && !Object.values(o).flat().includes(id)); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(run.rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; };
  fl.forEach((nd, k) => { if (run.roster.length >= 6) return;
    if (nd.type === 'recruit') { const p = pool(), needs = !run.roster.some(id => ROLE[id] === '坦' || ROLE[id] === '補'), first = needs ? p.find(id => ROLE[id] === '坦' || ROLE[id] === '補') : p[0], second = p.find(id => id !== first && (!needs || ROLE[id] !== ROLE[first])); o[k] = [first, second, p.find(id => id !== first && id !== second)].filter(Boolean); }      // 招募盡量三選一（人不夠就少一點）
    else if (nd.rescue) { const p = pool(); if (p.length) o[k] = [p[0]]; } }); }
export const advance = run => { run.floor++; prepare(run); return run; };
// 打贏一場：把血和道具帶走，血補兩成五（倒下的人從兩成五站起來）、SP 補三成；救援戰救出的人加入（回傳他的名字代號）
export function endStage(s, run) { for (const id of HEROES) { run.hp[id] = Math.min(STAT[id].hp, Math.max(0, s.hp[id]) + Math.round(STAT[id].hp * .25)); run.sp[id] = Math.min(STAT[id].sp, s.sp[id] + Math.round(STAT[id].sp * .3)); }
  run.items = { ...s.items }; for (const k in run.node.bonus || {}) run.items[k] += run.node.bonus[k]; run.rounds += s.round; run.summons += s.summons;
  const who = run.node.rescue && (run.offers[run.floor] || {})[run.path[run.floor]]; return who && join(run, who[0]) ? who[0] : null; }
// 茶水間：HP 回復一半、SP 補滿（名冊全員，候補也算）。回傳總共補了多少血
export function rest(run) { let sum = 0; for (const id of run.roster) { if (id !== 'vivi') { const v = Math.min(STAT[id].hp - run.hp[id], Math.round(STAT[id].hp * .5)); run.hp[id] += v; sum += v; } run.sp[id] = STAT[id].sp; } return sum; }
export const unlearned = run => run.starter ? SKILLS[run.starter].map(k => k.key).filter(k => !run.skills[run.starter].includes(k)) : [];
export function offerUpgrades(run) { const pool = Object.keys(UPGRADES).filter(k => { const U = UPGRADES[k]; return !(k === 'morale' && run.picks.includes('morale')) && !(k === 'learn' && !unlearned(run).length) && !(U.once && run.picks.includes(k)) && !(U.need && !U.need.some(id => run.roster.includes(id))); }); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(run.rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } return pool.slice(0, 3); }
// opt：在職進修要學哪一招（沒給就學排在最前面那個還不會的）
export function applyUpgrade(run, key, opt) { run.picks.push(key);
  if (key === 'raise') run.atk *= 1.15; else if (key === 'chair') run.def *= .85; else if (key === 'morale') run.moStart += 30; else if (key === 'drinks') run.items.tea += 2; else if (key === 'bento') run.items.bento += 1;
  else if (key === 'coffee') { run.items.coffee += 2; for (const id of run.roster) run.sp[id] = STAT[id].sp; }
  else if (key === 'learn') { const u = unlearned(run); if (u.length) run.skills[run.starter].push(u.includes(opt) ? opt : u[0]); }
  else if (key === 'leave') { for (const id of ALL) if (id !== 'vivi') STAT[id].hp = Math.round(STAT[id].hp * 1.2); for (const id of run.roster) run.hp[id] = STAT[id].hp; } }

// ---------- 存檔：站與站之間的進度（戰鬥打到一半不存，重開會回到進站前） ----------
// SAVE_V＝存檔格式的版本。格式有變就加一，並在 MIGRATE[舊版號] 放一個把舊資料改成下一版的函式；
// 沒有對應的轉換、或轉完檢查不過，loadRun 回傳 null（存檔作廢，不會帶著壞資料進遊戲）。
export const SAVE_V = 3;
// 1→2：行程表在第 5 站插了一層事件站，後面的樓層編號都往後一格
// 2→3：第 8 站又插了一層事件站「樓梯間」
const insertFloor = K => d => { const sh = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [+k >= K ? +k + 1 : +k, v])); if (d.floor >= K) { d.floor++; d.path.splice(K, 0, 0); } d.offers = sh(d.offers); d.events = sh(d.events); return d; };
const MIGRATE = { 1: insertFloor(4), 2: insertFloor(7) };
export function saveRun(run, extra = {}) { const { rand, node, ...d } = run; return { v: SAVE_V, ...JSON.parse(JSON.stringify(d)), ...extra }; }
export function loadRun(data, rand = Math.random) {
  try {
    let d = JSON.parse(JSON.stringify(data)); if (!d || !Number.isInteger(d.v) || d.v < 1 || d.v > SAVE_V) return null;
    while (d.v < SAVE_V) { const f = MIGRATE[d.v]; if (!f) return null; d = f(d); d.v++; }
    const num = x => typeof x === 'number' && Number.isFinite(x), ok = c => { if (!c) throw new Error('bad save'); };
    const mp = d.map ?? 'office'; ok(MAPS[mp]); useMap(mp);
    ok(Number.isInteger(d.floor) && d.floor >= 0 && d.floor < MAP.length);
    ok(Array.isArray(d.roster) && d.roster.length >= 1 && d.roster.length <= 6 && new Set(d.roster).size === d.roster.length && d.roster.every(id => ALL.includes(id)));
    ok(d.starter == null || d.roster.includes(d.starter)); ok(Array.isArray(d.picks) && d.picks.every(k => UPGRADES[k]));
    ok(Array.isArray(d.path) && d.path.length <= MAP.length); for (let k = 0; k < d.floor; k++) ok(Number.isInteger(d.path[k]) && MAP[k][d.path[k]]);
    ok(d.pend == null || (d.pend === 'upgrade' && Number.isInteger(d.path[d.floor]) && MAP[d.floor][d.path[d.floor]] && d.floor < MAP.length - 1));
    ok(d.rescued == null || d.roster.includes(d.rescued));
    ok([d.atk, d.def, d.moStart, d.rounds, d.summons].every(num) && d.atk > 0 && d.def > 0);
    ok(d.items && Object.keys(ITEMS).every(k => num(d.items[k]) && d.items[k] >= 0));
    ok(d.offers && typeof d.offers === 'object' && Object.values(d.offers).every(o => o && Object.values(o).every(l => Array.isArray(l) && l.every(id => ALL.includes(id)))));
    ok(d.events && typeof d.events === 'object' && Object.values(d.events).every(k => EVENTS[k]));
    const run = newRun(rand, d.roster[0], null, mp);      // newRun 會把 STAT 還原成基本值；「特休」強化改過的 HP 上限照拿過的次數重算
    for (const k of d.picks) if (k === 'leave') for (const id of ALL) if (id !== 'vivi') STAT[id].hp = Math.round(STAT[id].hp * 1.2);
    run.hp = {}; run.sp = {}; run.skills = {};
    for (const id of d.roster) { ok(num(d.hp?.[id]) && num(d.sp?.[id]) && Array.isArray(d.skills?.[id]) && d.skills[id].length >= 1 && d.skills[id].every(k => SKILLS[id].some(s => s.key === k)));
      run.hp[id] = Math.max(0, Math.min(STAT[id].hp, d.hp[id])); run.sp[id] = Math.max(0, Math.min(STAT[id].sp, d.sp[id])); run.skills[id] = d.skills[id].slice(); }
    Object.assign(run, { floor: d.floor, path: d.path.slice(), offers: d.offers, events: { ...d.events }, atk: d.atk, def: d.def, moStart: d.moStart, items: Object.fromEntries(Object.keys(ITEMS).map(k => [k, d.items[k]])), roster: d.roster.slice(), starter: d.starter ?? null, picks: d.picks.slice(), rounds: d.rounds, summons: d.summons });
    run.node = MAP[d.floor][d.pend ? d.path[d.floor] : 0]; prepare(run);
    return { run, pend: d.pend || null, rescued: d.rescued || null };
  } catch (e) { return null; }
}

// ---------- 一場戰鬥 ----------
export function newState(run = newRun()) {
  if (typeof run === 'function') { run = newRun(run); run.floor = MAP.length - 1; run.node = MAP[run.floor][0]; }      // 舊用法 newState(rand)：五人隊直接打魔王
  const st = STAGES[run.node.stage], rand = run.rand, act = active(run); HEROES.length = 0; HEROES.push(...act); FRONT.length = 0; FRONT.push(...act.filter(id => id !== 'vivi'));
  const [hk, ak] = SCALE[Math.min(4, HEROES.length)], sc = (v, k) => Math.round(v * k);
  const kind = {}, spare = Object.keys(KINDS).filter(k => KINDS[k].hero && !Object.values(st.kinds || {}).includes(k)); MINIONS.length = 0; MINIONS.push(...st.minions);
  for (const m of SLOTS) { const want = (st.kinds || {})[m]; kind[m] = want === 'random' ? spare.splice(Math.floor(rand() * spare.length), 1)[0] : want || 'drone'; const K = KINDS[kind[m]]; Object.assign(STAT[m], { hp: sc(st.minion.hp * K.hp, hk), atk: sc(st.minion.atk * K.atk, ak), spd: K.spd || BASE[m].spd }); }
  BOSS_ULT = {}; if (st.boss) { Object.assign(STAT.boss, st.boss, { hp: sc(st.boss.hp, hk), atk: sc(st.boss.atk, ak) }); for (const id of FRONT) BOSS_ULT[id] = sc(st.boss.ult * (.82 + .18 * STAT[id].hp / 2680), ak); }
  const s = { run, kind, hk, L: st.boss, hasBoss: !!st.boss, potUsed: false, rand, hp: {}, sp: {}, mo: run.moStart, defend: {}, items: { ...run.items }, round: 0, queue: [], events: [], shield: st.boss ? st.boss.shield : 0, broken: false, charging: false, bossTurns: 0,
    aegis: false, taunt: false, carry: false, duty: 0, bulwark: false, cover: null, dodge: false, counter: {}, meeting: false, friends: false, evidence: run.picks.includes('dossier') ? 2 : 0, aidUsed: false, burn: {}, mark: {}, atkDown: {}, atkUp: 0, evade: {}, bless: {}, endure: 0, overtime: run.picks.includes('crunch') ? 2 : 0, fairyBuff: act.includes('fairy'), summons: 0, over: null };
  for (const id of HEROES) { s.hp[id] = run.hp[id]; s.sp[id] = run.sp[id]; }
  s.hp.boss = st.boss ? STAT.boss.hp : 0; for (const m of SLOTS) s.hp[m] = MINIONS.includes(m) ? STAT[m].hp : 0;
  return s;
}
export const alive = (s, id) => s.hp[id] > 0;
const has = (s, k) => s.run.picks.includes(k);      // 這一輪有沒有拿某個強化
export const guarded = s => !!(s.L && s.L.guard) && MINIONS.some(id => alive(s, id));
export const foes = s => ['boss', ...MINIONS].filter(id => alive(s, id));
export const knows = (s, id, key) => (s.run.skills[id] || []).includes(key);
const vary = (s, v, k = .08) => Math.round(v * (1 - k + s.rand() * 2 * k));
const check = s => { if (s.hasBoss ? s.hp.boss <= 0 : MINIONS.every(m => !alive(s, m))) s.over = 'win'; else if (FRONT.every(id => !alive(s, id))) s.over = 'lose'; };
const gain = (s, n) => { s.mo = Math.max(0, Math.min(MO.max, s.mo + n)); return s.mo; };

// 排這一回合的行動順序（頭目可能一回合動兩次）。回合開始時結算灼燒，結果放在 s.events 給畫面演
export function startRound(s) { s.round++; s.potUsed = false; s.meeting = false; if (s.atkUp > 0) s.atkUp--; if (s.endure > 0) s.endure--; s.events = [];
  if (has(s, 'tempo')) s.events.push({ kind: 'tempo', mo: gain(s, 8) });
  for (const f in s.burn) if (s.burn[f] > 0 && alive(s, f)) { s.burn[f]--; const v = Math.round(520 * s.run.atk * (has(s, 'ember') ? 1.6 : 1)); s.hp[f] = Math.max(0, s.hp[f] - v); s.events.push({ kind: 'burn', dst: f, v, hp: s.hp[f], kill: s.hp[f] <= 0 }); check(s); }
  for (const f in s.mark) if (s.mark[f] > 0) s.mark[f]--;
  const list = [...HEROES, 'boss', ...MINIONS].filter(id => alive(s, id)).map(id => [id, STAT[id].spd]); if (alive(s, 'boss') && STAT.boss.spd2) list.push(['boss', STAT.boss.spd2]);
  s.queue = list.sort((a, b) => b[1] - a[1]).map(x => x[0]); return s.queue; }
// 輪到某個人（回傳 false＝這個人已經倒了，跳過）。自己身上「到下次行動前」的效果在這裡結束
export function beginTurn(s, id) {
  if (!alive(s, id)) return false;
  if (HEROES.includes(id)) { s.defend[id] = false; s.counter[id] = false; if (id === 'kevin') { s.aegis = false; s.taunt = false; } if (id === 'qiang') { s.carry = false; s.bulwark = false; } if (id === 'cha') s.friends = false; s.evade[id] = false; }
  return true;
}
export const canUlt = (s, id) => s.mo >= MO.ult && s.sp[id] >= STAT[id].cost;

// 打敵人：回傳一筆結果 { dst, v, guard, crit, kill, brk, hp, shield, pot }
function hitFoe(s, src, dst, base, o = {}) {
  if (!alive(s, dst)) return null;
  if (dst === 'boss' && guarded(s) && !o.pierce) return { src, dst, v: 0, guard: true, hp: s.hp.boss, shield: s.shield };
  if (dst === 'boss' && s.L.pot && !s.potUsed && !o.pierce) { const m = MINIONS.find(x => alive(s, x)); if (m) { s.potUsed = true; return { ...hitFoe(s, src, m, base, o), pot: true }; } }      // 甩鍋：這回合第一下由小兵背
  const bl = !!s.bless[src]; if (bl) s.bless[src] = false; const crit = bl || (!o.noCrit && s.rand() < .12); let v = vary(s, base) * s.run.atk * (s.atkUp > 0 ? 1.5 : 1) * (crit ? (bl ? 2 : 1.5) : 1) * (src === 'hui' ? 1 + .2 * s.overtime : 1) * (s.fairyBuff && (src === 'zong' || src === 'hui') ? 1.2 : 1) * (dst === 'boss' && s.broken ? (has(s, 'weakpoint') ? 2 : 1.5) : 1) * (s.mark[dst] > 0 ? 1.3 : 1); const armor = o.basic && dst !== 'boss' && KINDS[s.kind[dst]].armor; if (armor) v *= armor; v = Math.round(v);
  s.hp[dst] = Math.max(0, s.hp[dst] - v); const r = { src, dst, v, crit, weak: true, kill: s.hp[dst] <= 0, hp: s.hp[dst] }; if (armor) { r.armor = true; r.weak = false; }
  if (r.kill && s.mark[dst] > 0) { s.mark[dst] = 0; gain(s, 20); r.bounty = true; if (has(s, 'bounty')) { r.bountySp = 25; for (const h of FRONT) if (alive(s, h)) s.sp[h] = Math.min(STAT[h].sp, s.sp[h] + 25); } }
  if (dst === 'boss' && !s.broken && !r.kill) { s.shield = Math.max(0, s.shield - (o.sh ?? 1)); if (s.shield === 0) { s.broken = true; r.brk = true; } }
  if (dst === 'boss') r.shield = s.shield; check(s); return r;
}
// 打我方。list：[[id, 傷害]]。各種「幫忙擋」的效果在這裡處理；回傳 [{ dst, v, guard, miss, kill, hp }]，另外 out.counters 是反擊打回去的結果
function hitHeroes(s, src, list) {
  const out = []; out.counters = []; const single = list.length === 1;
  if (s.aegis && alive(s, 'kevin')) { let sum = 0; for (const [id, v] of list) { if (!alive(s, id)) continue; sum += v; if (id !== 'kevin') out.push({ src, dst: id, v: 0, guard: true, hp: s.hp[id] }); }
    const v = Math.min(s.hp.kevin - 1, Math.round(sum * .35 * s.run.def)); s.hp.kevin -= v; out.unshift({ src, dst: 'kevin', v, cover: true, hp: s.hp.kevin }); return out; }      // 鐵壁不會讓 Kevin 倒下
  if (s.bulwark && alive(s, 'qiang')) { let sum = 0; for (const [id, v] of list) { if (!alive(s, id)) continue; sum += id === 'qiang' ? v : v * .5; if (id !== 'qiang') out.push({ src, dst: id, v: 0, guard: true, hp: s.hp[id] }); }
    const v = Math.min(s.hp.qiang - 1, Math.round(sum * .6 * s.run.def)); s.hp.qiang -= v; out.unshift({ src, dst: 'qiang', v, cover: true, hp: s.hp.qiang }); const c = hitFoe(s, 'qiang', src, (STAT.qiang.atk * .9 + v * .8) * (has(s, 'riposte') ? 1.8 : 1), { noCrit: true }); if (c) out.counters.push(c); return out; }
  if (single && s.dodge && alive(s, 'cha')) { s.dodge = false; out.taunted = list[0][0]; out.push({ src, dst: 'cha', v: 0, miss: true, hp: s.hp.cha }); return out; }
  if (single && s.cover && alive(s, s.cover)) { const to = s.cover; s.cover = null; if (to !== list[0][0]) out.taunted = list[0][0]; list = [[to, list[0][1] * .5]]; }
  else if (single && s.carry && alive(s, 'qiang')) { if (list[0][0] !== 'qiang') out.taunted = list[0][0]; list = [['qiang', list[0][1] * .6]]; s.duty = Math.min(3, s.duty + 1); out.duty = s.duty; }
  else if (single && s.taunt && alive(s, 'kevin')) { if (list[0][0] !== 'kevin') out.taunted = list[0][0]; list = [['kevin', list[0][1] * .7]]; }
  for (const [id, raw] of list) { if (!alive(s, id)) continue; if (s.evade[id]) { s.evade[id] = false; out.push({ src, dst: id, v: 0, miss: true, hp: s.hp[id] }); continue; }
    const ctr = !!s.counter[id]; let v = Math.round(vary(s, raw) * s.run.def * (s.defend[id] ? .5 : 1) * (s.meeting ? .6 : 1) * (s.friends ? .5 : 1) * (ctr ? .4 : 1)); const saved = s.endure > 0 && v >= s.hp[id]; if (saved) v = s.hp[id] - 1; const aid = v >= s.hp[id] && !s.aidUsed && has(s, 'firstaid'); if (aid) s.aidUsed = true;
    s.hp[id] = aid ? Math.round(STAT[id].hp * .3) : Math.max(0, s.hp[id] - v); out.push({ src, dst: id, v, def: !!s.defend[id] || ctr, endure: saved, aid, kill: s.hp[id] <= 0, hp: s.hp[id] });
    if (ctr) { s.counter[id] = false; if (alive(s, id)) { const c = hitFoe(s, id, src, STAT[id].atk * 1.2 * (has(s, 'riposte') ? 1.8 : 1)); if (c) out.counters.push(c); } } }
  check(s); return out;
}

// ---------- 我方指令。都回傳 { kind, id, ... , hits:[…] } ----------
export function doAttack(s, id, target) { const hits = [hitFoe(s, id, target, STAT[id].atk, { basic: true })].filter(Boolean); return { kind: 'attack', id, target, hits, mo: gain(s, MO.attack) }; }
export function doDefend(s, id) { s.defend[id] = true; return { kind: 'defend', id, mo: gain(s, MO.defend) }; }
export function doCheer(s) { return { kind: 'cheer', id: 'vivi', mo: gain(s, MO.cheer) }; }
export function itemTargets(s, key) { const it = ITEMS[key]; return HEROES.filter(id => it.revive ? FRONT.includes(id) && !alive(s, id) : alive(s, id) && (it.hp ? s.hp[id] < STAT[id].hp : s.sp[id] < STAT[id].sp)); }
export function doItem(s, id, key, target) {
  const it = ITEMS[key]; s.items[key]--; const r = { kind: 'item', id, key, target };
  if (it.hp) { r.heal = Math.min(it.hp, STAT[target].hp - s.hp[target]); s.hp[target] += r.heal; }
  if (it.sp) { r.spGain = Math.min(it.sp, STAT[target].sp - s.sp[target]); s.sp[target] += r.spGain; }
  if (it.revive) { r.revive = true; r.heal = Math.round(STAT[target].hp * it.revive); s.hp[target] = r.heal; }
  r.hp = s.hp[target]; r.sp = s.sp[target]; r.mo = gain(s, MO.item); return r;
}
// 招式現在能不能用：SP 夠、而且有對象（補血要有人受傷、代擋要有別的同伴）
const allyPool = (s, id, sk) => { const a = sk.ally || 'hurt', f = FRONT.filter(h => alive(s, h)); return a === 'hurt' ? f.filter(h => s.hp[h] < STAT[h].hp) : a === 'other' ? f.filter(h => h !== id) : a === 'sp' ? f.filter(h => h !== id && s.sp[h] < STAT[h].sp) : f; };
export const skillOk = (s, id, sk) => s.sp[id] >= sk.sp && (sk.target !== 'ally' || allyPool(s, id, sk).length > 0);
export const allyTargets = allyPool;
export function doSkill(s, id, key, target) {
  const sk = SKILLS[id].find(x => x.key === key), atk = STAT[id].atk; s.sp[id] -= sk.sp; const r = { kind: 'skill', id, key, name: sk.name, target, hits: [] }, push = h => { if (h) r.hits.push(h); return h; }, all = () => [...MINIONS, 'boss'].filter(f => alive(s, f));
  if (key === 'sweep') { const fs = all(); if (fs.length === 1) push(hitFoe(s, id, fs[0], atk * 1.5)); else for (const f of fs) push(hitFoe(s, id, f, atk * .75)); }
  else if (key === 'draft') { push(hitFoe(s, id, target, atk * .8)); if (alive(s, target)) push(hitFoe(s, id, target, atk * .9)); }
  else if (key === 'counter') s.counter[id] = true;
  else if (key === 'taunt') s.taunt = true;
  else if (key === 'bash') { push(hitFoe(s, id, target, atk * 1.4)); s.defend.kevin = true; }
  else if (key === 'barrage') { for (const f of all()) push(hitFoe(s, id, f, atk * .8)); r.spGain = Math.min(15, STAT[id].sp - s.sp[id]); s.sp[id] += r.spGain; }
  else if (key === 'burn') { const h = push(hitFoe(s, id, target, atk * 1.1)); if (h && !h.guard && alive(s, h.dst)) { s.burn[h.dst] = has(s, 'ember') ? 3 : 2; r.burn = h.dst; } }
  else if (key === 'freeze') { const h = push(hitFoe(s, id, target, atk)); if (h && !h.guard && !h.kill) { s.atkDown[h.dst] = h.dst === 'boss' ? 4 : 2; r.down = [h.dst]; } }
  else if (key === 'mend') { const v = Math.min(1500, STAT[target].hp - s.hp[target]); s.hp[target] += v; r.heals = [{ dst: target, v, hp: s.hp[target] }]; }
  else if (key === 'soothe') r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(700, STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h] }; });
  else if (key === 'treat') r.spGains = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(60, STAT[h].sp - s.sp[h]); s.sp[h] += v; return { dst: h, v, sp: s.sp[h] }; });
  else if (key === 'delay') { push(hitFoe(s, id, target, atk * .7)); if (s.queue.includes(target) && alive(s, target)) { const moved = s.queue.filter(q => q === target); s.queue = s.queue.filter(q => q !== target).concat(moved); r.delayed = target; } }
  else if (key === 'lock') { r.down = all(); for (const f of r.down) s.atkDown[f] = Math.max(s.atkDown[f] || 0, 1); }
  else if (key === 'mark') { if (alive(s, target)) { s.mark[target] = 3; r.marked = [target]; } }
  else if (key === 'deal') { push(hitFoe(s, id, target, atk * 1.2)); gain(s, 15); r.bonusMo = 15; }
  else if (key === 'push') { s.cover = target; r.cover = target; }
  else if (key === 'chat') s.dodge = true;
  else if (key === 'carry') s.carry = true;
  else if (key === 'box') { push(hitFoe(s, id, target, atk * 1.5 * (1 + .3 * s.duty), { sh: 2 })); r.duty = s.duty; s.duty = 0; }
  else if (key === 'probe') { push(hitFoe(s, id, target, atk * .9)); s.evidence = Math.min(3, s.evidence + 1); r.evidence = s.evidence; }
  else if (key === 'expose') { const b = target === 'boss' && s.broken; push(hitFoe(s, id, target, atk * (b ? 2.0 : 1.3))); if (b) s.evidence = Math.min(3, s.evidence + 1); r.evidence = s.evidence; r.exposed = b; }
  else if (key === 'encore') { s.queue.unshift(target); r.encore = [target]; }
  else if (key === 'dance') { s.atkUp = Math.max(s.atkUp, 2); r.atkUp = true; }
  else if (key === 'slack') { s.evade[id] = true; r.spGain = Math.min(40, STAT[id].sp - s.sp[id]); s.sp[id] += r.spGain; }
  else if (key === 'backdoor') push(hitFoe(s, id, target, atk * 1.1, { pierce: true }));
  else if (key === 'mice') { const n = 4 + HEROES.filter(h => h === 'zong' || h === 'hui').length; for (let i = 0; i < n; i++) { const fs = all().filter(f => !(f === 'boss' && guarded(s))); if (!fs.length) break; push(hitFoe(s, id, fs[Math.floor(s.rand() * fs.length)], atk * .45)); } }
  else if (key === 'wand') { s.bless[target] = true; r.bless = target; }
  else if (key === 'sip') { const v = Math.min(900, STAT[id].hp - s.hp[id]); s.hp[id] += v; s.defend[id] = true; r.heals = [{ dst: id, v, hp: s.hp[id] }]; }
  else if (key === 'news') { const h = push(hitFoe(s, id, target, atk * 1.2)); if (h && !h.guard && !h.kill) { s.atkDown[h.dst] = Math.max(s.atkDown[h.dst] || 0, 1); r.down = [h.dst]; } }
  else if (key === 'overtime') { push(hitFoe(s, id, target, atk)); s.overtime = Math.min(4, s.overtime + 1); r.overtime = s.overtime; }
  else if (key === 'allnight') { r.selfDmg = Math.min(s.hp[id] - 1, Math.round(STAT[id].hp * .15)); s.hp[id] -= r.selfDmg; r.selfHp = s.hp[id]; push(hitFoe(s, id, target, atk * 2, { sh: 2 })); }
  else if (key === 'transfer') { const v = Math.min(80, STAT[target].sp - s.sp[target]); s.sp[target] += v; r.spGains = [{ dst: target, v, sp: s.sp[target] }]; }
  else if (key === 'mix') { const v = Math.min(1100, STAT[target].hp - s.hp[target]); s.hp[target] += v; s.defend[target] = true; r.heals = [{ dst: target, v, hp: s.hp[target] }]; r.shielded = target; }
  r.sp = s.sp[id]; r.mo = gain(s, MO.skill); return r;
}
export function doUlt(s, id) {
  s.sp[id] -= STAT[id].cost; gain(s, -MO.ult); const r = { kind: 'ult', id, sp: s.sp[id], mo: s.mo, hits: [] }, push = h => { if (h) r.hits.push(h); return h; }, all = () => [...MINIONS, 'boss'].filter(f => alive(s, f));
  const prime = () => alive(s, 'boss') && !guarded(s) ? 'boss' : MINIONS.filter(m => alive(s, m)).sort((a, b) => s.hp[b] - s.hp[a])[0] || (alive(s, 'boss') ? 'boss' : null);      // 單體奧義自動挑的對象：打得到頭目就打頭目
  if (id === 'kui') {      // 吐槽一閃：每隻小兵兩刀；最後一刀劈頭目
    for (const m of MINIONS) if (alive(s, m)) { push({ ...hitFoe(s, id, m, 1900, { noCrit: true }), stage: m }); if (alive(s, m)) push({ ...hitFoe(s, id, m, 2100, { noCrit: true }), stage: m }); }
    { const hit = hitFoe(s, id, 'boss', 4400, { sh: 2 }); if (hit) push({ ...hit, stage: hit.pot ? hit.dst : 'boss' }); }
  } else if (id === 'jie') {      // 深淵死線：敵方全體
    for (const m of MINIONS) push(hitFoe(s, id, m, 2600, { noCrit: true })); push(hitFoe(s, id, 'boss', 6200, { sh: 1 })); if (alive(s, 'boss') && !r.hits.at(-1)?.guard) push(hitFoe(s, id, 'boss', 5200, { sh: 1, noCrit: true }));
  } else if (id === 'kevin') { s.aegis = true;
  } else if (id === 'mi') {      // 聖光專線：全員補滿，聖光打一個敵人（先打小兵）
    r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = STAT[h].hp - s.hp[h]; s.hp[h] = STAT[h].hp; return { dst: h, v, hp: s.hp[h] }; });
    push(hitFoe(s, id, MINIONS.find(m => alive(s, m)) || 'boss', 2000));
  } else if (id === 'vivi') {      // 皇家敕令：攻擊力提升三回合，全員總攻擊（先清小兵，再打頭目）
    s.atkUp = 3; const tgt = wantBoss => { const m = MINIONS.find(x => alive(s, x)); return wantBoss && alive(s, 'boss') && !guarded(s) ? 'boss' : m || (alive(s, 'boss') ? 'boss' : null); };
    FRONT.filter(h => alive(s, h)).forEach((h, i) => { const t = tgt(i >= 2 || FRONT.length < 3); if (t) { const hit = hitFoe(s, h, t, STAT[h].atk * 1.6); if (hit) push({ ...hit, by: h }); } });
    { const t = tgt(true); if (t) { const hit = hitFoe(s, id, t, t === 'boss' ? 7000 : 3000, { sh: 2, noCrit: true }); if (hit) push({ ...hit, by: 'vivi', final: true }); } }
  } else if (id === 'yan') {      // 會議改到下週：敵人這回合剩下的行動排到最後，我方這回合減傷
    s.queue = s.queue.filter(q => HEROES.includes(q)).concat(s.queue.filter(q => !HEROES.includes(q))); s.meeting = true; r.delayedAll = true;
  } else if (id === 'heilun') { r.marked = all(); for (const f of r.marked) s.mark[f] = 3; for (const f of all()) push(hitFoe(s, id, f, 2200, { sh: 1 }));
  } else if (id === 'cha') { s.friends = true; for (const f of all()) push(hitFoe(s, id, f, 900, { sh: 2, noCrit: true }));
  } else if (id === 'qiang') { s.bulwark = true;
  } else if (id === 'senpai') { const t = prime(); if (t) push(hitFoe(s, id, t, 3400 + 2600 * s.evidence, { sh: 2 })); r.evidence = s.evidence; s.evidence = 0;
  } else if (id === 'wu') { r.encore = FRONT.filter(h => h !== id && alive(s, h)); s.queue = [...r.encore, ...s.queue];
  } else if (id === 'you') { const t = alive(s, 'boss') ? 'boss' : prime(); if (t) push(hitFoe(s, id, t, 5200, { sh: 3, pierce: true }));
  } else if (id === 'fairy') { r.heals = FRONT.filter(h => h !== id || alive(s, h)).map(h => { const up = !alive(s, h), v = up ? Math.round(STAT[h].hp * .3) : Math.min(Math.round(STAT[h].hp * .2), STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h], revive: up }; });
  } else if (id === 'zong') { s.endure = 2;
  } else if (id === 'hui') { for (let i = 0; i < 4; i++) { const fs = all().filter(f => !(f === 'boss' && guarded(s))); if (!fs.length) break; push(hitFoe(s, id, fs[Math.floor(s.rand() * fs.length)], 1500, { sh: 1 })); }
  } else if (id === 'xu') { r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(Math.round(STAT[h].hp * .4), STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h] }; });
    r.spGains = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(60, STAT[h].sp - s.sp[h]); s.sp[h] += v; return { dst: h, v, sp: s.sp[h] }; }); s.items.tea++; r.tea = true; }
  return r;
}

// ---------- 敵人行動 ----------
export function enemyTurn(s, id) {
  const targets = FRONT.filter(h => alive(s, h)), pick = () => targets[Math.floor(s.rand() * targets.length)], weak = s.atkDown[id] > 0, k = weak ? .7 : 1; if (weak && !(id === 'boss' && s.broken)) s.atkDown[id]--;
  if (id !== 'boss') { const K = KINDS[s.kind[id]];
    if (K.heal) { const hurt = ['boss', ...MINIONS].filter(f => alive(s, f) && s.hp[f] < STAT[f].hp).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0]; if (hurt) { const v = Math.min(Math.round(K.heal * s.hk), STAT[hurt].hp - s.hp[hurt]); s.hp[hurt] += v; return { kind: 'foeHeal', id, dst: hurt, v, hp: s.hp[hurt] }; } }
    const r = { kind: 'foeAtk', id, weak, hits: hitHeroes(s, id, K.aoe ? targets.map(h => [h, STAT[id].atk * k * K.aoe]) : [[pick(), STAT[id].atk * k]]) };
    if (K.drain) for (const h of r.hits) if (h.v > 0 && s.sp[h.dst] > 0) { h.spLoss = Math.min(K.drain, s.sp[h.dst]); s.sp[h.dst] -= h.spLoss; h.sp = s.sp[h.dst]; }
    return r; }
  if (s.broken) { s.broken = false; s.shield = STAT.boss.shield; return { kind: 'stunned', id, shield: s.shield }; }
  s.bossTurns++;
  if (s.charging) { s.charging = false; const r = { kind: 'bossUlt', id, weak, hits: hitHeroes(s, id, targets.map(h => [h, BOSS_ULT[h] * k])), blocked: (s.aegis && alive(s, 'kevin')) || (s.bulwark && alive(s, 'qiang')) };
    if (s.L.moDrain && !r.blocked) { r.moLoss = Math.min(s.L.moDrain, s.mo); gain(s, -r.moLoss); r.mo = s.mo; }      // 考績魔導士：大招沒被完全擋下來就扣氣勢
    if (!s.over && !MINIONS.some(m => alive(s, m))) { for (const m of MINIONS) s.hp[m] = STAT[m].hp; s.summons++; r.summon = true; } return r; }
  if (s.bossTurns % STAT.boss.cycle === STAT.boss.cycle - 1) { s.charging = true; return { kind: 'charge', id }; }
  return { kind: 'bossAtk', id, weak, hits: hitHeroes(s, id, [[pick(), STAT.boss.atk * k]]) };
}
