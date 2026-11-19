#!/bin/bash
# 09用：エンジン（chromium・webkit）× 表示領域の通し検査。bash rpg/shots/fix09_tests/run_matrix.sh（worktree 直下）
L=rpg/shots/fix09_tests; export PYTHONIOENCODING=utf-8
for E in chromium webkit; do
  ENGINE=$E OUT_NAME=fix09_screens_$E python rpg/tools/fix08_screens.py > $L/screens_$E.log 2>&1; echo "screens $E $?"
  ENGINE=$E OUT_NAME=fix09_screens_$E python rpg/tools/fix08_answer.py > $L/answer_$E.log 2>&1; echo "answer $E $?"
  ENGINE=$E OUT_NAME=fix09_screens_$E python rpg/tools/fix08_reward.py > $L/reward_$E.log 2>&1; echo "reward $E $?"
  ENGINE=$E OUT_NAME=fix09_strip_$E python rpg/tools/fix08_strip.py > $L/strip_$E.log 2>&1; echo "strip $E $?"
done
python rpg/tools/fix08_reveal.py > $L/reveal.log 2>&1; echo "reveal $?"
python rpg/tools/fix08_v3b_default.py > $L/v3b_default.log 2>&1; echo "v3b_default $?"
python rpg/tools/fix09_fit.py > $L/fit.log 2>&1; echo "fit $?"
python rpg/tools/d05_chests.py > $L/d05.log 2>&1; echo "d05 $?"
python rpg/tools/loop_07.py > $L/loop_07.log 2>&1; echo "loop07 $?"
python rpg/tools/fix09_record.py > $L/record.log 2>&1; echo "record $?"
echo MDONE
