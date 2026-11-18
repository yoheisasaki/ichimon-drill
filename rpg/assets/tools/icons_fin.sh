#!/bin/sh
# 使い方: icons_fin.sh <idの接頭辞(例 rw_sword)> "<説明>"  → 6個(3x2)を取り込み・切り分け・台帳
cd "$(dirname "$0")/../../.."
k=$1; ids=$(for i in 1 2 3 4 5 6; do printf "%s_%s," $k $i; done); ids=${ids%,}
mkdir -p rpg/assets/src/icons_$k; echo "$2（同会話のシート。基準 src/icons_w_sword/prompt.txt）" > rpg/assets/src/icons_$k/prompt.txt
sleep 6; sh rpg/assets/tools/icons_take.sh icons_$k $ids 3 2 && python rpg/assets/tools/icons_manifest.py icons_$k $ids "装備アイコン $2" > /dev/null
python rpg/assets/tools/icons_sheet.py ${k}_ C:/Users/user/AppData/Local/Temp/c.png
