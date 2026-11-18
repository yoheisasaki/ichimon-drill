# python bg_pipe.py <名前 waterland ...> : 報酬480x240 → 帯390x44 を生成・後処理。assets 直下から実行
import sys, os, subprocess, shutil
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); sys.path.insert(0, T)
from bg_data import BG
py = sys.executable
def sh(*a): return subprocess.run([py, *a], capture_output=True, text=True, encoding='utf-8', cwd=A)
STY = 'オリジナルのスーパーファミコン後期風ドット絵。添付の参照画像（ref.png）の絵柄・色使い・輪郭の濃紺/茶・左上光源に合わせる。見た目のドットは大きく粗く、低解像度のドット絵を拡大したように見えること（ぼやけ・アンチエイリアス・滑らかなグラデーション禁止）。文字・ロゴ・枠・影は含めない。キャラクターは描かない。'
for k in sys.argv[1:]:
    nm, d = BG[k]; r, s = 'bg_' + k, 'bg_' + k + '_strip'
    open(f'{A}/prompts/{r}.txt', 'w', encoding='utf-8').write(f'対象：「{nm}」の戦闘・報酬画面用の背景。横長の2:1の構図。{d}。画面の下側40%は左右に広く開けた平らな地面（キャラクターと宝箱を置く場所）にする。ピクセルの粗い質感。')
    open(f'{A}/prompts/{s}.txt', 'w', encoding='utf-8').write(f'対象：回答画面の下端に表示する、細長い帯状の「{nm}」の背景（横幅が高さの約9倍の極端に横長の構図）。{d}の一部を切り取った形。上部に少しの空、遠景、下部約1/3は左右に平らに続く地面。2枚目の参照画像（{k}_ref.png）と同じ場所・同じ色調。ピクセルの粗い質感。')
    if not os.path.exists(f'{A}/src/{r}/{r}.png'): print(sh('tools/batch.py', f'{r}:{r}:src/bg_meadow/ref.png').stdout, flush=True)
    if not os.path.exists(f'{A}/src/{r}/{r}.png'): print('FAIL', r, flush=True); continue
    sh('tools/process.py', 'bg', r, f'src/{r}/{r}.png', '480', '240')
    os.makedirs(f'{A}/src/{s}', exist_ok=True); shutil.copy(f'{A}/src/{r}/{r}.png', f'{A}/src/{s}/{k}_ref.png')
    if not os.path.exists(f'{A}/src/{s}/{s}.png'): print(sh('tools/batch.py', f'{s}:{s}:src/{s}/{k}_ref.png,src/bg_meadow/ref.png').stdout, flush=True)
    if os.path.exists(f'{A}/src/{s}/{s}.png'): sh('tools/process.py', 'bg', s, f'src/{s}/{s}.png', '390', '44')
    else: print('FAIL', s, flush=True)
