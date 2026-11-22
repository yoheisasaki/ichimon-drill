/* ichimon-drill: RPG全体セーブ共有API
 * 学習ボードの既存 Code.gs に追記して、既存の doGet/doPost から下記を呼ぶ。
 * Script Properties に ICHIMON_GAME_KEY を設定（長いランダムな秘密文字列）。
 * 既存の学習履歴APIは変更しない。鍵はGitHubやフロントエンドに直書きしない。
 *
 * doGet(e) の先頭近く:
 * if (e.parameter && e.parameter.api === 'ichimon_game') return json_(ichimonGameGet_(e.parameter.key));
 *
 * doPost(e) の既存のichimon POSTより前:
 * const gameReq = JSON.parse(e.postData && e.postData.contents || '{}');
 * if (gameReq.api === 'ichimon_game') return json_(ichimonGamePost_(gameReq));
 * ※既存コードがJSON.parseを行っているなら、その変数を再利用してください。
 */
const ICHIMON_GAME_PROP = 'ICHIMON_GAME_FILE_ID';
function ichimonGameKeyOk_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty('ICHIMON_GAME_KEY');
  return Boolean(expected && expected.length >= 20 && String(key || '') === expected);
}
function ichimonGameRead_() {
  const props=PropertiesService.getScriptProperties();
  const id=props.getProperty(ICHIMON_GAME_PROP);
  if(!id)return {version:0,save:null};
  const file=DriveApp.getFileById(id);
  const obj=JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  if(!obj || !Number.isInteger(obj.version) || obj.version < 0 || !('save' in obj))throw Error('保存データ不正');
  return obj;
}
function ichimonGameGet_(key) {
  if(!ichimonGameKeyOk_(key))return {ok:false,error:'unauthorized'};
  try {
    const x=ichimonGameRead_();
    return {ok:true,version:x.version,save:x.save};
  }catch(e){return {ok:false,error:'read_failed'};}
}
function ichimonGamePost_(req) {
  if(!ichimonGameKeyOk_(req.key))return {ok:false,error:'unauthorized'};
  if(!req || req.action!=='save' || !Number.isInteger(req.version) || req.version<0)return {ok:false,error:'bad_request'};
  const save=req.save;
  if(!save || typeof save!=='object' || save.v!==2 || !save.progress || !save.inv || !save.jobXp || !save.daily || !save.chest)return {ok:false,error:'bad_save'};
  const txt=JSON.stringify(save);
  if(txt.length>2000000)return {ok:false,error:'too_large'};
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(20000))return {ok:false,error:'busy'};
  try {
    const old=ichimonGameRead_();
    if(old.version!==req.version)return {ok:false,error:'conflict',version:old.version};
    const next={version:old.version+1,save:save};
    const body=JSON.stringify(next);
    const props=PropertiesService.getScriptProperties();
    let id=props.getProperty(ICHIMON_GAME_PROP);
    if(id)DriveApp.getFileById(id).setContent(body);
    else {
      const file=DriveApp.createFile('ichimon-rpg-cloud-save.json',body,MimeType.PLAIN_TEXT);
      id=file.getId();props.setProperty(ICHIMON_GAME_PROP,id);
    }
    return {ok:true,version:next.version};
  }catch(e){return {ok:false,error:'write_failed'};}
  finally{lock.releaseLock();}
}
