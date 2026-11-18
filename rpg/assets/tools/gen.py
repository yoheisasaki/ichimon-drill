# 画像生成: python rpg/assets/tools/gen.py <id> <prompt_file> [ref.png ...]
# 出力: rpg/assets/src/<id>/<id>.png と <id>.prompt.txt、<id>.log（生成秒数入り）。codex の設定は書き換えない。
import sys, os, shutil, subprocess, time
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'rpg', 'assets', 'src')
def main():
    id_, pf = sys.argv[1], sys.argv[2]; refs = sys.argv[3:]
    out = os.path.join(SRC, id_); os.makedirs(out, exist_ok=True)
    prompt = open(pf, encoding='utf-8').read().strip()
    names = []
    for r in refs:
        n = os.path.basename(r)
        if os.path.abspath(r) != os.path.join(out, n): shutil.copy(r, os.path.join(out, n))
        names.append(n)
    full = f"画像生成ツールを使って画像を1枚作り、このフォルダに {id_}.png として保存してください。内容：{prompt} 保存後、パスとピクセルサイズだけ答えて"
    open(os.path.join(out, id_ + '.prompt.txt'), 'w', encoding='utf-8').write(full + '\n参照: ' + ' '.join(names) + '\n')
    cmd = ['codex', 'exec', '-m', 'gpt-6-sol', '--skip-git-repo-check', '--sandbox', 'workspace-write', full]
    for n in names: cmd += ['-i', n]
    t = time.time()
    p = subprocess.run(cmd, cwd=out, stdin=subprocess.DEVNULL, capture_output=True, text=True, encoding='utf-8', errors='replace', shell=(os.name == 'nt'))
    sec = round(time.time() - t)
    open(os.path.join(out, id_ + '.log'), 'w', encoding='utf-8').write(f'seconds={sec}\nrc={p.returncode}\n{p.stdout[-1500:]}\n{p.stderr[-800:]}\n')
    print(id_, 'rc', p.returncode, 'sec', sec, 'exists', os.path.exists(os.path.join(out, id_ + '.png')))
main()
