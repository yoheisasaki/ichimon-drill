# 画像制作ログ（次の担当はこれだけ読めば続きから始められる）

## 手順（確立済み）
1. `assets/prompts/<id>.txt` に対象の説明を書く（共通の絵柄指示は `_common.txt` が頭に付く）。
2. `python rpg/assets/tools/batch.py <id>:<promptname>:<ref1>,<ref2> ...`（assets 直下から実行。参照は assets からの相対パス。同時2本まで）。出力は `src/<id>/<id>.png`（マゼンタ背景）。
3. 後処理 `tools/process.py sprite <id> <src> <高さpx|縮尺小数>`。宝箱は `tools/process_chests.py <kind>`（閉の幅48pxの縮尺を閉・開に共通適用）。
4. 台帳は `tools/update_chests.py` の型で、書く直前に読み直し自分のID行だけ更新（装備・素材アイコン等はブラウザ版の別担当が書く）。
5. 画面確認 `tools/chest_shots.py`（headless）→ `rpg/shots/assets_chest_*.png`。回帰 `node rpg/tests/run.js`。
- 1枚の生成は約2〜10分（codex）。参照に基準絵 `src/enemy_slime/ref.png`（承認絵柄の見本画面）を毎回付ける。

## 分担（2026-11-18 親の指示）
装備アイコン・素材/家具/記念品アイコン・職業しるし は ブラウザ版が担当。こちらは宝箱・キャラ・敵・背景・街・施設・NPC・技効果・記念絵・地図。

## 済み（正式・台帳反映済み・目視は父の最終確認待ち）
- 試作6枚: hero_warrior, hero_warrior_strip, enemy_e_leafslime(+_strip), bg_meadow, bg_meadow_strip
- 宝箱6枚: chest_normal_closed/open, chest_morning_closed/open, chest_boss_closed/open（`rpg/assets/chars/`、48px幅）
  - 配線: 報酬画面の宝箱=朝星、場面の勝利時の宝箱=通常、ボス勝利時=ボス（`rpg-sprites.js drawChest(...,kind)`）。画像が無ければ従来のコード絵に戻る。
  - 画面: `rpg/shots/assets_chest_all.png`（6枚一覧）、`assets_chest_reward_closed/open.png`、`assets_chest_scene.png`、`assets_chest_reward_full.png`
  - 回帰 95 pass / 0 fail、コンソールエラー0。

## 2026-11-18 追記（第2担当）
- 11職の主人公 待機（報酬96px＋帯28px）完了・台帳反映・画面 `rpg/shots/assets_heroes.png`。攻撃ポーズは未（順番9「残りのポーズ差分」）。
- スライム左向きに作り直し（目が小さめ。要目視で不満なら再生成）。
- 敵パイプライン: `tools/enemy_pipe.py <e_xxx|b_xxx...>`（説明は `tools/enemies_data.py`）。報酬56px・ボス128px、帯24px・ボス32px（同じ元絵を縮小）。ボスはspec192pxだが試作比（主人公96）で128にした。
- 主人公は `tools/hero_pipe.py`、台帳は `tools/update_assets.py id|srcdir|use|display`、一覧画面は `tools/roster_shots.py`、目視用 `tools/sheet.py`。
- 第1章の通常敵30体を生成・台帳反映・画面 `rpg/shots/assets_enemies_ch1.png`。電源断(2026-11-18)の後、壊れた生成は再生成済み。
- 担当変更: ボス（enemy_b_*）・第2/3章の敵・秘境・技効果はブラウザ側。ch1ボス3体（ancienttree/crystalturtle/silverdragon）の元絵は作成済みだが未コミット・未登録（ブラウザ側が決める）。
- 背景: `tools/bg_pipe.py <名前>`（説明は `tools/bg_data.py`）。ch1の水郷・砂海・山脈を生成中、機工都市・空城が次。

## 残り（優先順）
1. 12職の主人公（報酬用96px・帯用28px。待機→攻撃）: warrior以外11職（mage priest thief magicknight paladin shadow sage ninja ranger skyknight starseer）。参照=hero_warrior_chibi/ref。人型は2.3〜2.7頭身。
2. 第1章の敵と背景（敵は左向き。**試作の enemy_slime は正面向き**＝向きの作り直しが必要）、地域背景（REGION_COLOR のキー全部）
3. ホーム・街・施設 → NPC → 第2・3章 → 秘境・孤島・記念絵・地図 → 技効果 → 残り全部
（台帳の status:'予定' の行が一覧）

## 失敗・注意
- 失敗ID: なし。ChatGPT枠エラー: なし（2026-11-18 時点）。
- 今回、宝箱の開3本のうち一時的に codex を3本同時に走らせた（上限2本の超過。遅くはならなかったが次回は守る）。
- 宝箱の金の光は「光線なし・金属の色のみ」で控えめ。ボス箱は金の割合が多め（要目視）。
