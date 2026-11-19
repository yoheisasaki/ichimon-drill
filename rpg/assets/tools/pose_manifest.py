# python tools/pose_manifest.py : ChatGPTシート由来のポーズ(hero_<職>_<pose>, hero_<職>_strip_<pose>)を台帳に「正式」で登録。書く直前に台帳を読み直し、自分のIDの行だけ更新する。
import json, os, glob
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'); m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
NM = {'attack': '攻撃', 'ready': '構え', 'hit': '被弾', 'win': '勝利', 'walk': '歩行'}
n = 0
for f in sorted(glob.glob(os.path.join(ROOT, 'rpg', 'assets', 'chars', 'hero_*_*.png'))):
    id_ = os.path.basename(f)[:-4]; parts = id_.split('_')
    if parts[-1] not in NM: continue
    strip = id_.endswith(tuple('_strip_' + k for k in NM)); job = parts[1]
    sd = os.path.join(ROOT, 'rpg', 'assets', 'src', id_, 'inspect.json')
    if not os.path.exists(sd): continue
    i = json.load(open(sd, encoding='utf-8'))
    a = by.get(id_) or {'id': id_}; new = id_ not in by
    if a.get('status') == '正式' and 'pose_sheet_take' not in a.get('prompt', '') and not new: continue   # 別担当(Codex)の正式行は触らない
    a.update({'path': i['out'], 'src': '%dx%d' % tuple(i['src_size']), 'status': '正式', 'transparent': True, 'anchor': '足元中央',
              'prompt': 'ChatGPTブラウザ版: 待機絵を参照に付けた複数ポーズのシート(マゼンタ背景)→tools/pose_sheet_take.py で切り出し・待機と同縮尺。説明は PRODUCTION_LOG_browser.md',
              'inspect': '検品済み(自動): ' + json.dumps({k: v for k, v in i.items() if k not in ('src', 'out')}, ensure_ascii=False) + '。目視: 担当が確認、最終は父',
              'use': '主人公 %s・%sポーズ（%s用）' % (job, NM[parts[-1]], '帯 28px前後' if strip else '報酬 96px前後'),
              'display': '28px(帯)' if strip else '96px(報酬)'})
    if new: m['assets'].append(a)
    n += 1
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); json.load(open(mp, encoding='utf-8')); print(n, c)
