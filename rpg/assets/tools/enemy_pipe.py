# python enemy_pipe.py <id接尾 e_xxx ...> : 敵ごとに プロンプト作成→生成→報酬用(56px・ボス128px)と帯用(24px・ボス32px)へ後処理。assets 直下から実行
import sys, os, subprocess
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); py = sys.executable
sys.path.insert(0, T)
import enemies_data
D = {}
for n in dir(enemies_data):
    if n.startswith('E') and isinstance(getattr(enemies_data, n), dict): D.update(getattr(enemies_data, n))
def sh(*a): return subprocess.run([py, *a], capture_output=True, text=True, encoding='utf-8', cwd=A)
for k in sys.argv[1:]:
    nm, desc, kind = D[k]; i = 'enemy_' + k
    big = '、大きく迫力のあるボス敵' if kind == 'b' else ''
    open(f'{A}/prompts/{i}.txt', 'w', encoding='utf-8').write(
        f'対象：{"ボス" if kind=="b" else "通常"}敵「{nm}」{big}。{desc}。体と顔が画像の左を向いている左向きの横向き姿（斜め横）で、正面向きにしない。待機姿。かわいさと強さを両立した、参照画像（ref.png）のスライムと同じ画風・同じ丸みのあるデザイン言語。大きな色面と太い濃紺の輪郭。全体が入り、中央に配置し、余白を取る。')
    if not os.path.exists(f'{A}/src/{i}/{i}.png'):
        print(sh('tools/batch.py', f'{i}:{i}:src/enemy_slime/ref.png').stdout, flush=True)
    s = f'src/{i}/{i}.png'
    if not os.path.exists(f'{A}/{s}'): print('FAIL', i, flush=True); continue
    sh('tools/process.py', 'sprite', i, s, '128' if kind == 'b' else '56')
    sh('tools/process.py', 'sprite', i + '_strip', s, '32' if kind == 'b' else '24')
