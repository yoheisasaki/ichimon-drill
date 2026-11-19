# 宝箱6枚を台帳に反映: 書く直前に台帳を読み直し、宝箱のID行だけを更新する
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'); m = json.load(open(mp, encoding='utf-8'))
K = {'normal': '通常', 'morning': '朝星', 'boss': 'ボス'}; S = {'closed': '閉', 'open': '開'}
by = {a['id']: a for a in m['assets']}
for k, kn in K.items():
    for st, sn in S.items():
        id_ = f'chest_{k}_{st}'; d = os.path.join(ROOT, 'rpg', 'assets', 'src', id_)
        i = json.load(open(os.path.join(d, 'inspect.json'), encoding='utf-8'))
        p = open(os.path.join(d, id_ + '.prompt.txt'), encoding='utf-8').read().split('\n')[0]
        a = by.get(id_) or {'id': id_}
        a.update({'use': f'宝箱（{kn}・{sn}）報酬画面・開封演出', 'path': f'rpg/assets/chars/{id_}.png', 'src': '%dx%d' % tuple(i['src_size']), 'display': '48px幅(帯・場面) / 2倍(開封演出)', 'anchor': '足元中央', 'status': '正式', 'transparent': True, 'ref': 'enemy_slime/ref.png（見本）' + ('＋閉の絵' if st == 'open' else ''), 'prompt': p,
                  'inspect': '検品済み(自動): ' + json.dumps({x: y for x, y in i.items() if x not in ('src', 'out')}, ensure_ascii=False) + '。閉と開は同縮尺。目視: 父の最終確認待ち'})
        if id_ not in by: m['assets'].append(a); by[id_] = a
m['assets'] = [a for a in m['assets'] if a['id'] not in ('planned_chests', 'chest_open', 'chest_closed')]
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(c)
