# ブラウザ(ChatGPT)アイコン制作ログ
方法: ChatGPT 1シート=6個(3列×2行・マゼンタ背景) → Downloads → rpg/assets/src/<icons_xxx>/ → tools/icons_cut.py(box縮小・32px) → rpg/assets/icons/<id>.png → tools/icons_manifest.py で台帳(id=icon_<id>)。画面: rpg-screens.js の iconOf(装備画面のみ)。
実測: 1シートの生成 約60〜90秒。

## 済み
- 通常装備60すべて（w_sword/w_staff/w_dagger/w_bow/a_heavy/a_light/a_robe/x_charm/x_shieldorn/x_ring ×1〜6）。台帳は icon_<id> で正式。shots/assets_icons_pilot.png, assets_icons_normal.png

## 済み(続き)
- レア60: rw_{sword,staff,dagger,bow}_1-6, ra_{heavy,light,robe}_1-6, rx_{charm,shieldorn,ring}_1-6
- 固有18: u_<key>（ランク共通の1枚。ランク違いはアイコンを共用）

## 済み(続き2)
- 素材: ore_1-6, bm_<地域id>×18(meadow〜crown)、trial_wing, trial_star, dawn(夜明けのかけら dawn_0〜5 共用), dawn_dragon
- 職業しるし12: job_<職業id>（warrior〜starseer）
- 台帳は全て icon_<id> で「正式」。画面接続は装備画面のみ（rpg-screens.js iconOf。固有は u_<key>_<ランク> → icon_u_<key>）。素材・しるしのアイコンは画像だけ用意済みで、画面への表示は未接続。

## 残り
- 家具・記念品: データに該当がなく未制作（対象外）
- 素材・しるし・店/強化画面のアイコン表示の接続（別担当）

## 失敗
- なし（全シートが1回で採用可）。実測: 1シート 生成約60〜70秒＋取り込み。ChatGPTの使用上限表示は出なかった。

## 敵・ボス（第2・3章／試練・秘境・隠し） 2026-11-18
- 方法: ChatGPT 1シート=6体(3列×2行・左向き・マゼンタ背景) → tools/enemies_take.py <シート番号>（Downloads最新→切り分け→通常96px/ボス192px、帯用28px/48px）→ tools/enemies_manifest.py。敵の説明は tools/enemies_sheet.py。
- 済み: シート0-9の60体（第2章24、第3章24、試練ボス2、秘境ボス6、隠しボス1、試練の通常3）。台帳 enemy_<id> と enemy_<id>_strip は「正式」。画面は rpg-sprites.js が台帳から自動で読む。
- 右向きで出た3体（記憶の紙鳥・花冠の獣・天秤の守衛）は左右反転して採用。
- 事故: PC電源断で ASSET_MANIFEST.json がゼロ埋めで壊れた → HEAD から復元し、自分の敵の行だけ再登録。別担当の未コミットの台帳変更は失われた可能性がある（要確認）。
- 残り: 秘境・夜明けの通常敵 x_*/xi_*（既存敵の強化個体。仮絵のまま）、試練の通常敵 t_wing1/t_star1/t_star2。技の効果は別途。
