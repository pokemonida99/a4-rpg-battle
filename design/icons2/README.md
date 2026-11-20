# 第二批圖示（2026-11-21 凌晨，主 session 交代）

47 個 128×128 透明底 PNG，放 `art/map/icons/`，畫風照現有的 sk_draft、up_raise（同一套像素小物件，沒有外框底板）。圖上沒有字。
生圖 `art/raw/jobs18.sh`（A、B、C 三張格子圖，參考 `art/raw/skill_icons3.png`），切圖 `design/icons2/cut.py`（不會覆蓋同名舊圖，要重切加 `--force`）。總覽 `design/icons2/sheet.png`（最後兩顆是舊的 sk_draft、up_raise 對照）。

效果的畫法統一：光＝金色光芒、火＝橘色火焰、暗＝黑墨煙（不用紫色，紫色會被洋紅去背挖掉）、冰＝淡藍冰晶、打＝黃色衝擊星、斬＝白色弧光、護盾＝淡藍圓盾、回復＝綠十字、再生＝綠葉＋循環箭頭、回 SP＝藍水滴、攻擊提升＝綠色上箭頭、攻擊下降＝紅色下箭頭、標記＝紅色準星、中毒＝綠泡泡、暈眩＝三顆黃星、延後＝沙漏、閃避＝白色風、解除異常＝白色閃光。

## 新招式 32 個

| 檔名 | 誰／招式 | 畫的東西 |
|---|---|---|
| sk_deadline | 小葵 今天一定要結案 | 金劍刺穿圈了紅圈的日曆＋金光 |
| sk_backup | 小葵 我幫你補位 | 護盾裡伸出援手＋閃光 |
| sk_escalate | 阿傑 副本給你主管 | 著火的信封 |
| sk_sanitize | 阿傑 先把風險洗乾淨 | 噴金光的噴瓶＋護盾 |
| sk_cover | Kevin 先過我這關 | 罩在藍色光罩裡的大盾 |
| sk_gavel | Kevin 本案退回重辦 | 法槌敲下＋三顆暈眩星 |
| sk_followup | 小米 後續我來追 | 護盾＋綠葉循環箭頭 |
| sk_disinfect | 小米 負能量請消毒 | 噴瓶＋金光＋紅色下箭頭 |
| sk_budget | Vivi 這筆我核了 | 核准印章＋綠上箭頭＋護盾 |
| sk_morale | Vivi 今天不談績效 | 冒熱氣的茶杯＋綠心＋閃光 |
| sk_reschedule | 小燕 空檔先補起來 | 日曆＋綠十字＋護盾 |
| sk_minutes | 小燕 會議紀錄有寫 | 冒黑煙的筆記本＋紅準星 |
| sk_fineprint | 黑輪 小字你有看嗎 | 放大鏡＋卷軸＋綠泡泡＋黑煙 |
| sk_insurance | 黑輪 這單有保 | 金封合約＋護盾＋藍水滴 |
| sk_cheer | 茶茶 你剛剛超會接 | 拍手＋綠上箭頭＋藍水滴 |
| sk_rumor | 茶茶 大家都在說喔 | 三個黑對話框＋黑煙＋紅下箭頭 |
| sk_pallet | 阿強 棧板先借過 | 棧板砸地＋衝擊星 |
| sk_handover | 阿強 換我幫你扛 | 手臂舉盾護著紙箱 |
| sk_attach | 學姊 附件請補齊 | 發光迴紋針＋文件上的紅準星 |
| sk_redact | 學姊 這段先遮起來 | 塗黑的文件＋黑煙＋紅下箭頭 |
| sk_spotlight | 小蝶 主管請看這邊 | 舞台聚光燈＋白色風 |
| sk_cooldown | 小蝶 中場喝口水 | 運動水壺＋綠十字＋綠葉循環 |
| sk_spiked | 老油條 這杯誰放的 | 冒綠泡泡和黑煙的咖啡 |
| sk_outofoffice | 老油條 系統顯示不在線 | 轉過去的空椅子＋白色風＋閃光 |
| sk_nightshift | 鼠仙女 冷氣借開一下 | 吹出冰晶的冷氣＋沙漏 |
| sk_snacks | 鼠仙女 茶水間有餅乾 | 一盤餅乾＋護盾＋藍水滴 |
| sk_doorstop | 棕鼠 門先幫你頂著 | 門擋頂住門＋衝擊星＋護盾 |
| sk_hotpack | 棕鼠 抽屜還有暖暖包 | 冒熱氣的暖暖包＋綠葉循環 |
| sk_handoff | 灰鼠 這份先切出去 | 裁紙刀切開文件＋白弧光＋綠心 |
| sk_burnout | 灰鼠 印表機也過熱 | 冒火的印表機 |
| sk_antidote | 許許 這個要飯後吃 | 膠囊＋閃光＋綠十字 |
| sk_prescription | 許許 先吃藥再開會 | 結冰晶的藥瓶＋紅下箭頭 |

## 辦公小物 15 個

up_redpen 主管紅筆、up_cutter 美工刀、up_thermos 冒紅色怒氣的保溫瓶、up_partition 桌上隔板、up_blanket 摺好的重力毯＋月亮、up_cheatsheet 有綠十字的小卡、up_mug 超大馬克杯、up_snackdrawer 裝滿零食的抽屜、up_fridge 貼便利貼的小冰箱、up_applause 紅色按鈕＋拍手、up_countdown 撕頁桌曆、up_bell 服務鈴、up_tabs 六色索引貼、up_carbon 白黃藍三聯單、up_notebook 夾著鋼筆的皮面筆記本。

注意：幾顆護盾畫成「金框圓玻璃」（sk_handover、sk_snacks、sk_doorstop），看起來有點像鏡子；sk_spotlight、sk_outofoffice 的白色風邊緣帶一點粉紫，被去背吃掉一點點，縮小看不出來。
