'use strict';
// ペット8種類の専用SVG。保存データに手を加えず、成長ポイントから姿を描き分ける。
(function(root){
 const specs={
 dragon:{body:'#ed7358',light:'#ffc16d',dark:'#a43a48',ear:'horn'},
 wolf:{body:'#a9d5ec',light:'#eefaff',dark:'#587aa2',ear:'wolf'},
 slime:{body:'#6bc591',light:'#b3ecc1',dark:'#397d75',ear:'none'},
 mole:{body:'#ac805d',light:'#e4b48c',dark:'#664a4a',ear:'round'},
 bird:{body:'#f4d15e',light:'#fff0aa',dark:'#7c80cc',ear:'crest'},
 fox:{body:'#bc82db',light:'#f5d0ff',dark:'#7653a0',ear:'fox'},
 cat:{body:'#aebbc9',light:'#e8f2f8',dark:'#61778e',ear:'cat'},
 penguin:{body:'#77bdd8',light:'#f3fbff',dark:'#426e9f',ear:'none'}
 };
 const stage=x=>x>=180?3:x>=90?2:x>=10?1:0;
 const hatch='<ellipse cx="32" cy="44" rx="20" ry="19" fill="#f9edcd" stroke="#ad9684" stroke-width="3"/><path d="M15 38l8 5 8-5 8 5 8-5" fill="none" stroke="#c8b5a3" stroke-width="2"/>';
 function svg(id,xp,small=false){
   const s=specs[id]||specs.cat,g=stage(xp),scale=[0.77,0.83,0.99,1.13][g];
   const ears={cat:'<path d="M16 25L13 6 29 18M48 25L51 6 35 18" />',fox:'<path d="M14 25L10 3 29 19M50 25L54 3 35 19" />',wolf:'<path d="M17 25L13 5 28 18M47 25L51 5 36 18" />',round:'<circle cx="16" cy="21" r="9"/><circle cx="48" cy="21" r="9"/>',horn:'<path d="M18 21L16 5 29 17M46 21L48 5 35 17"/>',crest:'<path d="M29 19L27 7 35 15 40 5 39 21"/>',none:''}[s.ear];
   let extra='';
   if(id==='dragon')extra='<path d="M47 49Q62 42 56 27" fill="none" stroke="'+s.dark+'" stroke-width="8"/><path d="M10 38L3 29 20 32" fill="'+s.light+'" stroke="'+s.dark+'" stroke-width="2"/>';
   if(id==='wolf')extra='<path d="M45 51Q65 47 56 34" fill="none" stroke="'+s.light+'" stroke-width="10"/>';
   if(id==='fox')extra='<path d="M45 52Q65 45 56 32" fill="none" stroke="'+s.body+'" stroke-width="12"/><path d="M54 34l4 -5" stroke="'+s.light+'" stroke-width="6"/>';
   if(id==='cat')extra='<path d="M48 49Q64 45 57 28" fill="none" stroke="'+s.body+'" stroke-width="8"/><path d="M12 38l-10 -2m10 7l-9 3m49 -8l10 -2m-10 7l9 3" stroke="'+s.dark+'" stroke-width="1.7"/>';
   if(id==='penguin')extra='<path d="M14 39L3 49 18 47M50 39L61 49 46 47" fill="'+s.dark+'"/>';
   if(id==='bird')extra='<path d="M18 36L5 30 12 46M46 36L59 30 52 46" fill="'+s.light+'"/><path d="M28 41l4 5 4-5" fill="#eaa053"/>';
   if(id==='mole')extra='<path d="M12 51L5 55M52 51L59 55" stroke="'+s.dark+'" stroke-width="6"/><ellipse cx="32" cy="40" rx="6" ry="4" fill="#d992a2"/>';
   if(id==='slime')extra='<path d="M13 38Q13 15 32 17Q51 15 51 38" fill="none" stroke="'+s.light+'" stroke-width="4"/>';
   const face='<ellipse cx="24" cy="34" rx="2.6" ry="3.6" fill="#223342"/><ellipse cx="40" cy="34" rx="2.6" ry="3.6" fill="#223342"/><path d="M29 43Q32 46 35 43" fill="none" stroke="#4d4450" stroke-width="2" stroke-linecap="round"/>';
   const medal=g===3?'<path d="M32 1l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#f9d770" stroke="#af893e" stroke-width="1.5"/>':'';
   return '<svg class="pet-art '+(small?'pet-art-small':'')+'" viewBox="0 0 64 68" role="img" aria-label="'+id+'の成長した姿" xmlns="http://www.w3.org/2000/svg">'+
      '<g transform="translate(32 35) scale('+scale+') translate(-32 -35)">'+
      (g===0?hatch:'<g fill="'+s.body+'" stroke="'+s.dark+'" stroke-width="2.5" stroke-linejoin="round">'+ears+'</g><ellipse cx="32" cy="45" rx="22" ry="20" fill="'+s.body+'" stroke="'+s.dark+'" stroke-width="2.5"/><ellipse cx="32" cy="48" rx="14" ry="13" fill="'+s.light+'"/>'+extra+face+
      (g>=2?'<path d="M20 15Q32 10 44 15" fill="none" stroke="'+s.light+'" stroke-width="4"/>':'')+
      (g===3?'<circle cx="51" cy="17" r="4" fill="#f8d875"/><path d="M7 13l3 4-3 4-3-4z" fill="#f8d875"/>':''))+
      medal+'</g></svg>';
 }
 root.RPGPetArt={svg,stage};
})(typeof self!=='undefined'?self:this);
