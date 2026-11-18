# python hero_pipe.py job1 job2 ... : 各職 報酬(96px)→帯(28px) を順に生成・後処理（assets 直下から実行）
import sys, os, subprocess, shutil
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); py = sys.executable
def sh(*a): return subprocess.run([py, *a], capture_output=True, text=True, encoding='utf-8', cwd=A)
for j in sys.argv[1:]:
    rid, sid = 'hero_' + j, 'hero_' + j + '_strip'
    if not os.path.exists(f'{A}/src/{rid}/{rid}.png'):
        print(sh('tools/batch.py', f'{rid}:{rid}:src/hero_warrior_chibi/hero_warrior_chibi.png,src/hero_warrior_chibi/ref.png').stdout, flush=True)
    if not os.path.exists(f'{A}/src/{rid}/{rid}.png'): print('FAIL', rid, flush=True); continue
    sh('tools/process.py', 'sprite', rid, f'src/{rid}/{rid}.png', '96')
    shutil.copy(f'{A}/src/{rid}/{rid}.png', f'{A}/src/{rid}_ref_tmp.png')
    ref = f'src/{rid}_ref_tmp.png'
    os.makedirs(f'{A}/src/{sid}', exist_ok=True); shutil.copy(ref, f'{A}/src/{sid}/{j}_ref.png')
    if not os.path.exists(f'{A}/src/{sid}/{sid}.png'):
        print(sh('tools/batch.py', f'{sid}:{sid}:src/{sid}/{j}_ref.png,src/hero_warrior_chibi/ref.png').stdout, flush=True)
    if os.path.exists(f'{A}/src/{sid}/{sid}.png'): sh('tools/process.py', 'sprite', sid, f'src/{sid}/{sid}.png', '28')
    else: print('FAIL', sid, flush=True)
    os.remove(f'{A}/src/{rid}_ref_tmp.png')
