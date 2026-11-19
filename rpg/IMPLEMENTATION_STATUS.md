# 実装の進み具合（STATUS）— 次の担当はこのファイルだけ読めば続きから再開できる

更新：2026-11-19 ／ 作業場所：`C:/Users/user/projects/ichimon-drill/.worktrees/rpg`（git worktree、ブランチ `rpg`、元 master ef13338）
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

## 最新テスト（2026-11-19。詳細は CHECKLIST_07.md・TEST_REPORT.md。ログ rpg/shots/fix07_tests/）
node 5本 203件（run 95／meta 29／reward 31／stage3 36／hero 12）全通過／画面 ui_test 38・ui_test2 21・ui_test3 93・ui_test4 107・map 36・fx 10・text 20・hero(実部品) 62・fix06_reward 24・一周 loop_07 32・fix07_screens 7 全通過／コンソールエラー0／送信0。07 確認票 PASS 32／FAIL 0／未確認 1(B07)。判定＝内部確認済み。

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

## 技エフェクト（pixelfx）：完了（2026-11-18）
- 技の効果を pixelfx の動くドット絵に（帯は小さく、報酬画面の勝利時は大きく＋hit stop・ゆれ）。読めないときは静止画 fx_*→コード描画。詳細 DECISIONS D-39、取り込み記録 `rpg/vendor/pixelfx/README_取り込み.md`、確認 `python rpg/tools/ui_test_fx.py`。未確認：実機Safari・体感。

## 探索地図（2026-11-18）：完了
- ぼうけん→各地域の「ちず」で、`bg_map_<id>` の上に道・地点・今いる場所・済んだ区間・ボス・宝箱を重ねた探索地図が開く（25枚。試練は地図なし）。座標 `rpg/js/rpg-mapdata.js`、画面 `rpg-screens.js`（regionmap）、CSS `rpg-screens.css`、確認 `python rpg/tools/ui_test_map.py`、撮影 `rpg/shots/assets_explore_*.png`。決定 DECISIONS D-40。
- 未確認：実機Safari・体感。宝箱は「ボスの初回報酬」を表す印（地点ごとの宝箱は設計に無い）。地点の位置は自動追跡＋目視（道の絵の上にほぼ乗るが、数枚は微調整の余地）。

## 未完・未確認
1. 正式素材（画像）：766件（台帳 ASSET_MANIFEST.json の status）。無いのは第1章ボス3体（砂時計の巨人・黒鎧の騎士・天蓋の機神）、主人公の部品（rpg/assets/parts/）、手持ち武器の絵、色だけでない衣装の絵。「画面に接続したか」は status とは別の欄 connected（rpg/tools/annotate_manifest.js で付ける）
2. 学習ボード側の skip 受信保存＝このリポからは確認できない（未確認）。実機Safari・画像ロード計測（画像0枚）＝未実施
3. 敵：第1章ボス3体以外は正式画像（台帳の status が仮のまま読まれていなかった3体を修正）。レア装備55品の名前が仮名（provisional）のまま（子ども画面からは「仮名」の札を外したが、名前の正式化は未了）
4. セッション途中の画面復元（再読込で今の問題へ）は未実装
5. 手で遊んだ体感は未確認（数値と自動画面テストのみ）

## 既知の弱点・注意
- 僧侶は回復技・守り技をほとんど使わない（HPが40%を割る場面が少ない）。第2章以降で敵が強くなったら再確認（jobsim.js）
- セッション途中の画面復元（再読込で今の問題に戻る）は未実装。冒険の状態・回答済みの基本問題・未完了の復習はセーブされ、再開時に復習から出る
- 端末の時計を進める不正は防げない（巻き戻しは防ぐ。設計書どおり記録済み）
- 外部待ち：なし（画像生成手段のみ）

## 報酬と宝箱の作り直し（2026-11-18・修正指示書 5.）
- 問題：報酬画面で宝箱へ斬撃を当てる演出・飾りの宝箱があり、箱の中身は清算時に残高へ付与済みで、開封は見せかけだった。探索地図のボス報酬も宝箱マークだった。
- 変更：開封操作を持つのは朝星の宝箱のみ。清算時は箱を sealed で保存（ID・roll・日次枠・pity。残高は学習＋討伐のみ反映）。開封は付与と opened を同じ保存で確定してから演出（`C.openChestPersist`。保存失敗は巻き戻し、2タブは読み直して付与なし）。報酬画面は 06 の表順（上部は背景＋主人公のみ、箱は下の専用カード1か所、開封前合計＝学習＋討伐、開封後「学習・討伐N＋宝箱M＝合計」）。「おわる」「次の10問」は同一見た目。ホームに「受け取った宝箱」（期限なし・1個ずつ）。探索地図はボス印＋「初回報酬」。旧セーブは `C.migrateChests`（付与済みは opened/legacy、再加算なし、箱記録のないものは推測しない）。経験値式・復習件数・日次枠は未変更。
- 確認：node tests run 95／meta 29／stage3 36／reward 31（新規。D03/D04/D06〜D09）全通過。ブラウザ（headless chromium・390px・nosend=1）rpg/tools/fix06_reward.py 24項目通過、既存 ui_test 38・ui_test2 21・ui_test3 93・ui_test4 109・ui_test_map 36 通過、コンソールエラー0。
- 証拠：rpg/shots/fix06_reward/（victory_unopened/opened, continue_unopened, retreat_unopened, third_nochest, second_opened, home_with_sealed_chest, home_chest_opened, result.json）、rpg/tests/reward.js
- 未了：勝利姿は既存の「win」絵（跳ねる笑顔）のまま＝主人公の絵は別担当。レア箱・重複レアの画面は node のみ（画面は未撮影）。実機未確認。

## 修正指示書06 2章・3章（2026-11-18）：主人公を描く入口を1つに／ホーム・装備・店・転職・ナビ・回答帯
（各項目は 問題→変更→確認結果→証拠ファイル。判断は IMPLEMENTATION_DECISIONS.md D-41〜D-45。コミットは git log の「主人公の描画を1つに」）
- 問題：主人公の絵が画面ごとに別系統（14×14仮ドット／正式1枚絵）で、装備・外見・衣装が絵に出ない。ホームは教科カードが先で開始ボタンが画面外。装備・店にアイコンや試着の絵が無い。転職は全技表が先。
- 変更（絵）：`RPGSprites.drawHeroLayered(ctx,{look,job,costume,weaponId,pose,use,x,groundY,scale})` を唯一の入口に（rpg-sprites.js）。画面側は heroCv（canvas＋data-hero）→paintHeroes、帯・報酬は直接。部品（身体→頭→武器→前の手、肌・髪色の完全一致置換、武器の握り合わせ・回転）を実装。部品の無い組合せは正式な1枚絵（マスター衣装含む）で描き、`?devcheck=1` の `window.__rpgDev`（`&devpanel=1` で画面表示）に「1枚絵」として一覧。画像の読込が終わると描き直す（onUpdate）。14×14の仮絵経路（hero()・heroRows・drawHero）は削除。敵は図鑑・ぼうけんも正式画像に（enemyCv）。
- 変更（画面）：ホーム（app.js home()＋RPG.homeTop/homeBonus）／じぶん／装備（大きな主人公・武器アイコン・変更前後・折りたたみ詳細・装備中/試着中ラベル・「これを装備する」「取り消し」）／店（全商品アイコン・今の職業の武器を先に・購入と試着は別・未購入も試着）／転職（姿→特徴→条件✓→「この職業になる」、技と強さは折りたたみ、動きを見る、初回演出は旧姿→光→新姿でとばせる）／外見（説明文・マスター衣装）／ナビ（ホーム/冒険/街/自分にルビ・固定ナビの余白と同じ高さ）／回答帯（背景のコントラストを下げ、縁取りと足元の影、主人公と敵を近づけ、待機は小さな呼吸、攻撃時に距離を詰める）／バックアップは設定内。新しい文章は漢字＋ルビ（rpg-screens.js の辞書 RUBY・kr()、既存の `{漢字|よみ}`）。
- 確認：自動テスト node run 95／meta 29／reward 31／stage3 36／hero 12（新規）全通過。ブラウザ（headless chromium・390/375/430/320・nosend=1）：既存 ui_test・ui_test2・ui_test3・ui_test4・ui_test_map・ui_test_fx・regress を新しい画面に合わせて通過（`.subj` は「学習範囲の変更」の中に入ったので、テストは `window.__rangeOpen=true` で開く）。新規 `python rpg/tools/ui_test_hero.py`（62項目。失敗は A09 の2項目＝第1章ボス3体の画像なしだけ。下の確認票）。
- 証拠：rpg/shots/fix06_screens/（real_*＝実物の絵、fix_*＝試験用部品で重ねを確認、strips_all_regions_390.png＝全18地域の帯、result.json）、rpg/baseline/fix06/（学習画面の寸法）、rpg/tests/hero.js、rpg/tests/fixtures/（試験用部品の生成器と部品。実物ではない）。

### 07 確認票（A・B01〜B03・B06〜B08・C。D・E は別担当）
**（2026-11-18 時点の記録。部品が届く前の判定で古い。現在の判定は `rpg/CHECKLIST_07.md` が正。下の「部品が届いたら残る作業」も実施済み）**
結果の書き方：PASS／FAIL／未確認。区別：自動＝node テスト、ブラウザ＝headless 操作、目視＝画像を自分で見た。「部品待ち」＝実物の部品が無いので試験用部品でしか確かめられない。
|ID|結果|根拠|
|---|---|---|
|A01|未確認（部品待ち）|仕組み：ブラウザ（試験用部品）でホーム/自分/装備/転職/外見/報酬/帯の7用途が同じ職業・武器・衣装・顔髪肌を渡して描くことを確認（A01_*）。実物の絵は1枚絵なので、顔髪肌の一致は職業ごとの絵そのまま|
|A02|PASS|目視：real_jobs_base/adv/top_390.png。12職が衣装・構え・武器で区別でき、棒状キャラなし|
|A03|未確認（部品待ち）|仕組み PASS：ブラウザ（試験用部品）で青銅→火花の試着で武器の画素だけが変わり、頭・身体は同じ。数値も更新（A03_*）。実物の1枚絵は武器が描き込みで、試着で絵は変わらない|
|A04|未確認（部品待ち）|状態は PASS：ブラウザで取り消し→元に戻る、確定→保存→再読込・帯・報酬で同じ武器、試着が他画面・保存に漏れない（A04_*）。絵の反映は部品が必要|
|A05|PASS（1枚絵）|目視：僧侶＝杖、盗賊＝短剣、レンジャー＝弓、魔法使い・賢者＝杖、忍者＝短剣。重ね描きをしないので二重武器なし。ブラウザ（試験用部品）で部品経路も職業の武器だけを重ねる（A05_*）|
|A06|FAIL（部品待ち）|仕組みはブラウザ（試験用部品）で全主要画面へ反映・肌髪の色が画素に出る（A06_*）が、実物の1枚絵は顔・髪・肌・髪色が変わらない。比較画像：fix_look_before/after_390.png（試験用部品）|
|A07|未確認（部品待ち）|ブラウザ：試験用部品で 4顔×6髪型×5肌×6髪色×(L,S)＝1440通りが全て読込・描画できた（A07_*）。実部品でのつなぎ目の目視は未|
|A08|PASS（マスター衣装のみ）|ブラウザ：Lv30で選べて絵が変わり全画面に反映、未獲得は選べず、未解放職のプレビューは本人の顔髪でセーブ不変（A08_*）。追加衣装（上級職の依頼報酬）は絵も依頼も無く未対応。色だけの衣装は選べなくした（D-42）|
|A09|FAIL|第1章ボス6体のうち3体（砂時計の巨人・黒鎧の騎士・天蓋の機神）は画像ファイルが無く、暫定の形4種の絵になる（開発用検査 enemyMissing に出る）。残り3体と他の敵は正式画像で、図鑑・ぼうけん・帯・報酬とも接続。台帳の「仮」だった3体は「正式」に直した|
|B01|PASS|ブラウザ測定＋目視：390pxで主人公も開始ボタンも最初の画面（844px）内。real_home_390.png|
|B02|PASS|ブラウザ測定＋目視：姿→名前→特徴→条件→ボタン→折りたたみの順、ボタンは最初の画面内、詳細は閉じている、初回演出は旧姿→光→新姿でとばせる（試験用部品で顔髪が同一）。実物の1枚絵は職業ごとの別の絵|
|B03|PASS|ブラウザ：店・装備・図鑑で同じ名前・アイコン・数値/効果（通常品・レア品）|
|B06|PASS|ブラウザ：320/375/390/430px で14画面（ホーム・ぼうけん・街・自分・装備・店・転職一覧と詳細・外見・設定・図鑑・実績・技設定・探索地図）の横スクロール無し・末尾の操作がナビに隠れない・余白＝ナビの高さ（B06_*）|
|B07|PASS（拡大は zoom 1.3 で代用）|ブラウザ：文字を1.3倍にして7画面で切れ無し、折りたたみを全部開いても主要ボタンへ戻れる。OSの文字拡大そのものは未確認|
|B08|PASS（目視。差あり）|目視：採用見本（home-job-style）とホーム・転職を同幅で比較。主人公・背景・情報の優先順位は一致。見本のドット枠の飾りは未制作の差|
|C01|PASS|ブラウザ：regress.py fix06 は直前の after4 と全項目一致。原本との差は帯の高さぶん（ページ高さ）と minHeight 表記のみで、カード・地図・選択肢の寸法は同じ|
|C02|PASS（実機キーボードは未確認）|ブラウザ：regress/ui_test2 の実操作（4択・地図・入力・長文・わかんない・復習）通過。入力欄を触ると帯は隠れる|
|C03|PASS|目視：strips_all_regions_390.png（18地域）。主人公と敵が縁取り・足元の影で読める|
|C04|PASS|ブラウザ：回答しないで3.5秒待っても戦闘は進まず、帯は待機ポーズのみ|
|C05|PASS|ブラウザ：不正解の答え確認中は被弾ポーズが出ない（「次へ」のあとに進む）|
|C06|PASS|ブラウザ：帯は canvas だけ（ボタン・数字なし）、音は初期オフ、reduce-motion は静止|

### 部品が届いたら残る作業
1. 台帳の `parts_json` を「正式」にする（status の書き換えだけ。画面側は接続済み）。`?devcheck=1&devpanel=1` で、1枚絵のまま残る組合せ（職業×衣装×ポーズ×用途）を確認。
2. 作業途中の部品（戦士・魔法戦士ほか。部品担当が書いている parts.json の handPos・武器の握り・4色の肌髪列）でも描画は動くことを確認済み（rpg/shots/fix06_screens/parts_wip_*.png。`?devcheck=1&partsdir=rpg/assets/parts/` で台帳を変えずに試せる）。部品が完成したら、武器の握り・先の向き・weaponScale・手の位置を目視（A03・A05・A07）。
3. A01/A03/A04/A06/A07 を実物の部品で再確認（`python rpg/tools/ui_test_hero.py`）。マスター衣装の部品（`body_<職>_master_*`）、上級職の追加衣装（alt）とその入手（依頼）。
4. 第1章ボス3体の画像、レア装備55品の正式な名前、親向け以外の全画面のルビ統一（次の担当）、実機iPhone。

## 修正指示書06 4章・6章＋部品の接続（2026-11-18〜19）
（問題→変更→確認結果→証拠。判断は IMPLEMENTATION_DECISIONS.md D-46〜D-50）
- 問題：主人公の部品が揃ったのに台帳の parts_json が「予定」で1枚絵のまま。ホームの主人公（整数2倍）が背景の建物より大きく重なる。子ども向け画面がひらがな分かち書き・「にがて」・「ランクIのこうせき」・仮名表示で、ルビも画面ごとにまちまち。会話は全区間に同型の説明文。図鑑の分母が159（強化版込み）。レア55品が仮名。
- 変更（絵）：台帳 parts_json を「正式」（connected＝接続済み）。12職の通常衣装・マスター衣装・追加衣装は parts.json にあれば部品、無ければ1枚絵（読むだけ。parts は触っていない）。ホームの主人公を整数1倍（96px）にし足元を街の広場の位置（下から44px）へ。第1章ボス3体（砂時計の巨人・黒鎧の騎士・天蓋の機神）の正式画像と帯用6行を台帳に「正式」で登録（inspect を差し替え）。`rpg/tools/boss_fit.py` を drawHeroLayered に直した。
- 変更（ルビ）：`rpg-ruby.js`（共通レンダラー：{漢字|よみ}＋辞書＋DOMへの後付けの安全なテキスト走査）、`rpg-ruby-dict.js`（1194語）。名称（職業・技・地域）はデータの ruby 欄を起動時に登録。設定画面に「ふりがな」オン/オフ（初期ON）。画面ごとの kr()／タグ除去は廃止。ホームの学習ボタンは本体の言い方「復習が必要なところ（N個）」「スタート（N問）」＋ルビ。報酬画面の「ランクIの鉱石」。効果文は短い文（effectShort）を一覧・店に、数値を「効果を詳しく」に。ひらがな分かち書きの文言を語彙表で漢字かな交じりに直し（変更一覧 rpg/shots/fix06_text/changes_before_after.txt、残りのひらがな＝助詞・送り仮名中心 hiragana_remaining.txt）。
- 変更（文章・図鑑）：会話は出来事の区間だけ（rpg-story.js を自然な文に書き直し、pagesFor が出来事以外で []）。図鑑の分母＝基本種99（強化版60は元の敵の欄で「強化版 n/m」）、装備144（一覧の件数も同じ集合）。レア60品すべて正式名（オリジナル）、provisional 廃止。
- 確認結果：node run 95／meta 29／reward 31／stage3 36／hero 12 全通過。ブラウザ（headless・390px・nosend=1）：新規 `python rpg/tools/ui_test_text.py` 20項目全通過（B03 レア60品＋B04 ルビの外の漢字ゼロ＋B05 分かち書き/禁止語ゼロ＋ルビ切替＋図鑑分母）、`REAL=1 python rpg/tools/ui_test_hero.py`（実部品）62項目（A01・A03・A04・A06・A07・A08・A09 を含む）、ui_test 38／ui_test2 21／ui_test3 93／ui_test4 107／ui_test_map 36／ui_test_fx／regress fix06b、コンソールエラー0。文字を含むテストの期待値を新しい表記に直した。
- 証拠：rpg/shots/fix06_text/（home・adv・town・me・equip・shop・jobdetail・codex・settings・reward 390px、me_ruby_off、result.json、bare_kanji.txt）、rpg/shots/fix06_screens/（real_*＝実部品、strips_all_regions_390.png）、rpg/tools/ruby_audit.js（抜け0件）。
- 未了・注意：実機iPhoneは未確認。辞書の単漢字の読み（--review）は目視で確認したが、読みの正しさの最終確認は人の目が望ましい。マスター衣装のうち parts.json に無い組合せは1枚絵（開発用検査 `?devcheck=1&devpanel=1` に一覧）。台帳の planned_* 行（予定）は制作計画の記録で、画面には出ない。

## 07 確認票の記入と一周（2026-11-19）
- 問題→変更→確認→証拠。**問題**：確認票が未記入／前の担当の判定を今のコミットで確かめていない。**変更**：全テストを再実行し、穴（D05 箱4種・A02 12職の実画面・B06 4幅・C02 入力欄とキーボード近似・E 一周と録画・F 比較画像）を埋めた。**確認**：上のテスト結果、確認票 `rpg/CHECKLIST_07.md`。**証拠**：`rpg/shots/fix07_loop/`（loop.webm と画像、result.json）・`fix07_d05/`・`fix07_screens/`・`fix07_compare/`・`fix07_tests/`。
- 見つけて直した不具合：レア箱の開封カードに中身のアイコンが無かった（rpg-ui.js の chestContentHtml に追加。06「中身のアイコン/正式名/効果」）。テスト側：fix06_reward.py が学習範囲の折りたたみ（`.subj` が隠れる）と、ルビを含む `innerText` に未対応で2件落ちていたのを直した（アプリの不具合ではない）。
- B08：初回 FAIL→ホームを見本に合わせて直した（app.js home()、rpg-screens.js homeTop/homeNow/homeNext/homeBonus、rpg-screens.css 末尾、STAGE.home を h262・k2）。転職は見出し帯・主ボタンの矢印のみ。宝箱の絵は使わず★アイコン。再判定 PASS。
- 直さず既知問題にしたもの：最初の青銅の剣が「はじまりの武器」と同じ絵（K-02）、未接続アイコン44（K-06）。`rpg/KNOWN_ISSUES.md`。
- 台帳 `ASSET_MANIFEST.json`：件数・状態を実態に更新（`rpg/tools/refresh_manifest.py`。制作状態と接続状態は別の欄）。対応表 `rpg/ASSET_SCREEN_MAP.md`（`make_asset_screen_map.py`）。
- 新規ツール：`loop_07.py`（一周・録画）、`d05_chests.py`、`fix07_screens.py`、`coverage_07.py`、`make_compare.py`、`refresh_manifest.py`、`make_asset_screen_map.py`。
- 手順の順：make_manifest.js → annotate_manifest.js → refresh_manifest.py → make_asset_screen_map.py（make_manifest.js は台帳を作り直すので、後ろ2つを必ず通す）。
