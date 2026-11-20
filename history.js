'use strict';
const KEY='ichimon.history.mama.v1';
const $=id=>document.getElementById(id);
const escapeHtml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plain=s=>String(s??'').replace(/\{([^|{}]+)\|([^{}]+)\}/g,'$1');
const params=new URLSearchParams(location.search);
let qs=[],byId=new Map(),rows=[],subject='全部',term='',missOnly=false;
function csvRows(s){
  s=s.replace(/^\ufeff/,'');const sep=s.slice(0,200).includes('\t')?'\t':',';
  let result=[],row=[],cur='',quoted=false;
  for(let i=0;i<s.length;i++){const c=s[i];if(quoted){if(c==='"'&&s[i+1]==='"'){cur+='"';i++;}else if(c==='"')quoted=false;else cur+=c;}
  else if(c==='"')quoted=true;else if(c===sep){row.push(cur);cur='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&s[i+1]==='\n')i++;row.push(cur);if(row.some(v=>v.trim()))result.push(row);row=[];cur='';}
  else cur+=c;}
  if(cur||row.length){row.push(cur);result.push(row);}return result;
}
function parseLog(text){
 const all=csvRows(text);if(!all.length)throw Error('空のCSVです');
 const hdr=all[0].map(x=>x.trim());
 const col=name=>hdr.indexOf(name);
 const id=col('問題ID'),date=col('日時'),ok=col('正誤'),pick=col('選んだ答え'),rid=col('rid');
 if([id,date,ok].some(i=>i<0))throw Error('「一問一答_記録」のCSVを選んでください（問題ID・日時・正誤の列が必要です）');
 const seen=new Set(),result=[];
 for(const a of all.slice(1)){
  const qid=(a[id]||'').trim(),t=(a[date]||'').trim();if(!qid||!t)continue;
  const unique=rid>=0&&a[rid]?a[rid]:qid+'@'+t+'@'+(a[pick]||'');
  if(seen.has(unique))continue;seen.add(unique);
  const value=(a[ok]||'').trim();
  result.push({qid,t,ok:value==='○'||value==='◯'||value==='true'||value==='TRUE'||value==='1',pick:pick>=0?(a[pick]||''):'',skip:(a[col('わかんない')]||'')==='1'});
 }
 if(!result.length)throw Error('回答記録が見つかりませんでした');return result;
}
function render(){
 const stats=new Map();
 for(const r of rows){if(!stats.has(r.qid))stats.set(r.qid,[]);stats.get(r.qid).push(r);}
 const vals=qs.filter(q=>(subject==='全部'||q.subject===subject)&&(!term||[q.q,q.unit,q.id].some(x=>plain(x).toLowerCase().includes(term)))&&(!missOnly||(stats.get(q.id)||[]).some(x=>!x.ok))).sort((a,b)=>{
  let ar=stats.get(a.id)||[],br=stats.get(b.id)||[];
  return ((br.at(-1)?.t)||'').localeCompare((ar.at(-1)?.t)||'');
 });
 $('summary').textContent='履歴データ '+rows.length+'回分 / 条件に合う問題 '+vals.length+'問（解答なしの問題も表示）';
 const openId=params.get('qid');
 $('results').innerHTML=vals.map(q=>{
  const ar=(stats.get(q.id)||[]).slice().sort((a,b)=>b.t.localeCompare(a.t));
  const correct=ar.filter(x=>x.ok).length,wrong=ar.length-correct;
  let days=new Map();for(const r of ar){let day=r.t.slice(0,10);if(!days.has(day))days.set(day,[]);days.get(day).push(r);}
  const details=Array.from(days).map(([day,ds])=>'<div class="day"><strong>'+escapeHtml(day)+'：'+ds.length+'回（<span class="good">○'+ds.filter(x=>x.ok).length+'</span> / <span class="bad">×'+ds.filter(x=>!x.ok).length+'</span>）</strong>'+
   ds.map(x=>'<div class="attempt">'+escapeHtml(x.t.slice(11,16))+'　'+(x.ok?'<span class="good">○ 正解</span>':'<span class="bad">× 不正解</span>')+'　選択：'+escapeHtml(x.pick||'記録なし')+'</div>').join('')+'</div>').join('');
  return '<details class="item"'+(openId===q.id?' open':'')+'><summary><div class="question">'+escapeHtml(plain(q.q))+'</div><div class="counts"><span>解答 '+ar.length+'回</span><span class="good">○ '+correct+'回</span><span class="bad">× '+wrong+'回</span></div><div class="meta">'+escapeHtml(q.subject+' / '+q.id)+'</div></summary><div class="detail">'+(details||'<div class="empty">まだこの問題の回答記録はありません。</div>')+'</div></details>';
 }).join('')||'<div class="empty">条件に合う問題がありません。</div>';
}
async function init(){
 try{
  const d=await fetch('data/questions.json',{cache:'no-cache'}).then(r=>r.json());
  qs=d.questions.filter(q=>q.test===(d.tests.find(t=>t.current)||d.tests[0]).id);
  const raw=localStorage.getItem(KEY);if(raw){rows=JSON.parse(raw);$('status').textContent='前回読み込んだ記録：'+rows.length+'回分';}
  const qid=params.get('qid');if(qid){const q=qs.find(x=>x.id===qid);if(q){subject=q.subject;term=q.id;$('subject').value=subject;$('search').value=term;}}
  render();
 }catch(e){$('status').textContent='読み込みエラー：'+e.message;}
}
$('file').addEventListener('change',async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  rows=parseLog(await f.text());localStorage.setItem(KEY,JSON.stringify(rows));
  $('status').textContent=rows.length+'回分の履歴を読み込みました（'+f.name+'）';render();
 }catch(err){$('status').textContent='読み込めませんでした：'+err.message;}
});
$('subject').onchange=e=>{subject=e.target.value;render();};
$('search').oninput=e=>{term=e.target.value.trim().toLowerCase();render();};
$('missOnly').onchange=e=>{missOnly=e.target.checked;render();};
init();