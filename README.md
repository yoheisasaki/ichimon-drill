# 一問一答（ichimon-drill）

小3向け、テスト範囲の4択一問一答。ビルド無しの静的サイト（index.html / app.js / style.css / data/questions.json）。仕様は katei-gakushu の `_work/ichimon/仕様_共通.md`。

- 問題：`data/questions.json`。ふりがなは `{漢字|かな}`。
- 記録：端末の localStorage（問題ごとの まちがい回数・正解回数・続けて正解・最後の結果・日時）。子どもの名前・点数はリポに入れない。
- 送信：1問ごとに行を localStorage のキューに積み、アプリを開いたとき・回の終わり・やめる・ネット復帰時に POST（text/plain）。
  1. まず通常の fetch。応答が読めて `{"ok":true}` なら、送った行をキューから消す。
  2. 応答が読めない（リダイレクトで CORS 例外など）ときは、同じ行を `mode:'no-cors'` でもう一度送り、送信が成立したら消す。通信自体の失敗なら残して次回再送。
  3. 二重送信はサーバー側が `rid` で弾く（確実さ優先）。
- 送信先は `app.js` 先頭の `SEND_URL`。`?nosend=1` で送信しない。`?send=<URL>` は送信先の差し替え（テスト用）。
- 3連続で正解＝おぼえた。まちがえた問題は3問あとにもう一度（1回の延長は最大5問）。
- 地図問題：問題に `"map":{"hl":"<県>","mark":"<地点>"}`。`map.js`（renderMap）・`data/map_chubu_kanto.json`・`data/features.json`。地図 JSON は地図問題が初めて出るときに1回だけ読む。「ちず」ボタンは map 付きの問題だけを出す（社会にも含む）。
- 問題の検査：`python tools/check_questions.py`（id重複・choices3つ・答えと重複・`{|}`の形・map.mark/hl の存在）。問題を足したら必ず通す。
- 出典：地図：国土数値情報（行政区域データ）を加工して作成（元データの整形：smartnews-smri/japan-topography）。最初の画面の下にも表示。

## ママ用（保護者）
- 問題の一覧：https://yoheisasaki.github.io/ichimon-drill/list.html （全問を回・教科・まとまり別に表示。教科の絞り込み・文字検索・「こたえをかくす」＝タップで1問ずつ表示、口頭で出題できる）。端末の記録は読まず、送信もしない。
- 試しに解く：https://yoheisasaki.github.io/ichimon-drill/mama.html （送信しない。保存キーは末尾 `.mama` で、息子の成績・選び・送信待ちとは混ざらない。ホーム上部にママ用の帯と一覧へのリンクが出る）。
- 共通部分（まとまり・ふりがな）は `common.js`。
