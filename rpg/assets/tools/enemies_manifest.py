# python enemies_manifest.py <シート番号...> : 台帳を読み直し、該当敵(本体と_strip)の行だけ更新
import sys, os, json
T = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(T, '..', '..', '..')); sys.path.insert(0, T)
import enemies_sheet as E
mp = ROOT + '/rpg/ASSET_MANIFEST.json'
m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
for n in map(int, sys.argv[1:]):
    for key, nm, desc, kind in E.S[n*6:n*6+6]:
        i = 'enemy_' + key
        if not os.path.exists(f'{ROOT}/rpg/assets/chars/{i}.png'): continue
        pr = open(f'{ROOT}/rpg/assets/src/enemy_sheet{n}/prompt.txt', encoding='utf-8').read()
        for suf, h, disp in (('', 192 if kind == 'b' else 96, '報酬用'), ('_strip', 48 if kind == 'b' else 28, '帯用')):
            a = by.get(i + suf) or {'id': i + suf}
            a.update({'use': f'敵 {nm}（{disp} {h}px）', 'path': f'rpg/assets/chars/{i}{suf}.png', 'src': f'シート(ChatGPT) src/enemy_sheet{n}/sheet.png から切り出し', 'display': f'{h}px({disp})', 'anchor': '足元中央', 'status': '正式', 'transparent': True, 'ref': 'rpg/assets/src/enemy_slime/ref.png', 'prompt': f'（シート{n}の全文は src/enemy_sheet{n}/prompt.txt）' + pr[:200] + '…', 'inspect': '自動: マゼンタ残り確認・左向き・余白切り・最近傍縮小。目視: 判別・向き'})
            if i + suf not in by: m['assets'].append(a); by[i + suf] = a
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(c)
