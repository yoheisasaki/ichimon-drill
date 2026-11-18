# python tools/bg_take.py <key>[:帯のy位置0-1] ... : Downloads の cg_bg_<key>.png を src へ移し 480x240 に後処理。
# 帯(390x44)は同じ絵の全幅を横長に切り出して作る（ChatGPT は 3:1 までしか出せないため。y位置=切り出し窓の上端の高さ比、既定0.45）
import sys, os, shutil, subprocess
from PIL import Image
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); D = os.path.expanduser('~/Downloads')
for a in sys.argv[1:]:
    k, _, fy = a.partition(':'); fy = float(fy or 0.45); i = f'bg_{k}'; f = f'{D}/cg_{i}.png'; s = f'{A}/src/{i}/{i}.png'
    if os.path.exists(f):
        os.makedirs(f'{A}/src/{i}', exist_ok=True); shutil.move(f, s)
    if not os.path.exists(s): print('skip', i); continue
    r = subprocess.run([sys.executable, f'{A}/tools/process.py', 'bg', i, f'src/{i}/{i}.png', '480', '240'], capture_output=True, text=True, cwd=A); print(r.stdout.strip()[-120:], r.stderr.strip()[:200])
    im = Image.open(s).convert('RGB'); W, H = im.size; nh = round(W * 44 / 390); y0 = min(round(H * fy), H - nh)
    im.crop((0, y0, W, y0 + nh)).resize((390, 44), Image.NEAREST).save(f'{A}/bg/{i}_strip.png'); print(i + '_strip', 'y0', y0, 'of', H)
