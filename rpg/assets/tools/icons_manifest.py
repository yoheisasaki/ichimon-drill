# アイコンの台帳更新: python rpg/assets/tools/icons_manifest.py <srcdir名> <id,id,...> "<用途の前置き>"
# 台帳は読み直して、自分のid(icon_<id>)の行だけ足す/更新する。
import sys, os, json
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json')
srcdir, ids, use = sys.argv[1], sys.argv[2].split(','), sys.argv[3]
prompt = open(os.path.join(ROOT, 'rpg', 'assets', 'src', srcdir, 'prompt.txt'), encoding='utf-8').read().strip()
m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
for i in ids:
    k = 'icon_' + i
    a = by.get(k) or {'id': k}
    a.update({'use': f'{use}（{i}）', 'path': f'rpg/assets/icons/{i}.png', 'src': 'シート(ChatGPT)から切り出し', 'display': '32px', 'anchor': '中央', 'status': '正式', 'transparent': True, 'ref': 'rpg/assets/src/pilot/ref.png', 'prompt': prompt[:300] + '…（全文は src/' + srcdir + '/prompt.txt）', 'inspect': '自動: マゼンタ残り0〜数px・32px四方・箱平均縮小。目視: ランク差を確認'})
    if k not in by: m['assets'].append(a); by[k] = a
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(c)
