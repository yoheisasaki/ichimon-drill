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
  // 5分は目安。建築などの操作が完了するまでは遮らず、最大7分で終了。
  const SOFT_PLAY_MS = 5 * 60 * 1000;
  const MAX_PLAY_MS = 7 * 60 * 1000;
  const nowDay = () => new Date().toLocaleDateString('sv-SE', {timeZone:'Asia/Tokyo'});
  function ensure(save) {
    if (!save) return null;
    if (!save.life || typeof save.life !== 'object') save.life = {};
    const l = save.life;
    l.pets = l.pets || {};
    l.total = Number(l.total || 0);
    l.party = Array.isArray(l.party) ? l.party : ['dragon'];
    l.materials = l.materials || {wood:5,stone:3,iron:0,crystal:0};
    l.food=Number(l.food||0); l.fedDays=l.fedDays||{};
    l.foodPoints=Math.max(0,Math.floor(Number(l.foodPoints)||0));
    l.foodPointReceipts=Array.isArray(l.foodPointReceipts)?l.foodPointReceipts:[];
    l.map = l.map || [{x:2,y:2,id:'house'}];
    // ブロック建築は旧マップとは別に保存。既存の家・ペット・ポイントに影響しない。
    l.blocks = Array.isArray(l.blocks) ? l.blocks.filter(b=>b && Number.isInteger(b.x) && Number.isInteger(b.y) && Number.isInteger(b.z) && b.x>=0 && b.x<6 && b.y>=0 && b.y<6 && b.z>=0 && b.z<4 && ['wood','stone','iron','crystal'].includes(b.id)).slice(0,144) : [];
    l.claimedDays = l.claimedDays || {};
    l.shards = Number(l.shards || 0);
    l.explored = l.explored || {};
    l.play = l.play || {day:nowDay(),used:0,done:false};
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
      l.food++;
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
  // 訪問ボーナス：連続ログインではなく累計訪問日数。休んでも回数を失わない。
  // 同じ日の再表示・端末での再起動では二重付与しない。
  const VISIT_REWARDS = [
    {emoji:'🪵',name:'木材×3'},
    {emoji:'🍎',name:'ペットのエサ×2'},
    {emoji:'💎',name:'宝石×2'},
    {emoji:'⛏️',name:'石×3と鉄×2'},
    {emoji:'🐾',name:'同行ペットの成長＋10'},
    {emoji:'🗺️',name:'地図のかけら×2'},
    {emoji:'🎁',name:'特別な宝箱'}
  ];
  function visitInfo(save) {
    const l=ensure(save),v=l.visits||{total:0,lastDay:'',lastReward:null};
    return {total:v.total||0,step:(v.total||0)%7,round:Math.floor((v.total||0)/7),
      next:(v.total||0)%7+1,lastDay:v.lastDay||'',lastReward:v.lastReward||null,
      today:v.lastDay===nowDay(),rewards:VISIT_REWARDS};
  }
  function visit(save,day) {
    const l=ensure(save),d=String(day||nowDay());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return {changed:false,error:'日付が不正'};
    l.visits=l.visits||{total:0,lastDay:'',lastReward:null};
    const v=l.visits;
    if(v.lastDay===d||v.lastDay>d)return {changed:false,info:visitInfo(save)};
    const nth=(v.total||0)+1,step=((nth-1)%7)+1;
    let r=VISIT_REWARDS[step-1];
    if(step===1)l.materials.wood=(l.materials.wood||0)+3;
    if(step===2)l.food=(l.food||0)+2;
    if(step===3)l.materials.crystal=(l.materials.crystal||0)+2;
    if(step===4){l.materials.stone=(l.materials.stone||0)+3;l.materials.iron=(l.materials.iron||0)+2;}
    if(step===5){for(const id of l.party){if(l.pets[id])l.pets[id].xp+=10;}}
    if(step===6)l.shards=(l.shards||0)+2;
    if(step===7 && root.RPGCore) {
      const C=root.RPGCore, D=root.RPGData,id='visit-week-'+Math.floor((nth-1)/7);
      if(!C.chestById(save,id)){
        const roll=C.rollChest(save,id);
        // 7回目だけは未所持のレア装備を優先する特別な宝箱。
        if(D && D.ITEMS){
          const rares=Object.values(D.ITEMS).filter(x=>x.rarity==='rare' && x.rank===roll.rank);
          const fresh=rares.filter(x=>!save.inv.items[x.id]);
          const pool=fresh.length?fresh:rares;
          if(pool.length){roll.kind='rare';roll.item=pool[Math.floor(C.rngFrom(id)()*pool.length)].id;delete roll.mats;delete roll.coin;}
        }
        C.addSealedChest(save,id,roll,{visitBonus:7,got:d});
      }
    }
    v.total=nth;v.lastDay=d;v.lastReward={step,emoji:r.emoji,name:r.name,day:d};
    return {changed:true,info:visitInfo(save)};
  }
  function party(save) {const l=ensure(save);return l.party.map(id=>{const p=PETS.find(p=>p.id===id);return p?Object.assign({},p,{emoji:visual(p,l.pets[id].xp)}):null;}).filter(Boolean);}
  function setParty(save,id) {
    const l=ensure(save);if(!l.pets[id])return {ok:false,msg:'まだ仲間になっていません'};
    if(l.party.includes(id)){if(l.party.length===1)return {ok:false,msg:'最低1匹は連れていこう'};l.party=l.party.filter(x=>x!==id);}
    else {if(l.party.length>=3)return {ok:false,msg:'3匹まで。先にほかの子をお休みさせてね'};l.party.push(id);}
    return {ok:true,msg:'冒険の仲間を変更しました'};
  }
  // 既存の建築素材をポイントで買えるショップ。ポイントは正解1問につき1。
  const POINT_SHOP_ITEMS = [
    {id:'food',name:'ペットのエサ',emoji:'🍎',qty:1,price:10}
  ];  function buyPointShopItem(save,id) {
    const l=ensure(save),item=POINT_SHOP_ITEMS.find(x=>x.id===id);
    if(!l||!item)return {ok:false,msg:'商品が見つからないよ'};
    if(l.foodPoints<item.price)return {ok:false,msg:item.name+'には'+item.price+'ポイント必要だよ'};
    l.foodPoints-=item.price;
    if(item.id==='food')l.food+=item.qty;
    else l.materials[item.id]=(Number(l.materials[item.id])||0)+item.qty;
    return {ok:true,msg:item.emoji+' '+item.name+'を'+item.qty+'個買ったよ！ 残り'+l.foodPoints+'ポイント'};
  }
  const FOOD_POINT_PRICE = 10;
  // 1問正解で1ポイント。不正解・スキップ・同じ解答IDの再処理は加算しない。
  function earnFoodPoint(save, receiptId) {
    const l=ensure(save),id=String(receiptId||'');
    if(!l||!id||l.foodPointReceipts.includes(id))return false;
    l.foodPointReceipts.push(id);
    if(l.foodPointReceipts.length>3000)l.foodPointReceipts.splice(0,l.foodPointReceipts.length-3000);
    l.foodPoints+=1;
    return true;
  }
  function buyFood(save) { return buyPointShopItem(save,'food'); }
  function feed(save,id,day,amount=1){
    const l=ensure(save),d=day||nowDay();
    if(!l.pets[id])return {ok:false,msg:'まだ仲間になっていません'};
    // エサのまとめあげ。所持数の範囲だけ消費し、同じ回数分の成長を一括保存する。
    if(l.food<1)return {ok:false,msg:'エサが足りないよ。ショップで買うか問題を解いて集めよう'};
    const requested=amount==='all'?l.food:Number(amount);
    if(!Number.isSafeInteger(requested)||requested<1)return {ok:false,msg:'エサの数を選んでね'};
    const used=Math.min(requested,l.food);
    l.food-=used;l.pets[id].xp+=used*10;l.fedDays[id]=d;
    return {ok:true,msg:(PETS.find(p=>p.id===id)||{}).name+'にエサを'+used+'個あげた！ 成長ポイント＋'+(used*10)+'（残り'+l.food+'個）'};
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
  // 2.5Dクラフト：空きマスへ同じ座標で4段まで積み上げ。1個につき素材1個。
  // 下から順に置き、上から順に回収して浮いたブロックを作らない。
  function placeBlock(save,id,x,y){
    const l=ensure(save);
    if(!['wood','stone','iron','crystal'].includes(id))return {ok:false,msg:'ブロックの種類を選んでね'};
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>=6||y<0||y>=6)return {ok:false,msg:'土地の中を選んでね'};
    if(l.map.some(t=>t.x===x&&t.y===y))return {ok:false,msg:'建物がある場所には積めないよ'};
    const stack=l.blocks.filter(t=>t.x===x&&t.y===y);
    if(stack.length>=4)return {ok:false,msg:'ここは4段まで。別の場所にも建ててみよう'};
    if((l.materials[id]||0)<1)return {ok:false,msg:MATERIALS[id]+'が足りないよ。ショップや探検で集めよう'};
    l.materials[id]--;
    l.blocks.push({x,y,z:stack.length,id});
    return {ok:true,msg:MATERIALS[id]+'のブロックを'+(stack.length+1)+'段目に積んだ！'};
  }
  function takeBlock(save,x,y){
    const l=ensure(save),stack=l.blocks.filter(t=>t.x===x&&t.y===y);
    if(!stack.length)return {ok:false,msg:'ここにブロックはないよ'};
    const top=stack.reduce((a,b)=>a.z>b.z?a:b),i=l.blocks.indexOf(top);
    l.blocks.splice(i,1);
    l.materials[top.id]=(l.materials[top.id]||0)+1;
    return {ok:true,msg:'いちばん上のブロックを回収！ '+MATERIALS[top.id]+'×1が戻った'};
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
  // お試し期間：マイワールドの利用時間制限を停止。
  // 保存済みの done:true も無視し、記録は書き換えない。再開時に元の仕様へ戻せる。
  function playState(save,day) {
    const l=ensure(save);
    return {used:(l.play&&l.play.used)||0,done:false,softReached:false,max:null,unlimited:true};
  }
  function finishPlay(save,day) { return false; }
  function spendPlay(save,ms,day) { return playState(save,day); }
  root.RPGLife={PETS,RECIPES,ZONES,MATERIALS,VISIT_REWARDS,FOOD_POINT_PRICE,POINT_SHOP_ITEMS,ensure,sync,visit,visitInfo,party,setParty,stage,visual,level,earnFoodPoint,buyPointShopItem,buyFood,feed,craft,remove,placeBlock,takeBlock,explore,playState,finishPlay,spendPlay,nowDay};
  if(root.RPG) {
    root.RPG.visitBonus = function(day) {
      if(!root.RPG.ok)return null;
      const result=visit(root.RPG.save,day||nowDay());
      if(result.changed && !root.RPG.persist())return null;
      return result.info;
    };
    root.RPG.visitInfo = function(){return root.RPG.ok?visitInfo(root.RPG.save):null;};
    root.RPG.earnFoodPoint = function(receiptId) {
      if(!root.RPG.ok)return false;
      if(!earnFoodPoint(root.RPG.save,receiptId))return false;
      return root.RPG.persist();
    };
    root.RPG.lifeSync = function(stats,day,daily) {
      if(!root.RPG.ok)return;
      const total=Object.values(stats||{}).reduce((n,x)=>n+(Number(x.c)||0)+(Number(x.w)||0),0);
      if(sync(root.RPG.save,total,day,daily))root.RPG.persist();
    };
    // 以前から答えた回数があれば再読込時に引き継ぐ（今までの記録を消さない）。
  }
})(typeof self!=='undefined'?self:this);
