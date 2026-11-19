# 試遊前確認票（記入済み）— 一問一答 RPG　**2026-11-19 午後の再実行版（v3b 一体絵・外見選択撤去後。HEAD＝d674446＋本コミット）**

元の票：07_試遊前確認票.md（A〜F）。判定は PASS／FAIL／未確認／撤去済み。根拠の種類：**自動テスト**（node）／**ブラウザ操作**（Playwright headless。chromium・webkit）／**画像目視**。**人間の試遊は一度もしていない。iPhone 実機は未確認。**

## 再実行の結果（2026-11-19 午後）と、前回（午前）からの変更点

|項目|結果|証拠|
|---|---|---|
|node run 129／meta 29／reward 31／stage3 36／hero 21|**246 全通過**|`rpg/shots/fix09_tests/node_*.log`|
|画面 ui_test 38／ui_test2 21／ui_test3 93／ui_test4 107／ui_test_map 36／ui_test_fx／ui_test_text 20／ui_test_hero（REAL=1）59|全通過（下記の検査側の修正後）|`fix09_tests/py_*.log`|
|一周 loop_07（390×700。新規→名前→10問→開封→購入→試着/取消/装備→魔法戦士→再読込→次の冒険→異常系）|**33 項目 全通過**、遮断0・外部リクエスト0・コンソール0|`rpg/shots/fix07_loop/`（録画 loop.webm・result.json）|
|宝箱 d05（レア／重複レア／素材／コイン）|通過|`rpg/shots/fix07_d05/`|
|回帰 regress（学習画面の寸法）|学習画面のカード・地図・選択肢の寸法は前回と一致（差は地図ページ全体の高さ −4px と結果文言のみ）|`rpg/baseline/fix09/metrics.json`|
|ルビ監査 ruby_audit.js|**初回 9 件の抜け → 辞書に9語を足して 0 件**（現在地・目的・着がえる・条件・未達・習得・再開・詳細・特別）。コントラスト 1586 件中 4.5 未満 0|`fix09_tests/ruby_audit.log`・`py_contrast.log`|

**前回からの変更（07 の項目の読み替え）**
- A06（顔・髪型・肌・髪色の変更）・A07（その全選択値）：**撤去済み（D：父 11/19、D-55）**。代わりに「選択肢が無いこと」「全画面で同じ一体絵」「全12職×衣装×用途の48通りが描ける」を確認（ui_test_hero A06_*／A07_*、fix08_v3b_default.py）。
- E の手順1「主人公を選ぶ」：名前のみ入力（外見選択なし）。保存は v2 で look＝衣装だけ。
- 保存の移行 D08：ブラウザでも確認（v1 の day14.json を読込 → v=2・職・装備が保たれる。chromium・webkit、390×700・320×568：`fix08_v3b_default/result.json`）。
- 検査側の追従（アプリ本体は変えていない）：ui_test3／ui_test_hero／loop_07（外見選択）、ui_test_map（範囲シート・クエストのシート化・章切替）、ui_test_text（08 の文言）、fix08_screens（webkit はホイール未対応のため背面固定は overflow で代用）。fix06_reward.py は 06 当時の報酬画面（内訳行・コイン内訳）用で 08 の配置に合わない＝**廃止扱い**。同じ D01〜D10 の確認は fix08_reward.py（chromium・webkit、7表示領域）・d05_chests.py・loop_07・node reward が担う。
- アプリ本体の修正（本コミット）：ルビ辞書9語、報酬の素材名の途中改行、装備・自分の舞台の主人公倍率（頭の上の余白）。

以下は午前の記入（基点 845fc31）の記録。A06・A07 は上のとおり撤去済み、ほかの行は上の再実行で通過を確認し直した。

## 記入欄

|項目|内容|
|---|---|
|対象ブランチ/コミット|ブランチ `rpg`。基点 845fc31 ＋ 本確認票のコミット（コミットID は報告に記載。push・master 取り込みはしていない）|
|確認日|2026-11-19|
|ブラウザ/OS|Playwright chromium 151.0.7922.34（headless）。一部の旧テスト（ui_test3 ほか）は webkit 26.5（headless）も。Windows 11。**iPhone 実機・実物の Safari は未確認**|
|画面寸法|主に 390×844（DPR2・タッチ有効）。B06 は 320／375／390／430 幅。C02 のキーボードは縦を 844→410 に縮めて近似|
|セーブの出所|①新規セーブ（localStorage 空から。E の前半）②`rpg/tests/saves/day14.json` に職業Lv・コイン等を足した試験用セーブ（A・B・E の後半）③D05 は実際の冒険で作った箱の抽選結果だけを固定（開封の処理と表示は実物）。本番データは使っていない。`?nosend=1` で送信を遮断（遮断カウント 0、外部リクエスト 0）|
|検査担当|Claude Code（ブラウザ自動操作）。前の担当の判定は写さず、今のコミットですべて再実行した|
|証拠フォルダー|`rpg/shots/fix07_loop/`（一周・録画）、`fix07_tests/`（全テストのログ）、`fix07_screens/`、`fix07_d05/`、`fix07_compare/`、`fix06_screens/`・`fix06_text/`・`fix06_reward/`（2026-11-19 に再実行して上書き）|

## 今回の再実行の結果（すべて 2026-11-19、基点 845fc31 ＋ rpg-ui.js の宝箱アイコン追加）

|種類|件数|ログ|
|---|---|---|
|node：run 95／meta 29／reward 31／stage3 36／hero 12|203 全通過|`rpg/shots/fix07_tests/node_*.log`|
|画面：ui_test 38／ui_test2 21／ui_test3 93／ui_test4 107／ui_test_map 36／ui_test_fx 10／ui_test_text 20／ui_test_hero（REAL=1 実部品）62|全通過|`fix07_tests/py_*.log`|
|報酬 fix06_reward 24／一周 loop_07 32／穴埋め fix07_screens 7|全通過|`py_fix06_reward.log`・`py_loop_07.log`・`fix07_screens/result.json`|
|回帰 regress（学習画面の寸法）|前回（fix06）と全項目一致。原本との差はページ高さ＋56px（帯）と minHeight 表記のみ|`rpg/baseline/fix07/metrics.json`|
|ルビ監査 ruby_audit.js|抜け 0 件|`fix07_tests/ruby_audit.log`|
|部品の描き分け coverage_07.py|12職×(通常・マスター・追加)×全ポーズ×用途 324通り中 270 が部品描画。残り54は「上級職でない6職の追加衣装」（存在しない組合せ）のみ。画像の無い敵 0・読めない部品 0|`fix07_tests/coverage.json`|

## A. 主人公と装備

|ID|結果|根拠の種類|証拠・メモ|
|---|---|---|---|
|A01|PASS|ブラウザ操作＋画像目視|7用途（ホーム/自分/装備/転職/外見/報酬/帯）が同じ職業・武器・衣装・顔髪肌を渡して描く：`fix06_screens/result.json` の A01_*。一周でも新規主人公→魔法戦士→再読込→次の冒険の帯・報酬が同じ外見・武器：`fix07_loop/result.json`（E6）、画像 `fix07_loop/22_home_magicknight.png`・`24_quiz_strip.png`・`25_result_next.png`|
|A02|PASS|画像目視|12職の一覧（基本4・上級6・最上級2）の実画面：`fix07_screens/A02_jobs_base_390.png`・`A02_jobs_adv_390.png`・`A02_jobs_top_390.png`。衣装・構え・武器で区別でき棒状キャラなし。`fix06_screens/result.json` A02_12jobs_no_missing_art|
|A03|PASS|ブラウザ操作＋画像目視|青銅の剣→鉄の剣（w_sword_2）の試着：絵の画素が変わり数値も変わる（攻撃 20→26）、顔・身体は同じ。`fix07_loop/15_equip_before_sword2.png`→`16_equip_try_sword2.png`→`17_equip_confirmed_sword2.png`、比較 `fix07_compare/06_equip.png`、`fix06_screens/result.json` A03_*。**注意：最初の「青銅の剣」は「はじまりの武器」と同じ絵（既知問題 K-02）。火花の剣の試着は `fix06_screens/fix_*`・hero テストで確認**|
|A04|PASS|ブラウザ操作|取消で絵・保存が元に戻る（loop の E4）。確定後はホーム・帯・報酬・再読込後も同じ武器（E6：武器 w_sword_2 を魔法戦士転職後の再読込・次の冒険の帯と報酬まで保持）。試着が他画面や保存に漏れない：A04_*|
|A05|PASS|ブラウザ操作＋画像目視|僧侶＝杖、盗賊＝短剣、レンジャー＝弓。固定の剣・二重武器なし：`fix06_screens/result.json` A05_weapon_icon_matches_job、画像 `real_jobs_*_390.png`|
|A06|撤去済み（D：父 11/19）|ブラウザ操作＋画像目視|顔・髪型・肌・髪色を変更して全主要画面へ反映：A06_*。変更前後 `fix07_compare/11_A06_look.png`（新規主人公の初期外見→顔3・髪4・肌2・髪色3）|
|A07|撤去済み（D：父 11/19）|ブラウザ操作＋自動テスト|全選択値（4顔×6髪型×5肌×6髪色×L・S＝1440通り）の読込・描画：A07_all_look_values_load_and_draw。部品の組合せ 324 通りの描画方式：`fix07_tests/coverage.json`。つなぎ目の目視は `fix06_screens/real_*` と `fix07_loop/22_home_magicknight.png`（頭・手・武器に破綻なし）。node hero 12 通過|
|A08|PASS|ブラウザ操作|マスター衣装（Lv30）で絵が変わり全画面に反映、未獲得は選択不可、未解放職のプレビューはセーブ不変：A08_*。追加衣装（上級職）は部品あり（coverage の alt1 54 通り）|
|A09|PASS|ブラウザ操作＋自動テスト|第1章ボス6体と図鑑/冒険の敵が正式画像：A09_*。`devReport().enemyMissing`＝空、部品の不足＝空（読込失敗は仮絵に黙って戻らず、開発用検査に出る）。`fix07_tests/coverage.json`|

## B. 画面と文章

|ID|結果|根拠の種類|証拠・メモ|
|---|---|---|---|
|B01|PASS|ブラウザ操作＋画像目視|390px：主人公と開始ボタンが最初の画面（844px）内（ホームを見本に作り直した後も再確認。開始ボタン下端 609px）。B01_*、`fix07_loop/03_home_hero.png`|
|B02|PASS|ブラウザ操作＋画像目視|姿→名前→特徴→条件→主要ボタンの順、技一覧は折りたたみ、初回転職は旧姿→光→新姿で別人にならない（顔・髪・肌は同じ）。B02_*、`fix07_loop/19_jobdetail_magicknight.png`・`20_job_fx.png`|
|B03|PASS|ブラウザ操作|店・装備・図鑑で同じ正式名・アイコン・効果（通常品とレア60品）：B03_*（`fix06_screens`・`fix06_text`）|
|B04|PASS|ブラウザ操作＋自動テスト＋計算|ルビの外の漢字 0（全子ども画面）：ui_test_text B04、ruby_audit.js 抜け0件。学習範囲のカードの「こ・おぼえた」も漢字＋ルビ（個・覚えた）に統一。**読みやすさ（コントラスト）**：16画面（ホーム範囲を開いた状態・ぼうけん・街・自分・装備・店・鍛冶・転職一覧/詳細・外見・設定・図鑑・実績・技設定・施設・報酬）の全テキスト（ふりがな含む1930件）で文字と背景のコントラスト比を計算し、4.5未満 0 件（`rpg/tools/contrast_audit.py`、`fix07_tests/contrast.json`）。初回は 529 件（ふりがな503・緑青ボタン等）が未満だったため直した（RPG画面の中だけ。学習アプリ本体は regress で不変を確認）。**読みの正しさの最終確認は人の目が望ましい**（辞書 1194 語）|
|B05|PASS|ブラウザ操作|分かち書き・仮名・開発用注記の残りなし：ui_test_text B05。名前だけの置換で壊れた文なし|
|B06|PASS|ブラウザ操作＋画像目視|320/375/390/430 の6画面（ホーム・装備・店・転職一覧・転職詳細・自分）と回答画面で横スクロールなし、末尾の操作がナビより上、回答の「わかんない」が帯に隠れない：`fix07_screens/result.json`（b06_layout）、画像 `fix07_screens/B06_{320,375,390,430}_*.png`。別の14画面は hero テスト B06_*|
|B07|未確認（一部確認）|ブラウザ操作|ブラウザの zoom 1.3倍では7画面で切れなし・折りたたみを開いても主要ボタンへ戻れる（B07_zoom130_*）。**OS/端末の文字サイズ設定そのものは未確認**|
|B08|PASS|画像目視|`fix07_compare/10_B08_reference.png`（見本の左＝ホーム、右＝転職と同じ高さで比較）。初回は FAIL だったため、ホームを見本に合わせて直した：地色を他のRPG画面と同じ濃紺、金の枠飾りの見出し帯＋その下に冒険者Lvとコインの1行、街の情景を枠いっぱいに出して主人公は整数2倍で広場に立つ（職業Lvの札は維持）、緑青の大きな開始ボタン＋「続き：地域名」、次の技は1行カード、日次ボーナスは見本の枠意匠（宝箱の絵は使わず、経験値を示す金の★アイコン＝06の5章どおり）、復習ボタンと学習範囲の変更は残した。390pxで主人公と開始ボタンは最初の画面内（開始ボタン下端 609px／画面 844px）。転職は見出し帯の金飾りと主ボタンの矢印を合わせた（構成は元から近い）。**範囲を開いたホーム：`fix06_reward/home_with_sealed_chest.png`（カードを濃紺の意匠にし、見出し・数字・ルビが読める。目視確認）。残る差：見本のドット枠の細工（四隅の飾り）・ナビの絵アイコン・開始ボタンの文言（見本「ぼうけんへ」、実装は「スタート（10問）」で本体の言い方を維持）**（K-05）|

## C. 回答中

|ID|結果|根拠の種類|証拠・メモ|
|---|---|---|---|
|C01|PASS|ブラウザ操作|regress.py：前回と全項目一致。原本との差は帯ぶんのページ高さと minHeight 表記のみで、カード・地図・選択肢の寸法は同じ。`rpg/baseline/fix07/metrics.json`|
|C02|PASS（実機キーボードは未確認）|ブラウザ操作＋画像目視|4択・地図・長文・わかんない・復習：ui_test/ui_test2/regress。入力：一周の2回目（かく＝入力問題10問を実際の入力欄に打鍵）`fix07_loop/result.json`。キーボード近似（縦 844→410）：入力欄と送信ボタンが縮んだ表示内に収まり、帯は隠れ、打鍵できる `fix07_screens/C02_input_keyboard_410.png`。**iPhone 実機のキーボード・safe-area は未確認**|
|C03|PASS|画像目視|全18地域の帯：`rpg/shots/fix06_screens/strips_all_regions_390.png`（再実行で更新）|
|C04|PASS|ブラウザ操作|回答しない3.5秒、戦闘は進まず待機ポーズのみ：C04_*|
|C05|PASS|ブラウザ操作|不正解の答え確認中は敵演出なし、「次へ」の後に進む：C05_*。一周で `fix07_loop/q_after_wrong.png`|
|C06|PASS|ブラウザ操作|帯は canvas のみ（ボタン・数字なし）、音は初期オフ、reduce-motion は静止：C06_*。`fix07_tests/py_ui_test_fx.log`（描画 4ms 前後）|

## D. 報酬と保存

|ID|結果|根拠の種類|証拠・メモ|
|---|---|---|---|
|D01|PASS|ブラウザ操作＋画像目視|勝利/継続/撤退の姿と文言が結果に一致、箱は下の専用カード1か所：`fix06_reward/victory_unopened.png`・`continue_unopened.png`・`retreat_unopened.png`、result.json（24通過）|
|D02|PASS|ブラウザ操作＋画像目視|1回目・2回目は閉じた朝星1個、3回目は箱欄ごとなし、二重箱なし：`fix06_reward/third_nochest.png`・`second_opened.png`|
|D03|PASS|自動テスト＋ブラウザ操作|開封前の合計＝学習＋討伐（node reward D03 ×6、fix06_reward）。一周でも開封前の残高＝学習＋討伐のみ：`fix07_loop/06_result_sealed.png`|
|D04|PASS|自動テスト＋ブラウザ操作|開封後の増分・内訳・最終残高が一致。135＋40＝175 を含め複数ケース（node reward D04 ×12）。画面：`fix07_loop/07_result_opened.png`、`fix07_d05/coin_2_opened.png`（学習・討伐295＋宝箱40＝合計335）|
|D05|PASS|ブラウザ操作＋画像目視|レア箱（火花の剣・**アイコン付き**・効果）／素材箱／コイン箱／重複レア（「もう持っていたので ランクIの鉱石×3 に交換」、鉱石＋3・レア数は増えず）を各撮影：`fix07_d05/{rare,rare_dup,mat,coin}_{1_sealed,2_opened,3_card}.png`、`fix07_d05/result.json`。**今回の再確認で、レア箱の中身にアイコンが無かった不具合を見つけて直した（K-修正1）**|
|D06|PASS|自動テスト＋ブラウザ操作|未開封で終了→ホームの入口→再読込→後日開封、同じ内容を1回だけ：node reward D06、`fix06_reward/home_with_sealed_chest.png`・`home_chest_opened.png`|
|D07|PASS|自動テスト＋ブラウザ操作|連打・演出中の再読込・2タブ・保存失敗：node reward D07 ×4。ブラウザで開封連打（click×3）→付与1回：fix06_reward|
|D08|PASS|自動テスト|旧セーブの付与済み箱を移行（再付与・減算なし、判断できない状態は推測しない）：node reward D08 ×4。**ブラウザでの旧セーブ読込は未実施**|
|D09|PASS|自動テスト|4時境界・未完冒険の再開・復習XPの重複なし：node reward D09 ×3|
|D10|PASS|ブラウザ操作|箱なしでも「おわる」「次の10問」が成立、両ボタンが同じ強調、学習の自動開始なし：fix06_reward（btnSame、third→more）|

## E. 一周（ブラウザ自動操作。人間の操作ではない）

録画：`rpg/shots/fix07_loop/loop.webm`（390×844、約56秒、実際のクリック・入力。待ち時間は短縮せず、操作速度は自動操作のため速い）。スクリプト：`rpg/tools/loop_07.py`。結果：`fix07_loop/result.json`（32項目 全通過、遮断カウント0、外部リクエスト0、コンソールエラー0）。

|手順|結果|証拠|
|---|---|---|
|1 新規セーブ→主人公を選ぶ（名前・顔・髪・肌・髪色）→範囲（社会）|通過|`01_home_new.png`・`02_look_chosen.png`・`03_home_hero.png`・`04_range_social.png`|
|2 10問（正解6・不正解2・わかんない2・復習4）|通過|`05_quiz_first.png`、`q_after_wrong.png`・`q_after_skip.png`|
|3 結果→朝星の箱（未開封で残高＝学習・討伐のみ）→開封→合計一致→終了→ホームに箱の入口なし|通過|`06_result_sealed.png`・`07_result_opened.png`|
|4 店で武器購入（残高が値段ぶん減る）→試着→取消→装備|通過|`08_shop.png`・`10_shop_bought.png`・`11_equip_try.png`・`12_equip_after_cancel.png`・`13_equip_confirmed.png`|
|5 試験用セーブ（戦士・魔法使いLv10以上）で魔法戦士へ転職（衣装・武器を確認）|通過|`19_jobdetail_magicknight.png`・`20_job_fx.png`・`21_me_magicknight.png`|
|6 ホーム→再読込→次の冒険（入力問題10問）で帯・報酬・ホームの外見と武器が同じ|通過（画素の一致＋描画呼出しの職業・顔髪肌・武器の一致）|`22_home_magicknight.png`・`23_home_after_reload.png`・`24_quiz_strip.png`・`25_result_next.png`・`26_result_next_opened.png`|
|7 異常系：転職条件未達（ボタン無効＋理由）／装備不可（弓：「この職業では使えない」、保存・絵とも不変）／資金不足（買えない商品は押せず、理由表示、残高不変）／未開封箱なし（ホームに入口なし）|通過|`14_job_unmet.png`・`18_equip_unusable.png`・`09_shop_insufficient.png`|

一周の制約：5 は「別の試験用セーブ」を同じ録画の中で localStorage に書いて再読込した（外見・装備は一周の続き、職業Lvとコインだけ増やした）。主人公の選び方は「名前・見た目」画面での操作で、初回の専用の選択画面は無い。

## F. 提出物と試遊可否

|提出物|場所|
|---|---|
|修正前/後の比較（ホーム・帯・報酬 未開封/開封後/箱なし・装備 前/試着/確定・転職・全12職）|`rpg/shots/fix07_compare/01〜11_*.png`、対応表 `index.json`。修正前は `C:/Users/user/projects/ichimon-drill/_shots/RPG現状_20261118/`（gitignore対象。コピーせずパス参照）|
|操作録画|`rpg/shots/fix07_loop/loop.webm`|
|テスト結果|上の表と `rpg/shots/fix07_tests/`、`rpg/TEST_REPORT.md`|
|保存の移行結果|node reward D08（旧セーブ移行 ×4）、`rpg/baseline/saves_report_20261118.json`、試験用セーブ6本の読込・全画面表示は run.js/stage3.js が通過|
|素材台帳と実画面の対応表|`rpg/ASSET_SCREEN_MAP.md`（台帳 `rpg/ASSET_MANIFEST.json`、制作状態と接続状態は別の欄）|
|既知問題（影響付き）|`rpg/KNOWN_ISSUES.md`|
|試遊依頼文の下書き|`rpg/PLAYTEST_REQUEST_DRAFT.md`|

### 集計

**午前の記入：PASS 32／FAIL 0／未確認 1。午後の再実行：PASS 31／撤去済み 2（A06・A07）／FAIL 0／未確認 1**（A01〜D10 の 33 行）。未確認：B07（OSの文字サイズ）。B08 は初回 FAIL → ホームを直して PASS（下の再判定）。
PASS のうち実機での確認が残るもの：C02（iPhone のキーボード・safe-area）。そのほか画面全般で iPhone 実機（Safari）は未確認。

### 試遊不可の条件の点検

|条件|状態|
|---|---|
|仮素材|画面に出る絵・部品は全て正式。台帳の「仮」は音（簡易な合成音・初期オフ）の1行だけで、絵ではない|
|主要画面での別人化|なし（7用途・一周で同じ外見を確認）|
|武器が見た目に出ない|出る（職業ごとの手持ち。最初の青銅の剣だけ「はじまりの武器」と同じ絵＝K-02）|
|宝箱の不整合|なし（開封前後・連打・再読込・旧セーブで一致）|
|ルビの系統的な抜け|なし（監査0件）|
|保存の破損|なし|

### 判定：**内部確認済み**（試遊は可。ただし B07 未確認・iPhone 実機未確認・既知問題 K-01〜K-12 を開示して渡すこと）

自動テストだけでなく、画像の目視とブラウザ操作の一周が通ったので「検証中」ではなく「内部確認済み」とする。人間の試遊（楽しさ・テンポ・読みやすさ）は未実施。
