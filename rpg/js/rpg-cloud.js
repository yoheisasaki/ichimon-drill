'use strict';
// RPGセーブのクラウド同期。親が設定した共有鍵がある端末だけ有効。
// 端末の変更とクラウドの変更が競合したら勝手に上書きせず、選択を求める。
(function(root){
  const RPG=root.RPG,C=root.RPGCore,M=root.RPGMeta;
  // ママ用のゲームは風助のクラウドとは絶対に混ぜない。
  if(root.location && (/\/mama\.html$/.test(root.location.pathname||'') || new URLSearchParams(root.location.search||'').get('mama')==='1'))return;
  const KEY='ichimon.rpg.cloud.key.v1',BASE='ichimon.rpg.cloud.base.v1';
  let cloudVersion=0,syncedRev=null,ready=false,busy=false,timer=null,status='未設定',remote=null;
  let lastCheck=0, pendingChange=false;
  const read=k=>{try{return root.localStorage.getItem(k)||''}catch(e){return ''}};
  const write=(k,v)=>{try{root.localStorage.setItem(k,v)}catch(e){}};
  const getKey=()=>read(KEY);
  const endpoint=()=>((typeof SEND_OVERRIDE !== 'undefined' && SEND_OVERRIDE) || (typeof SEND_URL !== 'undefined' && SEND_URL) || '');
  const url=()=>endpoint()+'?api=ichimon_game&key='+encodeURIComponent(getKey())+'&t='+Date.now();
  const valid=s=>s&&C.validateSave(C.migrateSave(JSON.parse(JSON.stringify(s)))).length===0;
  function snapshot(){return JSON.parse(JSON.stringify(RPG.save));}
  function state(){return {status,connected:!!getKey(),ready,busy,version:cloudVersion,hasRemote:!!remote,localPoints:Number(RPG.save&&RPG.save.life&&RPG.save.life.foodPoints)||0,remotePoints:remote&&remote.save&&remote.save.life?Number(remote.save.life.foodPoints)||0:null};}
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
    if(!valid(x.save))return fail('クラウドのセーブを確認できません');
    // 解答中でも保護者が明示的に選んだ場合のみ読み込めるようにする。
    // 元セーブのバックアップが書き込めなければ、端末の進行は変更しない。
    const key=C.LS_BACKUP;
    try{
      const original=JSON.stringify(RPG.save);
      RPG.io.set(key,original);
      if(RPG.io.get(key)!==original)return fail('バックアップできなかったため、読み込みを中止しました');
    }catch(e){return fail('バックアップできなかったため、読み込みを中止しました');}
    const s=C.migrateSave(JSON.parse(JSON.stringify(x.save)));
    s.rev=RPG.save.rev;
    const result=RPG.store.save(s);
    if(!result.ok)return fail('端末への保存に失敗しました。上書きしません');
    RPG.save=M.ensure(s);
    cloudVersion=x.version;syncedRev=s.rev;ready=true;remote=null;
    write(BASE,JSON.stringify({version:cloudVersion,rev:syncedRev}));
    status='同期済み（クラウドから読み込み済み）';pendingChange=false;return state();
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
        if(stored&&stored.version===x.version&&stored.rev===RPG.save.rev){syncedRev=RPG.save.rev;ready=true;remote=null;status='同期済み';return state();}
        if(stored&&stored.version<x.version&&stored.rev===RPG.save.rev){
          if(RPG.save.active){status='別端末の新しいセーブがあります。解答中なので読み込みを保留';return state();}
          return applyCloud(x);
        }
        if(stored&&stored.version===x.version&&stored.rev!==RPG.save.rev){
          // 最後のクラウド版が変わっていなければ、この端末の変更を安全に送れる。
          syncedRev=stored.rev;ready=true;remote=null;pendingChange=true;status='この端末の変更を同期中';
          onPersist();return state();
        }
        status='クラウドにセーブあり。どちらを使うか選んでください';
      }else{remote=null;status='クラウドは空です。この端末を最初のセーブにできます';}
    }catch(e){status='接続できません：'+String(e.message||e);remote=null;}
    finally{busy=false;if(ready&&pendingChange)schedulePush();}
    return state();
  }
  async function chooseCloud(){
    if(!getKey()||!remote)return fail('先にクラウドを確認してください');
    return applyCloud(remote);
  }
  async function push(first, allowPaused){
    if(!getKey()||busy||(!first&&!allowPaused&&RPG.save.active))return fail('解答が終わってから同期してください');
    if(!first&&!ready)return fail('先に同期の初期設定をしてください');
    busy=true;status='保存中';
    // 初回保存だけ、解答途中の端末でも可能にする。
    // 端末上の途中経過はそのまま保存し、クラウドには確定済みの進行だけ送る。
    // 他端末で途中の問題を引き継ぐことはしない。
    const local=snapshot(),base=first?0:cloudVersion;
    // この送信に含まれる変更はここで確保。通信中に発生した新しい変更だけを次回送信する。
    pendingChange=false;
    const hadActive=!!local.active;
    // 冒険途中の問題・戦闘は端末専用。一方、獲得ポイントや所持品は途中でも確定して共有する。
    const upload=hadActive?{...local,active:null,quizResume:null}:local;
    try{
      const x=await post(base,upload);
      if(!x||!x.ok){
        if(x&&x.error==='conflict'){remote=null;return fail('ほかの端末で変更されています。クラウドを確認してください');}
        return fail('保存失敗：'+String(x&&x.error||'通信エラー'));
      }
      const moreChanges=RPG.save.rev!==local.rev||pendingChange;
      cloudVersion=x.version;syncedRev=local.rev;ready=true;remote=null;
      write(BASE,JSON.stringify({version:cloudVersion,rev:syncedRev}));
      status=moreChanges?'追加の変更を同期中':'同期済み';if(moreChanges)pendingChange=true;return state();
    }catch(e){return fail('通信に失敗しました。端末のデータは残っています');}
    finally{busy=false;if(ready&&pendingChange)schedulePush();}
  }
  // 保護者が明示的に選んだときだけ、この端末を共有セーブの基準にする。
  // CAS(version)で他端末の直近の更新を壊さず、クラウド旧版を端末に退避する。
  async function useThisDevice(){
    if(!getKey()||busy)return fail('共有鍵を確認してください');
    busy=true;status='この端末のデータを確認中';
    try{
      const x=await request();
      if(x.save){
        const old=JSON.stringify({version:x.version,save:x.save,savedAt:new Date().toISOString()});
        const k='ichimon.rpg.cloud.previous.v1';
        write(k,old);
        if(read(k)!==old)return fail('以前のクラウドデータをバックアップできませんでした');
      }
      const local=snapshot();
      if(!valid(local))return fail('この端末のセーブを確認できません');
      // 進行中の戦闘や問題は端末に残すが、他端末へは引き継がない。
      const upload={...local,active:null};
      const result=await post(x.version,upload);
      if(!result||!result.ok){
        if(result&&result.error==='conflict')return fail('別の端末で更新されました。確認し直してください');
        return fail('保存できませんでした：'+String(result&&result.error||'通信エラー'));
      }
      cloudVersion=result.version;syncedRev=local.rev;ready=true;remote=null;pendingChange=false;
      write(BASE,JSON.stringify({version:cloudVersion,rev:syncedRev}));
      status='同期済み（この端末を基準に保存しました）';
      return state();
    }catch(e){return fail('通信に失敗しました。端末のデータは残っています');}
    finally{busy=false;}
  }
  function schedulePush(){
    if(!getKey()||!ready||busy)return;
    if(timer)clearTimeout(timer);
    timer=setTimeout(()=>{timer=null;if(ready&&!busy&&pendingChange)void push(false,true);},800);
  }
  function onPersist(){
    if(!getKey())return;
    pendingChange=true;
    schedulePush();
  }
  async function refresh(){
    if(!getKey()||busy)return state();
    if(timer){clearTimeout(timer);timer=null;}
    busy=true;
    try{
      const x=await request();
      lastCheck=Date.now();
      if(!x.save){ready=false;return fail('クラウドのデータが見つかりません');}
      // ローカル更新があれば、クラウド側が同じ版のときだけあとで送る。
      const changed=ready && (RPG.save.rev!==syncedRev || pendingChange);
      if(x.version===cloudVersion){
        if(changed){status='この端末の変更を同期中';}
        else {status='同期済み';ready=true;}
        if(changed){
          busy=false;
          return await push(false,true);
        }
        return state();
      }
      if(ready&&!changed&&!RPG.save.active)return applyCloud(x);
      remote=x;
      // 端末・クラウド両方に差分があるときは、自動上書きしない。
      return fail(changed?'両方に変更があります。どちらを残すか選んでください':'別端末の新しいセーブがあります。解答終了後に最新を確認してください');
    }catch(e){return fail('通信に失敗しました。端末のデータは残っています');}
    finally{busy=false;if(ready&&pendingChange)schedulePush();}
  }
  function autoCheck(force=false){
    if(!getKey()||busy)return;
    if(!ready){if(!force&&Date.now()-lastCheck<30000)return;lastCheck=Date.now();void connect();return;}
    if(!force&&Date.now()-lastCheck<12000)return;
    // 解答途中も新しいクラウド版の存在を確認。ただし読み込みによる上書きはしない。
    void refresh();
  }
  function disconnect(){if(timer)clearTimeout(timer);timer=null;ready=false;remote=null;cloudVersion=0;syncedRev=null;write(KEY,'');write(BASE,'');status='未設定';return state();}
  RPG.cloud={state,connect,chooseCloud,useThisDevice,push,refresh,onPersist,disconnect};
  root.addEventListener('focus',()=>autoCheck(true));
  root.document&&root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)autoCheck(true);});
  root.addEventListener('online',()=>autoCheck(true));
  // アプリを開いたまま別端末を使った場合も更新を検出する。
  root.setInterval(()=>autoCheck(),30000);
  if(getKey())root.addEventListener('load',()=>connect(),{once:true});
})(typeof self!=='undefined'?self:this);
