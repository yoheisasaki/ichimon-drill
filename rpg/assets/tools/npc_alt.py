# python npc_alt.py <mira|toto|luca|knight> : 表情差分を、立ち絵と同じ縮尺で縮めて chars/npc_<k>_alt.png にする
import sys, os, json, subprocess
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); R = os.path.abspath(os.path.join(A, '..', '..'))
for k in sys.argv[1:]:
    i = json.load(open(f'{A}/src/npc_{k}/inspect.json', encoding='utf-8')); sc = i['out_size'][1] / i['trim_size'][1]
    print(subprocess.run([sys.executable, f'{A}/tools/process.py', 'sprite', f'npc_{k}_alt', f'{A}/src/npc_{k}_alt/npc_{k}_alt.png', repr(sc)], capture_output=True, text=True, cwd=R).stdout[:200])
