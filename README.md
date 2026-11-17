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
