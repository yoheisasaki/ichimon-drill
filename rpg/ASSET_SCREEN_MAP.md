# 素材台帳と実画面の対応表

自動生成（`python rpg/tools/make_asset_screen_map.py`）。元は `rpg/ASSET_MANIFEST.json`（更新 2026-11-19）。**制作状態（status）と画面への接続（connected）は別の欄。**

## 件数

- 制作状態：{"正式": 773, "仮": 1, "置換済み": 5, "制作済み": 17, "一部": 3, "予定": 1}
- 画面への接続：{"接続済み": 730, "対象外": 26, "未接続": 44}（対象外＝画像素材でない台帳行・制作計画の行）
- 「正式」の画像行 773 のうち、画面に接続済み 729、未接続 44（下の「未接続」表）

## 画面に接続済み（正式）

|件数|例（台帳ID）|読んでいる画面・場面|
|---|---|---|
|60|hero_mage, hero_mage_attack, hero_mage_hit, hero_mage_ready ほか56件|ホーム・自分・装備・転職・外見・エンディング・報酬・記念絵（主人公1枚絵（drawHeroLayered。部品が無い組合せの描き方））|
|159|enemy_b_ancienttree, enemy_b_balancelion, enemy_b_balga, enemy_b_blackknight ほか155件|報酬（継続）・ぼうけん・図鑑・記念絵（enemyCv／drawEnemy）|
|26|bg_aurora, bg_dawnisle, bg_dragonvalley, bg_garden ほか22件|報酬画面の背景|
|2|bg_crown, bg_crown_strip|エンディング（主人公の舞台）・帯・報酬|
|60|hero_mage_strip, hero_mage_strip_attack, hero_mage_strip_hit, hero_mage_strip_master ほか56件|回答帯（drawHeroLayered use=strip）／探索地図の現在地|
|185|bg_aurora_strip, bg_dawnisle_strip, bg_dragonvalley_strip, bg_garden_strip ほか181件|回答帯|
|120|icon_a_heavy_1, icon_a_heavy_2, icon_a_heavy_3, icon_a_heavy_4 ほか116件|装備・店・図鑑（iconOf）。試着の武器は部品があるとき主人公の手にも重ねる|
|2|chest_morning_closed, chest_morning_open|報酬・ホーム（朝星の宝箱）|
|18|icon_u_chionnotsue, icon_u_hakuginnomunaate, icon_u_josainoyoroi, icon_u_kijinnoyubiwa ほか14件|装備・店・図鑑（固有装備。iconOf）|
|24|fx_blast, fx_blast_strip, fx_fire, fx_fire_strip ほか20件|技エフェクト（帯・報酬の静止画フォールバック）|
|1|bg_town|ホーム（主人公の舞台）・街|
|2|bg_room_forge, bg_room_guild|施設の室内（街）|
|3|bg_room_room, bg_room_shop, bg_room_temple|施設の室内・自分／装備／転職／外見の舞台|
|4|town_airship, town_fountain, town_monument, town_windmill|街|
|8|npc_knight, npc_knight_alt, npc_luca, npc_luca_alt ほか4件|街の施設・おはなし|
|4|bg_memorial_ch1, bg_memorial_ch2, bg_memorial_dawnisle, bg_memorial_main|記念絵|
|1|bg_worldmap|ぼうけん（世界地図）|
|25|bg_map_aurora, bg_map_crown, bg_map_dawnisle, bg_map_dragonvalley ほか21件|探索地図|
|24|hero_mage_master, hero_mage_master_win, hero_magicknight_master, hero_magicknight_master_win ほか20件|ホーム・自分・装備・転職・外見・エンディング・報酬（マスター衣装を選び、獲得済みのとき）|
|1|parts_json|rpg-ui.js が読み、rpg-sprites.js の drawHeroLayered が身体・頭・武器・前の手を重ねる|

## 未接続（素材は制作済みだが、どの画面にも出していない）

|件数|例（台帳ID）|理由・メモ|
|---|---|---|
|4|chest_boss_closed, chest_boss_open, chest_normal_closed, chest_normal_open|未使用の資産として保管（06 5章：開封操作は朝星の宝箱のみ）|
|40|icon_bm_aurora, icon_bm_crown, icon_bm_gearcity, icon_bm_icevolcano ほか36件|素材・職業・称号のアイコン。どの画面にも出していない|

## 画像素材ではない行・制作計画の行（対象外）

|状態|件数|例|メモ|
|---|---|---|---|
|置換済み|5|hero_look_variants, job_intro_pose, memorial_picture, screen_frames ほか1件|コード/CSS描画だった行。画面からは外した（正式な画像／部品に置換）|
|制作済み|17|planned_bg_battle_reward, planned_enemy_boss, planned_enemy_extra, planned_enemy_normal ほか13件|制作計画の分類行（画像なし）。実物は個別の行／部品で、画面に出すかは各行の connected を見る|
|一部|3|planned_job_emblem_intro, planned_materials_furniture, planned_town|制作計画の分類行（画像なし）。実物は個別の行／部品で、画面に出すかは各行の connected を見る|
|予定|1|planned_hero_overlay|制作計画の分類行（画像なし）。実物は個別の行／部品で、画面に出すかは各行の connected を見る|
