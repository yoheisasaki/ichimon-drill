# python tools/master_manifest.py : マスター/追加衣装(hero_<職>_master, _master_win, hero_<職>_strip_master, *_alt…)を台帳に「正式」で登録。書く直前に読み直し、自分のIDだけ更新。
import json, os, glob, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'); m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
n = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'rpg', 'assets', 'chars', 'hero_*_*.png'))):
    id_ = os.path.basename(f)[:-4]
    if not re.search(r'_(master|alt)(_win)?$', id_): continue
    i = json.load(open(os.path.join(ROOT, 'rpg', 'assets', 'src', id_, 'inspect.json'), encoding='utf-8'))
    a = by.get(id_) or {'id': id_}; new = id_ not in by
    strip = '_strip_' in id_
    a.update({'path': i['out'], 'src': '%dx%d' % tuple(i['src_size']), 'status': '正式', 'transparent': True, 'anchor': '足元中央',
              'prompt': 'ChatGPTブラウザ版: 通常の待機・勝利・帯待機を参照に付け、豪華版(マスター/追加衣装)を横1列3マスのシートで生成(マゼンタ背景)→tools/master_take.py で切り出し・通常待機と同じ高さ。説明は PRODUCTION_LOG_browser.md',
              'inspect': '検品済み(自動): ' + json.dumps({k: v for k, v in i.items() if k not in ('src', 'out')}, ensure_ascii=False) + '。目視: 担当が確認、最終は父',
              'use': '主人公 %s（%s用）' % (id_, '帯' if strip else '報酬'), 'display': '28px(帯)' if strip else '96px(報酬)'})
    if new: m['assets'].append(a)
    n += 1
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); json.load(open(mp, encoding='utf-8')); print(n, c)
