#!/usr/bin/env python3
"""data/questions.json の検査。使い方: python tools/check_questions.py [questions.json]"""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'data', 'questions.json')
d = json.load(open(path, encoding='utf-8'))
plain = lambda s: re.sub(r'\{([^|{}]+)\|([^{}]+)\}', r'\1', s)
feats = {f['name'] for f in json.load(open(os.path.join(ROOT, 'data', 'features.json'), encoding='utf-8'))}
prefs = set(json.load(open(os.path.join(ROOT, 'data', 'map_chubu_kanto.json'), encoding='utf-8'))['prefs'])
tests = {t['id'] for t in d['tests']}
SUBJ = {'国語', '算数', '理科', '社会'}
errs, ids = [], set()
for q in d['questions']:
    i = q.get('id', '?')
    def e(m): errs.append(f'{i}: {m}')
    if i in ids: e('id重複')
    ids.add(i)
    for k in ('id', 'test', 'subject', 'unit', 'q', 'a', 'choices', 'src', 'from', 'added'):
        if not q.get(k): e(f'{k}が無い')
    if q.get('test') not in tests: e('testが tests に無い')
    if q.get('subject') not in SUBJ: e('教科が不正')
    ch = q.get('choices') or []
    if len(ch) != 3: e(f'choices が{len(ch)}個')
    allc = [plain(c) for c in ch] + [plain(q.get('a', ''))]
    if len(set(allc)) != len(allc): e('選択肢と答えが重なる')
    for s in [q.get('q', ''), q.get('a', ''), *ch]:
        t = re.sub(r'\{[^|{}]+\|[^{}]+\}', '', s)
        if '{' in t or '}' in t or '|' in t: e(f'{{|}}の形が不正: {s}')
    # 公開リポなので子どもの記録（取り込みの日付・まちがい由来）を入れない。詳しい出どころは katei-gakushu/_work/ichimon/出どころ_非公開.json
    if re.search(r'取り込み|20\d{6}', q.get('src', '')) or q.get('from') == 'まちがい': e('src/from に子どもの記録が入っている（公開不可）')
    m = q.get('map')
    if m is not None:
        if m.get('mark') and m['mark'] not in feats: e(f'map.mark が features に無い: {m["mark"]}')
        if m.get('hl') and m['hl'] not in prefs: e(f'map.hl が地図に無い: {m["hl"]}')
        if not m.get('mark') and not m.get('hl'): e('map が空')
print(f'{len(d["questions"])}問 / エラー {len(errs)}')
for x in errs: print(' ', x)
sys.exit(1 if errs else 0)
