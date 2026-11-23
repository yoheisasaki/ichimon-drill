'use strict';
// 8匹×「赤ちゃん・成長・進化」=24枚の個別イラストを使用する。
// XPやセーブデータには一切書き込まず、現在の値から表示だけを決める。
(function(root){
  const offsets={dragon:[0,0],wolf:[3,0],slime:[0,1],mole:[3,1],bird:[0,2],fox:[3,2],cat:[0,3],penguin:[3,3]};
  const names={dragon:'ほのおドラゴン',wolf:'こおりオオカミ',slime:'もりスライム',mole:'こうざんモグラ',bird:'かみなりバード',fox:'ほしキツネ',cat:'ぎんいろネコ',penguin:'こおりペンギン'};
  const stages=['生まれたて','赤ちゃん','成長','進化'];
  const eggSpecies=new Set(['dragon','bird','penguin']);
  const newbornStageName=id=>eggSpecies.has(id)?'たまご':id==='slime'?'小さな芽':'生まれたて';
  const stage=xp=>Number(xp)>=180?3:Number(xp)>=90?2:Number(xp)>=10?1:0;
  // 24枚の画像は6列×4行に配置。各種3枚ずつで絵そのものが異なる。
  const atlas=root.RPGPetStageAtlas;
  if(root.document&&!root.document.getElementById('rpg-pet-individual-stage-style')){
    const css=root.document.createElement('style');
    css.id='rpg-pet-individual-stage-style';
    const background=atlas?'background-image:url("'+atlas+'");':'';
    css.textContent='.pet-portrait{display:inline-flex;position:relative;overflow:hidden;align-items:center;justify-content:center;width:94px;height:98px;flex-shrink:0;vertical-align:middle;border-radius:12px;background-color:#fffaf2;}' +
      '.pet-portrait .pet-scene{position:absolute;inset:0;'+background+'background-repeat:no-repeat;background-size:600% 400%;}' +
      '.pet-portrait.pet-mini{width:30px;height:31px;border-radius:5px;}' +
      '.pet-portrait.pet-egg{background:radial-gradient(circle at 50% 20%,#fffcef,#ecd6a8);font-size:48px;}' +
      '.pet-portrait.pet-mini.pet-egg{font-size:20px;}' +
      '.pet-portrait.pet-newborn{background:linear-gradient(#e6f5e6,#f7e6bc);}' +
      '.pet-portrait.pet-newborn .pet-scene{inset:17% 23% 26%;border-radius:45% 45% 34% 34%;background-size:600% 400%;}' +
      '.pet-portrait.pet-newborn::after{content:"";position:absolute;bottom:5%;left:12%;width:76%;height:29%;border-radius:50%;background:linear-gradient(160deg,#e5bb83,#9a704d);box-shadow:inset 0 5px 4px #f6dfb7;pointer-events:none;}' +
      '.pet-portrait.pet-newborn.pet-mini::after{bottom:2%;}' +
      '.pet-portrait.pet-sprout{background:radial-gradient(circle,#efffd0,#b5e3aa);font-size:40px;}' +
      '.pet-portrait.pet-mini.pet-sprout{font-size:20px;}' +
      '.pet-portrait.pet-evolved{box-shadow:0 0 0 2px #efc367,0 0 8px #f4d67c;}' +
      '.pet-portrait.pet-growing{box-shadow:0 0 0 2px #91c9db;}';
    root.document.head.appendChild(css);
  }
  function svg(id,xp,small){
    if(!offsets[id])id='cat';
    const step=stage(xp);
    const cls='pet-portrait'+(small?' pet-mini':'')+([' pet-egg',' pet-baby',' pet-growing',' pet-evolved'][step]);
    const label=names[id]+'・'+stages[step];
    if(step===0){
      if(eggSpecies.has(id))return '<span class="'+cls+'" role="img" aria-label="'+names[id]+'のたまご">🥚</span>';
      if(id==='slime')return '<span class="pet-portrait'+(small?' pet-mini':'')+' pet-sprout" role="img" aria-label="もりスライム・小さな芽">🌱</span>';
      // ほ乳類（ネコ・オオカミ・キツネ・モグラ）は卵を使わず、巣で寝る幼獣を描く。
      const xy=offsets[id],pos=(xy[0]*20)+'% '+(xy[1]*100/3)+'%';
      return '<span class="pet-portrait'+(small?' pet-mini':'')+' pet-newborn" role="img" aria-label="'+names[id]+'・生まれたて"><span class="pet-scene" style="background-position:'+pos+'"></span></span>';
    }
    const x=offsets[id][0]+step-1,y=offsets[id][1];
    const pos=x*20+'% '+(y*100/3)+'%';
    return '<span class="'+cls+'" role="img" aria-label="'+label+'"><span class="pet-scene" style="background-position:'+pos+'"></span></span>';
  }
  root.RPGPetArt={svg,stage,stageLabel:(id,xp)=>stage(xp)===0?newbornStageName(id):stages[stage(xp)]};
})(typeof window!=='undefined'?window:this);
