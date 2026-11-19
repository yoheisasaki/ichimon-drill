# 台帳 rpg/ASSET_MANIFEST.json の古い状態・件数を実態に合わせる（何度実行しても同じ結果）。python rpg/tools/refresh_manifest.py
# 順序：make_manifest.js → annotate_manifest.js → 本スクリプト。
# status＝素材の制作状態（予定／制作済み／一部／正式／仮／置換済み）、connected＝画面（rpg/js）が実際に読んでいるか。この2つは別の欄。
import json, os, re, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json')
m = json.load(open(P, encoding='utf-8')); A = m['assets']
parts = json.load(open(os.path.join(ROOT, 'rpg', 'assets', 'parts', 'parts.json'), encoding='utf-8'))
def n(rx): return sum(1 for a in A if re.match(rx, a['id']) and a['status'] == '正式')
def bodies(kind, size):
    c = 0
    for k in parts['body']:
        ps = k.split('_'); kd = 'master' if 'master' in ps else ('alt' if any(x.startswith('alt') for x in ps) else 'base')
        if kd == kind and ps[-1] == size: c += 1
    return c
enemy_base = sum(1 for a in A if re.match(r'enemy_', a['id']) and not a['id'].endswith('_strip') and a['status'] == '正式')
# 予定行（制作計画の分類）に対する、今ある実物の数。足りていれば「制作済み」、足りなければ「一部」、無ければ「予定」のまま
REAL = {
    'planned_hero_base_poses': (bodies('base', 'L'), '部品 body 通常衣装L（parts.json）'),
    'planned_hero_master_poses': (bodies('master', 'L'), '部品 body マスター衣装L（parts.json）'),
    'planned_hero_adv_extra': (bodies('alt', 'L'), '部品 body 追加衣装L（上級職6、parts.json）'),
    'planned_face_hair': (len(parts['head']), '部品 head（parts.json）'),
    'planned_strip_sprites': (bodies('base', 'S') + bodies('master', 'S'), '部品 body 帯用S（通常＋マスター）'),
    'planned_enemy_normal': (enemy_base, '敵の正式画像（enemy_*。基本種＋強化版）。planned_enemy_* 3行の合計に対して'),
    'planned_enemy_boss': (enemy_base, '同上'), 'planned_enemy_extra': (enemy_base, '同上'),
    'planned_bg_battle_reward': (n(r'bg_(?!.*_strip)(?!map_)(?!memorial)(?!room)(?!town)(?!worldmap)'), 'bg_*（戦闘・報酬の背景）'),
    'planned_town': (n(r'town_') + n(r'bg_town$'), 'town_* と bg_town'),
    'planned_rooms': (n(r'bg_room_'), 'bg_room_*'), 'planned_world_map': (n(r'bg_worldmap$'), 'bg_worldmap'),
    'planned_icons_normal': (n(r'icon_(w|a|x)_'), 'icon_w/a/x_*'),
    'planned_icons_rare_unique': (n(r'icon_(rw|ra|rx)_') + n(r'icon_u_'), 'icon_rw/ra/rx_*、icon_u_*'),
    'planned_weapon_inhand': (sum(1 for f in os.listdir(os.path.join(ROOT, 'rpg', 'assets', 'parts')) if f.startswith('hand_')), '部品 hand（前の手）'),
    'planned_skill_fx': (n(r'fx_'), 'fx_*'), 'planned_npc': (n(r'npc_'), 'npc_*'), 'planned_memorial': (n(r'bg_memorial_'), 'bg_memorial_*'),
    'planned_job_emblem_intro': (n(r'icon_job_'), 'icon_job_*（職業しるしのみ。紹介絵は別。画面に未接続）'),
    'planned_hero_overlay': (0, '該当する素材なし'),
    'planned_materials_furniture': (n(r'icon_(ore|bm|trial|dawn)'), 'icon_ore/bm/trial/dawn（画面に未接続）。家具・記念品は無い'),
}
# 敵3行は合計で比べる（計93）
enemy_plan = sum(a.get('count') or 0 for a in A if a['id'] in ('planned_enemy_normal', 'planned_enemy_boss', 'planned_enemy_extra'))
for a in A:
    if not a['id'].startswith('planned_'): continue
    have, what = REAL[a['id']]; need = a.get('count') or 0
    if a['id'] in ('planned_enemy_normal', 'planned_enemy_boss', 'planned_enemy_extra'): need = enemy_plan
    a['status'] = '制作済み' if have >= need and need > 0 else ('一部' if have > 0 else '予定')
    a['madeCount'] = have; a['madeAs'] = what + f'（計画{need}・実物{have}）'
    a['inspect'] = '制作計画の分類行。実物は個別の行／部品に登録されている（画面に出す／出さないは各行の connected を見る）'; a['connectedWhere'] = '制作計画の分類行（画像なし）。実物は個別の行／部品で、画面に出すかは各行の connected を見る'
# 画像素材ではないコード/CSS描画の行：画面から外した仮絵は「置換済み」。音だけは合成の簡易音のまま（初期オフ）なので「仮」
for a in A:
    if a['id'] in ('memorial_picture', 'hero_look_variants', 'town_overview', 'job_intro_pose', 'screen_frames'):
        a['status'] = '置換済み'; a['connectedWhere'] = 'コード/CSS描画だった行。画面からは外した（正式な画像／部品に置換）'; a['inspect'] = '仮絵だった行。画面から外し、正式な画像／部品に置き換えた（コードは残るが画面は読まない）'
    if a['id'] == 'sound_original':
        a['connected'] = '接続済み'; a['connectedWhere'] = 'rpg-sound.js（報酬・開封・転職などで鳴る。設定で初期オフ）。画像素材ではない'
        a['inspect'] = '簡易な合成音（外部素材なし）。設定で初期オフ。録音した効果音ではない＝仮のまま（絵ではないので試遊不可の条件には数えないが、既知の制約）'
c = collections.Counter(a['status'] for a in A); cc = collections.Counter(a.get('connected') for a in A)
m['updated'] = '2026-11-19'
m['note'] = '状態: status＝素材の制作状態（正式＝制作済み・組み込み済み／仮＝コード描画の仮物／置換済み＝仮絵だったが画面から外した／予定行は 制作済み・一部・予定）。connected＝画面（rpg/js）が実際に読んでいるか（接続済み・未接続・対象外）。この2つは別の欄。件数は rpg/tools/refresh_manifest.py が数え直す'
m['counts'] = dict(c); m['connectedCounts'] = dict(cc)
m['counts_by_kind'] = {'正式の画像行（connected 別）': dict(collections.Counter(a.get('connected') for a in A if a['status'] == '正式'))}
json.dump(m, open(P, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(dict(c), dict(cc), m['counts_by_kind'])
for a in A:
    if a['id'].startswith('planned_'): print(a['id'], a['status'], a['madeAs'])
