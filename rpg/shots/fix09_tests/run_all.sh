#!/bin/bash
# 全検査を順に実行してログを残す。bash rpg/shots/fix09_tests/run_all.sh（worktree 直下）
L=rpg/shots/fix09_tests
export PYTHONIOENCODING=utf-8
for t in run meta reward stage3 hero; do node rpg/tests/$t.js > $L/node_$t.log 2>&1; echo "node $t $?"; done
for t in ui_test ui_test2 ui_test3 ui_test4 ui_test_map ui_test_fx ui_test_text; do python rpg/tools/$t.py > $L/py_$t.log 2>&1; echo "py $t $?"; done
REAL=1 python rpg/tools/ui_test_hero.py > $L/py_ui_test_hero.log 2>&1; echo "py ui_test_hero $?"
python rpg/tools/fix06_reward.py > $L/py_fix06_reward.log 2>&1; echo "fix06_reward $?"
python rpg/tools/fix07_screens.py > $L/py_fix07_screens.log 2>&1; echo "fix07_screens $?"
python rpg/tools/regress.py fix09 > $L/py_regress.log 2>&1; echo "regress $?"
node rpg/tools/ruby_audit.js > $L/ruby_audit.log 2>&1; echo "ruby $?"
python rpg/tools/contrast_audit.py > $L/py_contrast.log 2>&1; echo "contrast $?"
echo DONE
