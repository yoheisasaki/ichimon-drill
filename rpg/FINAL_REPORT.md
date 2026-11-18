# 最終提出（FINAL_REPORT）— 一問一答 RPG 実装（rpg ブランチ）
更新：2026-11-18。**「完成」ではない。** 正式素材が0件（全て仮絵）、skip受信側・実機Safari・体感は未確認。push・公開・デプロイはしていない。

## 1. 実装済み範囲
第1段：下端の冒険帯・自動戦闘12職・成長/日次/抽選/保存・結果画面。第2段：ホーム・街・装備・店・鍛冶・転職・技設定・外見・図鑑・実績・本編3章18地域300区間。
第3段（今回）：固有装備18＋再鍛造／再戦18／最上級職の試練2（転職可）／秘境6／夜明けの孤島／隠しボス（暁の竜）／称号・衣装・秘境装備・夜明けの灯・記念絵／エンディング／区間ごとの会話（全462区間）／宝箱の開封演出／音・振動・設定（初期オフ）／試験用セーブ6。

## 2. 起動手順
worktree `C:/Users/user/projects/ichimon-drill/.worktrees/rpg` で `python -m http.server 8000` → `http://127.0.0.1:8000/index.html?nosend=1`（**nosend=1 必須**。無いと実データを送る）。`?rpg=0` でRPGだけ切れる。
テスト：`node rpg/tests/run.js`／`meta.js`／`stage3.js`、`python rpg/tools/ui_test.py`／`ui_test2.py`／`ui_test3.py`／`ui_test4.py`／`regress.py <tag> <port>`（Windowsは PYTHONIOENCODING=utf-8）。シミュレーション：`node rpg/tools/sim_full.js`／`sim_post.js`、`make_saves.js`。

## 3. 主要画面（rpg/shots）
p3_adv_quests／p3_adv_postgame（ぼうけん・クエスト選択）、p3_story（おはなし）、p3_forge_unique（固有装備）、p3_chest_closed／p3_chest_open（宝箱）、p3_settings、p3_ending、p3_memorial、p3_me_rewards、p3_codex_extra。第2段：p2_home／p2_town／p2_equip／p2_shop／p2_forge／p2_jobdetail ほか。学習画面：q_choice／q_input／q_map／q_long／q_wrong_strip／reward_full。**全て仮絵・CSS描画。**

## 4. 試験結果
- node 3本 計160件（95＋29＋36）全通過。画面 ui_test 38／ui_test2 21／ui_test3 93／ui_test4 109 全通過（chromium＋webkit、390px。320/375/430も確認）。コンソールエラー0・送信リクエスト0・44px未満0・横はみ出し0
- 回帰（regress.py）：問題カード・地図・選択肢・入力・わかんないの寸法差0、再出題は3問後、skip記録行の形は基準と同じ。check_questions 275問 エラー0
- 保存の異常系（run.js／ui_test2）：保存失敗は成功扱いにしない、壊れたセーブは上書きしない、2タブ排他、書き出し/読み込み（検証失敗は無変更）、再読込→再開、二重タップ
- 既存の記録送信：送信先へは送らず、遮断＋記録行のモック確認のみ。**学習ボード側のskip受信は未確認**

## 5. シミュレーション集計（毎日2回・固定seed×5・店売り最上位のみの保守的な買い方）
| 正答率 | 本編 冒険数/日数 | 試練に着手 | 秘境(6)の冒険数 | 孤島 | 最上級職Lv |
|---|---|---|---|---|---|
| 30% | 570/285日 | 157日・21冒険 | 29/25/25/28/31/22 | 61 | Lv30 |
| 60% | 356/178日 | 102日・10冒険 | 20/19/15/20/19/17 | 38 | Lv30 |
| 80% | 333/167日 | 101日・10冒険 | 18/19/16/19/18/17 | 36 | Lv30 |
| 100% | 332/166日 | 101日・10冒険 | 19/19/16/19/17/17 | 38 | Lv30 |

設計書の目標との比較：本編240〜360回→60〜100%で317〜344（OK）。30%でも554冒険で到達（止まらない）。最上級職（試練着手）約100日＝設計書の約101日。第2章末は91日（設計書84日よりやや遅い。調整せず、根拠は DECISIONS D-38）。秘境1つ15〜20冒険（OK）、孤島30〜40（OK）。必須の秘境経路 約148冒険（設計書120〜160）。
試験用セーブ6（`rpg/tests/saves`、数値は baseline/saves_report_20261118.json）：
- day01：1日・2冒険・冒険者Lv3・warrior・コイン190・装備ランク1・討伐2・地域クリア0
- day14：14日・28冒険・冒険者Lv13・priest・コイン3288・装備ランク1・討伐24・地域クリア2
- ch1end：36日・72冒険・冒険者Lv21・magicknight・コイン8348・装備ランク3・討伐60・地域クリア6
- ch2end：91日・182冒険・冒険者Lv35・paladin・コイン19694・装備ランク5・討伐138・地域クリア12
- maingoal：171日・342冒険・冒険者Lv49・skyknight・コイン34373・装備ランク6・討伐256・地域クリア18
- postgame：242日・484冒険・冒険者Lv58・skyknight・コイン55619・装備ランク6・討伐365・地域クリア18
6つとも読み込み・全15画面の表示・stage3.js の検証を通過（手で最後まで遊んではいない）。

## 6. 仕様補完・変更の一覧
IMPLEMENTATION_DECISIONS.md の D-01〜D-38。第3段は D-28〜D-38（固有装備の効果量とランク、再鍛造の費用、クエスト構成と強さ、おはなし、報酬、宝箱演出、音、エンディング、試験用セーブ、調整根拠）。

## 7. 素材の充足状況
正式 0／仮 206／予定 23（ASSET_MANIFEST.json）。画像を生成する手段が無く、全て未制作または仮絵（コード描画）。
**足りない画像（正式素材が必要なもの。仮の画像ID）**
- hero（13）：warrior、mage、priest、thief、magicknight、paladin、shadow、sage、ninja、ranger、skyknight、starseer、look_variants
- enemy（159）：159体ぶん（全て形4種の色替え）。IDは ASSET_MANIFEST.json の enemy_*
- bg（27）：meadow、waterland、sandsea、mountain、gearcity、skycastle、rootwood、sunkencity、invertedruins、icevolcano、oldfactory、skybackside、worldtree、moonfall、skytower、aurora、skyfactory、crown、trial_wing、trial_star、garden、pearl、nightcity、dragonvalley、lab0、orchard、dawnisle
- sound（1）：original
- memorial（1）：picture
- chest（2）：open、closed
- town（1）：overview
- job（1）：intro_pose
- screen（1）：frames
**未制作（予定）**
- planned_hero_base_poses（60）：主人公 基本職業衣装 12職×5ポーズ（待機/構え/攻撃/被弾/勝利）
- planned_hero_master_poses（60）：主人公 マスター衣装 12×5
- planned_hero_adv_extra（30）：上級職追加衣装 6×5
- planned_face_hair（20）：顔4・髪6（正面寄り/戦闘向き、肌・髪色マスク）
- planned_strip_sprites（48）：回答帯用小型キャラ 12職×(待機/歩行/攻撃/被弾)
- planned_job_emblem_intro（24）：職業しるし/紹介絵 各12
- planned_hero_overlay（8）：主人公特殊状態（翼/影/魔法剣/星等）透明重ね
- planned_enemy_normal（66）：通常敵 66体（帯用縮小版つき。現在は仮絵36体分）
- planned_enemy_boss（18）：本編ボス 18体＋形態差分（仮絵は第1章6体）
- planned_enemy_extra（9）：試練2/秘境6/隠し1
- planned_bg_battle_reward（27）：戦闘/報酬背景 本編18＋秘境6＋孤島1＋試練2＝27（仮は第1章6）
- planned_town（8）：街 基本1＋進行差分パーツ
- planned_rooms（5）：施設室内 ギルド/店/鍛冶屋/神殿/自室
- planned_world_map（1）：世界地図（地点・線は別レイヤー）
- planned_explore_maps（25）：探索地図 本編18＋秘境6＋孤島1
- planned_icons_normal（60）：通常装備アイコン 60
- planned_icons_rare_unique（78）：レア/固有アイコン（レア60＋固有18）
- planned_weapon_inhand（24）：手持ち武器（装備可能武器の全種）
- planned_materials_furniture（40）：素材/家具/記念品
- planned_chests（6）：宝箱 通常/朝星/ボス×閉/開=6（仮は2）
- planned_skill_fx（20）：技効果（斬撃/炎/氷/雷/水/光/回復/盾/煙/星＋専用大技）
- planned_npc（4）：主要NPC ミラ/トト/ルカ/黒鎧の騎士（立ち絵＋表情）
- planned_memorial（4）：記念絵 章1/章2/本編/孤島

## 8. 既知の制約・未確認
- 正式素材なし。ホーム・街・装備・転職の「本格的な絵」は未制作（CSS・ドット仮絵）。採用見本どおりの見た目ではない
- 学習ボード側の skip 受信保存＝未確認。実機Safari＝未実施（WebKit headless 390pxのみ）。画像ロード計測＝未計測（画像0枚）
- 手で遊んだ体感は未確認。第2章末が設計書より約7日遅い（保守的な買い方のため。強化・レア・固有を使う遊び方では短くなる見込みだが未計測）
- セッション途中の画面復元（再読込で今の問題へ戻る）は未実装。冒険の状態・回答済みの基本問題・未完了の復習は保存される
- 端末の時計を進める不正は防げない（巻き戻しは防ぐ）
- ランクII〜VIの通常装備・レア名は仮名。会話の文はひらがな中心だが一部の漢字はルビなし
- 全条件を満たしていないため「完成」とは言えない


## 9. ライセンス（外部素材・ライブラリ）
- pixelfx（https://github.com/patch-gg/pixelfx 、MIT、コミット 5294518）：`rpg/vendor/pixelfx/`（LICENSE・NOTICE.md 同梱。Sprite Fusion/Hugo Duprez、Hollow Crown/rehan-remade の MIT 改作を含む）。技の動くエフェクトに使用。gallery/fonts（MIT対象外）は不使用。記録：vendor/pixelfx/README_取り込み.md、ASSET_MANIFEST.json の vendor、DECISIONS D-39。
