# 複数IDを同時2本までで生成: python batch.py id:prompt:ref1,ref2 ...   (promptは prompts/<名前>.txt。_common.txt を頭に付ける)
import sys, os, subprocess, concurrent.futures as cf
T = os.path.dirname(os.path.abspath(__file__)); P = os.path.join(T, '..', 'prompts'); S = os.path.join(T, '..', 'src')
def run(spec):
    id_, pn, refs = (spec.split(':') + [''])[:3]
    txt = ('' if pn.startswith('bg_') else open(os.path.join(P, '_common.txt'), encoding='utf-8').read().strip() + ' ') + open(os.path.join(P, pn + '.txt'), encoding='utf-8').read().strip()
    tmp = os.path.join(S, '_tmp_' + id_ + '.txt'); open(tmp, 'w', encoding='utf-8').write(txt)
    r = subprocess.run([sys.executable, os.path.join(T, 'gen.py'), id_, tmp] + [x for x in refs.split(',') if x], capture_output=True, text=True, encoding='utf-8')
    os.remove(tmp); return r.stdout.strip() + r.stderr.strip()[-300:]
with cf.ThreadPoolExecutor(2) as ex:
    for o in ex.map(run, sys.argv[1:]): print(o, flush=True)
