# python tools/pose_sheet_take.py <職> [シート画像] : ChatGPTで作った 3列x2行のポーズシート
# (左上=待機,上中=attack,右上=ready,左下=hit,下中=win) を切り分け、待機の縮尺をそろえて chars/hero_<職>_<pose>.png に出す。
# シートは Downloads/rpgpose_<職>.png を既定とし、src/hero_<職>_sheet/ へ移す。
import sys, os, shutil, json, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); D = os.path.expanduser('~/Downloads')
STRIP = os.environ.get('STRIP')=='1'   # 帯用: 2列x2行 左上=待機 右上=attack 左下=hit 右下=walk
CELL = {(0,0):'idle',(0,1):'attack',(1,0):'hit',(1,1):'walk'} if STRIP else {(0,0):'idle',(0,1):'attack',(0,2):'ready',(1,0):'hit',(1,1):'win'}
NC = 2 if STRIP else 3
SUF = '_strip' if STRIP else ''
def mag(a):
    r,g,b=[a[...,i].astype(int) for i in range(3)]
    if os.environ.get('STRICT')=='1': return (r>200)&(b>200)&(g<80)&((r+b)//2-g>150)
    return (r>140)&(b>140)&(g<120)&((r+b)//2-g>80)
for j in sys.argv[1:]:
    sid=f'hero_{j}{SUF}_sheet'; s=f'{A}/src/{sid}/{sid}.png'; f=f'{D}/rpgpose_{"s_" if STRIP else ""}{j}.png'
    if os.path.exists(f): os.makedirs(os.path.dirname(s),exist_ok=True); shutil.move(f,s)
    im=Image.open(s).convert('RGB'); a=np.array(im); H,W=a.shape[:2]
    fg=~mag(a)
    lab,n=ndi.label(ndi.binary_dilation(fg,iterations=10))
    lab=lab*fg
    comps={}
    for k in range(1,n+1):
        m=lab==k; c=int(m.sum())
        if c<400: continue
        ys,xs=np.nonzero(m); comps[k]=(ys.mean(),xs.mean(),c,m)
    cells={}
    for k,(cy,cx,c,m) in comps.items():
        key=(int(cy>H/2),min(NC-1,int(cx/(W/NC)))); cells.setdefault(key,[]).append(m)
    print(j,'cells',{k:len(v) for k,v in cells.items()})
    idle_h=Image.open(f'{A}/chars/hero_{j}{SUF}.png').size[1]
    m=np.any(cells[(0,0)],axis=0); ys=np.nonzero(m.any(1))[0]; sc=float(idle_h/(ys.max()-ys.min()+1)); print('scale',sc)
    for key,pose in CELL.items():
        if pose=='idle' or key not in cells or pose in os.environ.get('KEEP','').split(','): continue
        m=np.any(cells[key],axis=0); o=np.zeros_like(a)+np.array([255,0,255],np.uint8); o[m]=a[m]
        pid=f'hero_{j}{SUF}_{pose}'; os.makedirs(f'{A}/src/{pid}',exist_ok=True); Image.fromarray(o).save(f'{A}/src/{pid}/{pid}.png')
        r=subprocess.run([sys.executable,f'{A}/tools/process.py','sprite',pid,f'src/{pid}/{pid}.png',repr(sc)],capture_output=True,text=True,cwd=A)
        print(pid,r.stdout.strip()[-100:],r.stderr.strip()[:200])
