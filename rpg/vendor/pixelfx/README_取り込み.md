# pixelfx 取り込み記録
- 元：https://github.com/patch-gg/pixelfx（MIT。LICENSE・NOTICE.md を同梱）
- コミット：5294518ce7c72e48b6100a744596e0acf57f2826（2026-11-18 に `git clone --depth 1`、作業フォルダ外の `.worktrees/_vendor_src/`）
- 確認：src を grep し、fetch／XHR／eval／new Function／import()／WebSocket／cookie／localStorage／sendBeacon／Math.random／Date／document／window の使用なし（外部通信なし）。URL は著作者表示のコメントのみ。
- コピー：`src/core/*.js` 全部（index.js が互いに参照するため）と、使う effect 20種とその `_lib.js`：
  melee/{sword-slash,double-slash,dagger-flurry,heavy-cleave,thrust}、fire/fireball、ice/{ice-lance,frost-nova}、lightning/{zap-hit,thunderclap}、holy/{heal,divine-shield,smite,holy-pillar}、impacts/{shield-block,crit-hit}、explosions/smoke-bomb、arcane/{star-fall,mana-burst}、water/splash
- 持ち込まないもの：`gallery/`（フォントは MIT の対象外）、docs、tools、skills、package.json
- 改変：なし（無改変のコピー）。使い方は `rpg/js/rpg-fx.js`。
