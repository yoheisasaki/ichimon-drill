# 実装の進み具合（STATUS）— 次の担当はこのファイルだけ読めば続きから再開できる

更新：2026-11-18 ／ 作業場所：`C:/Users/user/projects/ichimon-drill/.worktrees/rpg`（git worktree、ブランチ `rpg`、元 master ef13338）
設計書：`C:/Users/user/projects/AI事業部/_work/ichimon-rpg-spec-20261118/`（README→01→02→03→04）。決定の根拠は同じフォルダの `IMPLEMENTATION_DECISIONS.md`。
**push・公開・デプロイはしていない（してはいけない）。本体 `C:/Users/user/projects/ichimon-drill`（master）は触っていない。**

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
node 94件 全通過／画面38件＋異常系21件 全通過（chromium・webkit、390px中心＋320/375/430）／コンソールエラー0／学習ボードへの送信リクエスト0（遮断）。

## 起動・確認のしかた
- ローカル：worktree で `python -m http.server <port>` → `http://127.0.0.1:<port>/index.html?nosend=1`（**`nosend=1` を必ず付ける**。付けないと実データを送る）。`?rpg=0` で RPG だけ切れる
- テスト：`node rpg/tests/run.js`、`python rpg/tools/ui_test.py`、`python rpg/tools/ui_test2.py`、`python rpg/tools/regress.py <tag>`（Windows は `PYTHONIOENCODING=utf-8`。ポートが使えないときは第2引数で変える）
- シミュレーション：`node rpg/tools/sim.js`（正答率別・第1章）、`--regions 0.7`、`--steps 0.7`、`node rpg/tools/jobsim.js`

## 未完（次にやること。具体的な順）
**作業順5（ホーム・街・装備…）— 未着手**
1. ホーム／ぼうけん／まち／じぶん の下部ナビ（回答中は非表示）、ホーム画面（職業・Lv・コイン・当日ボーナス2個・再開ボタン・次の技・任意目標）。学習フィルター選択は既存ホームを流用
2. 装備画面（試着・性能差・効果文。確定するまで変更しない）、店（買う・返品=未使用のみ同額）、鍛冶（強化+3・素材・レア重複）。ロジックは core に `buy/equip/grantItem` まで有り、強化・売却・返品・再鍛造は**未実装**
3. 転職画面（基本/上級/最上級、条件の進捗、目標登録、初回演出スキップ可）。`canChangeJob` はある。**職の変更UIが無いため、今は戦士固定**（セーブ上は `save.job` を書き換えれば他職でも動く）
4. 技設定（冒険前に3枠＋継承1枠、作戦 おまかせ/攻める/守る）。ロジック（validateLoadout/recommendLoadout/inheritable）は有り、画面が無い。今は自動おすすめで固定
5. 主人公の外見（名前・顔4・髪6・肌/髪色）、図鑑、実績、おねがい（宝箱の分類）の選択UI（今は `save.wish='sword'` 固定）、宝箱の開封演出（今は清算時に結果確定・即反映）
6. 結果画面の「そうびを見る」（装備画面ができたら足す。未実装ボタンは置いていない）

**作業順6以降**
- 第2章（地底樹海〜空城裏側）・第3章（12のしるし）の敵（残り57体の通常敵・本編ボス12・試練2・秘境6・隠し1）、地点名・短い会話、固有装備18、再鍛造、クリア後、試練、秘境、孤島。現在は第1章72冒険のみ。72冒険クリア後は最後のボスの再戦になる（仮）
- 装備ランクIV〜VI（第2・3章解放）の入手経路。ランクII〜VIの名前とレア効果は仮名（DECISIONS D-08）。固有装備の効果は未定義
- レア効果のうち戦闘に実装済み：hpPct / reduce / firstReduce / healBonus / firstSkill / elemAdd / firstMulti / firstHeal / halfHeal。固有装備の効果（防御技後の通常強化など）は未実装
- 回答帯・報酬の正式素材（画像生成の手段が無い）：`ASSET_MANIFEST.json`＝仮56件・予定23分類・正式0件。**仮絵のまま完成扱いにしない**
- 音（初期OFF）、振動、設定画面、保存の「別端末への複製」説明の画面
- 受信側（学習ボード）の `skip` 保存対応の確認：**未確認**（クライアントは従来どおり `skip:1` を送る）
- 実機Safari（iPhone）での確認：**未実施**（WebKit(Playwright)のみ）。入力時のソフトキーボードと safe-area は実機で要確認
- ゲーム画像の初回ロード計測（2MB目標）：画像素材が無いので **未計測**（今は画像0枚、JS/CSSのみ）
- 作業順8・9：14日/第1章末/第2章末/本編末/クリア後の試験用セーブ、全体の数値調整（第1章は調整済み。第2章以降は敵データが無いので未調整）、データ検査の拡張（全装備の入手経路など）

## 既知の弱点・注意
- 僧侶は回復技・守り技をほとんど使わない（HPが40%を割る場面が少ない）。第2章以降で敵が強くなったら再確認（jobsim.js）
- セッション途中の画面復元（再読込で今の問題に戻る）は未実装。冒険の状態・回答済みの基本問題・未完了の復習はセーブされ、再開時に復習から出る
- 端末の時計を進める不正は防げない（巻き戻しは防ぐ。設計書どおり記録済み）
- 外部待ち：なし（画像生成手段のみ）
