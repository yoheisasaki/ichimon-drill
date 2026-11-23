'use strict';
const $=id=>document.getElementById(id);
const plain=s=>String(s??'').replace(/\{([^|{}]+)\|([^{}]+)\}/g,'$1');
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const params=new URLSearchParams(location.search);
let questions=[], history=null, subject='全部', term='', errorsOnly=false;
const API='https://script.google.com/macros/s/AKfycbwR6PPGrKn5HL1yJ8-xc_sjV-kaEDY2dv0jD_e7XyRSjQUd2E_2_Pq-rGE6tWxHRj3QFg/exec?api=ichimon_history';
function matches(q) {
  return (subject==='全部'||q.subject===subject) && (!term||[q.q,q.a,q.unit,q.id].some(v=>plain(v).toLowerCase().includes(term))) &&
    (!errorsOnly || (history?.[q.id]?.wrong||0)+(history?.[q.id]?.unknown||0)>0);
}
function render() {
  const data=questions.filter(matches);
  const hasHistory=history!==null;
  $('summary').textContent='該当 '+data.length+'問 ／ 全'+questions.length+'問'+(hasHistory?'（履歴取得済み）':'');
  $('results').innerHTML=data.map(q=>{
    const h=history?.[q.id], ar=(h?.attempts||[]).slice().reverse();
    const label=!hasHistory?'履歴未取得':h&&h.n ? '解答 '+h.n+'回　○'+h.correct+'　×'+h.wrong+'　わかんない'+h.unknown : '未回答（記録なし）';
    const last=h?.last, status=last ? (last.result==='correct'?'○ 正解':last.result==='unknown'?'わかんない':'× 不正解') : '';
    const detail=ar.map(a=>'<div class="attempt">'+esc(String(a[0]).slice(0,16).replace('T','　'))+'　'+(a[1]==='c'?'○ 正解':a[1]==='u'?'わかんない':'× 不正解')+'</div>').join('');
    return '<details class="item"'+(params.get('qid')===q.id?' open':'')+'><summary><div class="question">'+esc(plain(q.q))+'</div><div class="counts"><span>'+esc(label)+'</span></div><div class="meta">'+esc(q.subject+' / '+q.id)+(last?'　最後：'+esc(String(last.at).slice(0,10)+' '+status):'')+'</div></summary><div class="detail">'+(detail||'<div class="empty">解答の記録はありません。</div>')+'</div></details>';
  }).join('')||'<div class="empty">条件に合う問題はありません。</div>';
}
async function loadHistory(){
  $('status').textContent='全端末の解答履歴を取得中…';
  $('reload').disabled=true;
  try{
    const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),15000);
    let response;
    try{response=await fetch(API+'&t='+Date.now(),{cache:'no-store',signal:ctrl.signal});}
    finally{clearTimeout(timer);}
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(data.ok!==true||!data.questions)throw Error('APIの応答が正しくありません');
    history=data.questions;
    $('status').textContent='取得済み：全端末の記録 '+Number(data.total||0)+'回分（'+Object.keys(history).length+'問）';
  }catch(e){
    history=null;
    $('status').textContent='履歴を取得できませんでした。未回答とは判定できません。再読み込みしてください。';
  }finally{$('reload').disabled=false;render();}
}
async function init(){
  try{
    const data=await fetch('data/questions.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('questions');return r.json()});
    questions=data.questions;
    const qid=params.get('qid'), q=questions.find(x=>x.id===qid);
    if(q){subject=q.subject;term=q.id;$('subject').value=subject;$('search').value=term;}
    render();loadHistory();
  }catch(e){$('status').textContent='問題データを読み込めませんでした';}
}
$('subject').onchange=e=>{subject=e.target.value;render()};
$('onlyWrong').onchange=e=>{errorsOnly=e.target.checked;render()};
$('go').onclick=()=>{const input=$('search');input.blur();term=input.value.trim().toLowerCase();render()};
$('clear').onclick=()=>{$('search').value='';term='';render()};
$('search').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();$('go').click();}});
$('reload').onclick=loadHistory;
init();