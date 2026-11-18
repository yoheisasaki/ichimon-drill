#!/bin/sh
# 使い方: icons_fin2.sh <srcdir名> <ID,ID,...> <列> <行> "<説明>"   (ID個別指定版)
cd "$(dirname "$0")/../../.."
mkdir -p rpg/assets/src/$1; echo "$5（同会話のシート。基準 src/icons_w_sword/prompt.txt）" > rpg/assets/src/$1/prompt.txt
sleep 6; sh rpg/assets/tools/icons_take.sh $1 $2 $3 $4 && python rpg/assets/tools/icons_manifest.py $1 $2 "$5" > /dev/null
