# python tools/master_take.py <master|alt> <職> [<職>...] : ChatGPTで作った 横1列3マスのシート(左=報酬待機 中=報酬勝利 右=帯用待機)を切り、
# 通常衣装の待機と同じ高さに縮尺をそろえて chars/hero_<職>_<kind>.png / _<kind>_win.png / hero_<職>_strip_<kind>.png に出す。
# シートは Downloads/rpg<kind>_<職>.png を既定とし、src/hero_<職>_<kind>_sheet/ へ移す。STRICT=1 で紫の服の職用(マゼンタ判定を厳しく)。
import sys, os, shutil, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); D = os.path.expanduser('~/Downloads')
kind = sys.argv[1]
def mag(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    if os.environ.get('STRICT')=='1': return (r>200)&(b>200)&(g<80)&((r+b)//2-g>150)
    return (r>140)&(b>140)&(g<120)&((r+b)//2-g>80)
for j in sys.argv[2:]:
    sid=f'hero_{j}_{kind}_sheet'; s=f'{A}/src/{sid}/{sid}.png'; f=f'{D}/rpg{kind}_{j}.png'
    if os.path.exists(f): os.makedirs(os.path.dirname(s),exist_ok=True); shutil.move(f,s)
    a=np.array(Image.open(s).convert('RGB')); H,W=a.shape[:2]; fg=~mag(a)
    lab,n=ndi.label(ndi.binary_dilation(fg,iterations=10)); lab=lab*fg; cells={}
    for k in range(1,n+1):
        m=lab==k
        if m.sum()<400: continue
        ys,xs=np.nonzero(m); cells.setdefault(min(2,int(xs.mean()/(W/3))),[]).append(m)
    print(j,kind,'cells',{k:len(v) for k,v in cells.items()})
    def hgt(ms): m=np.any(ms,axis=0); ys=np.nonzero(m.any(1))[0]; return ys.max()-ys.min()+1
    idle_h=Image.open(f'{A}/chars/hero_{j}.png').size[1]; strip_h=Image.open(f'{A}/chars/hero_{j}_strip.png').size[1]
    sc=idle_h/hgt(cells[0]); sc2=strip_h/hgt(cells[2]); print('scale',sc,sc2)
    for c,pid,scl in [(0,f'hero_{j}_{kind}',sc),(1,f'hero_{j}_{kind}_win',sc),(2,f'hero_{j}_strip_{kind}',sc2)]:
        m=np.any(cells[c],axis=0); o=np.zeros_like(a)+np.array([255,0,255],np.uint8); o[m]=a[m]
        os.makedirs(f'{A}/src/{pid}',exist_ok=True); Image.fromarray(o).save(f'{A}/src/{pid}/{pid}.png')
        r=subprocess.run([sys.executable,f'{A}/tools/process.py','sprite',pid,f'src/{pid}/{pid}.png',repr(float(scl))],capture_output=True,text=True,cwd=A,env=dict(os.environ,**({'RESAMPLE':'box'} if c==2 else {})))
        print(pid,r.stdout.strip()[-90:],r.stderr.strip()[:200])
