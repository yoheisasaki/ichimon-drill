'use strict';
// 図鑑風ペットイラスト。成長段階・表示サイズから描画する（セーブ形式は不変）。
(function(root){
  const chars={
    dragon:{a:'#ed5b36',b:'#ffc468',c:'#922d48',accent:'#ffd53f',bg:'#71242d',kind:'dragon'},
    wolf:{a:'#8bc4f3',b:'#f4fcff',c:'#376eac',accent:'#8df2ff',bg:'#154578',kind:'wolf'},
    slime:{a:'#55bf76',b:'#bcf2a8',c:'#287c5b',accent:'#d1fa64',bg:'#326b40',kind:'slime'},
    mole:{a:'#ad805d',b:'#f2caa0',c:'#62443c',accent:'#ffd26d',bg:'#66503b',kind:'mole'},
    bird:{a:'#f3be39',b:'#fff1a4',c:'#aa6b30',accent:'#9defff',bg:'#74632d',kind:'bird'},
    fox:{a:'#b589f5',b:'#f8dcff',c:'#654d9c',accent:'#fff29c',bg:'#463574',kind:'fox'},
    cat:{a:'#afbecf',b:'#f6fbff',c:'#5c779d',accent:'#8fefff',bg:'#3b5d84',kind:'cat'},
    penguin:{a:'#4c94d6',b:'#fcffff',c:'#234b94',accent:'#b9f7ff',bg:'#255b82',kind:'penguin'}
  };
  const esc=v=>String(v).replace(/[^a-zA-Z0-9_-]/g,'');
  function svg(id,xp,small=false){
    const q=chars[id]||chars.cat, g=xp>=180?3:xp>=90?2:xp>=10?1:0;
    const prefix='pet-'+esc(id), size=small?'pet-art-small':'pet-art-card';
    const scale=[.73,.8,1,1.13][g],off=64*(1-scale);
    const defs='<defs><linearGradient id="'+prefix+'-body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+q.b+'"/><stop offset=".48" stop-color="'+q.a+'"/><stop offset="1" stop-color="'+q.c+'"/></linearGradient><radialGradient id="'+prefix+'-sky"><stop stop-color="'+q.accent+'" stop-opacity=".43"/><stop offset="1" stop-color="'+q.bg+'" stop-opacity="0"/></radialGradient><linearGradient id="'+prefix+'-glaze" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#ffffff" stop-opacity=".78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>';
    const body='url(#'+prefix+'-body)';
    const contour='stroke="'+q.c+'" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"';
    const eye='<ellipse cx="49" cy="57" rx="4.8" ry="7.1" fill="#213450"/><ellipse cx="79" cy="57" rx="4.8" ry="7.1" fill="#213450"/><circle cx="51" cy="54" r="2" fill="white"/><circle cx="81" cy="54" r="2" fill="white"/><ellipse cx="37" cy="69" rx="7" ry="3" fill="#ec9caa" opacity=".65"/><ellipse cx="91" cy="69" rx="7" ry="3" fill="#ec9caa" opacity=".65"/><path d="M60 72q4 4 8 0" stroke="'+q.c+'" stroke-width="2.8" fill="none" stroke-linecap="round"/>';
    const leg='<path d="M44 97l-3 9q-5 7 6 8h13l5-13m18-4 3 10q5 8-6 8H67l-4-13" fill="'+q.a+'" '+contour+'/>';
    let rear='', ears='', face=eye, special='';
    if(q.kind==='cat'||q.kind==='fox'||q.kind==='wolf'){
      ears='<path d="M27 53L18 13Q17 6 25 11L49 28M101 53l9-40q2-8-7-3L79 28" fill="'+q.a+'" '+contour+'/><path d="M26 40l-4-21 16 15m64 6 4-21-16 15" fill="#f5b8bc"/>';
      const tail=q.kind==='fox'?'M95 95Q145 102 123 57Q109 84 97 71':q.kind==='wolf'?'M96 100Q146 87 125 55Q116 74 99 74':'M97 98Q135 116 126 78Q121 63 112 77';
      rear='<path d="'+tail+'" fill="'+body+'" '+contour+'/>';
      if(q.kind==='fox')special='<path d="M42 73q22 18 44 0l-10 28H53Z" fill="'+q.b+'"/><path d="M61 22l4-10 4 10" fill="'+q.accent+'"/>';
      if(q.kind==='wolf')special='<path d="M30 72l-12 16 21-4-8 15 24-12 9 14 11-14 22 12-9-15 22 4-13-16" fill="'+q.b+'" '+contour+'/>';
      if(q.kind==='cat')special='<path d="M38 69l-25-3m26 10-25 4m76-11 25-3m-26 10 25 4" stroke="'+q.c+'" stroke-width="2.2" fill="none"/><path d="M61 69l3 3 3-3" fill="#e49ca2"/><path d="M49 100l15 9 15-9" fill="none" stroke="'+q.accent+'" stroke-width="4"/><circle cx="64" cy="109" r="6" fill="'+q.accent+'" stroke="'+q.c+'" stroke-width="2"/>';
    }
    if(q.kind==='dragon'){
      ears='<path d="M31 35L26 8l24 20m50 7 3-27-24 20" fill="'+q.accent+'" '+contour+'/>';
      rear='<path d="M94 92Q148 109 125 65L115 79l-10-7" fill="'+q.a+'" '+contour+'/><path d="M36 75Q-4 35 9 20l29 24m54 31q39-40 26-55L90 44" fill="'+q.a+'" '+contour+'/><path d="M28 61L9 29l21 15m70 17 18-32-21 15" fill="'+q.b+'"/>';
      special='<path d="M55 8l9-8 9 8-9 15Z" fill="'+q.accent+'"/><path d="M41 94l-8 11 13-2m38-9 8 11-13-2" fill="'+q.accent+'"/>';
    }
    if(q.kind==='slime'){
      face='<ellipse cx="49" cy="68" rx="5.2" ry="7" fill="#164a39"/><ellipse cx="79" cy="68" rx="5.2" ry="7" fill="#164a39"/><circle cx="50" cy="65" r="2" fill="white"/><circle cx="80" cy="65" r="2" fill="white"/><path d="M55 78q9 12 18 0" fill="none" stroke="#24674f" stroke-width="3"/><circle cx="39" cy="79" r="5" fill="#f7a9b0"/><circle cx="89" cy="79" r="5" fill="#f7a9b0"/>';
      special='<path d="M61 31Q48 11 45 7Q61 8 67 30M66 29Q75 6 93 13Q85 31 66 29" fill="'+q.a+'" stroke="'+q.c+'" stroke-width="3"/><path d="M33 52q25-29 61-7" fill="none" stroke="white" opacity=".6" stroke-width="7"/>';
    }
    if(q.kind==='mole'){
      ears='<circle cx="24" cy="49" r="17" fill="'+q.a+'" '+contour+'/><circle cx="104" cy="49" r="17" fill="'+q.a+'" '+contour+'/><circle cx="24" cy="49" r="10" fill="#efa9a6"/><circle cx="104" cy="49" r="10" fill="#efa9a6"/>';
      special='<ellipse cx="64" cy="75" rx="10" ry="7" fill="#e99da2"/><path d="M24 26q40-22 80 0l6 18H18Z" fill="#d8b46c" '+contour+'/><path d="M49 22h30v17H49Z" fill="'+q.accent+'" '+contour+'/><circle cx="64" cy="30" r="8" fill="#a3ebfa"/><path d="M27 90l-18 11 26 1m66-12 18 11-26 1" fill="'+q.b+'" '+contour+'/>';
    }
    if(q.kind==='bird'){
      ears='<path d="M55 32L46 5l20 16 13-19-4 31" fill="'+q.accent+'" '+contour+'/>';
      rear='<path d="M32 73L3 48l5 39 31 7m57-21 29-25-5 39-31 7" fill="'+q.a+'" '+contour+'/>';
      special='<path d="M58 73l6 8 6-8Z" fill="#db8944" '+contour+'/><path d="M26 67L7 55m95 12 19-12" stroke="'+q.accent+'" stroke-width="5"/>';
    }
    if(q.kind==='penguin'){
      rear='<path d="M35 73L9 88l21 9m63-24 26 15-21 9" fill="'+q.c+'" '+contour+'/>';
      special='<ellipse cx="64" cy="81" rx="27" ry="31" fill="'+q.b+'"/><path d="M57 70l7 9 7-9-7-4Z" fill="#f5b15e" '+contour+'/><path d="M37 102q27 9 54 0" fill="none" stroke="'+q.accent+'" stroke-width="10"/><path d="M93 104l10 18-14-3" fill="'+q.accent+'" '+contour+'/>';
    }
    let creature;
    if(g===0){
      creature='<path d="M64 23C99 23 112 57 107 85Q101 119 64 119Q27 119 21 85C16 57 29 23 64 23Z" fill="#fff6db" stroke="#bb9b73" stroke-width="4"/><path d="M26 83l13-11 13 10 12-9 13 9 13-10 13 11" stroke="#c5aa87" stroke-width="3" fill="none"/><ellipse cx="48" cy="53" rx="19" ry="7" transform="rotate(-30 48 53)" fill="white" opacity=".65"/>';
    }else if(q.kind==='slime'){
      creature='<path d="M12 95Q9 64 33 49Q53 37 64 30Q75 37 95 49Q119 64 116 95Q113 115 64 117Q15 115 12 95Z" fill="'+body+'" '+contour+'/>'+special+face;
    }else{
      creature=rear+leg+ears+'<ellipse cx="64" cy="74" rx="43" ry="42" fill="'+body+'" '+contour+'/><ellipse cx="64" cy="88" rx="27" ry="20" fill="'+q.b+'" opacity=".89"/><path d="M35 45q29-24 57 0" fill="none" stroke="white" stroke-opacity=".55" stroke-width="5"/>'+special+face;
    }
    const stars=g>=2?'<path d="M15 16l4 9 9 3-9 4-4 9-4-9-9-4 9-3z" fill="'+q.accent+'" opacity=".9"/><circle cx="115" cy="23" r="5" fill="'+q.accent+'"/>':'';
    const crown=g===3?'<path d="M43 8l-5-12 16 8 10-14 10 14 16-8-5 12-7 11H50Z" fill="#ffdb76" stroke="#9b6b35" stroke-width="3"/><circle cx="64" cy="7" r="4" fill="#e66895"/>':'';
    return '<svg class="pet-art '+size+'" viewBox="0 0 128 136" role="img" aria-label="'+esc(id)+'の姿" xmlns="http://www.w3.org/2000/svg">'+defs+
      '<circle cx="64" cy="63" r="60" fill="url(#'+prefix+'-sky)"/><ellipse cx="64" cy="120" rx="47" ry="8" fill="#26364d" opacity=".19"/>'+stars+
      '<g transform="translate('+off+' '+(14*(1-scale))+') scale('+scale+')">'+creature+crown+'</g></svg>';
  }
  root.RPGPetArt={svg};
})(typeof self!=='undefined'?self:this);
