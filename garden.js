'use strict';
/* 理科の畑：冒険の既存セーブや問題の履歴は変更しない。観察と栽培のみ独立保存。 */
const KEY='ichimon.science.garden.v1';
const P=[
{id:'asagao',n:'アサガオ',icon:'🌸',seed:'黒っぽい、角のある種',leaf:'ハート形の本葉が、くきから交互に出る',flower:'朝に開く、ラッパのような花',fruit:'花のあとにできる実の中に種',kind:'つる',flowerIcon:'🌸',produce:'種',color:'#8a64cf',q:[
['種の形','アサガオの種はどんな形に近い？','黒っぽく、角ばっている',['白くて丸い','長くて細い'], 'アサガオの種は黒っぽく、角のある形。ヒマワリの細長い種とは違うよ。'],
['芽の出方','種からまず伸びてくるものは？','根',['花','実'], '根が先に伸びて水を吸い、やがて芽が土の上に出るよ。'],
['子葉','アサガオの子葉は何枚？','2枚',['1枚','4枚'], 'はじめに開く2枚は子葉。あとから本葉が出てくるよ。'],
['葉とくき','アサガオのくきは、どう伸びる？','つるがものに巻きついて伸びる',['太い幹になる','地中にだけ伸びる'],'アサガオはつる植物。ハート形に近い本葉を出しながら伸びるよ。'],
['花','アサガオの花は、どんな形？','ラッパのような形',['小さい花が集まった丸い形','とうもろこしの穂の形'],'アサガオの花は、花びらがつながったラッパのような形だよ。'],
['実と種','アサガオの花が終わると何ができる？','種の入った実',['かならず食べられる野菜','地下に新しい花'],'花のあとに実ができ、中に次の世代の種が入っているよ。']]},
{id:'sunflower',n:'ヒマワリ',icon:'🌻',seed:'細長く、しま模様がある種',leaf:'大きな本葉には網目状の葉脈',flower:'大きな花のように見える部分は、小さな花の集まり',fruit:'花の中心にたくさんの種のような実',kind:'直立',flowerIcon:'🌻',produce:'種',color:'#f3b83e',q:[
['種の形','ヒマワリの種に多い形は？','細長い形',['まん丸','平たい三角形'],'細長い種で、しま模様のあるものも多いよ。'],
['芽の出方','芽が出るとき、最初に土に向かう部分は？','根',['花びら','実'],'種から根が伸び、土の中で水を吸うよ。'],
['子葉','ヒマワリの芽で、最初に開く子葉は？','2枚',['1枚','6枚'],'2枚の子葉と、そのあとに出る本葉は形が違うよ。'],
['葉とくき','ヒマワリの本葉に見えるすじ（葉脈）は？','網目のようにつながる',['まっすぐ平行に並ぶ','葉脈がまったくない'],'本葉には網目状の葉脈が見える。くきも太く伸びるよ。'],
['花','ヒマワリの大きな「花」は？','小さな花がたくさん集まっている',['花びらが1枚だけの花','種だけが集まっている'],'外側の黄色い部分も、中心の部分も、小さな花が集まったつくりだよ。'],
['実と種','ヒマワリの花が終わったあと、中心にできるものは？','たくさんの実（中に種がある）',['根','新しい花びらだけ'],'中心にたくさんの実ができるよ。中に種が入っている。']]},
{id:'housenka',n:'ホウセンカ',icon:'🌺',seed:'小さく、ほぼ丸い種',leaf:'子葉は丸っぽく、本葉は細長くぎざぎざ',flower:'くきの葉のつけ根近くに花がつく',fruit:'熟した実にふれると、種がはじける',kind:'直立',flowerIcon:'🌺',produce:'種',color:'#e77d99',q:[
['種の形','ホウセンカの種に近い形は？','小さく、丸っぽい',['長い穂の形','大きなうすい板'],'ホウセンカの種は小さくて丸っぽいよ。'],
['芽の出方','ホウセンカが芽を出すとき、先に出るものは？','根',['実','花'],'土の中へ根が伸び、そのあと芽が出てくるよ。'],
['子葉','ホウセンカで、はじめに出る子葉は？','丸っぽい2枚の葉',['細長い葉が10枚','1枚だけの大きな葉'],'子葉は丸っぽい2枚。本葉はずっと細長いよ。'],
['葉とくき','ホウセンカの本葉のふちは？','ぎざぎざしている',['まったく葉がない','針のように硬い'],'細長く、ふちがぎざぎざした本葉が育つよ。'],
['花','ホウセンカの花はどこに見られる？','葉のつけ根の近く',['いつも根の先','土の中だけ'],'葉のつけ根あたりに花がつくよ。'],
['実と種','熟したホウセンカの実にさわると？','はじけて種が飛び出す',['色が青くなるだけ','地下にしずむ'],'熟した実がはじけて、種を遠くに散らすしくみがあるよ。']]},
{id:'edamame',n:'エダマメ',icon:'🫛',seed:'丸みのある豆（ダイズの種）',leaf:'子葉2枚のあと、3枚ひと組の本葉が出る',flower:'小さな白色や紫色の花',fruit:'さやの中に豆が育つ',kind:'直立',flowerIcon:'🌼',produce:'エダマメ',color:'#58a977',q:[
['種の形','エダマメを育てるときにまく種は？','ダイズ（大豆）の豆',['ゴマの種','トウモロコシの粒'],'エダマメは、未熟なダイズの豆を食べる野菜。まく種もダイズだよ。'],
['芽の出方','ダイズの種から、まず伸びてくるのは？','根',['花','さや'],'種が水を吸って、最初に根が出るよ。'],
['子葉','ダイズの子葉は何枚？','2枚',['1枚','5枚'],'大きな2枚の子葉が出て、あとから本葉が育つよ。'],
['葉とくき','エダマメでよく見られる本葉のつき方は？','小さな葉3枚でひと組',['針のような葉1枚だけ','葉がない'],'ダイズでは3枚でひと組の葉（三出複葉）が見られるよ。'],
['花','エダマメの花は？','小さな白や紫色の花',['大きな赤いラッパ形','緑色のとうもろこしの穂'],'小さく目立たない花から、豆の入ったさやができるよ。'],
['実と種','エダマメで食べているのは？','さやの中の若い豆',['花びら','根'],'若いダイズの豆をエダマメとして食べるんだよ。']]},
{id:'tomato',n:'トマト',icon:'🍅',seed:'小さく平たく、うぶ毛のある種',leaf:'切れこみのある葉が交互につく',flower:'黄色い星形の花がいくつかまとまって咲く',fruit:'花のあとに丸い実が大きくなる',kind:'直立',flowerIcon:'🌼',produce:'トマト',color:'#dd6658',q:[
['種の形','トマトの種の形に近いのは？','小さく平たい',['トウモロコシの大きな粒','細長い黒いしま模様'],'トマトの種は小さく平たく、表面に細かな毛があるよ。'],
['芽の出方','トマトの種が発芽すると、まず伸びるのは？','根',['赤い実','花'],'根が出てから子葉が土の上に現れるよ。'],
['子葉','トマトの子葉は？','2枚',['1枚','8枚'],'細長めの2枚の子葉が出て、そのあとに本葉が育つよ。'],
['葉とくき','トマトの本葉は？','切れこみのある葉',['細長く平行な葉脈だけ','葉がない'],'トマトの葉は切れこみがあり、くきから交互に出るよ。'],
['花','トマトの花の色は？','黄色',['青色','黒色'],'黄色い花がいくつかまとまって咲く。花のあとに実ができるよ。'],
['実と種','トマトの赤い実の中にあるのは？','たくさんの種',['子葉がついたままの新しい芽','小さな花びらだけ'],'トマトは花のあとに実ができ、その中に種が入っているよ。']]},
{id:'cucumber',n:'キュウリ',icon:'🥒',seed:'平たい楕円形で、淡い色の種',leaf:'大きい子葉2枚のあと、広く切れこんだ本葉',flower:'黄色い雄花と雌花が別々につく',fruit:'雌花の下が大きくなってキュウリになる',kind:'つる',flowerIcon:'🌼',produce:'キュウリ',color:'#5aa56d',q:[
['種の形','キュウリの種はどんな形？','平たく楕円形',['黒い三角形','丸い金属の玉'],'キュウリの種は淡い色で、平たい楕円形だよ。'],
['芽の出方','キュウリが芽を出すとき、先に伸びるのは？','根',['きゅうりの実','花'],'根が先に伸び、子葉が土の上に広がるよ。'],
['子葉','キュウリの芽に出る子葉は？','2枚',['1枚','3枚'],'丸みのある大きめの2枚の子葉が出るよ。'],
['葉とくき','キュウリのくきの特徴は？','つるが伸び、巻きひげでつかまる',['地下にしか伸びない','太い木の幹になる'],'つるや巻きひげを伸ばし、広い本葉をつけるよ。'],
['花','キュウリの花について正しいのは？','雄花と雌花が別々に咲く',['花は必ず青い','雄花しか咲かない'],'黄色い雄花と雌花があり、雌花の下には小さなキュウリのような部分があるよ。'],
['実と種','キュウリの実になるのは？','雌花の下の部分',['雄花の花粉だけ','根の先'],'雌花が受粉すると、その下にある子房が育って実になるよ。']]},
{id:'pumpkin',n:'カボチャ',icon:'🎃',seed:'大きく平たく、楕円形の種',leaf:'大きく広い、切れこみのある葉',flower:'大きな黄色い雄花と雌花が別々につく',fruit:'雌花の下が大きくなり、実になる',kind:'つる',flowerIcon:'🌼',produce:'カボチャ',color:'#ed9a46',q:[
['種の形','カボチャの種の形は？','大きめで平たい楕円形',['細い針の形','長い穂の形'],'カボチャの種は平たく、キュウリの種より大きめのことが多いよ。'],
['芽の出方','カボチャの種が芽を出すとき、先に出るのは？','根',['大きな実','花'],'土の中で根が伸び、やがて子葉が広がるよ。'],
['子葉','カボチャの子葉は何枚？','2枚',['1枚','7枚'],'大きな2枚の子葉が広がって、そのあと本葉が育つよ。'],
['葉とくき','カボチャのくきはどう伸びる？','つるが地面などをはいながら伸びる',['いつも木のようにまっすぐ','土の中だけ'],'カボチャはつるを伸ばし、大きな葉をつけるよ。'],
['花','カボチャの花の特徴は？','黄色い雄花と雌花が別々に咲く',['白い1枚だけの花','花が咲かない'],'雄花と雌花があり、雌花の下に小さな実のような部分があるよ。'],
['実と種','カボチャの実は、どこから育つ？','雌花の下にある部分',['根の先','葉のふち'],'雌花の子房が大きくなって実になるよ。']]},
{id:'corn',n:'トウモロコシ',icon:'🌽',seed:'丸みのある、硬い粒（種を含む実）',leaf:'細長い葉、平行に走る葉脈',flower:'先端に雄花の穂、わきに雌花の穂',fruit:'雌花のひげに花粉がつき、粒が育つ',kind:'イネ科',flowerIcon:'🌾',produce:'トウモロコシ',color:'#e8b53f',q:[
['種の形','トウモロコシの「種」としてまくのは？','硬い粒',['毛の長いわた','平たい黒い三角形'],'黄色などの硬い粒をまく。正確には粒は実で、中に種の部分があるよ。'],
['芽の出方','トウモロコシの芽で最初に土に伸びるのは？','根',['とうもろこしの実','花'],'種の中の芽と根が育ち、細長い葉が出てくるよ。'],
['子葉','トウモロコシは何枚の子葉をもつ仲間？','1枚',['2枚','4枚'],'トウモロコシは単子葉類。アサガオなどと違い、子葉は1枚で、土の上に2枚の子葉を広げないよ。'],
['葉とくき','トウモロコシの葉のすじ（葉脈）は？','ほぼ平行に走る',['網目だけでできている','葉脈がない'],'細長い葉には平行脈が見られる。葉はくきの左右に交互につくよ。'],
['花','トウモロコシの雄花はどこにある？','くきの先端の穂',['地下の根','葉の裏だけ'],'先端の穂に雄花、葉のわきの穂に雌花ができる。ひげは雌しべの一部だよ。'],
['実と種','トウモロコシのひげは何の一部？','雌しべ',['根','葉脈'],'ひげは雌しべ。花粉がつくと、やがて粒が育っていくよ。']]}];
const STAGES=['種','発芽','子葉','本葉・くき','花','実','収穫'];
function blank(){return {plots:[null,null,null,null],harvest:{},solved:0,wrong:0}}
function safeLoad(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&Array.isArray(v.plots)&&v.plots.length===4)return {plots:v.plots.map(x=>x&&P.some(p=>p.id===x.id)?{id:x.id,stage:Math.min(6,Math.max(0,Number(x.stage)||0))}:null),harvest:v.harvest||{},solved:Number(v.solved)||0,wrong:Number(v.wrong)||0};}catch(e){}return blank()}
let state=safeLoad(),dialog=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function plant(id){return P.find(p=>p.id===id)}
function vector(p,stage){
const col=p.color, flower=p.flowerIcon, corn=p.kind==='イネ科',vine=p.kind==='つる';
const seedShape=p.id==='sunflower'?'M-9 -19 Q-3 -25 5 -18 L8 14 Q0 24 -8 13Z':p.id==='asagao'?'M-13 -12 L1 -21 L15 -5 L6 16 L-11 9Z':p.id==='corn'?'M-14 -11 Q0 -20 14 -9 L12 14 Q0 21 -12 13Z':'M-15 0 Q-15 -17 0 -17 Q15 -17 15 0 Q15 16 0 16 Q-15 16 -15 0Z';
let v='<svg viewBox="0 0 240 170" class="art" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+esc(p.n+'の'+STAGES[stage])+'"><rect x="0" y="0" width="240" height="170" rx="12" fill="#eef8ea"/><path d="M0 140 Q70 128 120 140 T240 140 V170 H0Z" fill="#aa7450"/><path d="M0 145 Q100 136 240 145" stroke="#825c40" stroke-width="2" fill="none"/>';
if(stage===0){v+='<g transform="translate(120 110)"><path d="'+seedShape+'" fill="'+(p.id==='corn'?'#e4c144':'#826443')+'" stroke="#493e32" stroke-width="2"/></g><text x="120" y="50" text-anchor="middle" font-size="16" fill="#526d51">たね</text>'}
else{const height=[0,20,40,70,91,95,99][stage];v+='<path d="M120 140 Q120 '+(140-height/2)+' '+(vine?133:120)+' '+(140-height)+'" fill="none" stroke="#36804e" stroke-width="'+(stage>=4?8:5)+'" stroke-linecap="round"/>';
if(stage===1)v+='<path d="M120 126 Q132 119 142 126 Q132 132 120 126" fill="#65ba66"/>';
if(stage>=2){const leafY=140-height+13;for(let side of [-1,1])v+='<ellipse cx="'+(120+side*19)+'" cy="'+leafY+'" rx="'+(corn?10:21)+'" ry="'+(corn?22:11)+'" transform="rotate('+(side*24)+' '+(120+side*19)+' '+leafY+')" fill="#79c86f" stroke="#38864a" stroke-width="2"/>';}
if(stage>=3){for(let j=0;j<(corn?3:2);j++){const y=105-j*20;const a=j%2?-1:1;v+='<path d="M120 '+(y+8)+' Q'+(120+a*37)+' '+(y-22)+' '+(120+a*58)+' '+(y-4)+' Q'+(120+a*24)+' '+(y+18)+' 120 '+(y+8)+'" fill="#46a55c" stroke="#31784b" stroke-width="2"/>';}}
if(vine&&stage>=3)v+='<path d="M120 101 Q175 89 166 116 Q150 135 187 124" stroke="#52a766" stroke-width="3" fill="none"/>';
if(stage>=4){v+='<circle cx="'+(vine?132:120)+'" cy="48" r="18" fill="'+col+'" stroke="#b17837" stroke-width="2"/>';v+='<circle cx="'+(vine?132:120)+'" cy="48" r="7" fill="#edc958"/>';if(p.id==='corn')v+='<path d="M120 40 Q106 11 122 7 Q142 22 120 40" stroke="#b98c42" stroke-width="3" fill="none"/>';}
if(stage>=5){const produce=p.icon;v+='<text x="162" y="103" text-anchor="middle" font-size="36">'+produce+'</text>';}
}return v+'</svg>'}
function render(){
const harvested=Object.values(state.harvest).reduce((a,b)=>a+b,0);
const plots=state.plots.map((x,i)=>{if(!x)return '<article class="plot empty"><div class="empty-art">🪴</div><h3>畑 '+(i+1)+'</h3><small>まだ何も植えていないよ</small><button data-plant="'+i+'">たねをまく ＋</button></article>';const p=plant(x.id);return '<article class="plot">'+vector(p,x.stage)+'<h3>'+p.icon+' '+p.n+'</h3><small>'+STAGES[x.stage]+' ／ 7だんかい</small><button data-open="'+i+'">'+(x.stage===6?'🎁 収穫する':'🔎 観察して育てる')+'</button></article>'}).join('');
document.getElementById('garden').innerHTML='<section class="intro"><h1>🌿 ふうすけの理科の畑</h1><p>たねをまいて、芽・子葉・本葉・花・実の順番に観察しよう。<br>クイズに答えて「答えと解説」を読むと、植物がひとつ育つよ。枯れることはないから自分のペースで大丈夫！</p><div class="stats"><span class="stat">🌻 植物 8しゅるい</span><span class="stat">🏆 収穫 '+harvested+'回</span><span class="stat">🔍 観察 '+state.solved+'回</span></div></section><h2 class="section-title">🪴 4つの畑</h2><div class="plots">'+plots+'</div><section class="panel"><h2>📒 植物ずかん</h2><p>収穫した植物がここに残るよ。違う種類を育てて、種や葉の形をくらべよう。</p><div class="inventory">'+P.map(p=>'<span>'+p.icon+' '+p.n+' '+(state.harvest[p.id]?' ✅ '+state.harvest[p.id]+'回':' 🔒')+'</span>').join('')+'</div><p class="note">※ 成長にかかる時間はゲーム用に短くしてあります。イラストは特徴を学ぶための模式図で、実物の大きさや細部を忠実に表したものではありません。</p></section>';
document.querySelectorAll('[data-plant]').forEach(el=>el.onclick=()=>seedSelect(Number(el.dataset.plant)));
document.querySelectorAll('[data-open]').forEach(el=>el.onclick=()=>openPlot(Number(el.dataset.open)));
}
function modal(content){closeModal();const bg=document.createElement('div');bg.className='dialog-backdrop';bg.innerHTML='<section class="dialog" role="dialog" aria-modal="true">'+content+'</section>';document.body.appendChild(bg);dialog=bg;bg.querySelectorAll('[data-close]').forEach(e=>e.onclick=closeModal)}
function closeModal(){if(dialog){dialog.remove();dialog=null}}
function seedSelect(i){modal('<h2>🌱 どの種をまく？</h2><p class="lead">花も野菜も育てられるよ。選んだあとで種の形を観察しよう。</p><div class="seedlist">'+P.map(p=>'<button class="seed" data-seed="'+p.id+'"><span class="mini-seed">'+p.icon+'</span><span>'+p.n+'<small>'+esc(p.seed)+'</small></span></button>').join('')+'</div><button class="secondary" data-close>もどる</button>');dialog.querySelectorAll('[data-seed]').forEach(el=>el.onclick=()=>{state.plots[i]={id:el.dataset.seed,stage:0};save();render();closeModal();openPlot(i)})}
function openPlot(i){const plot=state.plots[i];if(!plot)return;const p=plant(plot.id),stage=plot.stage;if(stage===6){modal('<h2>🎉 '+p.n+'が育った！</h2>'+vector(p,stage)+'<p class="lead">花が終わって、実や種ができたね。'+esc(p.fruit)+'</p><p class="question">🎁 '+p.produce+'を収穫しよう！</p><button class="primary" id="harvest">収穫する ✨</button><button class="secondary" data-close>あとで収穫する</button>');dialog.querySelector('#harvest').onclick=()=>{state.harvest[p.id]=(state.harvest[p.id]||0)+1;state.plots[i]=null;save();render();modal('<div class="result"><div class="symbol">🎁</div><h2>収穫できた！</h2><p class="lead">'+p.icon+' '+p.produce+'をゲット！植物ずかんに記録したよ。</p><button class="primary" data-close>畑へもどる</button></div>');dialog.querySelector('[data-close]').onclick=closeModal};return}
const quiz=p.q[stage];const values=[quiz[2],...quiz[3]];let options=values.map((v,j)=>({v,sort:(j*7+stage*3+i*5)%11})).sort((a,b)=>a.sort-b.sort).map(o=>o.v);
modal('<h2>'+p.icon+' '+p.n+'：'+esc(STAGES[stage])+'</h2><p class="lead">まずはよく観察しよう。クイズに正解すると次へ育てられるよ。</p>'+vector(p,stage)+'<p class="note">🔍 観察ポイント：'+esc([p.seed,'種から根が伸びはじめる',p.id==='corn'?'トウモロコシは子葉が1枚':'子葉が2枚出てくる',p.leaf,p.flower,p.fruit][stage])+'</p><div class="question">'+esc(quiz[1])+'</div><div class="options">'+options.map((o,j)=>'<button class="option" data-answer="'+j+'">'+esc(o)+'</button>').join('')+'</div><button class="primary" id="decide" disabled>これで決定</button><button class="secondary" data-close>あとで観察する</button>');
let selected=null;dialog.querySelectorAll('[data-answer]').forEach(el=>el.onclick=()=>{selected=options[Number(el.dataset.answer)];dialog.querySelectorAll('[data-answer]').forEach(btn=>btn.classList.toggle('selected',btn===el));dialog.querySelector('#decide').disabled=false});dialog.querySelector('#decide').onclick=()=>{if(selected===null)return;const correct=selected===quiz[2];if(!correct)state.wrong++;else state.solved++;save();showVerdict(i,p,stage,correct,quiz)}}
function showVerdict(i,p,stage,correct,quiz){modal('<div class="result"><div class="symbol '+(correct?'':'wrong')+'">'+(correct?'○':'×')+'</div><h2>'+(correct?'せいかい！':'もう一度チャレンジ！')+'</h2><p class="lead">'+(correct?'よく観察できたね！':'答えを確認して、もう一度ためそう。')+'</p><button class="primary" id="explain">答えと解説を見る ▶</button></div>');dialog.querySelector('#explain').onclick=()=>showExplanation(i,p,stage,correct,quiz)}
function showExplanation(i,p,stage,correct,quiz){modal('<h2>📘 '+p.n+'の観察ノート</h2>'+vector(p,stage)+'<p class="question">答え：'+esc(quiz[2])+'</p><div class="explain">'+esc(quiz[4])+'</div><p class="note">実物の写真や栽培では、品種や育て方によって見え方が違うこともあるよ。</p><button class="primary" id="continue">'+(correct?'💧 水やりして成長させる':'🔁 問題にもう一度挑戦')+'</button>');dialog.querySelector('#continue').onclick=()=>{if(correct){const v=state.plots[i];if(v&&v.id===p.id&&v.stage===stage)v.stage++;save();render();closeModal();if(v&&v.stage===6)openPlot(i)}else openPlot(i)}}
render();
