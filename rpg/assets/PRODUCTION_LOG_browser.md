# ブラウザ(ChatGPT)アイコン制作ログ
方法: ChatGPT 1シート=6個(3列×2行・マゼンタ背景) → Downloads → rpg/assets/src/<icons_xxx>/ → tools/icons_cut.py(box縮小・32px) → rpg/assets/icons/<id>.png → tools/icons_manifest.py で台帳(id=icon_<id>)。画面: rpg-screens.js の iconOf(装備画面のみ)。
実測: 1シートの生成 約60〜90秒。

## 済み
- 通常装備60すべて（w_sword/w_staff/w_dagger/w_bow/a_heavy/a_light/a_robe/x_charm/x_shieldorn/x_ring ×1〜6）。台帳は icon_<id> で正式。shots/assets_icons_pilot.png, assets_icons_normal.png

## 残り
- レア60、固有18、素材・家具・記念品、職業しるし12

## 失敗
- なし
