# 主人公の部品仕様（06 修正指示書 2章の実装用・2026-11-18 決定）

画像担当とコード担当の取り決め。ここに無いことは 06 を正とする。

## 見た目
- 約3頭身（旧仕様の2.5頭身から変更）。顔が読める大きさ。落ち着いた冒険者。右向き（3/4 右）。
- 待機＝自然な構え。勝利＝武器を下げて小さく喜ぶ／胸を張る。跳ねる幼児風の笑顔・効果線は禁止。
- 職業は色だけでなく輪郭・装飾・構えで区別（06 の例どおり）。
- 色数は1部品 24 色以内に減色（パレット差し替えのため）。背景透明、ぼかし禁止。

## 寸法（ドット原寸）
- 報酬・ホーム用（size=L）：待機の全身高さ 96px、足元＝画像下端、左右中央＝足の中心。
- 帯用（size=S）：全身高さ 26px。L の縮小ではなく専用に描く。

## 部品と置き場
`rpg/assets/parts/` に置く。元シートと作業物は `rpg/assets/src/parts/`。

| 部品 | ファイル | 中身 |
|---|---|---|
| 身体 | `body_<job>[_<costume>]_<pose>_<size>.png` | 頭（首から上）と武器を除いた全身。武器を握る手は空の握り拳 |
| 頭 | `head_f<0-3>_h<0-5>_<size>.png` | 顔4×髪型6＝24個。L は全ポーズ共通の1向き（必要ならポーズ別 `_<pose>` を足してよい）。S は髪型6だけ（顔は区別しない）`head_h<0-5>_S.png` |
| 前の手 | `hand_<job>[_<costume>]_<pose>_<size>.png` | 武器の上に重ねる握り手（身体から切り出した小片） |
| 武器 | アイテムの正式アイコン（itemId と同じ）を持ち手用に使う | 一覧・入手・装備画面・手持ちで同じ itemId の絵 |

pose：L＝idle ready attack hit win ／ S＝idle attack hit walk。costume：無し（通常）・master・alt<n>。

## 重ね順
後方装飾（マント/翼。身体に含めてよい）→ 身体 → 頭 → 武器 → 前の手。

## 基準点 `rpg/assets/parts/parts.json`
```
{ "version":1,
  "body": { "<job>[_<costume>]_<pose>_<size>": { "w":..,"h":.., "foot":[x,y], "neck":[x,y], "grip":[x,y], "gripAngle":deg, "weaponScale":n, "hand":"hand_...png" | null } },
  "head": { "<name>": { "w":..,"h":.., "neck":[x,y] } },
  "weapon": { "<iconFile>": { "grip":[x,y], "tipAngle":deg } },
  "palette": { "skin": { "<partFile>": ["#rrggbb", ...明→暗] }, "hair": { "<partFile>": [...] } }
}
```
- 頭は neck 同士を合わせて置く。武器は grip 同士を合わせ、gripAngle − tipAngle だけ回す（90°単位以外は回転でにじむので、L は 0/45/90 度刻み推奨）。
- 肌・髪の色：部品の skin/hair の色列を、rpg-meta.js の SKIN（5色）・HAIR_COLOR（6色）から作った明→暗の列へ同じ順で置き換える（実行時に canvas で完全一致の色だけ差し替え）。

## 描画入口（コード）
`RPGSprites.drawHeroLayered(ctx, {look, job, costume, weaponId, pose, use, x, groundY, scale})` を唯一の入口にする。use＝home/self/equip/job/reward/look/ending/strip/codex。部品が揃っていない組合せは、開発用検査で失敗させる（配布版で仮絵を黙って出さない）。14×14 の仮ドット経路（rpg-screens.js `hero()`・rpg-sprites.js `heroRows`）は廃止する。

## 追記（2026-11-18 試作で追加した欄）
- `body.<key>.handPos` ＝ 前の手の小片の左上（身体PNG座標）。`hand` が null の組合せは前の手を重ねない。
- `body.<key>.weaponLayer` ＝ `"front"`（既定。身体→頭→武器→前の手）／`"back"`（S 用。武器→身体→頭。胴体に武器が重ならない。前の手は重ねない）。S の body は全て `back`。
- `jobWeapon` ＝ 職ごとの基本武器アイコン（rpg-data.js JOBS[*].weapons の先頭。影武者は短剣）。弓(w_bow_1)は回転せず 45度のまま胴の木の部分(grip)を握る。
- 身体PNGは首の上に頭ぶんの余白（L 32px・S 10px）を含む。全身高さは頭を載せて L 約96・S 26。
