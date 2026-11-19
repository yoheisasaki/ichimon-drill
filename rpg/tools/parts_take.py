# Downloads の rpgparts_<職>_<衣装>_<L|S>.png を assets/src/parts/sheet_body_*.png へ移し、parts_body.py で部品にする
# python rpg/tools/parts_take.py [職_衣装_サイズ ...]（省略時は Downloads にある全部）
import sys, os, glob, shutil, subprocess
DL = os.path.expanduser('~/Downloads'); R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(R, 'assets', 'src', 'parts')
for f in sorted(glob.glob(os.path.join(DL, 'rpgparts_*.png'))):
    tag = os.path.basename(f)[len('rpgparts_'):-4]; job, costume, size = tag.split('_')
    if len(sys.argv) > 1 and tag not in sys.argv[1:]: continue
    dst = os.path.join(SRC, f'sheet_body_{job}_{costume}_{size}.png'); shutil.move(f, dst)
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    if job in ('mage', 'ninja', 'shadow', 'thief'): env['PARTS_STRICT'] = '1'
    print('==', tag); r = subprocess.run([sys.executable, os.path.join(R, 'tools', 'parts_body.py'), f'{job}:{costume}', size], env=env, capture_output=True, text=True, encoding='utf-8')
    print('\n'.join(r.stdout.splitlines()[-6:]), r.stderr[-400:])
