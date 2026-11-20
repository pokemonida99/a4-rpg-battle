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
// 整體難度旋鈕（戰鬥 2.0 之後我方變強，敵人整體往上調）：小兵血、小兵攻擊、頭目血、頭目攻擊、頭目大招
export const TUNE = { hp: 1.3, atk: 1.5, bhp: 1.4, batk: 1.5, ult: 1.65 };
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
// ---------- 戰鬥 2.0：新招式（每人兩招）、普攻附帶效果、被動 ----------
// 新招式用「效果清單」fx 描述，doSkill 照著跑（runFx）。ic＝還沒有專屬圖示，先借哪一招的圖示。目標 target 同上；fx 每一項是 [動作, 參數…]：
// dmg 倍率 {sh:多削幾點底氣}（target 是 all 就打全體）、burn 回合、poison 回合 每回合倍率、mark、down 幅度（敵人下一次行動傷害降這麼多）、stun（小兵跳過下一次行動；頭目改成多削 2 底氣）、delay、
// ward 對象 數值（護盾：到那個人下次行動開始前，先吸收這麼多傷害）、heal 對象 數值、regen 對象 每回合 回合數、sp 對象 數值、up 對象 次數（攻擊 +25%）、cleanse 對象、taunt、evade 對象。對象：self 自己、ally 選的同伴、party 前排全員
const NEW_SKILLS = {
  kui: [{ key: 'deadline', ic: 'draft', name: '今天一定要結案', sp: 30, type: 'holy', target: 'foe', note: '單體攻擊　底氣 -3', desc: '把話講死的一刀：光屬性，多削兩點底氣。', fx: [['dmg', 1.2, { sh: 3 }]] },
    { key: 'backup', ic: 'counter', name: '我幫你補位', sp: 26, target: 'ally', ally: 'any', note: '同伴護盾 700　解除異常', desc: '替一位同伴擋在前面：護盾 700，並解除他身上的異常。', fx: [['ward', 'ally', 700], ['cleanse', 'ally']] }],
  jie: [{ key: 'escalate', ic: 'burn', name: '副本給你主管', sp: 58, type: 'fire', target: 'all', note: '敵方全體　灼燒兩回合', desc: '火屬性燒過所有敵人，每一個都灼燒兩回合。', fx: [['dmg', .8], ['burn', 2]] },
    { key: 'sanitize', ic: 'barrage', name: '先把風險洗乾淨', sp: 44, type: 'holy', target: 'foe', note: '單體攻擊　全員護盾 300', desc: '光屬性攻擊一個敵人，同時前排全員各得 300 護盾。', fx: [['dmg', 1.0], ['ward', 'party', 300]] }],
  kevin: [{ key: 'cover', ic: 'taunt', name: '先過我這關', sp: 28, target: 'party', note: '全員護盾 500', desc: '前排全員各得 500 護盾，到各自下次行動前有效。', fx: [['ward', 'party', 500]] },
    { key: 'gavel', ic: 'bash', name: '本案退回重辦', sp: 24, type: 'holy', target: 'foe', note: '單體攻擊　暈眩', desc: '光屬性一槌：小兵暈眩、跳過下一次行動；打頭目改成多削兩點底氣。', fx: [['dmg', 1.1], ['stun']] }],
  mi: [{ key: 'followup', ic: 'mend', name: '後續我來追', sp: 32, target: 'ally', ally: 'any', note: '再生三回合　護盾 350', desc: '一位同伴接下來三回合每回合回 350 HP，並先得到 350 護盾。', fx: [['regen', 'ally', 350, 3], ['ward', 'ally', 350]] },
    { key: 'disinfect', ic: 'soothe', name: '負能量請消毒', sp: 30, type: 'holy', target: 'foe', note: '單體攻擊　攻擊力下降', desc: '光屬性攻擊，目標下一次行動的傷害減兩成。', fx: [['dmg', 1.2], ['down', .2]] }],
  vivi: [{ key: 'budget', ic: 'treat', name: '這筆我核了', sp: 90, target: 'ally', ally: 'any', note: '同伴攻擊 +25%　護盾 600', desc: '核准預算：一位同伴接下來兩次行動攻擊力 +25%，並得到 600 護盾。', fx: [['up', 'ally', 2], ['ward', 'ally', 600]] },
    { key: 'morale', ic: 'treat', name: '今天不談績效', sp: 100, target: 'party', note: '全員回復 450　解除異常', desc: '前排全員各回 450 HP，並解除異常。', fx: [['heal', 'party', 450], ['cleanse', 'party']] }],
  yan: [{ key: 'reschedule', ic: 'delay', name: '空檔先補起來', sp: 30, target: 'ally', ally: 'any', note: '回復 900　護盾 450', desc: '一位同伴回 900 HP，並得到 450 護盾。', fx: [['heal', 'ally', 900], ['ward', 'ally', 450]] },
    { key: 'minutes', ic: 'lock', name: '會議紀錄有寫', sp: 34, type: 'dark', target: 'foe', note: '單體攻擊　標記', desc: '暗屬性攻擊並標記目標：它受到的傷害多三成。', fx: [['dmg', 1.2], ['mark']] }],
  heilun: [{ key: 'fineprint', ic: 'mark', name: '小字你有看嗎', sp: 28, type: 'dark', target: 'foe', note: '單體攻擊　中毒三回合', desc: '暗屬性攻擊，目標中毒三回合，每回合開始扣血。', fx: [['dmg', .9], ['poison', 3, .25]] },
    { key: 'insurance', ic: 'deal', name: '這單有保', sp: 24, target: 'ally', ally: 'any', note: '同伴護盾 800　SP +15', desc: '一位同伴得到 800 護盾，並回復 15 SP。', fx: [['ward', 'ally', 800], ['sp', 'ally', 15]] }],
  cha: [{ key: 'cheer', ic: 'chat', name: '你剛剛超會接', sp: 28, target: 'ally', ally: 'other', note: '同伴攻擊 +25%　SP +20', desc: '誇一位同伴：接下來兩次行動攻擊力 +25%，並回復 20 SP。', fx: [['up', 'ally', 2], ['sp', 'ally', 20]] },
    { key: 'rumor', ic: 'push', name: '大家都在說喔', sp: 30, type: 'dark', target: 'all', note: '敵方全體　攻擊力下降', desc: '暗屬性打所有敵人，每一個下一次行動的傷害減一成五。', fx: [['dmg', .6], ['down', .15]] }],
  qiang: [{ key: 'pallet', ic: 'box', name: '棧板先借過', sp: 28, type: 'blunt', target: 'all', note: '敵方全體　攻擊力下降', desc: '推著棧板撞過所有敵人，每一個下一次行動的傷害減一成五。', fx: [['dmg', .8], ['down', .15]] },
    { key: 'handover', ic: 'carry', name: '換我幫你扛', sp: 24, target: 'ally', ally: 'other', note: '同伴護盾 1000　自己回 500', desc: '一位同伴得到 1000 護盾，自己回 500 HP。', fx: [['ward', 'ally', 1000], ['heal', 'self', 500]] }],
  senpai: [{ key: 'attach', ic: 'probe', name: '附件請補齊', sp: 30, type: 'holy', target: 'foe', note: '單體攻擊　標記', desc: '光屬性攻擊並標記目標：它受到的傷害多三成。', fx: [['dmg', 1.0], ['mark']] },
    { key: 'redact', ic: 'expose', name: '這段先遮起來', sp: 28, type: 'dark', target: 'foe', note: '單體攻擊　攻擊力下降', desc: '暗屬性攻擊，目標下一次行動的傷害減兩成五。', fx: [['dmg', 1.3], ['down', .25]] }],
  wu: [{ key: 'spotlight', ic: 'dance', name: '主管請看這邊', sp: 24, type: 'holy', target: 'foe', note: '單體攻擊　吸引並閃過一擊', desc: '光屬性攻擊，並把敵人的單體攻擊引到自己身上、閃過下一擊。', fx: [['dmg', 1.0], ['taunt'], ['evade', 'self']] },
    { key: 'cooldown', ic: 'encore', name: '中場喝口水', sp: 30, target: 'party', note: '全員回復 400　再生兩回合', desc: '前排全員各回 400 HP，接下來兩回合每回合再回 180。', fx: [['heal', 'party', 400], ['regen', 'party', 180, 2]] }],
  you: [{ key: 'spiked', ic: 'backdoor', name: '這杯誰放的', sp: 24, type: 'dark', target: 'foe', note: '單體攻擊　中毒三回合', desc: '暗屬性攻擊，目標中毒三回合，每回合開始扣血。', fx: [['dmg', .8], ['poison', 3, .3]] },
    { key: 'outofoffice', ic: 'slack', name: '系統顯示不在線', sp: 30, target: 'ally', ally: 'other', note: '同伴解除異常　閃過下一擊', desc: '幫一位同伴掛上「不在線」：解除異常，並閃過下一次攻擊。', fx: [['cleanse', 'ally'], ['evade', 'ally']] }],
  fairy: [{ key: 'nightshift', ic: 'wand', name: '冷氣借開一下', sp: 38, type: 'ice', target: 'foe', note: '單體攻擊　延到最後', desc: '冰屬性重擊，並把目標這回合還沒做的行動排到最後面。', fx: [['dmg', 1.4], ['delay']] },
    { key: 'snacks', ic: 'mice', name: '茶水間有餅乾', sp: 44, target: 'party', note: '全員護盾 500　SP +15', desc: '前排全員各得 500 護盾，並回復 15 SP。', fx: [['ward', 'party', 500], ['sp', 'party', 15]] }],
  zong: [{ key: 'doorstop', ic: 'news', name: '門先幫你頂著', sp: 22, type: 'blunt', target: 'foe', note: '單體攻擊　吸引攻擊　護盾 700', desc: '頂住門打一下：敵人的單體攻擊改打棕鼠，自己得到 700 護盾。', fx: [['dmg', .9], ['taunt'], ['ward', 'self', 700]] },
    { key: 'hotpack', ic: 'sip', name: '抽屜還有暖暖包', sp: 26, target: 'ally', ally: 'any', note: '回復 500　再生三回合', desc: '一位同伴回 500 HP，接下來三回合每回合再回 250。', fx: [['heal', 'ally', 500], ['regen', 'ally', 250, 3]] }],
  hui: [{ key: 'handoff', ic: 'overtime', name: '這份先切出去', sp: 24, type: 'slash', target: 'foe', note: '單體攻擊　自己回 450', desc: '斬屬性攻擊，順便喘口氣：自己回 450 HP。', fx: [['dmg', 1.2], ['heal', 'self', 450]] },
    { key: 'burnout', ic: 'allnight', name: '印表機也過熱', sp: 30, type: 'fire', target: 'all', note: '敵方全體　灼燒兩回合', desc: '火屬性燒過所有敵人，每一個都灼燒兩回合。', fx: [['dmg', .7], ['burn', 2]] }],
  xu: [{ key: 'antidote', ic: 'mix', name: '這個要飯後吃', sp: 36, target: 'party', note: '全員解除異常　回復 300', desc: '前排全員解除異常，各回 300 HP。', fx: [['cleanse', 'party'], ['heal', 'party', 300]] },
    { key: 'prescription', ic: 'transfer', name: '先吃藥再開會', sp: 28, type: 'ice', target: 'foe', note: '單體攻擊　攻擊力下降', desc: '冰屬性攻擊，目標下一次行動的傷害減兩成五。', fx: [['dmg', 1.0], ['down', .25]] }],
};
for (const id in NEW_SKILLS) SKILLS[id].push(...NEW_SKILLS[id]);
export const START2 = { kui: 'deadline', jie: 'sanitize' };      // 主角一開始除了自己挑的那一招，另外會這一招（先有第二種屬性可以用）
// 普攻附帶效果（每次普通攻擊都有）與被動特質（整場常駐）的說明文字；實際效果在 rider()、passive hooks
export const RIDER = { kui: '自己得到 180 護盾', jie: '目標下一次行動的傷害減一成', kevin: '自己回復 180 HP', mi: 'HP 最低的同伴回復 180', yan: 'SP 最少的另一位同伴 +6 SP', heilun: '氣勢多 +3', cha: 'HP 最低的另一位同伴得到 220 護盾', qiang: '下回合開始時自己回 220 HP',
  senpai: '打頭目多削 1 點底氣', wu: '目標這回合受到的傷害多三成', you: '回復的 SP 加倍', fairy: '另一位同伴 +8 SP（老鼠優先）', zong: '自己得到 200 護盾', hui: '自己回復 120 HP', xu: '另一位同伴 +10 SP' };
export const PASSIVE = { kui: ['交件前再看一眼', '自己的行動打中弱點時，回復 6 SP。'], jie: ['燒完記得存檔', '自己的行動打中灼燒中的敵人時，氣勢 +3。'], kevin: ['站著就是進度', '每次行動結束，自己得到 180 護盾。'], mi: ['值班補貼', '行動結束時，如果有同伴 HP 低於一半，自己回 8 SP。'],
  vivi: ['公主有交代', '每回合開始，氣勢 +3。'], yan: ['行程留白', '成功延後敵人的行動時，自己回 8 SP。'], heilun: ['成交有回饋', '被標記的敵人倒下時，自己回 10 SP。'], cha: ['氣氛不能冷', '行動結束時，前排有三人以上站著，氣勢 +2。'],
  qiang: ['扛久就習慣', '每回合開始，每一層扛責回 100 HP。'], senpai: ['查核有補助', '自己的行動打中被標記的敵人時，回復 5 SP。'], wu: ['暖場有成', '每回合第一次有同伴用招式時，自己回 5 SP。'], you: ['看破不說破', '每回合第一次閃過攻擊時，氣勢 +5。'],
  fairy: ['鼠輩互助會', '每回合開始，前排每有一隻老鼠，自己回 4 SP。'], zong: ['老班底撐場', '每回合開始，HP 不到一半時得到 350 護盾。'], hui: ['加班餐費', '行動結束時，每一層加班回 2 SP。'], xu: ['轉接有回音', '用招式或奧義幫同伴回 SP 之後，自己回 6 SP。'] };
// ---------- 合體技（幻想水滸傳式）：指定的兩三個人都在場才有 ----------
// 輪到其中一人、其他成員這回合都還沒動時可以放：所有成員的行動都用掉、各扣自己的 SP。算招式傷害。
// fx 多幾個動作：dmgBy 第幾個成員 倍率（用那個人的攻擊力）、wardTo 第幾個成員 數值、tauntBy 第幾個成員、mark0（先標記再打）、healPct 第幾個成員 比例、reviveOrHeal 比例、mo 數值；對象多一個 others（成員以外的前排）
export const UNITES = [
  { key: 'u_final', who: ['kui', 'jie'], name: '學長，這版真的定了', sp: [32, 72], type: 'fire', target: 'foe', note: '兩人各打一下　灼燒', desc: '小葵交稿、學長放火：兩人各打一下（火屬性 1.4 倍），目標灼燒兩回合。', fx: [['dmgBy', 0, 1.4], ['dmgBy', 1, 1.4], ['burn', 2]] },
  { key: 'u_sign', who: ['kui', 'senpai'], name: '請先簽名再改', sp: [30, 34], type: 'slash', target: 'foe', note: '兩人各打一下　底氣 -3', desc: '小葵和學姊各砍一刀（斬屬性 1.5 倍），多削兩點底氣，目標下一次行動傷害減兩成五。', fx: [['dmgBy', 0, 1.5], ['dmgBy', 1, 1.5, { sh: 3 }], ['down', .25]] },
  { key: 'u_delay', who: ['kevin', 'yan'], name: '系統判定要延期', sp: [24, 48], type: 'blunt', target: 'foe', note: '重擊　延到最後　全員護盾', desc: 'Kevin 重擊一個敵人（打屬性 2.2 倍），把它的行動排到最後，前排全員得到 1000 護盾。', fx: [['dmgBy', 0, 2.2], ['delay'], ['ward', 'party', 1000]] },
  { key: 'u_firewall', who: ['kevin', 'zong'], name: '舊系統也有防火牆', sp: [26, 22], type: 'fire', target: 'foe', note: '兩人各打一下　全員護盾', desc: 'Kevin 和棕鼠各打一下（火屬性），前排全員得到 1200 護盾，目標下一次行動傷害減三成。', fx: [['dmgBy', 0, 1.0], ['dmgBy', 1, 1.0], ['ward', 'party', 1200], ['down', .3]] },
  { key: 'u_ticket', who: ['mi', 'xu'], name: '您的問題已轉專人', sp: [64, 48], target: 'party', note: '全員回復 1200　解除異常　SP +25', desc: '前排全員回 1200 HP、解除異常，並各回 25 SP。', fx: [['heal', 'party', 1200], ['cleanse', 'party'], ['sp', 'party', 25]] },
  { key: 'u_carry', who: ['cha', 'qiang'], name: '你先聊，我來扛', sp: [36, 26], type: 'blunt', target: 'foe', note: '重擊　阿強護盾並吸引攻擊', desc: '茶茶拉住敵人聊天，阿強整箱砸下去（打屬性 2.8 倍）；阿強得到 1800 護盾，敵人的單體攻擊改打他。', fx: [['dmgBy', 1, 2.8], ['wardTo', 1, 1800], ['tauntBy', 1]] },
  { key: 'u_stamp', who: ['senpai', 'you'], name: '摸魚也有時間戳', sp: [38, 34], type: 'dark', target: 'foe', note: '先標記　兩人各打一下', desc: '先標記目標（受傷多三成），學姊和老油條再各打一下（暗屬性 1.6 倍），多削兩點底氣。', fx: [['mark0'], ['dmgBy', 0, 1.6], ['dmgBy', 1, 1.6, { sh: 3 }]] },
  { key: 'u_mice', who: ['zong', 'hui', 'fairy'], name: '鼠於我們的下班時間', sp: [24, 32, 64], type: 'blunt', target: 'foe', note: '六連擊　全員護盾', desc: '老鼠三人組輪流打六下（打屬性），前排全員得到 1200 護盾，灰鼠回一成五的 HP。', fx: [['dmgBy', 0, .65], ['dmgBy', 1, .65], ['dmgBy', 2, .65], ['dmgBy', 0, .65], ['dmgBy', 1, .65], ['dmgBy', 2, .65], ['ward', 'party', 1200], ['healPct', 1, .15]] },
  { key: 'u_approve', who: ['vivi', 'heilun'], name: '公主核准，業務買單', sp: [100, 36], type: 'holy', target: 'all', note: '敵方全體　標記　氣勢 +18', desc: '黑輪拿著公主的核准打過所有敵人（光屬性 1.5 倍），全部標記，氣勢多 18。', fx: [['dmgBy', 1, 1.5], ['mark'], ['mo', 18]] },
  { key: 'u_mc', who: ['wu', 'cha'], name: '主持人不要再加碼', sp: [48, 36], target: 'party', note: '其他人攻擊 +25%　SP +35', desc: '兩個人把場子炒熱：其他同伴接下來兩次行動攻擊力 +25%，各回 35 SP，氣勢多 12。', fx: [['up', 'others', 2], ['sp', 'others', 35], ['mo', 12]] },
  { key: 'u_rebuild', who: ['jie', 'fairy'], name: '午夜前全部重建', sp: [84, 72], type: 'ice', target: 'all', note: '敵方全體兩下　復活或回復', desc: '阿傑和鼠仙女各打全體一下（冰屬性 1.1 倍）；有同伴倒下就以三成五 HP 站起來，沒有就幫最傷的人回三成五。', fx: [['dmgBy', 0, 1.1], ['dmgBy', 1, 1.1], ['reviveOrHeal', .35]] },
];
// ---------- 戰鬥 2.0：屬性與弱點 ----------
// 六種屬性。每個人的普攻、每個攻擊招式、每個攻擊奧義各有一個屬性；每種敵人有兩個弱點（KINDS 的 weak、頭目的 weak）。
// 打中弱點：傷害 ×1.3、氣勢 +6（一個指令只加一次）、打頭目多削 1 點底氣（一個指令只多削一次）
export const TYPES = { slash: '斬', blunt: '打', fire: '火', ice: '冰', holy: '光', dark: '暗' };
export const ATK_TYPE = { kui: 'slash', jie: 'dark', kevin: 'blunt', mi: 'holy', vivi: 'holy', yan: 'ice', heilun: 'blunt', cha: 'holy', qiang: 'blunt', senpai: 'slash', wu: 'slash', you: 'slash', fairy: 'holy', zong: 'blunt', hui: 'blunt', xu: 'ice' };
export const ULT_TYPE = { kui: 'slash', jie: 'dark', mi: 'holy', vivi: 'holy', heilun: 'dark', cha: 'holy', senpai: 'slash', you: 'slash', hui: 'blunt' };
const SK_TYPE = { draft: 'slash', sweep: 'slash', burn: 'fire', freeze: 'ice', barrage: 'dark', bash: 'blunt', delay: 'ice', deal: 'blunt', box: 'blunt', probe: 'slash', expose: 'slash', backdoor: 'slash', mice: 'dark', news: 'blunt', overtime: 'blunt', allnight: 'blunt' };
for (const id in SKILLS) for (const k of SKILLS[id]) if (SK_TYPE[k.key]) k.type = SK_TYPE[k.key];
// 一般敵人的種類（每一場的 kinds 指定哪個位置站誰，沒寫就是社畜小兵）。hp／atk＝相對這一場小兵基準值的倍率；spd＝行動速度（沒寫用原本的）
// drain：打中扣對方多少 SP。armor：被「普通攻擊」打到只吃這個倍率的傷害（招式、奧義照常）。heal：場上有敵人受傷時不攻擊，改成幫傷最重的回這麼多血（照人數縮放）
export const KINDS = {
  drone: { name: '社畜小兵', hp: 1, atk: 1, move: '加班連打', weak: ['slash', 'fire'] },
  courier: { name: '催稿信差', weak: ['ice', 'blunt'], hp: .75, atk: .75, spd: 330, drain: 25, move: '催稿', note: '動作快，被他打中會扣 25 SP' },
  knight: { name: '公文櫃重甲兵', weak: ['fire', 'dark'], hp: 1.2, atk: 1.0, spd: 90, armor: .5, move: '蓋章重擊', note: '普通攻擊打他只有一半傷害，用招式或奧義' },
  intern: { name: '續命實習生', weak: ['dark', 'slash'], hp: .7, atk: .5, spd: 210, heal: 900, move: '遞提神飲料', note: '會幫受傷的敵人回血，先解決他' },
  // dull：被「招式」打到只吃這個倍率的傷害（普通攻擊、奧義照常；跟重甲兵相反）。smoke：被他打中的人，下一次普通攻擊傷害減半（行動過一次就散；他倒下也散）
  auntie: { name: '大媽同事', weak: ['holy', 'blunt'], hp: 1.4, atk: .8, spd: 180, dull: .5, move: '你去問別人', note: '一問三不知：用招式打她只有一半傷害，改用普通攻擊' },
  smoker: { name: '臭臭阿北', weak: ['ice', 'holy'], hp: 1.1, atk: .75, spd: 240, smoke: true, move: '借過，我抽一下', note: '二手煙：被他打中的人，下一次普通攻擊傷害減半。改用招式，或先打倒他' },
};
// 台灣篇的一般敵人：現有敵人的台灣版，機制一樣、名字和圖不同。like＝本來是誰（沒有專屬圖時畫面拿那個頂著）
for (const [k, like, name, move, note] of [['tw_drone', 'drone', '燈彩值班兵', '燈籠連打'], ['tw_knight', 'knight', '剪黏檔案衛', '屋脊重擊', '一身剪黏很硬：普通攻擊打他只有一半傷害，用招式或奧義'], ['tw_auntie', 'auntie', '總務帳房姑', '帳不是我記的', '一問三不知：用招式打她只有一半傷害，改用普通攻擊'],
  ['tw_courier', 'courier', '限時叫號使', '號碼過了', '動作快，被他打中會扣 25 SP'], ['tw_intern', 'intern', '續攤補給生', '再來一杯', '會幫受傷的敵人回血，先解決他'], ['tw_smoker', 'smoker', '煙霧巡樓伯', '巡一下，抽一根', '二手煙：被他打中的人，下一次普通攻擊傷害減半。改用招式，或先打倒他']])
  KINDS[k] = { ...KINDS[like], like, name, move, note };
// 鏡像內戰（第二張地圖）：對面站的是自己人的鏡像。血量、攻擊照本人換算，速度一樣，特長也帶過去：
// 坦克皮厚（普攻減半）、補師幫敵人回血、小燕與黑輪打中扣 SP、阿傑一次打全體（aoe＝對每個人的傷害倍率）。
export const NAME = { kui: '小葵', jie: '阿傑', kevin: 'Kevin', mi: '小米', vivi: 'Vivi', yan: '小燕', heilun: '黑輪', cha: '茶茶', qiang: '阿強', senpai: '學姊', wu: '小蝶', you: '老油條', fairy: '鼠仙女', zong: '棕鼠', hui: '灰鼠', xu: '許許' };
const MIRROR_TRAIT = { kevin: { armor: .5, note: '跟本人一樣皮厚：普通攻擊只有一半傷害' }, qiang: { armor: .5, note: '跟本人一樣皮厚：普通攻擊只有一半傷害' }, zong: { armor: .6, note: '皮厚：普通攻擊傷害打六折' },
  mi: { heal: 1100, note: '跟本人一樣會補血，先解決' }, xu: { heal: 900, note: '跟本人一樣會補血，先解決' }, fairy: { heal: 900, note: '會幫敵人回血，先解決' },
  yan: { drain: 30, note: '打中會扣 30 SP' }, heilun: { drain: 20, note: '打中會扣 20 SP' }, jie: { aoe: .55, note: '跟本人一樣，一次打全體' } };
for (const id of ALL) if (id !== 'vivi') KINDS['m_' + id] = { hero: id, name: '鏡像' + NAME[id], hp: Math.max(.75, Math.min(1.5, STAT[id].hp / 2600)), atk: Math.max(.7, STAT[id].atk / 1150), spd: STAT[id].spd, move: SKILLS[id][0].name, weak: ROLE[id] === '坦' ? ['fire', 'dark'] : ROLE[id] === '補' ? ['dark', 'slash'] : ROLE[id] === '輸出' ? ['ice', 'holy'] : ['blunt', 'fire'], ...MIRROR_TRAIT[id] };
// 氣勢：起始值、放奧義要多少、各種行動加多少
export const MO = { start: 30, max: 100, ult: 40, attack: 14, skill: 14, defend: 16, item: 6, cheer: 35 };
// 戰鬥的種類。boss：這一場的頭目（沒有就是純小兵戰）；guard＝小兵在場時無敵；pot＝每回合第一次被打甩給小兵；ult＝大招傷害的基準；text＝招式名
export const STAGES = {
  intro: { name: '遲到的社畜', sub: '第一天上班', minions: ['ma', 'mb'], minion: { hp: 3400, atk: 330 }, boss: null },
  crowd: { name: '加班大隊', sub: '人越來越多了', minions: ['ma', 'mb', 'mc'], kinds: { mc: 'courier' }, minion: { hp: 4200, atk: 340 }, boss: null },
  night: { name: '夜班大隊', sub: '燈還亮著', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'knight', mc: 'intern' }, minion: { hp: 5600, atk: 430 }, boss: null },
  // 第三、四站的另外幾種組合（每一輪抽一種，見 MAPS 的 pool）：大媽和阿北第一次登場不同場，阿北不跟重甲兵同場
  crowd_a: { name: '總務櫃檯', sub: '這個我沒經手，你問隔壁看看', minions: ['ma', 'mb', 'mc'], kinds: { mc: 'auntie' }, minion: { hp: 4000, atk: 340 }, boss: null },
  crowd_s: { name: '樓梯間的煙', sub: '這個我不會用啦，你幫我按一下', minions: ['ma', 'mb', 'mc'], kinds: { mc: 'smoker' }, minion: { hp: 4200, atk: 340 }, boss: null },
  night_a: { name: '檔案室夜班', sub: '早就說了，這個不是我負責的', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'knight', mc: 'auntie' }, minion: { hp: 5200, atk: 430 }, boss: null },
  night_s: { name: '頂樓吸菸區', sub: '燈還亮著，煙也還在', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'courier', mb: 'smoker', mc: 'intern' }, minion: { hp: 5600, atk: 430 }, boss: null },
  chief: { name: '甩鍋課長', sub: '這不是我的問題', minions: ['ma', 'mb'], minion: { hp: 3000, atk: 360 },
    boss: { id: 'chief', name: '甩鍋課長', hp: 45000, spd: 200, spd2: 0, atk: 950, shield: 5, cycle: 4, guard: false, pot: true, ult: 900, text: { charge: '蓄力　這不是我的問題', atk: '甩鍋', ult: '奧義　全體背鍋', summon: '召喚　找人背鍋' } } },
  // 第六站的另外兩位頭目（每一輪跟甩鍋課長三選一）
  // echo＝附議：普通攻擊的回合改成照抄一隻小兵的行動（先指定好，畫面會預告）；輪到他時那隻小兵已經倒了，這次行動就落空
  parrot: { name: '鸚鵡長官', sub: '對，我剛剛也是這個意思', minions: ['ma', 'mb'], kinds: { ma: 'courier', mb: 'intern' }, minion: { hp: 3800, atk: 360 },
    boss: { id: 'parrot', name: '鸚鵡長官', hp: 45000, spd: 220, spd2: 0, atk: 1050, shield: 6, cycle: 4, guard: false, pot: false, echo: true, ult: 1050, text: { charge: '蓄力　主管說得有道理', atk: '照案敲定', ult: '奧義　全體一致通過', summon: '召喚　找幾個人來附議', down: '我只是轉達，又不是我決定的……' } } },
  // proj＝臨時專案：蓄力時指定一隻小兵（沒有小兵就先叫一隻），放大招時那隻還活著才放得出來，倒了大招就落空
  monkey: { name: '猴子長官', sub: '這個很簡單啊，今天做得完吧？', minions: ['ma', 'mb'], minion: { hp: 3000, atk: 380 },
    boss: { id: 'monkey', name: '猴子長官', hp: 43000, spd: 270, spd2: 0, atk: 1100, shield: 5, cycle: 4, guard: false, pot: false, proj: true, ult: 1400, text: { charge: '蓄力　我突然有個想法', atk: '順手捅一下', ult: '奧義　今晚就要上線', summon: '召喚　大家先放下手邊工作', down: '不然先改回原本那版好了。' } } },
  // 菁英：沒有護衛也不甩鍋，但是大招會把氣勢扣掉（moDrain），身邊帶一個催稿的、一個會補血的
  audit: { name: '考績魔導士', sub: '請進，把門帶上', minions: ['ma', 'mb'], kinds: { ma: 'courier', mb: 'intern' }, minion: { hp: 4200, atk: 380 },
    boss: { id: 'audit', name: '考績魔導士', hp: 34000, spd: 230, spd2: 0, atk: 900, shield: 6, cycle: 4, guard: false, pot: false, ult: 900, moDrain: 40, text: { charge: '蓄力　年度考核', atk: '紅筆退件', ult: '奧義　考績丙等', summon: '召喚　找人來補件' } } },
  // 第九站的另一位菁英（每一輪跟考績魔導士二選一）。brag＝成果灌水：大招威力＝0.5＋底氣比例（從蓄力開始算最低的那一刻），底氣削得越多越不痛
  pig: { name: '豬腦長官', sub: '方向是我定的，大家只是把它做出來', minions: ['ma', 'mb'], kinds: { ma: 'auntie', mb: 'smoker' }, minion: { hp: 3800, atk: 380 },
    boss: { id: 'pig', name: '豬腦長官', hp: 37000, spd: 190, spd2: 0, atk: 1000, shield: 7, cycle: 4, guard: false, pot: false, brag: true, ult: 1000, text: { charge: '蓄力　這案子我從頭就在帶', atk: '功勞蓋章', ult: '奧義　年度成果發表', summon: '召喚　執行細節請同仁補充', down: '執行有落差，這個要再檢討。' } } },
  // ---- 台灣篇的關卡（base＝沒指定的位置站誰）。三個頭目各有一個新機制：
  // wok＝這鍋你背：蓄力時把鍋掛在我方一個人身上，大招只打他（1.7 倍）；那個人在防禦，鍋就彈回去，頭目受重傷並理虧
  // fee＝加收服務費：招牌亮著時我方用招式多扣這麼多 SP；普通攻擊打中他三下招牌就熄，他下一次蓄力再點亮
  // layers＝再加一層就好：他每行動一次加蓋一層（最多三層），被招式打中拆一層；大招威力＝0.7＋0.4×層數
  tw_intro: { name: '巷口騎樓', sub: '颱風天，照常上班', base: 'tw_drone', minions: ['ma', 'mb'], minion: { hp: 3400, atk: 330 }, boss: null },
  tw_rescue1: { name: '燈會值班', sub: '燈還沒掛完，誰都不准走', base: 'tw_drone', minions: ['ma', 'mb'], kinds: { mb: 'tw_courier' }, minion: { hp: 3600, atk: 330 }, boss: null },
  tw_ridge: { name: '屋脊巡邏', sub: '上面的人說，再巡一圈', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_knight' }, minion: { hp: 4200, atk: 350 }, boss: null },
  tw_stall: { name: '騎樓攤位', sub: '這個不歸我們管', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { mc: 'tw_auntie' }, minion: { hp: 4200, atk: 350 }, boss: null },
  tw_plaza: { name: '廟埕夜班', sub: '燈會結束前，都算上班時間', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_knight', mb: 'tw_courier', mc: 'tw_intern' }, minion: { hp: 5000, atk: 420 }, boss: null },
  tw_pot: { name: '剪黏甩鍋課長', sub: '這鍋，我早就幫你留好了', base: 'tw_drone', minions: ['ma', 'mb'], minion: { hp: 3200, atk: 370 },
    boss: { id: 'tw_pot', like: 'chief', name: '剪黏甩鍋課長', hp: 50000, spd: 200, spd2: 0, atk: 1100, shield: 6, cycle: 3, guard: false, pot: true, wok: true, ult: 1100, text: { charge: '蓄力　這鍋你背', atk: '紅筆長槍', ult: '奧義　黑鍋壓頂', summon: '召喚　再找兩個來背', down: '這次是鍋的問題，不是我的問題。' } } },
  tw_queue: { name: '排隊人龍', sub: '號碼牌抽了嗎', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_courier', mc: 'tw_intern' }, minion: { hp: 5200, atk: 430 }, boss: null },
  tw_alley: { name: '夜市後巷', sub: '借過，後面還有三桶', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_smoker', mc: 'tw_auntie' }, minion: { hp: 5200, atk: 430 }, boss: null },
  tw_night: { name: '不夜城營運總監', sub: '本店全年無休，同仁也是', base: 'tw_drone', minions: ['ma', 'mb'], kinds: { ma: 'tw_courier', mb: 'tw_intern' }, minion: { hp: 4200, atk: 390 },
    boss: { id: 'tw_night', like: 'audit', name: '不夜城營運總監', hp: 42000, spd: 240, spd2: 0, atk: 1050, shield: 7, cycle: 4, guard: false, pot: false, fee: 10, ult: 1150, text: { charge: '蓄力　招牌全部點亮', atk: '價目牌飛擲', ult: '奧義　全年無休', summon: '召喚　叫下一班來', down: '今天……提早打烊。' } } },
  tw_stairs: { name: '頂樓樓梯間', sub: '電梯停了，用走的', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_knight', mb: 'tw_smoker', mc: 'tw_intern' }, minion: { hp: 5600, atk: 460 }, boss: null },
  tw_hall: { name: '鐵皮走廊', sub: '這一層是後來加的', base: 'tw_drone', minions: ['ma', 'mb', 'mc'], kinds: { ma: 'tw_knight', mb: 'tw_courier', mc: 'tw_auntie' }, minion: { hp: 5800, atk: 470 }, boss: null },
  tw_roof: { name: '鐵皮增建處長', sub: '再加一層就好，很快', base: 'tw_drone', minions: ['ma', 'mb'], kinds: { ma: 'tw_knight', mb: 'tw_smoker' }, minion: { hp: 3800, atk: 420 },
    boss: { id: 'tw_roof', like: 'boss', name: '鐵皮增建處長', hp: 82000, spd: 210, spd2: 0, atk: 1300, shield: 9, cycle: 4, guard: false, pot: false, layers: true, ult: 1150, text: { charge: '蓄力　再加一層就好', atk: '鋼梁槌', ult: '奧義　整棟壓下來', summon: '召喚　留守的都上來', down: '結構……本來就沒有問題……' } } },
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
// 頭目的弱點；locks＝蓄力時會不會出現「屬性鎖」（已經有自己蓄力機制的頭目不出）
const BOSS_WEAK = { boss: ['holy', 'slash'], chief: ['fire', 'blunt'], audit: ['slash', 'fire'], parrot: ['ice', 'slash'], monkey: ['fire', 'holy'], pig: ['slash', 'dark'], tw_pot: ['blunt', 'ice'], tw_night: ['dark', 'ice'], tw_roof: ['fire', 'blunt'], m_kevin: ['fire', 'dark'], m_fairy: ['slash', 'fire'], m_vivi: ['dark', 'blunt'] };
for (const st of Object.values(STAGES)) if (st.boss) { st.boss.weak = BOSS_WEAK[st.boss.id] || []; st.boss.locks = !(st.boss.proj || st.boss.wok || st.boss.brag || st.boss.layers); }
// 肉鴿路線（行程表）：一層一站，有兩個選項的那一層要選一邊走。
// type：battle 戰鬥（打贏三選一強化）、rest 茶水間、gift 福委會（直接三選一）、recruit 招募（三個人選一個）、event 事件（EVENTS 抽一個，選一個選項）。rescue＝打贏救出一個夥伴。bonus＝打贏多拿的道具。
// 兩張地圖：office＝一般行程（討伐奧客總經理）；mirror＝鏡像內戰（很難，對面是自己人的鏡像，最後是鏡像 Vivi 帶著阿傑、小葵）。
// 兩張的站數與岔路形狀一樣（畫面上鏡像地圖是把藍圖左右翻過來），招募、事件、休息都照舊。MAP＝現在這一輪用的那一張（newRun／loadRun 會切）
export const MAPS = { office: [
  [{ type: 'battle', stage: 'intro', tag: '戰鬥', icon: 'battle' }],
  [{ type: 'recruit', name: '新人報到', tag: '招募', icon: 'recruit', sub: '三位同事選一位同行' }],
  [{ type: 'battle', stage: 'crowd', pool: ['crowd', 'crowd_a', 'crowd_s'], tag: '戰鬥', icon: 'battle' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'night', pool: ['night', 'night_a', 'night_s'], tag: '救援', icon: 'rescue', rescue: true, sub: '打贏救出一位夥伴' }],
  [{ type: 'event', name: '走廊轉角', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'battle', stage: 'chief', pool: ['chief', 'parrot', 'monkey'], tag: '頭目', icon: 'chief' }],
  [{ type: 'gift', name: '福委會', tag: '福利', icon: 'gift', sub: '直接三選一強化' }, { type: 'recruit', name: '獵頭公司', tag: '招募', icon: 'hunt', sub: '三位同事選一位同行' }],
  [{ type: 'event', name: '樓梯間', tag: '事件', icon: 'event', sub: '不知道會遇到什麼' }],
  [{ type: 'rest', name: '茶水間', tag: '休息', icon: 'rest', sub: 'HP 回復一半　SP 補滿' }, { type: 'battle', stage: 'audit', pool: ['audit', 'pig'], tag: '菁英', icon: 'elite', bonus: { tea: 1, coffee: 1, bento: 1 }, sub: '打贏多拿奶茶、咖啡、便當各一' }],
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
// 台灣篇：十二站、三條支線（上、中、下）。to＝從這一站可以走到下一層的哪幾站（沒寫就是都可以）；相鄰的路才換得過去
const LANE = [[0, 1], [0, 1, 2], [1, 2]], B = (stage, tag = '戰鬥', icon = 'battle', more = {}) => ({ type: 'battle', stage, tag, icon, ...more }), RESCUE = { rescue: true, sub: '打贏救出一位夥伴' };
const N = (type, name, tag, icon, sub) => ({ type, name, tag, icon, sub }), REST = name => N('rest', name, '休息', 'rest', 'HP 回復一半　SP 補滿'), GIFT = name => N('gift', name, '福利', 'gift', '直接三選一強化'), EVT = name => N('event', name, '事件', 'event', '不知道會遇到什麼'), REC = (name, icon = 'recruit') => N('recruit', name, '招募', icon, '三位同事選一位同行');
const lanes = fl => fl.map((nd, i) => ({ ...nd, to: LANE[i] }));
MAPS.taiwan = [
  [B('tw_intro')],
  lanes([REC('里民活動中心'), B('tw_rescue1', '救援', 'rescue', RESCUE), REC('巷口早餐店', 'hunt')]),
  lanes([B('tw_ridge'), EVT('騎樓轉角'), B('tw_stall')]),
  [REST('廟口茶攤'), B('tw_plaza', '救援', 'rescue', RESCUE), GIFT('里長辦公室')],
  [B('tw_pot', '頭目', 'chief')],
  lanes([REC('獵頭攤車', 'hunt'), EVT('夜市入口'), REST('豆花攤')]),
  lanes([B('tw_queue'), B('tw_night', '菁英', 'elite', { bonus: { tea: 1, coffee: 1, bento: 1 }, sub: '打贏多拿奶茶、咖啡、便當各一' }), B('tw_alley')]),
  [GIFT('福委會攤位'), REST('剉冰店'), EVT('夜市後門')],
  [EVT('天橋')],
  lanes([B('tw_stairs', '救援', 'rescue', RESCUE), REST('頂樓水塔'), GIFT('頂樓菜園')]),
  [B('tw_hall'), EVT('曬衣場'), REC('頂樓鄰居')],
  [B('tw_roof', '魔王', 'boss')],
];
export let MAP = MAPS.office;
export const useMap = key => { MAP = MAPS[key] || MAPS.office; return MAP; };
// 有 pool 的站每一輪抽一種敵人組合（記在 run.alt[原本的 stage]）；stageOf＝這一輪這一站實際打哪一場。舊存檔沒有 alt，就打原本那一場
export const stageOf = (run, nd) => (nd && run && run.alt && run.alt[nd.stage]) || (nd && nd.stage);
export const nodeName = (nd, run) => nd.name || STAGES[stageOf(run, nd)].name;
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
  const run = { rand, map: MAPS[map] ? map : 'office', floor: 0, node: MAP[0][0], path: [], offers: {}, events: {}, tally: { brk: 0, ult: 0, fights: 0 }, atk: 1, def: 1, moStart: MO.start, items: {}, hp: {}, sp: {}, skills: {}, roster: [], starter, picks: [], rounds: 0, summons: 0, alt: {} };
  for (const fl of MAP) for (const nd of fl) if (nd.pool) run.alt[nd.stage] = nd.pool[Math.floor(rand() * nd.pool.length)];
  for (const k in ITEMS) run.items[k] = ITEMS[k].n;
  if (starter) { join(run, starter); run.skills[starter] = [skill || SKILLS[starter][0].key, START2[starter]].filter(Boolean); } else for (const id of ['kui', 'kevin', 'jie', 'mi', 'vivi']) join(run, id);
  return run;
}
// 加入名冊（滿血滿 SP、會全部招式）
export function join(run, id) { if (run.roster.includes(id) || run.roster.length >= 6) return false; run.roster.push(id); run.hp[id] = STAT[id].hp; run.sp[id] = STAT[id].sp; run.skills[id] = SKILLS[id].map(k => k.key); return true; }
// 上場的人：名冊前四個（至少要有一個不是 Vivi 的人）
export function active(run) { const a = run.roster.slice(0, 4); if (!a.some(id => id !== 'vivi')) { const f = run.roster.find(id => id !== 'vivi'); if (f) a[a.length - 1] = f; } return a; }
// 名冊裡把第 i 個往前（d=-1）或往後（d=1）移
export function reorder(run, i, d) { const j = i + d; if (j < 0 || j >= run.roster.length) return false; [run.roster[i], run.roster[j]] = [run.roster[j], run.roster[i]]; return true; }
// 這一層現在走得到哪幾站（看上一層選的那一站的 to）
export const reachable = run => { const fl = MAP[run.floor] || [], prev = run.floor > 0 && MAP[run.floor - 1][run.path[run.floor - 1]]; return prev && prev.to ? prev.to.filter(i => fl[i]) : fl.map((_, i) => i); };
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
// 把這一場的統計（理虧幾次、放了幾次奧義）加進這一輪；輸掉的那一場由畫面在結案時呼叫
export function addTally(s, run) { if (s.tallied) return; s.tallied = true; run.tally.brk += s.tally.brk; run.tally.ult += s.tally.ult; }
export function endStage(s, run) { for (const id of HEROES) { run.hp[id] = Math.min(STAT[id].hp, Math.max(0, s.hp[id]) + Math.round(STAT[id].hp * .25)); run.sp[id] = Math.min(STAT[id].sp, s.sp[id] + Math.round(STAT[id].sp * .3)); }
  addTally(s, run); run.tally.fights++;
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
    const pools = Object.fromEntries(MAP.flat().filter(nd => nd.pool).map(nd => [nd.stage, nd.pool])); ok(d.alt == null || (typeof d.alt === 'object' && Object.entries(d.alt).every(([k, v]) => pools[k] && pools[k].includes(v))));
    const run = newRun(rand, d.roster[0], null, mp);      // newRun 會把 STAT 還原成基本值；「特休」強化改過的 HP 上限照拿過的次數重算
    for (const k of d.picks) if (k === 'leave') for (const id of ALL) if (id !== 'vivi') STAT[id].hp = Math.round(STAT[id].hp * 1.2);
    run.hp = {}; run.sp = {}; run.skills = {};
    for (const id of d.roster) { ok(num(d.hp?.[id]) && num(d.sp?.[id]) && Array.isArray(d.skills?.[id]) && d.skills[id].length >= 1 && d.skills[id].every(k => SKILLS[id].some(s => s.key === k)));
      run.hp[id] = Math.max(0, Math.min(STAT[id].hp, d.hp[id])); run.sp[id] = Math.max(0, Math.min(STAT[id].sp, d.sp[id])); run.skills[id] = d.skills[id].slice(); }
    Object.assign(run, { floor: d.floor, path: d.path.slice(), offers: d.offers, events: { ...d.events }, tally: { brk: +(d.tally?.brk) || 0, ult: +(d.tally?.ult) || 0, fights: +(d.tally?.fights) || 0 }, atk: d.atk, def: d.def, moStart: d.moStart, items: Object.fromEntries(Object.keys(ITEMS).map(k => [k, d.items[k]])), roster: d.roster.slice(), starter: d.starter ?? null, picks: d.picks.slice(), rounds: d.rounds, summons: d.summons, alt: { ...(d.alt || {}) } });
    run.node = MAP[d.floor][d.pend ? d.path[d.floor] : 0]; prepare(run);
    return { run, pend: d.pend || null, rescued: d.rescued || null };
  } catch (e) { return null; }
}

// ---------- 一場戰鬥 ----------
export function newState(run = newRun()) {
  if (typeof run === 'function') { run = newRun(run); run.floor = MAP.length - 1; run.node = MAP[run.floor][0]; }      // 舊用法 newState(rand)：五人隊直接打魔王
  const st = STAGES[stageOf(run, run.node)], rand = run.rand, act = active(run); HEROES.length = 0; HEROES.push(...act); FRONT.length = 0; FRONT.push(...act.filter(id => id !== 'vivi'));
  const [hk, ak] = SCALE[Math.min(4, HEROES.length)], sc = (v, k) => Math.round(v * k);
  const kind = {}, spare = Object.keys(KINDS).filter(k => KINDS[k].hero && !Object.values(st.kinds || {}).includes(k)); MINIONS.length = 0; MINIONS.push(...st.minions);
  for (const m of SLOTS) { const want = (st.kinds || {})[m]; kind[m] = want === 'random' ? spare.splice(Math.floor(rand() * spare.length), 1)[0] : want || st.base || 'drone'; const K = KINDS[kind[m]]; Object.assign(STAT[m], { hp: sc(st.minion.hp * K.hp * TUNE.hp, hk), atk: sc(st.minion.atk * K.atk * TUNE.atk, ak), spd: K.spd || BASE[m].spd }); }
  BOSS_ULT = {}; if (st.boss) { Object.assign(STAT.boss, st.boss, { hp: sc(st.boss.hp * TUNE.bhp, hk), atk: sc(st.boss.atk * TUNE.batk, ak) }); for (const id of FRONT) BOSS_ULT[id] = sc(st.boss.ult * TUNE.ult * (.82 + .18 * STAT[id].hp / 2680), ak); }
  const s = { run, kind, hk, L: st.boss, hasBoss: !!st.boss, potUsed: false, rand, hp: {}, sp: {}, mo: run.moStart, defend: {}, items: { ...run.items }, round: 0, queue: [], events: [], shield: st.boss ? st.boss.shield : 0, broken: false, charging: false, bossTurns: 0,
    aegis: false, taunt: false, carry: false, duty: 0, bulwark: false, cover: null, dodge: false, counter: {}, meeting: false, friends: false, evidence: run.picks.includes('dossier') ? 2 : 0, aidUsed: false, plan: {}, tally: { brk: 0, ult: 0, ko: 0 }, burn: {}, mark: {}, atkDown: {}, atkUp: 0, evade: {}, bless: {}, endure: 0, overtime: run.picks.includes('crunch') ? 2 : 0, fairyBuff: act.includes('fairy'), summons: 0, over: null,
    smoke: {}, echo: null, proj: null, bragLow: 0, inSkill: false, ward: {}, regen: {}, poison: {}, stun: {}, up: {}, downK: {}, guardian: null, warmed: false, dodged: false, locks: null, lockN: 0, cmd: { mo: false, chip: false, lock: false }, curType: null, extra: 0, bonus: {}, onBonus: null, wok: null, sign: st.boss && st.boss.fee ? 3 : 0, layers: st.boss && st.boss.layers ? 1 : 0, layerHit: false };      // smoke[我方]＝被哪個敵人的煙嗆到；echo＝鸚鵡這次要附議誰；proj＝猴子的臨時專案是誰；bragLow＝豬腦蓄力以來底氣最低剩多少
  for (const id of HEROES) { s.hp[id] = run.hp[id]; s.sp[id] = run.sp[id]; }
  s.hp.boss = st.boss ? STAT.boss.hp : 0; for (const m of SLOTS) s.hp[m] = MINIONS.includes(m) ? STAT[m].hp : 0;
  return s;
}
export const alive = (s, id) => s.hp[id] > 0;
export const weakOf = (s, f) => (f === 'boss' ? s.L && s.L.weak : KINDS[s.kind[f]] && KINDS[s.kind[f]].weak) || [];
const newCmd = s => { s.cmd = { mo: false, chip: false, lock: false }; };      // 每下一個指令（或敵人每行動一次）重算「只給一次」的加成
// 這個人現在打得出哪些屬性（普攻＋學會的攻擊招式）
export const typesOf = (s, id) => [...new Set([ATK_TYPE[id], ...SKILLS[id].filter(k => k.type && (s.run.skills[id] || []).includes(k.key)).map(k => k.type)].filter(Boolean))];
export const smoked = (s, id) => !!(s.smoke[id] && alive(s, s.smoke[id]));      // 這個人現在是不是被煙嗆到（下一次普通攻擊減半）
// 豬腦長官的大招現在幾成威力（1＝100%）。蓄力中看蓄力以來最低的底氣，還沒蓄力就看現在的底氣
export const roofPow = s => .7 + .4 * s.layers;      // 鐵皮增建處長的大招威力（看加蓋幾層）
export const bragPow = s => s.L && s.L.brag ? .5 + (s.charging ? s.bragLow : s.shield) / s.L.shield : 1;
const hurtFoe = s => ['boss', ...MINIONS].filter(f => alive(s, f) && s.hp[f] < STAT[f].hp).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0];
const has = (s, k) => s.run.picks.includes(k);      // 這一輪有沒有拿某個強化
export const guarded = s => !!(s.L && s.L.guard) && MINIONS.some(id => alive(s, id));
export const foes = s => ['boss', ...MINIONS].filter(id => alive(s, id));
export const knows = (s, id, key) => (s.run.skills[id] || []).includes(key);
const vary = (s, v, k = .08) => Math.round(v * (1 - k + s.rand() * 2 * k));
const check = s => { if (s.hasBoss ? s.hp.boss <= 0 : MINIONS.every(m => !alive(s, m))) s.over = 'win'; else if (FRONT.every(id => !alive(s, id))) s.over = 'lose'; };
const gain = (s, n) => { s.mo = Math.max(0, Math.min(MO.max, s.mo + n)); return s.mo; };
// 附帶效果的結果都記成 r.fxs 裡的一筆，畫面照著演：{ t: 'ward'|'heal'|'sp'|'mo'|'tag', dst, v, hp, sp, mo, text }
const FX = { ward: (s, dst, v, why) => { if (!alive(s, dst)) return null; s.ward[dst] = Math.max(s.ward[dst] || 0, v); return { t: 'ward', dst, v, why }; },
  heal: (s, dst, v, why) => { if (!alive(s, dst)) return null; const x = Math.min(v, STAT[dst].hp - s.hp[dst]); s.hp[dst] += x; return x > 0 ? { t: 'heal', dst, v: x, hp: s.hp[dst], why } : null; },
  sp: (s, dst, v, why) => { if (!alive(s, dst)) return null; const x = Math.min(v, STAT[dst].sp - s.sp[dst]); s.sp[dst] += x; return x > 0 ? { t: 'sp', dst, v: x, sp: s.sp[dst], why } : null; },
  mo: (s, v, why) => ({ t: 'mo', v, mo: gain(s, v), why }), tag: (dst, text) => ({ t: 'tag', dst, text }) };
const addFx = (r, x) => { if (x) (r.fxs || (r.fxs = [])).push(x); return x; };
const lowHp = (s, not) => FRONT.filter(h => alive(s, h) && h !== not).sort((a, b) => s.hp[a] / STAT[a].hp - s.hp[b] / STAT[b].hp)[0];
const lowSp = (s, not, first = []) => FRONT.filter(h => alive(s, h) && h !== not && s.sp[h] < STAT[h].sp).sort((a, b) => first.includes(b) - first.includes(a) || s.sp[a] / STAT[a].sp - s.sp[b] / STAT[b].sp)[0];
export const cleanse = (s, id) => { const had = !!s.smoke[id]; s.smoke[id] = null; return had; };
// 普攻附帶效果
function rider(s, id, target, r) { const h0 = r.hits[0], hit = h0 && !h0.guard && h0.v > 0;
  if (id === 'kui') addFx(r, FX.ward(s, id, 180)); else if (id === 'kevin') addFx(r, FX.heal(s, id, 180)); else if (id === 'hui') addFx(r, FX.heal(s, id, 120)); else if (id === 'zong') addFx(r, FX.ward(s, id, 200));
  else if (id === 'mi') { const t = lowHp(s); if (t) addFx(r, FX.heal(s, t, 180)); } else if (id === 'cha') { const t = lowHp(s, id) || id; addFx(r, FX.ward(s, t, 220)); }
  else if (id === 'yan') { const t = lowSp(s, id); if (t) addFx(r, FX.sp(s, t, 6)); } else if (id === 'fairy') { const t = lowSp(s, id, ['zong', 'hui']); if (t) addFx(r, FX.sp(s, t, 8)); } else if (id === 'xu') { const t = lowSp(s, id, s.queue); if (t) addFx(r, FX.sp(s, t, 10)); }
  else if (id === 'heilun') addFx(r, FX.mo(s, 3)); else if (id === 'qiang') { s.regen[id] = { v: 220, n: 1 }; addFx(r, FX.tag(id, '下回合回 220')); }
  else if (id === 'you') { const x = addFx(r, FX.sp(s, id, r.spGain)); if (x) { r.spGain += x.v; r.fxs.pop(); } }
  else if (hit && alive(s, h0.dst)) { const f = h0.dst;
    if (id === 'jie') { s.atkDown[f] = Math.max(s.atkDown[f] || 0, 1); s.downK[f] = Math.max(s.downK[f] || 0, .1); addFx(r, FX.tag(f, '攻擊力 ↓')); }
    else if (id === 'wu') { s.mark[f] = Math.max(s.mark[f] || 0, 1); addFx(r, FX.tag(f, '露出破綻')); } } }
// 每次行動結束：被動特質、攻擊提升的次數
function after(s, id, r) { const hs = (r.hits || []).filter(h => h && !h.guard && h.v > 0), me = FRONT.includes(id);
  if (s.up[id] > 0 && r.kind !== 'item' && r.kind !== 'defend') s.up[id]--;
  if (id === 'kui' && hs.some(h => h.wk)) addFx(r, FX.sp(s, id, 6, '交件前再看一眼')); if (id === 'jie' && hs.some(h => s.burn[h.dst] > 0)) addFx(r, FX.mo(s, 3, '燒完記得存檔'));
  if (id === 'kevin' && alive(s, id)) addFx(r, FX.ward(s, id, 180, '站著就是進度')); if (id === 'mi' && FRONT.some(h => h !== id && alive(s, h) && s.hp[h] < STAT[h].hp * .5)) addFx(r, FX.sp(s, id, 8, '值班補貼'));
  if (id === 'yan' && (r.delayed || r.delayedAll)) addFx(r, FX.sp(s, id, 8, '行程留白')); if (id === 'cha' && FRONT.filter(h => alive(s, h)).length >= 3) addFx(r, FX.mo(s, 2, '氣氛不能冷'));
  if (id === 'senpai' && hs.some(h => s.mark[h.dst] > 0 || h.bounty)) addFx(r, FX.sp(s, id, 5, '查核有補助')); if (id === 'hui' && s.overtime > 0) addFx(r, FX.sp(s, id, Math.min(8, s.overtime * 2), '加班餐費'));
  if (id === 'xu' && (r.kind === 'skill' || r.kind === 'ult') && [...(r.spGains || []), ...(r.fxs || []).filter(x => x.t === 'sp')].some(x => x.dst !== id && x.v > 0)) addFx(r, FX.sp(s, id, 6, '轉接有回音'));
  if (r.kind === 'skill' && id !== 'wu' && !s.warmed && FRONT.includes('wu') && alive(s, 'wu')) { s.warmed = true; addFx(r, FX.sp(s, 'wu', 5, '暖場有成')); }
  if (me && r.kind === 'attack' && id === 'senpai') { /* 多削底氣在 doAttack 裡算 */ }
  r.mo = s.mo; return r; }

// 排這一回合的行動順序（頭目可能一回合動兩次）。回合開始時結算灼燒，結果放在 s.events 給畫面演
export function startRound(s) { s.round++; s.potUsed = false; s.meeting = false; s.extra = 0; s.bonus = {}; s.onBonus = null; if (s.atkUp > 0) s.atkUp--; if (s.endure > 0) s.endure--; s.events = [];
  if (has(s, 'tempo')) s.events.push({ kind: 'tempo', mo: gain(s, 8) });
  for (const f in s.burn) if (s.burn[f] > 0 && alive(s, f)) { s.burn[f]--; const v = Math.round(520 * s.run.atk * (has(s, 'ember') ? 1.6 : 1)); s.hp[f] = Math.max(0, s.hp[f] - v); s.events.push({ kind: 'burn', dst: f, v, hp: s.hp[f], kill: s.hp[f] <= 0 }); check(s); }
  for (const f in s.poison) { const p = s.poison[f]; if (p && p.n > 0 && alive(s, f)) { p.n--; s.hp[f] = Math.max(0, s.hp[f] - p.v); s.events.push({ kind: 'poison', dst: f, v: p.v, hp: s.hp[f], kill: s.hp[f] <= 0 }); check(s); } }
  for (const f in s.mark) if (s.mark[f] > 0) s.mark[f]--;
  s.warmed = false; s.dodged = false;
  for (const h of FRONT) { const g = s.regen[h]; if (g && g.n > 0 && alive(s, h)) { g.n--; const x = FX.heal(s, h, g.v); if (x) s.events.push({ kind: 'regen', dst: h, v: x.v, hp: x.hp }); } }
  // 每回合開始的被動
  if (HEROES.includes('vivi')) s.events.push({ kind: 'passive', who: 'vivi', name: '公主有交代', mo: gain(s, 3) });
  if (FRONT.includes('qiang') && alive(s, 'qiang') && s.duty > 0) { const x = FX.heal(s, 'qiang', 100 * s.duty); if (x) s.events.push({ kind: 'regen', dst: 'qiang', v: x.v, hp: x.hp, name: '扛久就習慣' }); }
  if (FRONT.includes('fairy') && alive(s, 'fairy')) { const n = FRONT.filter(h => (h === 'zong' || h === 'hui') && alive(s, h)).length, x = n && FX.sp(s, 'fairy', 4 * n); if (x) s.events.push({ kind: 'passive', who: 'fairy', name: '鼠輩互助會', sp: x.sp, v: x.v }); }
  if (FRONT.includes('zong') && alive(s, 'zong') && s.hp.zong <= STAT.zong.hp * .5) { FX.ward(s, 'zong', 350); s.events.push({ kind: 'passive', who: 'zong', name: '老班底撐場', ward: 350 }); }
  const list = [...HEROES, 'boss', ...MINIONS].filter(id => alive(s, id)).map(id => [id, STAT[id].spd]); if (alive(s, 'boss') && STAT.boss.spd2) list.push(['boss', STAT.boss.spd2]);
  for (const f of ['boss', ...MINIONS]) if (alive(s, f) && !s.plan[f]) planFoe(s, f);      // 剛上場或剛被叫回來的敵人，補上下一步要打誰
  s.queue = list.sort((a, b) => b[1] - a[1]).map(x => x[0]); return s.queue; }
// 輪到某個人（回傳 false＝這個人已經倒了，跳過）。自己身上「到下次行動前」的效果在這裡結束
export function beginTurn(s, id) {
  if (!alive(s, id)) return false; s.onBonus = null;
  if (HEROES.includes(id)) { if (s.bonus[id] > 0) { s.bonus[id]--; s.onBonus = id; }      // 這一次是別人送的「再動一次」：不能再送給別人
    s.ward[id] = 0; if (s.guardian === id) s.guardian = null;      // 護盾、吸引攻擊都只到自己下次行動開始
    s.defend[id] = false; s.counter[id] = false; if (id === 'kevin') { s.aegis = false; s.taunt = false; } if (id === 'qiang') { s.carry = false; s.bulwark = false; } if (id === 'cha') s.friends = false; s.evade[id] = false; }
  return true;
}
// 敵人的意圖：每個敵人事先決定「下一次單體攻擊打誰」（s.plan），畫面才能照實預告。真正出手時如果那個人倒了才重抽
function planFoe(s, id) { const t = FRONT.filter(h => alive(s, h)); s.plan[id] = t.length ? t[Math.floor(s.rand() * t.length)] : null;
  if (id === 'boss' && s.L && s.L.echo && s.echo == null) { const ms = MINIONS.filter(m => alive(s, m)); s.echo = ms.length ? ms[Math.floor(s.rand() * ms.length)] : null; } }      // 鸚鵡：順便指定下一次要附議哪隻小兵（沒有小兵就自己打）
// 給畫面用：這個敵人下一步要做什麼。kind：atk 單體攻擊、drain 攻擊並扣 SP、aoe 打全體、heal 幫同伴回血、charge 蓄力、ult 大招（全體）、stun 理虧中
// target 已經把「幫忙擋」算進去（Kevin 的吸引、阿強的搬、茶茶的代擋與聊天），所以玩家開了嘲諷會馬上看到箭頭改指向坦克
export function intent(s, id) { if (!alive(s, id)) return null; const raw = s.plan[id] && alive(s, s.plan[id]) ? s.plan[id] : null;
  const target = !raw ? null : s.dodge && alive(s, 'cha') ? 'cha' : s.cover && alive(s, s.cover) ? s.cover : s.carry && alive(s, 'qiang') ? 'qiang' : s.taunt && alive(s, 'kevin') ? 'kevin' : s.guardian && alive(s, s.guardian) ? s.guardian : raw, weak = s.atkDown[id] > 0;
  // 頭目多的欄位：pow＝豬腦大招幾成威力；proj／lost＝猴子的大招綁在哪隻小兵身上、那隻是不是已經倒了；echo＝鸚鵡這次附議誰（lost＝那隻已經倒了，這次落空）
  if (id !== 'boss' && s.stun[id]) return { kind: 'stun' };
  if (id === 'boss') { if (s.broken) return { kind: 'stun' }; if (s.charging) return { kind: 'ult', weak, locks: s.locks ? s.locks.slice() : null, lockN: s.lockN, wok: s.L.wok && s.wok && alive(s, s.wok) ? s.wok : null, pow: s.L.layers ? roofPow(s) : s.L.brag ? bragPow(s) : null, proj: s.L.proj ? s.proj : null, lost: !!s.L.proj && !(s.proj && alive(s, s.proj)) }; if ((s.bossTurns + 1) % STAT.boss.cycle === STAT.boss.cycle - 1) return { kind: 'charge' };
    if (s.L.echo && s.echo) { if (!alive(s, s.echo)) return { kind: 'echo', echo: s.echo, lost: true }; const K = KINDS[s.kind[s.echo]], hurt = K.heal && hurtFoe(s); return hurt ? { kind: 'echo', echo: s.echo, act: 'heal', target: hurt } : { kind: 'echo', echo: s.echo, act: K.drain ? 'drain' : 'atk', target, weak, drain: K.drain }; }
    return { kind: 'atk', target, weak }; }
  const K = KINDS[s.kind[id]]; if (K.heal) { const hurt = hurtFoe(s); if (hurt) return { kind: 'heal', target: hurt }; }
  return K.aoe ? { kind: 'aoe', weak } : { kind: K.drain ? 'drain' : 'atk', target, weak, drain: K.drain, smoke: !!K.smoke }; }
// 傷害預估（不含浮動與爆擊）：普通攻擊或某一招打某個敵人大約多少。打不到（護衛中）回傳 0；這一招不是攻擊回傳 null
const SKPOW = { draft: 1.7, sweep: s => foes(s).length === 1 ? 1.5 : .75, bash: 1.4, barrage: .8, burn: 1.1, freeze: 1, delay: .7, deal: 1.2, box: s => 1.5 * (1 + .3 * s.duty), probe: .9, expose: (s, t) => t === 'boss' && s.broken ? 2 : 1.3, backdoor: 1.1, mice: .45, news: 1.2, overtime: 1, allnight: 2 };
export function preview(s, id, target, key) { const sk = key && SKILLS[id].find(x => x.key === key), fd = sk && sk.fx && sk.fx.find(x => x[0] === 'dmg'), pw = key ? SKPOW[key] ?? (fd ? fd[1] : null) : 1; if (pw == null) return null; if (!alive(s, target)) return 0;
  if (target === 'boss' && guarded(s) && !(sk && sk.pierce)) return 0; const m = typeof pw === 'function' ? pw(s, target) : pw, armor = (target !== 'boss' && (key ? KINDS[s.kind[target]].dull : KINDS[s.kind[target]].armor) || 1) * (!key && smoked(s, id) ? .5 : 1);
  return Math.round(STAT[id].atk * m * s.run.atk * (s.atkUp > 0 ? 1.5 : 1) * (s.up[id] > 0 ? 1.25 : 1) * (s.bless[id] ? 2 : 1) * (id === 'hui' ? 1 + .2 * s.overtime : 1) * (s.fairyBuff && (id === 'zong' || id === 'hui') ? 1.2 : 1) * (target === 'boss' && s.broken ? (has(s, 'weakpoint') ? 2 : 1.5) : 1) * (s.mark[target] > 0 ? 1.3 : 1) * (armor || 1)); }
export const canUlt = (s, id) => s.mo >= MO.ult && s.sp[id] >= STAT[id].cost && !(id === 'wu' && (s.onBonus === id || s.extra >= EXTRA_MAX));

// 打敵人：回傳一筆結果 { dst, v, guard, crit, kill, brk, hp, shield, pot }
function hitFoe(s, src, dst, base, o = {}) {
  if (!alive(s, dst)) return null; const type = o.type ?? s.curType ?? ATK_TYPE[src] ?? null, lk = {};
  // 屬性鎖：頭目蓄力中，用鎖上的屬性打他一下拆一個（一個指令最多拆一個；護衛中、被甩鍋也算）。全拆 → 大招取消、頭目理虧
  if (dst === 'boss' && s.locks && s.locks.length && type && !s.cmd.lock) { const i = s.locks.indexOf(type); if (i >= 0) { s.locks.splice(i, 1); s.cmd.lock = true; lk.lock = s.locks.length; lk.lockType = type; if (!s.locks.length) { s.locks = null; s.charging = false; s.broken = true; s.shield = 0; s.tally.brk++; lk.lockAll = true; lk.brk = true; } } }
  if (dst === 'boss' && guarded(s) && !o.pierce) return { src, dst, v: 0, guard: true, hp: s.hp.boss, shield: s.shield, ...lk };
  if (dst === 'boss' && s.L.pot && !s.potUsed && !o.pierce) { const m = MINIONS.find(x => alive(s, x)); if (m) { s.potUsed = true; return { ...hitFoe(s, src, m, base, { ...o, type }), pot: true, ...lk }; } }      // 甩鍋：這回合第一下由小兵背
  const bl = !!s.bless[src]; if (bl) s.bless[src] = false; const crit = bl || (!o.noCrit && s.rand() < .12); let v = vary(s, base) * s.run.atk * (s.atkUp > 0 ? 1.5 : 1) * (s.up[src] > 0 ? 1.25 : 1) * (crit ? (bl ? 2 : 1.5) : 1) * (src === 'hui' ? 1 + .2 * s.overtime : 1) * (s.fairyBuff && (src === 'zong' || src === 'hui') ? 1.2 : 1) * (dst === 'boss' && s.broken ? (has(s, 'weakpoint') ? 2 : 1.5) : 1) * (s.mark[dst] > 0 ? 1.3 : 1); const armor = o.basic && dst !== 'boss' && KINDS[s.kind[dst]].armor; if (armor) v *= armor; const dull = s.inSkill && dst !== 'boss' && KINDS[s.kind[dst]].dull; if (dull) v *= dull; const wk = !!type && weakOf(s, dst).includes(type); if (wk) v *= 1.3; v = Math.round(v);
  s.hp[dst] = Math.max(0, s.hp[dst] - v); const r = { src, dst, v, crit, weak: true, kill: s.hp[dst] <= 0, hp: s.hp[dst], type, ...lk }; if (wk) { r.wk = true; if (!s.cmd.mo) { s.cmd.mo = true; gain(s, 6); r.wkMo = 6; } } if (armor) { r.armor = true; r.weak = false; } if (dull) { r.dull = true; r.weak = false; }
  if (dst === 'boss' && s.L.fee && o.basic && s.sign > 0 && v > 0) { s.sign--; r.sign = s.sign; }      // 不夜城：普攻打中一下，招牌暗一格
  if (dst === 'boss' && s.L.layers && s.inSkill && s.layers > 0 && !s.layerHit) { s.layers--; s.layerHit = true; r.layerDown = s.layers; }      // 鐵皮：一招拆一層
  if (r.kill && dst === s.proj) r.projDown = true;      // 猴子的臨時專案被打倒：大招放不出來了
  if (r.kill && s.mark[dst] > 0) { s.mark[dst] = 0; gain(s, 20); r.bounty = true; if (FRONT.includes('heilun') && alive(s, 'heilun')) { const x = FX.sp(s, 'heilun', 10, '成交有回饋'); if (x) r.fxs = [x]; } if (has(s, 'bounty')) { r.bountySp = 25; for (const h of FRONT) if (alive(s, h)) s.sp[h] = Math.min(STAT[h].sp, s.sp[h] + 25); } }
  if (dst === 'boss' && !s.broken && !r.kill) { const more = wk && !s.cmd.chip ? 1 : 0; if (more) s.cmd.chip = true; s.shield = Math.max(0, s.shield - (o.sh ?? 1) - more); if (s.charging) s.bragLow = Math.min(s.bragLow, s.shield); if (s.shield === 0) { s.broken = true; r.brk = true; s.tally.brk++; } }
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
  else if (single && s.guardian && alive(s, s.guardian)) { if (list[0][0] !== s.guardian) out.taunted = list[0][0]; list = [[s.guardian, list[0][1]]]; }
  for (const [id, raw] of list) { if (!alive(s, id)) continue; if (s.evade[id]) { s.evade[id] = false; const m = { src, dst: id, v: 0, miss: true, hp: s.hp[id] }; if (!s.dodged && FRONT.includes('you') && alive(s, 'you')) { s.dodged = true; m.fxs = [FX.mo(s, 5, '看破不說破')]; } out.push(m); continue; }
    const ctr = !!s.counter[id]; let v = Math.round(vary(s, raw) * s.run.def * (s.defend[id] ? .5 : 1) * (s.meeting ? .6 : 1) * (s.friends ? .5 : 1) * (ctr ? .4 : 1)); const ab = Math.min(s.ward[id] || 0, v); if (ab > 0) { s.ward[id] -= ab; v -= ab; } const saved = s.endure > 0 && v >= s.hp[id]; if (saved) v = s.hp[id] - 1; const aid = v >= s.hp[id] && !s.aidUsed && has(s, 'firstaid'); if (aid) s.aidUsed = true;
    s.hp[id] = aid ? Math.round(STAT[id].hp * .3) : Math.max(0, s.hp[id] - v); out.push({ src, dst: id, v, ab, ward: s.ward[id] || 0, def: !!s.defend[id] || ctr, endure: saved, aid, kill: s.hp[id] <= 0, hp: s.hp[id] });
    if (ctr) { s.counter[id] = false; if (alive(s, id)) { const c = hitFoe(s, id, src, STAT[id].atk * 1.2 * (has(s, 'riposte') ? 1.8 : 1)); if (c) out.counters.push(c); } } }
  check(s); return out;
}

// ---------- 我方指令。都回傳 { kind, id, ... , hits:[…] } ----------
// 普通攻擊：回復自己 6% 最大 SP（至少 8）。防禦：受傷減半，另外回 10 SP
export function doAttack(s, id, target) { newCmd(s); const sm = smoked(s, id); s.smoke[id] = null; const hits = [hitFoe(s, id, target, STAT[id].atk * (sm ? .5 : 1), { basic: true, type: ATK_TYPE[id], sh: id === 'senpai' ? 2 : 1 })].filter(Boolean);
  const spGain = Math.min(STAT[id].sp - s.sp[id], Math.max(8, Math.round(STAT[id].sp * .06))); s.sp[id] += spGain; const r = { kind: 'attack', id, target, hits, smoked: sm, spGain, mo: gain(s, MO.attack) }; rider(s, id, target, r); r.sp = s.sp[id]; return after(s, id, r); }
export function doDefend(s, id) { newCmd(s); s.defend[id] = true; s.smoke[id] = null; const spGain = Math.min(10, STAT[id].sp - s.sp[id]); s.sp[id] += spGain; return after(s, id, { kind: 'defend', id, spGain, sp: s.sp[id], mo: gain(s, MO.defend) }); }
export function doCheer(s) { return { kind: 'cheer', id: 'vivi', mo: gain(s, MO.cheer) }; }
export function itemTargets(s, key) { const it = ITEMS[key]; return HEROES.filter(id => it.revive ? FRONT.includes(id) && !alive(s, id) : alive(s, id) && (it.hp ? s.hp[id] < STAT[id].hp : s.sp[id] < STAT[id].sp)); }
export function doItem(s, id, key, target) {
  const it = ITEMS[key]; s.items[key]--; s.smoke[id] = null; const r = { kind: 'item', id, key, target };
  if (it.hp) { r.heal = Math.min(it.hp, STAT[target].hp - s.hp[target]); s.hp[target] += r.heal; }
  if (it.sp) { r.spGain = Math.min(it.sp, STAT[target].sp - s.sp[target]); s.sp[target] += r.spGain; }
  if (it.revive) { r.revive = true; r.heal = Math.round(STAT[target].hp * it.revive); s.hp[target] = r.heal; }
  r.hp = s.hp[target]; r.sp = s.sp[target]; r.mo = gain(s, MO.item); return after(s, id, r);
}
// 招式現在能不能用：SP 夠、而且有對象（補血要有人受傷、代擋要有別的同伴）
const allyPool = (s, id, sk) => { const a = sk.ally || 'hurt', f = FRONT.filter(h => alive(s, h)); return a === 'hurt' ? f.filter(h => s.hp[h] < STAT[h].hp) : a === 'other' ? f.filter(h => h !== id) : a === 'sp' ? f.filter(h => h !== id && s.sp[h] < STAT[h].sp) : f; };
// 「再動一次」的護欄：被送行動的那一次不能再送給別人；全隊一回合最多多動 3 次
export const EXTRA_MAX = 3;
export const skillOk = (s, id, sk) => s.sp[id] >= sk.sp && (sk.target !== 'ally' || allyPool(s, id, sk).length > 0) && !(sk.key === 'encore' && (s.onBonus === id || s.extra >= EXTRA_MAX));
export const allyTargets = allyPool;
export function doSkill(s, id, key, target) {
  const sk = SKILLS[id].find(x => x.key === key), atk = STAT[id].atk; s.sp[id] -= sk.sp; newCmd(s); s.smoke[id] = null; s.inSkill = true; s.curType = sk.type || null; s.layerHit = false; const fee = s.L && s.L.fee && s.sign > 0 ? Math.min(s.L.fee, s.sp[id]) : 0; s.sp[id] -= fee; const r = { kind: 'skill', id, key, name: sk.name, target, hits: [] }, push = h => { if (h) r.hits.push(h); return h; }, all = () => [...MINIONS, 'boss'].filter(f => alive(s, f));
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
  else if (key === 'encore') { s.queue.unshift(target); s.bonus[target] = (s.bonus[target] || 0) + 1; s.extra++; r.encore = [target]; }
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
  else if (sk.fx) runFx(s, id, sk, target, r, push, all);
  s.inSkill = false; s.curType = null; if (fee) r.fee = fee; gain(s, MO.skill); after(s, id, r); r.sp = s.sp[id]; return r;
}
export function doUlt(s, id) {
  newCmd(s); s.curType = ULT_TYPE[id] || null; s.sp[id] -= STAT[id].cost; gain(s, -MO.ult); s.tally.ult++; s.smoke[id] = null; const r = { kind: 'ult', id, sp: s.sp[id], mo: s.mo, hits: [] }, push = h => { if (h) r.hits.push(h); return h; }, all = () => [...MINIONS, 'boss'].filter(f => alive(s, f));
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
  } else if (id === 'wu') { r.encore = FRONT.filter(h => h !== id && alive(s, h)).slice(0, Math.max(0, EXTRA_MAX - s.extra)); s.queue = [...r.encore, ...s.queue]; for (const h of r.encore) s.bonus[h] = (s.bonus[h] || 0) + 1; s.extra += r.encore.length;
  } else if (id === 'you') { const t = alive(s, 'boss') ? 'boss' : prime(); if (t) push(hitFoe(s, id, t, 5200, { sh: 3, pierce: true }));
  } else if (id === 'fairy') { r.heals = FRONT.filter(h => h !== id || alive(s, h)).map(h => { const up = !alive(s, h), v = up ? Math.round(STAT[h].hp * .3) : Math.min(Math.round(STAT[h].hp * .2), STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h], revive: up }; });
  } else if (id === 'zong') { s.endure = 2;
  } else if (id === 'hui') { for (let i = 0; i < 4; i++) { const fs = all().filter(f => !(f === 'boss' && guarded(s))); if (!fs.length) break; push(hitFoe(s, id, fs[Math.floor(s.rand() * fs.length)], 1500, { sh: 1 })); }
  } else if (id === 'xu') { r.heals = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(Math.round(STAT[h].hp * .4), STAT[h].hp - s.hp[h]); s.hp[h] += v; return { dst: h, v, hp: s.hp[h] }; });
    r.spGains = FRONT.filter(h => alive(s, h)).map(h => { const v = Math.min(60, STAT[h].sp - s.sp[h]); s.sp[h] += v; return { dst: h, v, sp: s.sp[h] }; }); s.items.tea++; r.tea = true; }
  s.curType = null; after(s, id, r); r.sp = s.sp[id]; return r;
}
// 照效果清單跑一個新招式
function runFx(s, id, sk, target, r, push, all, team = [id]) { const atk = STAT[id].atk, who = w => (w === 'self' ? [id] : w === 'party' ? FRONT.filter(h => alive(s, h)) : w === 'others' ? FRONT.filter(h => alive(s, h) && !team.includes(h)) : [target]).filter(h => h && (alive(s, h) || false)); let hitList = [];
  for (const [op, a, b, c2] of sk.fx) {
    if (op === 'dmg') { const tg = sk.target === 'all' ? all() : [target]; for (const f of tg) { const o = { ...(b || {}) }; if (sk.fx.some(x => x[0] === 'stun') && f === 'boss') o.sh = (o.sh ?? 1) + 2; const h = push(hitFoe(s, id, f, atk * a, o)); if (h && !h.guard && !h.kill && alive(s, h.dst)) hitList.push(h.dst); } }
    else if (op === 'dmgBy') { const by = team[a], tg = sk.target === 'all' ? all() : [target]; for (const f of tg) { const h = push(hitFoe(s, by, f, STAT[by].atk * b, { ...(c2 || {}) })); if (h) { h.by = by; if (!h.guard && !h.kill && alive(s, h.dst) && !hitList.includes(h.dst)) hitList.push(h.dst); } } }
    else if (op === 'mark0') { if (target && alive(s, target)) { s.mark[target] = 3; r.marked = [target]; } }
    else if (op === 'wardTo') addFx(r, FX.ward(s, team[a], b)); else if (op === 'tauntBy') { s.guardian = team[a]; addFx(r, FX.tag(team[a], '我來扛！')); }
    else if (op === 'healPct') { const h = team[a], x = FX.heal(s, h, Math.round(STAT[h].hp * b)); if (x) (r.heals || (r.heals = [])).push({ dst: h, v: x.v, hp: x.hp }); }
    else if (op === 'reviveOrHeal') { const dead = FRONT.find(h => !alive(s, h)), h = dead || lowHp(s), v = Math.round(STAT[h].hp * a); if (dead) { s.hp[h] = v; (r.heals || (r.heals = [])).push({ dst: h, v, hp: v, revive: true }); } else { const x = FX.heal(s, h, v); if (x) (r.heals || (r.heals = [])).push({ dst: h, v: x.v, hp: x.hp }); } }
    else if (op === 'mo') addFx(r, FX.mo(s, a));
    else if (op === 'burn') { for (const f of hitList) s.burn[f] = Math.max(s.burn[f] || 0, has(s, 'ember') ? a + 1 : a); if (hitList.length) r.burns = hitList.slice(); }
    else if (op === 'poison') { for (const f of hitList) { s.poison[f] = { v: Math.round(atk * b * s.run.atk), n: a }; addFx(r, FX.tag(f, '中毒')); } }
    else if (op === 'mark') { for (const f of hitList) s.mark[f] = 3; if (hitList.length) r.marked = hitList.slice(); }
    else if (op === 'down') { for (const f of hitList) { s.atkDown[f] = Math.max(s.atkDown[f] || 0, 1); s.downK[f] = Math.max(s.downK[f] || 0, a); } if (hitList.length) r.down = hitList.slice(); }
    else if (op === 'stun') { for (const f of hitList) if (f !== 'boss') { s.stun[f] = true; addFx(r, FX.tag(f, '暈眩')); } }
    else if (op === 'delay') { for (const f of hitList) if (s.queue.includes(f)) { const moved = s.queue.filter(q => q === f); s.queue = s.queue.filter(q => q !== f).concat(moved); r.delayed = f; } }
    else if (op === 'ward') for (const h of who(a)) addFx(r, FX.ward(s, h, b));
    else if (op === 'heal') for (const h of who(a)) { const x = FX.heal(s, h, b); if (x) (r.heals || (r.heals = [])).push({ dst: h, v: x.v, hp: x.hp }); }
    else if (op === 'regen') for (const h of who(a)) { s.regen[h] = { v: b, n: c2 }; addFx(r, FX.tag(h, '再生')); }
    else if (op === 'sp') for (const h of who(a)) { const x = FX.sp(s, h, b); if (x) (r.spGains || (r.spGains = [])).push({ dst: h, v: x.v, sp: x.sp }); }
    else if (op === 'up') for (const h of who(a)) { s.up[h] = Math.max(s.up[h] || 0, b); addFx(r, FX.tag(h, '攻擊力 ↑')); }
    else if (op === 'cleanse') for (const h of who(a)) { if (cleanse(s, h)) addFx(r, FX.tag(h, '解除異常')); }
    else if (op === 'taunt') { s.guardian = id; addFx(r, FX.tag(id, '看這邊！')); }
    else if (op === 'evade') for (const h of who(a)) { s.evade[h] = true; addFx(r, FX.tag(h, '閃過下一擊')); } } }

// 合體技：現在能不能放（成員都上場、都活著、SP 都夠、其他成員這回合還沒動；被送的那一次行動不能放）
export const unitesOf = id => UNITES.filter(U => U.who.includes(id) && U.who.every(h => HEROES.includes(h)));
export const uniteOk = (s, id, U) => U.who.includes(id) && s.onBonus !== id && U.who.every((h, i) => HEROES.includes(h) && alive(s, h) && s.sp[h] >= U.sp[i] && (h === id || s.queue.includes(h)));
export function doUnite(s, id, key, target) { const U = UNITES.find(x => x.key === key); newCmd(s); s.inSkill = true; s.curType = U.type || null; s.layerHit = false;
  U.who.forEach((h, i) => { s.sp[h] -= U.sp[i]; s.smoke[h] = null; if (h !== id) { const q = s.queue.indexOf(h); if (q >= 0) s.queue.splice(q, 1); } });
  const r = { kind: 'unite', id, key, name: U.name, who: U.who.slice(), target, hits: [] }, push = h => { if (h) r.hits.push(h); return h; }, all = () => [...MINIONS, 'boss'].filter(f => alive(s, f));
  runFx(s, id, U, target, r, push, all, U.who); s.inSkill = false; s.curType = null; gain(s, MO.skill * 2); after(s, id, r); r.sps = U.who.map(h => ({ dst: h, sp: s.sp[h] })); r.sp = s.sp[id]; return r; }

// ---------- 敵人行動 ----------
export function enemyTurn(s, id) { newCmd(s);
  const targets = FRONT.filter(h => alive(s, h)), pick = () => { const t = s.plan[id]; s.plan[id] = null; return t && alive(s, t) ? t : targets[Math.floor(s.rand() * targets.length)]; }, weak = s.atkDown[id] > 0, k = weak ? 1 - (s.downK[id] || .3) : 1; if (weak && !(id === 'boss' && s.broken)) { s.atkDown[id]--; if (!s.atkDown[id]) s.downK[id] = 0; }
  if (id !== 'boss' && s.stun[id]) { s.stun[id] = false; return { kind: 'foeStun', id }; }
  const r = foeAct(s, id, targets, pick, weak, k); if (!s.over) planFoe(s, id); return r;
}
// 敵人打完之後的附帶效果：扣 SP（drain）、二手煙（smoke）。鸚鵡附議時拿被附議那隻小兵的種類來套
function afterHit(s, id, K, hits) { for (const h of hits) { if (!(h.v > 0)) continue;
  if (K.drain && s.sp[h.dst] > 0) { h.spLoss = Math.min(K.drain, s.sp[h.dst]); s.sp[h.dst] -= h.spLoss; h.sp = s.sp[h.dst]; }
  if (K.smoke && alive(s, h.dst)) { s.smoke[h.dst] = id; h.smoke = true; } } }
// 叫一隻小兵（回）來：滿血、重新決定要打誰；上一隻留下的煙不算在新來的頭上
function callIn(s, m) { s.hp[m] = STAT[m].hp; planFoe(s, m); for (const h in s.smoke) if (s.smoke[h] === m) s.smoke[h] = null; }
function foeAct(s, id, targets, pick, weak, k) {
  if (id !== 'boss') { const K = KINDS[s.kind[id]];
    if (K.heal) { const hurt = hurtFoe(s); if (hurt) { const v = Math.min(Math.round(K.heal * s.hk), STAT[hurt].hp - s.hp[hurt]); s.hp[hurt] += v; return { kind: 'foeHeal', id, dst: hurt, v, hp: s.hp[hurt] }; } }
    const r = { kind: 'foeAtk', id, weak, hits: hitHeroes(s, id, K.aoe ? targets.map(h => [h, STAT[id].atk * k * K.aoe]) : [[pick(), STAT[id].atk * k]]) };
    afterHit(s, id, K, r.hits); return r; }
  if (s.broken) { s.broken = false; s.shield = STAT.boss.shield; return { kind: 'stunned', id, shield: s.shield }; }
  s.bossTurns++; const echo = s.echo; s.echo = null;
  if (s.charging) { s.charging = false;
    if (s.L.proj) { const p = s.proj; s.proj = null; if (!p || !alive(s, p)) return { kind: 'ultMiss', id, of: p }; }      // 猴子：臨時專案倒了，大招放不出來
    if (s.L.wok) { const w = s.wok && alive(s, s.wok) ? s.wok : targets[Math.floor(s.rand() * targets.length)]; s.wok = null;
      if (s.defend[w]) { const v = Math.min(s.hp.boss, Math.round(BOSS_ULT[w] * 3)); s.hp.boss -= v; s.shield = 0; s.broken = true; s.tally.brk++; check(s); return { kind: 'wokBack', id, dst: w, v, hp: s.hp.boss, shield: 0, kill: s.hp.boss <= 0 }; }      // 背鍋的人在防禦：鍋彈回去
      const r = { kind: 'bossUlt', id, weak, single: w, hits: hitHeroes(s, id, [[w, BOSS_ULT[w] * k * 1.7]]), blocked: false }; if (!s.over && !MINIONS.some(m => alive(s, m))) { for (const m of MINIONS) callIn(s, m); s.summons++; r.summon = true; } return r; }
    const lockK = s.locks ? 1 - .25 * (s.lockN - s.locks.length) : 1, opened = s.locks ? s.lockN - s.locks.length : 0; s.locks = null;
    const pow = (s.L.layers ? roofPow(s) : s.L.brag ? .5 + s.bragLow / s.L.shield : 1) * lockK, r = { kind: 'bossUlt', id, weak, pow, opened, hits: hitHeroes(s, id, targets.map(h => [h, BOSS_ULT[h] * k * pow])), blocked: (s.aegis && alive(s, 'kevin')) || (s.bulwark && alive(s, 'qiang')) };
    if (s.L.moDrain && !r.blocked) { r.moLoss = Math.min(s.L.moDrain, s.mo); gain(s, -r.moLoss); r.mo = s.mo; }      // 考績魔導士：大招沒被完全擋下來就扣氣勢
    if (!s.over && !s.L.proj && !MINIONS.some(m => alive(s, m))) { for (const m of MINIONS) callIn(s, m); s.summons++; r.summon = true; } return r; }
  if (s.L.layers && s.layers < 3) s.layers++;      // 鐵皮：每行動一次加蓋一層
  if (s.bossTurns % STAT.boss.cycle === STAT.boss.cycle - 1) { s.charging = true; s.bragLow = s.shield; const r = { kind: 'charge', id };
    if (s.L.wok) s.wok = r.wok = targets[Math.floor(s.rand() * targets.length)]; if (s.L.fee) s.sign = r.sign = 3; if (s.L.layers) r.layers = s.layers;
    if (s.L.locks) { const pool = [...new Set(targets.flatMap(h => typesOf(s, h)))], pick = []; for (let i = 0; i < 3 && pool.length; i++) pick.push((pool.length > 3 - i ? pool.splice(Math.floor(s.rand() * pool.length), 1) : [pool[Math.floor(s.rand() * pool.length)]])[0]); s.locks = pick; s.lockN = pick.length; r.locks = pick.slice(); }      // 屬性鎖只抽現在場上的人打得出來的屬性
    if (s.L.proj) { let ms = MINIONS.filter(m => alive(s, m)); if (!ms.length) { const m = MINIONS[0]; callIn(s, m); s.summons++; r.called = m; ms = [m]; }      // 猴子：沒有小兵就先叫一隻來接專案
      s.proj = r.proj = ms.sort((a, b) => s.hp[b] - s.hp[a])[0]; }
    return r; }
  if (s.L.echo && echo) {      // 鸚鵡：照抄被指定的那隻小兵（補血、扣 SP、二手煙都照抄，傷害用自己的攻擊力）
    if (!alive(s, echo)) return { kind: 'echoMiss', id, of: echo };
    const K = KINDS[s.kind[echo]], hurt = K.heal && hurtFoe(s);
    if (hurt) { const v = Math.min(Math.round(K.heal * 4 * s.hk), STAT[hurt].hp - s.hp[hurt]); s.hp[hurt] += v; return { kind: 'foeHeal', id, echo, dst: hurt, v, hp: s.hp[hurt] }; }
    const r = { kind: 'bossAtk', id, weak, echo, hits: hitHeroes(s, id, [[pick(), STAT.boss.atk * k]]) }; afterHit(s, id, K, r.hits); return r; }
  return { kind: 'bossAtk', id, weak, hits: hitHeroes(s, id, [[pick(), STAT.boss.atk * k]]) };
}
