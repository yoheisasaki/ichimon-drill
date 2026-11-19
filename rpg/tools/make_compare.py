# 07 F：修正前（_shots/RPG現状_20261118/。gitignore対象なのでコピーせず、パスで読んで左右に並べるだけ）と修正後の比較画像を作る。
# python rpg/tools/make_compare.py → rpg/shots/fix07_compare/*.png と index.json（対応表）
import os, json
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BEFORE = 'C:/Users/user/projects/ichimon-drill/_shots/RPG現状_20261118/'
SH = os.path.join(ROOT, 'rpg', 'shots') + '/'
OUT = SH + 'fix07_compare/'; os.makedirs(OUT, exist_ok=True)
H = 1000
def font(n):
    for f in ('C:/Windows/Fonts/meiryo.ttc', 'C:/Windows/Fonts/YuGothM.ttc', 'C:/Windows/Fonts/msgothic.ttc'):
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()
def load(path, crop_h=None):
    im = Image.open(path).convert('RGB')
    if crop_h and im.height > crop_h * im.width / 390: im = im.crop((0, 0, im.width, int(crop_h * im.width / 390)))
    k = H / im.height; return im.resize((max(1, int(im.width * k)), H), Image.LANCZOS)
def sheet(name, title, before, afters, crop_h=None, blabel='修正前'):
    """before: パス or None（修正前に該当画面なし）。afters: [(ラベル, パス)]"""
    cols = [(blabel, before)] + afters
    ims = []
    for lab, pth in cols:
        if pth is None:
            im = Image.new('RGB', (390, H), (40, 40, 60)); d = ImageDraw.Draw(im); d.text((20, H // 2), '修正前：該当画面なし', fill=(230, 230, 230), font=font(26))
        else:
            if not os.path.exists(pth): raise SystemExit('missing ' + pth)
            im = load(pth, crop_h)
        ims.append((lab, im))
    gap, top = 24, 60; W = sum(i.width for _, i in ims) + gap * (len(ims) + 1)
    sh = Image.new('RGB', (W, H + top + 20), (18, 22, 44)); d = ImageDraw.Draw(sh); d.text((gap, 8), title, fill=(255, 215, 120), font=font(30)); x = gap
    for lab, im in ims:
        d.text((x, top - 26), lab, fill=(200, 230, 255), font=font(20)); sh.paste(im, (x, top)); x += im.width + gap
    sh.save(OUT + name + '.png'); return {'file': 'rpg/shots/fix07_compare/' + name + '.png', 'title': title, 'before': before.replace(BEFORE, 'RPG現状_20261118/') if before else None, 'after': [(l, p.replace(SH, 'rpg/shots/')) for l, p in afters]}
L = SH + 'fix07_loop/'; RW = SH + 'fix06_reward/'; SC = SH + 'fix07_screens/'
idx = []
idx.append(sheet('01_home', 'ホーム', BEFORE + '03_ホーム.png', [('修正後（新規セーブ・主人公を選んだ直後）', L + '03_home_hero.png'), ('修正後（魔法戦士・再読込後）', L + '23_home_after_reload.png')], crop_h=1200))
idx.append(sheet('02_strip', '回答中の帯（下端の冒険帯）', BEFORE + '02_回答中_帯の拡大.png', [('修正後（同じ帯・魔法戦士）', L + '24_quiz_strip.png')]))
idx.append(sheet('03_reward_sealed', '報酬：宝箱を開ける前', BEFORE + '05_報酬画面_全体_宝箱を開ける前.png', [('修正後（勝利・朝星の箱は閉じたまま）', RW + 'victory_unopened.png')]))
idx.append(sheet('04_reward_opened', '報酬：宝箱を開けた後', BEFORE + '06_報酬画面_朝星の宝箱を開けた後.png', [('修正後（開封後。合計が一致）', RW + 'victory_opened.png'), ('修正後（レア箱・アイコン付き）', SH + 'fix07_d05/rare_2_opened.png')]))
idx.append(sheet('05_reward_nochest', '報酬：当日3回目（箱なし）', None, [('修正後（箱の欄ごと出さない）', RW + 'third_nochest.png')]))
idx.append(sheet('06_equip', '装備：前 → 試着 → 確定', BEFORE + '12_装備_いま.png', [('修正後：前（装備中）', L + '15_equip_before_sword2.png'), ('修正後：試着（鉄の剣）', L + '16_equip_try_sword2.png'), ('修正後：確定', L + '17_equip_confirmed_sword2.png')], crop_h=1100))
idx.append(sheet('07_equip_try_old', '装備：別の武器を試着（修正前の試着画面との比較）', BEFORE + '13_装備_別の武器を試着.png', [('修正後：試着（鉄の剣）', L + '16_equip_try_sword2.png')], crop_h=1100))
idx.append(sheet('08_job', '転職：詳細（魔法戦士）', BEFORE + '15_転職_詳細_魔法戦士.png', [('修正後：詳細', L + '19_jobdetail_magicknight.png'), ('修正後：転職の演出', L + '20_job_fx.png')]))
idx.append(sheet('09_jobs_all', '転職：全12職の一覧（基本4・上級6・最上級2）', BEFORE + '14_転職_一覧.png', [('修正後：基本職', SC + 'A02_jobs_base_390.png'), ('修正後：上級職', SC + 'A02_jobs_adv_390.png'), ('修正後：最上級職', SC + 'A02_jobs_top_390.png')], crop_h=1100))
REF = 'C:/Users/user/projects/AI事業部/_work/ichimon-rpg-spec-20261118/references/home-job-style.png'
idx.append(sheet('10_B08_reference', 'B08：採用見本との比較（同じ高さに縮尺）', REF, [('実装：ホーム（魔法戦士）', L + '22_home_magicknight.png'), ('実装：転職の詳細', L + '19_jobdetail_magicknight.png')], blabel='採用見本（home-job-style.png）'))
idx.append(sheet('11_A06_look', 'A06：顔・髪型・肌・髪色を変えた前後（ホーム）', L + '01_home_new.png', [('変更後（顔3・髪4・肌2・髪色3）', L + '03_home_hero.png')], crop_h=700, blabel='変更前（初期の外見）'))
json.dump(idx, open(OUT + 'index.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(idx), 'sheets')
