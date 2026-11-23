'use strict';
// My World first-person walk view. Canvas ray casting with the existing 6x6 land.
// Read-only: walking never alters the saved blocks, materials, pets or points.
(function(root){
  const W=6,H=6,FOV=Math.PI/2.9,MAX=14;
  const COLORS={wood:[219,166,105],stone:[184,197,209],iron:[138,201,210],crystal:[178,145,250]};
  let active=null;
  function clamp(n,a,b){return Math.min(b,Math.max(a,n));}
  function wallAt(l,x,y){
    if(x<0||y<0||x>=W||y>=H)return {id:'boundary',height:3};
    const old=(l.map||[]).find(t=>t.x===x&&t.y===y);
    if(old)return {id:old.id,height:2.3,decor:true};
    const bs=(l.blocks||[]).filter(t=>t.x===x&&t.y===y);
    if(bs.length)return {id:bs[bs.length-1].id,height:bs.length};
    return null;
  }
  function color(id,shade){
    const v=COLORS[id]||[116,153,102];
    return 'rgb('+v.map(n=>Math.round(clamp(n*shade,0,255))).join(',')+')';
  }
  function mount(canvas,life){
    if(active){active.dispose();active=null;}
    if(!canvas||!life)return;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    const state={x:.5,y:.5,a:0.7};
    const cw=480,ch=300;canvas.width=cw;canvas.height=ch;
    const hint=canvas.parentElement.querySelector('[data-walk-position]');
    function draw(){
      ctx.fillStyle='#b8def9';ctx.fillRect(0,0,cw,ch/2);
      let grad=ctx.createLinearGradient(0,0,0,ch/2);
      grad.addColorStop(0,'#80bdea');grad.addColorStop(1,'#eff8ff');
      ctx.fillStyle=grad;ctx.fillRect(0,0,cw,ch/2);
      grad=ctx.createLinearGradient(0,ch/2,0,ch);
      grad.addColorStop(0,'#7fa66d');grad.addColorStop(1,'#467e4e');
      ctx.fillStyle=grad;ctx.fillRect(0,ch/2,cw,ch/2);
      ctx.fillStyle='#fff9';ctx.beginPath();ctx.arc(398,46,20,0,Math.PI*2);ctx.fill();
      const stripe=3;
      for(let px=0;px<cw;px+=stripe){
        const angle=state.a+Math.atan((px/cw-.5)*2*Math.tan(FOV/2));
        const dx=Math.cos(angle),dy=Math.sin(angle);
        let mapX=Math.floor(state.x),mapY=Math.floor(state.y);
        let ddx=Math.abs(1/dx),ddy=Math.abs(1/dy);
        let stepX=dx<0?-1:1,stepY=dy<0?-1:1;
        let sideX=(dx<0?state.x-mapX:mapX+1-state.x)*ddx;
        let sideY=(dy<0?state.y-mapY:mapY+1-state.y)*ddy;
        let wall=null,dist=MAX,face=0;
        for(let n=0;n<24;n++){
          if(sideX<sideY){mapX+=stepX;dist=sideX;sideX+=ddx;face=0;}
          else{mapY+=stepY;dist=sideY;sideY+=ddy;face=1;}
          wall=wallAt(life,mapX,mapY);if(wall)break;
        }
        if(!wall)continue;
        const corrected=Math.max(.08,dist*Math.cos(angle-state.a));
        const unit=ch/(corrected*1.33);
        const height=Math.min(ch*4,unit*wall.height);
        // Floor stays at the bottom of the visible cubes.
        const bottom=ch/2+unit*.48;
        const top=bottom-height;
        let tint=(face?0.79:1)*Math.max(.5,1-corrected/22);
        ctx.fillStyle=color(wall.id,tint);ctx.fillRect(px,top,stripe+1,height);
        ctx.fillStyle='rgba(255,255,255,.24)';ctx.fillRect(px,top,stripe+1,Math.min(3,unit*.10));
        if(wall.height>1){
          ctx.fillStyle='rgba(45,45,50,.18)';
          for(let t=1;t<Math.ceil(wall.height);t++){let yy=bottom-t*unit;ctx.fillRect(px,yy,stripe+1,Math.max(1,unit*.02));}
        }
        ctx.fillStyle='rgba(40,60,40,.15)';ctx.fillRect(px+stripe-1,top,1,height);
      }
      // Compact overhead position marker is helpful for children navigating a small plot.
      ctx.fillStyle='rgba(15,36,30,.78)';ctx.fillRect(9,9,119,119);
      for(let y=0;y<6;y++)for(let x=0;x<6;x++){
        const w=wallAt(life,x,y),xx=16+x*17,yy=16+y*17;
        ctx.fillStyle=w?color(w.id,1):'#86b877';ctx.fillRect(xx,yy,15,15);
      }
      ctx.fillStyle='#ffef54';ctx.beginPath();ctx.arc(16+state.x*17-8.5,16+state.y*17-8.5,5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16+state.x*17-8.5,16+state.y*17-8.5);ctx.lineTo(16+state.x*17-8.5+Math.cos(state.a)*11,16+state.y*17-8.5+Math.sin(state.a)*11);ctx.stroke();
      ctx.strokeStyle='#fff9';ctx.beginPath();ctx.moveTo(cw/2-9,ch/2);ctx.lineTo(cw/2+9,ch/2);ctx.moveTo(cw/2,ch/2-9);ctx.lineTo(cw/2,ch/2+9);ctx.stroke();
      if(hint)hint.textContent='現在地：'+(Math.floor(state.x)+1)+'列・'+(Math.floor(state.y)+1)+'行';
    }
    function move(amount){
      const nx=state.x+Math.cos(state.a)*amount,ny=state.y+Math.sin(state.a)*amount;
      const free=(x,y)=>x>.18&&y>.18&&x<5.82&&y<5.82&&!wallAt(life,Math.floor(x),Math.floor(y));
      if(free(nx,state.y)&&free(nx+.14,state.y)&&free(nx-.14,state.y))state.x=nx;
      if(free(state.x,ny)&&free(state.x,ny+.14)&&free(state.x,ny-.14))state.y=ny;
      draw();
    }
    function turn(amount){state.a=(state.a+amount+Math.PI*2)%(Math.PI*2);draw();}
    const buttons=[...canvas.parentElement.querySelectorAll('[data-walk]')];
    const act=which=>{
      if(which==='left')turn(-Math.PI/8);
      if(which==='right')turn(Math.PI/8);
      if(which==='forward')move(.25);
      if(which==='back')move(-.25);
    };
    const listeners=[];
    buttons.forEach(btn=>{const fn=()=>act(btn.dataset.walk);btn.addEventListener('click',fn);listeners.push(()=>btn.removeEventListener('click',fn));});
    let startX=null;
    const down=e=>{startX=e.touches[0].clientX;};
    const up=e=>{if(startX===null)return;const delta=e.changedTouches[0].clientX-startX;startX=null;if(Math.abs(delta)>24)turn(delta>0?.25:-.25);};
    canvas.addEventListener('touchstart',down,{passive:true});
    canvas.addEventListener('touchend',up,{passive:true});
    listeners.push(()=>{canvas.removeEventListener('touchstart',down);canvas.removeEventListener('touchend',up);});
    draw();
    active={dispose:()=>listeners.forEach(fn=>fn())};
  }
  root.RPGLandWalk={mount};
})(typeof self!=='undefined'?self:this);
