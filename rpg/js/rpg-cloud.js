'use strict';
// RPGセーブのクラウド同期。親が設定した共有鍵がある端末だけ有効。
// 端末の変更とクラウドの変更が競合したら勝手に上書きせず、選択を求める。
(function(root){
  const RPG=root.RPG,C=root.RPGCore,M=root.RPGMeta;
  const KEY='ichimon.rpg.cloud.key.v1',BASE='ichimon.rpg.cloud.base.v1';
  let cloudVersion=0,syncedRev=null,ready=false,busy=false,timer=null,status='未設定',remote=null;
  const read=k=>{try{return root.localStorage.getItem(k)||''}catch(e){return ''}};
  const write=(k,v)=>{try{root.localStorage.setItem(k,v)}catch(e){}};
  const getKey=()=>read(KEY);
  const endpoint=()=>((root.SEND_OVERRIDE||root.SEND_URL)||'');
  const url=()=>endpoint()+'?api=ichimon_game&key='+encodeURIComponent(getKey())+'&t='+Date.now();
  const valid=s=>s&&C.validateSave(C.migrateSave(JSON.parse(JSON.stringify(s)))).length===0;
  function snapshot(){return JSON.parse(JSON.stringify(RPG.save));}
  function state(){return {status,connected:!!getKey(),ready,busy,version:cloudVersion,hasRemote:!!remote};}
  function fail(msg){status=msg;ready=false;return state();}
  async function request(){
    const res=await fetch(url(),{cache:'no-cache'}),data=await res.json();
    if(!data||!data.ok)throw Error(data&&data.error||'通信エラー');
    if(!Number.isInteger(data.version)||data.version<0)throw Error('不正な同期情報');
    if(data.save&&!valid(data.save))throw Error('クラウドデータが不正');
    return data;
  }
  async function post(ver,save){
    const res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({api:'ichimon_game',action:'save',key:getKey(),version:ver,save})});
    return res.json();
  }
  function applyCloud(x){
    if(!valid(x.save)||RPG.save.active)return fail('解答中は読み込めません。問題終了後に試してください');
    // 先に現端末のデータをバックアップ。破壊的な読み込みは保護者操作のみ。
    const key=C.LS_BACKUP;
    try{RPG.io.set(key,JSON.stringify(RPG.save));}catch(e){}
    const s=C.migrateSave(JSON.parse(JSON.stringify(x.save)));
    s.rev=RPG.save.rev;
    const result=RPG.store.save(s);
    if(!result.ok)return fail('端末への保存に失敗しました。上書きしません');
    RPG.save=M.ensure(s);
    cloudVersion=x.version;syncedRev=s.rev;ready=true;remote=null;
    write(BASE,JSON.stringify({version:cloudVersion,rev:syncedRev}));
    status='同期中（クラウドから読み込み済み）';return state();
  }
  async function connect(key){
    if(key!==undefined){if(String(key).trim().length<20)return fail('共有鍵は20文字以上にしてください');write(KEY,String(key).trim());}
    if(!getKey())return fail('共有鍵がありません');
    busy=true;ready=false;status='クラウドを確認中';
    try{
      const x=await request();
      cloudVersion=x.version;
      const stored=JSON.parse(read(BASE)||'null');
      if(x.save){
        remote=x;
        // 同じ端末で同期済みで、ローカル変更が無ければ自動取得できる
        if(stored&&stored.version<=x.version&&stored.rev===RPG.save.rev)return applyCloud(x);
        status='クラウドにセーブあり。どちらを使うか選んでください';
      }else{remote=null;status='クラウドは空です。この端末を最初のセーブにできます';}
    }catch(e){status='接続できません：'+String(e.message||e);remote=null;}
    finally{busy=false;}
    return state();
  }
  async function chooseCloud(){
    if(!getKey()||!remote)return fail('先にクラウドを確認してください');
    return applyCloud(remote);
  }
  async function push(first){
    if(!getKey()||busy||RPG.save.active)return fail('解答が終わってから同期してください');
    if(!first&&!ready)return fail('先に同期の初期設定をしてください');
    busy=true;status='保存中';
    const local=snapshot(),base=first?0:cloudVersion;
    try{
      const x=await post(base,local);
      if(!x||!x.ok){
        if(x&&x.error==='conflict'){remote=null;return fail('ほかの端末で変更されています。クラウドを確認してください');}
        return fail('保存失敗：'+String(x&&x.error||'通信エラー'));
      }
      cloudVersion=x.version;syncedRev=local.rev;ready=true;remote=null;
      write(BASE,JSON.stringify({version:cloudVersion,rev:syncedRev}));
      status='同期済み';return state();
    }catch(e){return fail('通信に失敗しました。端末のデータは残っています');}
    finally{busy=false;}
  }
  function onPersist(){
    if(!ready||busy||!getKey())return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;if(ready&&!busy&&!RPG.save.active)push(false);},1500);
  }
  async function refresh(){
    if(!getKey()||busy||RPG.save.active)return state();
    if(timer){clearTimeout(timer);timer=null;}
    busy=true;
    try{
      const x=await request();
      if(!x.save){ready=false;return fail('クラウドのデータが見つかりません');}
      if(x.version===cloudVersion){status='同期済み';ready=true;return state();}
      if(ready&&RPG.save.rev===syncedRev)return applyCloud(x);
      remote=x;return fail('両方に変更があります。クラウドを確認してください');
    }catch(e){return fail('通信に失敗しました。端末のデータは残っています');}
    finally{busy=false;}
  }
  function disconnect(){if(timer)clearTimeout(timer);timer=null;ready=false;remote=null;cloudVersion=0;syncedRev=null;write(KEY,'');write(BASE,'');status='未設定';return state();}
  RPG.cloud={state,connect,chooseCloud,push,refresh,onPersist,disconnect};
  root.addEventListener('focus',()=>{if(ready)refresh();});
  if(getKey())root.addEventListener('load',()=>connect(),{once:true});
})(typeof self!=='undefined'?self:this);
