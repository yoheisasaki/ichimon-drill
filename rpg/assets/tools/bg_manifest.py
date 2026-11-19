# python tools/bg_manifest.py key... : 台帳の bg_<key> / bg_<key>_strip 行だけを正式に更新（実行直前に台帳を読み直す）。ブラウザ版(ChatGPT)背景用
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bg_data import BG
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json')
m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
for k in sys.argv[1:]:
    nm = BG[k][0]
    for suf, disp, use in (('', '480x240', '報酬'), ('_strip', '390x44', '帯')):
        i = f'bg_{k}{suf}'; p = f'rpg/assets/bg/{i}.png'; a = by.get(i) or {'id': i}
        sz = Image.open(os.path.join(ROOT, p)).size
        a.update({'use': f'背景_{k}（{use}）{nm} {disp}', 'path': p, 'src': 'ChatGPT生成 1774x887（帯は同じ絵の横長切り出し）' if suf else 'ChatGPT生成 1774x887', 'display': disp, 'anchor': '-', 'status': '正式', 'transparent': False,
                  'prompt': f'ChatGPTブラウザ版。第1章の背景2枚を参照に添付し「{nm}」を横長2:1で生成（説明は tools/bg_data.py）',
                  'inspect': f'検品済み(自動): 出力{sz[0]}x{sz[1]}。目視: 担当が確認、最終は父'})
        if i not in by: m['assets'].append(a); by[i] = a
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
s = json.dumps(m, ensure_ascii=False, indent=1); json.loads(s)
open(mp, 'w', encoding='utf-8').write(s); print(c)
