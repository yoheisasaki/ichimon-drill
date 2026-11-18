# ブラウザ(ChatGPT)アイコン制作ログ
方法: ChatGPT 1シート=6個(3列×2行・マゼンタ背景) → Downloads → rpg/assets/src/<icons_xxx>/ → tools/icons_cut.py(box縮小・32px) → rpg/assets/icons/<id>.png → tools/icons_manifest.py で台帳(id=icon_<id>)。画面: rpg-screens.js の iconOf(装備画面のみ)。
実測: 1シートの生成 約60〜90秒。

## 済み
- 通常 剣 w_sword_1〜6（パイロット。shots/assets_icons_pilot.png）

## 残り
- 通常: staff, dagger, bow, heavy, light, robe, charm, shieldorn, ring（各6）
- レア60、固有18、素材・家具・記念品、職業しるし12

## 失敗
- なし
