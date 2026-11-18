# python update_assets.py id[:srcdir[:use[:display]]] ... : 台帳の指定IDの行だけを正式に更新（実行直前に台帳を読み直す）
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'); m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
for spec in sys.argv[1:]:
    p = (spec.split('|') + ['', '', ''])[:4]; id_ = p[0]; sd = p[1] or id_
    d = os.path.join(ROOT, 'rpg', 'assets', 'src', sd); i = json.load(open(os.path.join(d, 'inspect.json'), encoding='utf-8'))
    pr = open(os.path.join(d, sd + '.prompt.txt'), encoding='utf-8').read().split('\n')[0]
    a = by.get(id_) or {'id': id_}; if_new = id_ not in by
    kind = 'bg' if i['out'].startswith('rpg/assets/bg') else 'chars'
    a.update({'path': i['out'], 'src': '%dx%d' % tuple(i['src_size']), 'status': '正式', 'transparent': kind == 'chars', 'prompt': pr,
              'inspect': '検品済み(自動): ' + json.dumps({k: v for k, v in i.items() if k not in ('src', 'out')}, ensure_ascii=False) + '。目視: 担当が確認、最終は父'})
    if p[2]: a['use'] = p[2]
    if p[3]: a['display'] = p[3]
    if kind == 'chars': a['anchor'] = '足元中央'
    if if_new: m['assets'].append(a)
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(c)
