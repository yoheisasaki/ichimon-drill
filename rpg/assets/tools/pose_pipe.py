# python pose_pipe.py <pose> <job...> : 主人公のポーズ差分 報酬(96px相当の縮尺) と 帯(28px相当) を生成・後処理。assets 直下から実行
# pose: attack/ready/hit/win（報酬）、帯は attack/walk/hit。待機絵と同じ縮尺で縮め、足元基準で並べても大きさが揃うようにする
import sys, os, json, subprocess, shutil
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); py = sys.executable
POSE = {
 'attack': '攻撃ポーズ。右向きで、持っている武器・杖・道具で前に向かって思い切り攻撃している瞬間（剣なら大きく振り下ろす、杖なら前に突き出す、弓なら引き絞って放つ、など職業の武器に合わせる）。体を前に傾け、足を踏み出す',
 'ready': '戦闘の構えポーズ。右向きで、持っている武器を前に構えて腰を少し落とし、相手をにらんでいる',
 'hit': '被弾ポーズ。右向きのまま、攻撃を受けて体をのけぞらせ、目をぎゅっと閉じ、片腕で顔をかばっている',
 'win': '勝利ポーズ。やや正面向きで、武器を高く掲げて飛び上がるように喜んでいる。笑顔',
 'walk': '歩行ポーズ。右向きで、足を前後に開いて歩いている途中の1コマ。武器は持ったまま',
}
def sh(*a): return subprocess.run([py, *a], capture_output=True, text=True, encoding='utf-8', cwd=A)
def idle_src(j, strip=False):
    d = 'hero_warrior_chibi' if (j == 'warrior' and not strip) else ('hero_warrior_strip' if j == 'warrior' else 'hero_' + j + ('_strip' if strip else ''))
    return f'src/{d}/{d}.png'
def scale(j, strip=False):
    sid = 'hero_' + j + ('_strip' if strip else ''); d = 'hero_warrior_chibi' if (j == 'warrior' and not strip) else sid
    i = json.load(open(f'{A}/src/{d}/inspect.json', encoding='utf-8')); return i['out_size'][1] / i['trim_size'][1]
def one(pose, j, strip):
    id_ = f'hero_{j}' + ('_strip' if strip else '') + '_' + pose
    if not os.path.exists(f'{A}/src/{id_}/{id_}.png'):
        pn = id_; sz = '28ピクセル程度の極小サイズで表示されるので細部を省き、太い輪郭と大きな色面だけで描く。' if strip else ''
        open(f'{A}/prompts/{pn}.txt', 'w', encoding='utf-8').write(f'対象：主人公（{j}）の{POSE[pose]}。1枚目の参照画像（{os.path.basename(idle_src(j, strip))}）と全く同じ人物・同じ衣装・同じ持ち物・同じ2.5頭身の体型・同じ塗り方で、ポーズだけを変える。{sz}全身が入り、画像の中央に配置し、周囲に余白。')
        print(sh('tools/batch.py', f'{id_}:{pn}:{idle_src(j, strip)},src/hero_warrior_chibi/ref.png').stdout, flush=True)
    if not os.path.exists(f'{A}/src/{id_}/{id_}.png'): print('FAIL', id_, flush=True); return
    sh('tools/process.py', 'sprite', id_, f'src/{id_}/{id_}.png', repr(scale(j, strip)))
if __name__ == '__main__':
    pose = sys.argv[1]; strip = pose.startswith('s:'); pose = pose.replace('s:', '')
    for j in sys.argv[2:]: one(pose, j, strip)
