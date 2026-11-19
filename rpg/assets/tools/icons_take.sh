#!/bin/sh
# 使い方: icons_take.sh <srcdir名> <ID,ID,...> <列> <行> [用途]
# Downloads で一番新しい画像(直近5分)を src/<srcdir>/sheet1.png へ移し、切り分け・台帳まで行う
cd "$(dirname "$0")/../../.."
D="/c/Users/user/Downloads"
F=$(find "$D" -maxdepth 1 -type f \( -name '*.png' -o -name '*.webp' \) -mmin -5 -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
[ -z "$F" ] && { echo "no new download"; exit 1; }
mkdir -p rpg/assets/src/$1; mv "$F" rpg/assets/src/$1/sheet1.png
python rpg/assets/tools/icons_cut.py rpg/assets/src/$1/sheet1.png $3 $4 $2 32 box
