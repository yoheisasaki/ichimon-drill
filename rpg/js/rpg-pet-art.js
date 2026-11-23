'use strict';
// 8匹×「赤ちゃん・成長・進化」=24枚の個別イラストを使用する。
// XPやセーブデータには一切書き込まず、現在の値から表示だけを決める。
(function(root){
  const offsets={dragon:[0,0],wolf:[3,0],slime:[0,1],mole:[3,1],bird:[0,2],fox:[3,2],cat:[0,3],penguin:[3,3]};
  const names={dragon:'ほのおドラゴン',wolf:'こおりオオカミ',slime:'もりスライム',mole:'こうざんモグラ',bird:'かみなりバード',fox:'ほしキツネ',cat:'ぎんいろネコ',penguin:'こおりペンギン'};
  const stages=['たまご','赤ちゃん','成長','進化'];
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
      '.pet-portrait.pet-evolved{box-shadow:0 0 0 2px #efc367,0 0 8px #f4d67c;}' +
      '.pet-portrait.pet-growing{box-shadow:0 0 0 2px #91c9db;}';
    root.document.head.appendChild(css);
  }
  function svg(id,xp,small){
    if(!offsets[id])id='cat';
    const step=stage(xp);
    const cls='pet-portrait'+(small?' pet-mini':'')+([' pet-egg',' pet-baby',' pet-growing',' pet-evolved'][step]);
    const label=names[id]+'・'+stages[step];
    if(step===0)return '<span class="'+cls+'" role="img" aria-label="'+label+'">🥚</span>';
    const x=offsets[id][0]+step-1,y=offsets[id][1];
    const pos=x*20+'% '+(y*100/3)+'%';
    return '<span class="'+cls+'" role="img" aria-label="'+label+'"><span class="pet-scene" style="background-position:'+pos+'"></span></span>';
  }
  root.RPGPetArt={svg,stage};
})(typeof window!=='undefined'?window:this);
