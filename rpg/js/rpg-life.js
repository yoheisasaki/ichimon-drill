'use strict';
// マイワールド：既存RPGのセーブ内に追加する任意機能。旧セーブは変更せず補完する。
(function (root) {
  const PETS = [
    {id:'dragon',name:'ほのおドラゴン',emoji:'🐉',role:'炎の力で攻撃を助ける',at:0},
    {id:'wolf',name:'こおりオオカミ',emoji:'🐺',role:'隠れた道を見つける',at:60},
    {id:'slime',name:'もりスライム',emoji:'🟢',role:'戦いのあとの回復を助ける',at:120},
    {id:'mole',name:'こうざんモグラ',emoji:'🐹',role:'鉱石を探す',at:180},
    {id:'bird',name:'かみなりバード',emoji:'🐤',role:'敵の攻撃を妨げる',at:240},
    {id:'fox',name:'ほしキツネ',emoji:'🦊',role:'不思議な仕掛けを見つける',at:300},
    {id:'cat',name:'ぎんいろネコ',emoji:'🐱',role:'隠れた宝物を見つける',at:360},
    {id:'penguin',name:'こおりペンギン',emoji:'🐧',role:'敵の動きをゆっくりにする',at:420}
  ];
  const RECIPES = [
    {id:'house',name:'木の家',emoji:'🏡',cost:{wood:8,stone:3}},
    {id:'pet',name:'ペット小屋',emoji:'🛖',cost:{wood:5,stone:2}},
    {id:'tree',name:'木',emoji:'🌳',cost:{wood:2}},
    {id:'garden',name:'お花畑',emoji:'🌷',cost:{wood:2,crystal:1}},
    {id:'bed',name:'ベッド',emoji:'🛏️',cost:{wood:3,stone:1}},
    {id:'books',name:'本棚',emoji:'📚',cost:{wood:4}},
    {id:'pool',name:'ペンギンプール',emoji:'🧊',cost:{stone:5,crystal:2}},
    {id:'tower',name:'見張り台',emoji:'🏰',cost:{wood:6,stone:8,iron:3}},
    {id:'lamp',name:'光るランプ',emoji:'🏮',cost:{iron:2,crystal:3}},
    {id:'catbed',name:'ネコのベッド',emoji:'🐈',cost:{wood:3,crystal:1}}
  ];
  const ZONES = [
    {id:'field',name:'はじまりの草原',emoji:'🌿',need:0,loot:{wood:3,stone:2}},
    {id:'forest',name:'ひみつの森',emoji:'🌲',need:2,loot:{wood:5,crystal:1}},
    {id:'mine',name:'きらめき鉱山',emoji:'⛏️',need:4,loot:{stone:4,iron:3}},
    {id:'snow',name:'雪と氷の洞窟',emoji:'❄️',need:7,loot:{crystal:3,iron:2}},
    {id:'village',name:'かくれ村',emoji:'🏘️',need:10,loot:{wood:3,stone:3,crystal:2}}
  ];
  const MATERIALS = {wood:'木材',stone:'石',iron:'鉄',crystal:'宝石'};
  const MAX_PLAY_MS = 5 * 60 * 1000;
  const nowDay = () => new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Tokyo'});
  function ensure(save) {
    if (!save) return null;
    if (!save.life || typeof save.life !== 'object') save.life = {};
    const l = save.life;
    l.pets = l.pets || {};
    l.total = Number(l.total || 0);
    l.party = Array.isArray(l.party) ? l.party : ['dragon'];
    l.materials = l.materials || {wood:5,stone:3,iron:0,crystal:0};
    l.map = l.map || [{x:2,y:2,id:'house'}];
    l.claimedDays = l.claimedDays || {};
    l.shards = Number(l.shards || 0);
    l.explored = l.explored || {};
    l.play = l.play || {day:nowDay(),used:0};
    for (const p of PETS) {
      if (l.total >= p.at && !l.pets[p.id]) l.pets[p.id] = {xp:p.id==='dragon'?10:0};
    }
    l.party = l.party.filter((x,i,a)=>l.pets[x] && a.indexOf(x)===i).slice(0,3);
    if (!l.party.length) l.party=['dragon'];
    return l;
  }
  function stage(xp) {return xp>=180?'進化':xp>=90?'成長':xp>=10?'赤ちゃん':'たまご';}
  function visual(p,xp){return xp<10?'🥚':xp>=180?p.emoji+'✨':p.emoji;}
  function level(xp) {return Math.min(30,1+Math.floor(xp/30));}
  function sync(save, totals, day, daily) {
    const l=ensure(save); if(!l)return false;
    let changed=false;
    const total=Math.max(0,Number(totals)||0);
    if(total>l.total){
      const delta=total-l.total;
      for(const id of l.party)if(l.pets[id])l.pets[id].xp+=delta;
      l.total=total;changed=true;
    }
    for(const p of PETS)if(l.total>=p.at&&!l.pets[p.id]){l.pets[p.id]={xp:p.id==='dragon'?10:0};changed=true;}
    const d=String(day||nowDay()),n=Number(daily||0);
    const claimed=l.claimedDays[d]||[];
    for(let target=10;target<=n;target+=10){
      if(claimed.includes(target))continue;
      l.materials.wood=(l.materials.wood||0)+2;
      l.materials.stone=(l.materials.stone||0)+1;
      if(target%20===0)l.materials.iron=(l.materials.iron||0)+1;
      if(target%30===0){l.materials.crystal=(l.materials.crystal||0)+1;l.shards++;}
      claimed.push(target);changed=true;
    }
    if(claimed.length)l.claimedDays[d]=claimed;
    const days=Object.keys(l.claimedDays).sort();
    while(days.length>100)delete l.claimedDays[days.shift()];
    return changed;
  }
  function party(save) {const l=ensure(save);return l.party.map(id=>{const p=PETS.find(p=>p.id===id);return p?Object.assign({},p,{emoji:visual(p,l.pets[id].xp)}):null;}).filter(Boolean);}
  function setParty(save,id) {
    const l=ensure(save);if(!l.pets[id])return {ok:false,msg:'まだ仲間になっていません'};
    if(l.party.includes(id)){if(l.party.length===1)return {ok:false,msg:'最低1匹は連れていこう'};l.party=l.party.filter(x=>x!==id);}
    else {if(l.party.length>=3)return {ok:false,msg:'3匹まで。先にほかの子をお休みさせてね'};l.party.push(id);}
    return {ok:true,msg:'冒険の仲間を変更しました'};
  }
  function canPay(l,cost){return Object.entries(cost).every(([id,n])=>(l.materials[id]||0)>=n);}
  function craft(save,id,x,y){
    const l=ensure(save),it=RECIPES.find(r=>r.id===id);
    if(!it)return {ok:false,msg:'作れるものを選んでね'};
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=6||y<0||y>=6)return {ok:false,msg:'場所を選んでね'};
    if(l.map.some(t=>t.x===x&&t.y===y))return {ok:false,msg:'ここにはもう何かあるよ'};
    if(!canPay(l,it.cost))return {ok:false,msg:'素材が足りないよ'};
    for(const [k,n] of Object.entries(it.cost))l.materials[k]-=n;
    l.map.push({x,y,id});return {ok:true,msg:it.name+'を建てた！'};
  }
  function remove(save,x,y){
    const l=ensure(save),i=l.map.findIndex(t=>t.x===x&&t.y===y);
    if(i<0)return {ok:false,msg:'ここには何もないよ'};
    if(l.map[i].id==='house'&&l.map.filter(x=>x.id==='house').length===1)return {ok:false,msg:'最初の家は残しておこう'};
    const [item]=l.map.splice(i,1),r=RECIPES.find(x=>x.id===item.id);
    if(r)for(const [k,n]of Object.entries(r.cost))l.materials[k]=(l.materials[k]||0)+Math.floor(n/2);
    return {ok:true,msg:'片付けたよ（素材が少し戻った）'};
  }
  function explore(save,id,day){
    const l=ensure(save),z=ZONES.find(x=>x.id===id),d=day||nowDay();
    if(!z)return {ok:false,msg:'場所が見つからない'};
    if(l.shards<z.need)return {ok:false,msg:'地図のかけらがあと'+(z.need-l.shards)+'枚必要'};
    if(l.explored[d])return {ok:false,msg:'今日の探検はおしまい。また明日！'};
    let loot=Object.assign({},z.loot);
    if(l.party.includes('mole'))loot.iron=(loot.iron||0)+1;
    if(l.party.includes('cat'))loot.crystal=(loot.crystal||0)+1;
    if(l.party.includes('wolf'))loot.wood=(loot.wood||0)+1;
    if(l.party.includes('fox'))loot.crystal=(loot.crystal||0)+1;
    for(const [k,n]of Object.entries(loot))l.materials[k]=(l.materials[k]||0)+n;
    l.explored[d]=id;
    return {ok:true,msg:z.name+'を探検！ '+Object.entries(loot).map(([k,n])=>MATERIALS[k]+'×'+n).join('・')+' を発見！'};
  }
  function playState(save,day) {
    const l=ensure(save),d=day||nowDay();
    if(l.play.day!==d)l.play={day:d,used:0};
    return {used:l.play.used,left:Math.max(0,MAX_PLAY_MS-l.play.used),max:MAX_PLAY_MS};
  }
  function spendPlay(save,ms,day){
    const l=ensure(save);const p=playState(save,day);l.play.used=Math.min(MAX_PLAY_MS,p.used+Math.max(0,Math.min(2000,Number(ms)||0)));return playState(save,day);
  }
  root.RPGLife={PETS,RECIPES,ZONES,MATERIALS,ensure,sync,party,setParty,stage,visual,level,craft,remove,explore,playState,spendPlay,nowDay};
  if(root.RPG) {
    root.RPG.lifeSync = function(stats,day,daily) {
      if(!root.RPG.ok)return;
      const total=Object.values(stats||{}).reduce((n,x)=>n+(Number(x.c)||0)+(Number(x.w)||0),0);
      if(sync(root.RPG.save,total,day,daily))root.RPG.persist();
    };
    // 以前から答えた回数があれば再読込時に引き継ぐ（今までの記録を消さない）。
  }
})(typeof self!=='undefined'?self:this);
