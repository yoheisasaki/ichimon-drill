# 実装の進み具合（STATUS）— 次の担当はこのファイルだけ読めば続きから再開できる

更新：2026-11-18 ／ 作業場所：`C:/Users/user/projects/ichimon-drill/.worktrees/rpg`（git worktree、ブランチ `rpg`、元 master ef13338）
設計書：`C:/Users/user/projects/AI事業部/_work/ichimon-rpg-spec-20261118/`（README→01→02→03→04）。決定の根拠は同じフォルダの `IMPLEMENTATION_DECISIONS.md`。
**push・公開・デプロイはしていない（してはいけない）。本体 `C:/Users/user/projects/ichimon-drill`（master）は触っていない。**

（第2段の追記は下の「第2段」節。テスト起動：`node rpg/tests/meta.js`、`python rpg/tools/ui_test3.py <port>`、`node rpg/tools/sim_full.js`）

## 第1段（04「着手」1〜4／「作業順」1〜4）：完了
1. 現行学習UIの基準スクショ・寸法・主要操作の回帰確認：`rpg/tools/regress.py`、基準値 `rpg/baseline/baseline/`、改修後 `rpg/baseline/after/`（問題カード・選択肢・入力・わかんないの寸法は差なし。地図はサイズ同一）
2. データ・成長・コイン・日次枠・宝箱抽選・保存/復元・イベント重複防止：`rpg/js/rpg-core.js`（保存キー `ichimon.rpg.v1`、revision排他、書き出し/読み込み）
3. 自動戦闘（純粋関数・乱数なし）12職の技・固有能力・作戦・AI、決定的シミュレーション：`rpg-battle.js`、`rpg/tools/jobsim.js`、`rpg/tools/sim.js`
4. 回答イベントとの接続・下端の冒険帯・結果（報酬）画面：`rpg-adventure.js`（冒険=基本10問＋復習）、`rpg-ui.js`、`rpg-sprites.js`、`rpg/css/rpg.css`、`app.js`/`index.html` に最小の接続（`start`/`reask`/`record`/`question`/`home`/`result`）

## 変更ファイル（worktree 内）
- 既存を変更：`app.js`（RPG接続のみ。問題・地図・入力・記録・送信の挙動は変更なし）、`index.html`（スクリプトとCSSの読み込み）
- 追加：`rpg/js/*.js`（data/core/battle/adventure/sprites/ui）、`rpg/css/rpg.css`、`rpg/tests/run.js`、`rpg/tools/{regress.py,ui_test.py,ui_test2.py,sim.js,jobsim.js,make_manifest.js}`、`rpg/ASSET_MANIFEST.json`、`rpg/baseline/`、`rpg/shots/`、本ファイル群
- `data/`（問題データ）は未変更（`python tools/check_questions.py` → 275問 / エラー0）

## 最新テスト（詳細は TEST_REPORT.md）
node run.js 95件＋meta.js 29件 全通過／画面 ui_test 38・ui_test2 21・ui_test3 93 全通過（chromium・webkit、390px中心＋320/375/430）／コンソールエラー0／学習ボードへの送信リクエスト0（遮断）。

## 起動・確認のしかた
- ローカル：worktree で `python -m http.server <port>` → `http://127.0.0.1:<port>/index.html?nosend=1`（**`nosend=1` を必ず付ける**。付けないと実データを送る）。`?rpg=0` で RPG だけ切れる
- テスト：`node rpg/tests/run.js`、`python rpg/tools/ui_test.py`、`python rpg/tools/ui_test2.py`、`python rpg/tools/regress.py <tag>`（Windows は `PYTHONIOENCODING=utf-8`。ポートが使えないときは第2引数で変える）
- シミュレーション：`node rpg/tools/sim.js`（正答率別・第1章）、`--regions 0.7`、`--steps 0.7`、`node rpg/tools/jobsim.js`

## 第2段（作業順5＋6の前半）：完了（2026-11-18）
- ホーム上部カード・下部ナビ・ぼうけん（地図18地域）・まち・じぶん・装備（試着→確定）・店（買う・売る・返品）・鍛冶（+3）・転職（12職・条件進捗・目標・初回演出）・技設定（3枠＋継承1＋作戦）・外見・図鑑・実績・ゲームのデータ。ロジック `rpg/js/rpg-meta.js`、画面 `rpg-screens.js`、CSS `rpg-screens.css`
- 僧侶の回復・守り技のAI調整（D-26）。第2・3章（300区間・敵84体）と装備ランクIV〜VI解放（D-21,22）
- 結果画面に「そうびを みる」（装備画面へ。戻るとホーム）

## 第3段（作業順6〜9）：完了（2026-11-18）。詳細は FINAL_REPORT.md
- 固有装備18・再鍛造・最上級職の試練（転職可）・再戦・秘境6・孤島・隠しボス・称号/衣装・エンディング・記念絵、区間ごとの会話、宝箱の開封演出、音・設定（初期オフ）
- 試験用セーブ6（tests/saves）、全体シミュレーション（sim_full／sim_post）、保存異常系・既存送信（モック）・データ検査・画面確認（chromium＋webkit、390px中心）
- テスト起動：`node rpg/tests/run.js`／`meta.js`／`stage3.js`、`python rpg/tools/ui_test.py`／`ui_test2.py`／`ui_test3.py`／`ui_test4.py`／`regress.py <tag> <port>`、`node rpg/tools/sim_post.js`／`make_saves.js`

## 未完・未確認
1. 正式素材（画像）は0件。全て仮絵。生成手段なし。台帳 ASSET_MANIFEST.json（仮206・予定23）
2. 学習ボード側の skip 受信保存＝このリポからは確認できない（未確認）。実機Safari・画像ロード計測（画像0枚）＝未実施
3. 敵の絵は形4種の色替え。ランクII〜VIの通常装備・レア名は仮名のまま
4. セッション途中の画面復元（再読込で今の問題へ）は未実装
5. 手で遊んだ体感は未確認（数値と自動画面テストのみ）

## 既知の弱点・注意
- 僧侶は回復技・守り技をほとんど使わない（HPが40%を割る場面が少ない）。第2章以降で敵が強くなったら再確認（jobsim.js）
- セッション途中の画面復元（再読込で今の問題に戻る）は未実装。冒険の状態・回答済みの基本問題・未完了の復習はセーブされ、再開時に復習から出る
- 端末の時計を進める不正は防げない（巻き戻しは防ぐ。設計書どおり記録済み）
- 外部待ち：なし（画像生成手段のみ）
