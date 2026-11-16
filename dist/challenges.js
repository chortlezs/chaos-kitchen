/* Local input simulations for the future ESP knife / pan / plate gestures. */
class CoffeeChallenge {
  constructor(onFinish) { this.onFinish=onFinish; this.reset(); }
  reset(){this.mode=null;this.data=null;this.age=0;this.pointer=null;this.gesture=0;this.zoom=0;}
  start(mode,item){this.mode=mode;this.item=item;this.age=0;this.gesture=0;this.pointer=null;this.data={progress:0,hits:0,beat:0,flips:0,window:0,scorch:0,flash:0,tilt:0,velocity:0,integrity:100,steady:0,wind:0,quality:100};}
  end(ok){const result={mode:this.mode,ok,quality:Math.round(this.data.integrity),flips:this.data.flips};this.mode=null;this.onFinish(result);}
  chop(){if(this.mode==='chop'&&this.data.hits<10&&this.age-this.data.beat>.16){this.data.hits++;this.data.beat=this.age;this.data.flash=.2;this.data.progress=Math.min(1,this.data.hits/10);}}
  flip(){if(this.mode!=='cook')return;const d=this.data;d.flash=.65;if(d.window>0){d.flips++;d.window=0;d.scorch=Math.max(0,d.scorch-8);d.flashGood=true;}else{d.scorch=Math.min(100,d.scorch+12);d.flashGood=false;}}
  down(x,y){this.pointer={x,y,lastX:x,lastY:y,start:this.age};if(this.mode==='chop')this.chop();}
  move(x,y){if(!this.pointer)return;const p=this.pointer,dx=x-p.lastX,dy=y-p.lastY;this.gesture=Math.min(1,Math.hypot(dx,dy)/25);if(this.mode==='cook'&&p.y-y>100){this.flip();p.y=y;}p.lastX=x;p.lastY=y;}
  up(){this.pointer=null;}
  update(dt,keys){if(!this.mode)return;this.age+=dt;const d=this.data;d.flash=Math.max(0,d.flash-dt);this.gesture*=Math.exp(-dt*5);
    if(this.mode==='chop'){if(keys.e||this.pointer)this.chop();if(d.progress>=1&&d.flash===0)this.end(true);return;}
    if(this.mode==='cook'){
      const stir=!!keys.e||(this.gesture>.025&&this.gesture<.65);d.stir=stir;d.amplitude=keys.e?.27:this.gesture;
      if(!keys.e&&this.gesture>.65)d.scorch+=dt*5;
      if(d.window>0){d.window-=dt;if(d.window<=0){d.window=2.8;d.scorch+=27;d.flash=.5;d.flashGood=false;}}
      else if(stir){const gate=d.flips===0?.34:d.flips===1?.72:1;d.progress=Math.min(gate,d.progress+dt/10);d.scorch=Math.max(0,d.scorch-dt*.6);if(d.progress>=gate&&d.flips<2)d.window=2.8;}
      if(!stir&&this.age>2)d.scorch+=dt*7;
      if(d.scorch>=100){this.end(false);return;}
      if(d.progress>=1&&d.flips===2){this.end(true);return;}return;
    }
    if(this.mode==='carry'){
      const input=Number(keys.d||keys.arrowright||false)-Number(keys.a||keys.arrowleft||false);
      const moving=!!keys.e;d.wind=d.progress>=1?.14:.58+Math.sin(this.age*1.3)*.3+Math.sin(this.age*.45)*.18;
      d.velocity+=(d.wind+input*1.7-d.tilt*.14-d.velocity*2.1)*dt;d.tilt+=d.velocity*dt;
      d.tilt=Math.max(-1.15,Math.min(1.15,d.tilt));
      if(Math.abs(d.tilt)>.66)d.integrity-=dt*(14+Math.abs(d.tilt)*8);
      if(Math.abs(d.tilt)>.96)d.integrity-=dt*20;
      if(moving&&Math.abs(d.tilt)<.72)d.progress=Math.min(1,d.progress+dt/12);
      if(d.progress>=1&&Math.abs(d.tilt)<.25&&moving)d.steady+=dt;else d.steady=0;
      if(d.integrity<=0){this.end(false);return;}
      if(d.steady>=1.2)this.end(true);
    }
  }
  draw(ctx,drawFood){if(!this.mode)return;const d=this.data,t=this.age;
    const box=(x,y,w,h,r,c)=>{ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=c;ctx.fill();};
    const label=(s,x,y,size=22,color='#f2dcc2')=>{ctx.fillStyle=color;ctx.font=`600 ${size}px "Noto Sans SC",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,x,y);};
    const oval=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
    const bean=(x,y,scale,angle)=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);oval(0,0,scale*1.4,scale,'#68402b');ctx.strokeStyle='#bd8c5a';ctx.lineWidth=scale*.16;ctx.beginPath();ctx.moveTo(-scale*.7,scale*.25);ctx.bezierCurveTo(-scale*.1,-scale*.8,scale*.1,scale*.8,scale*.7,-scale*.25);ctx.stroke();ctx.restore();};
    ctx.save();ctx.globalAlpha=Math.min(1,t*3);box(0,0,1100,680,0,'#271b16');
    for(let i=0;i<22;i++)bean((i*179+80)%1130,(i*127+90)%690,22+(i%3)*9,i*.7);
    box(25,25,1050,630,32,'#35251cdd');label('BEAN HOPPER / MICRO KITCHEN',550,60,14,'#c8a17a');
    if(this.mode==='chop'){
      label('01 / 近景备菜 · ESP 代表刀',550,102,24);label('按住 E，或点按砧板切菜',550,143,17,'#d9b48b');
      ctx.save();ctx.translate(550,350);ctx.rotate(-.025);box(-340,-145,680,290,36,'#603c27');box(-340,-157,680,285,36,'#bd8b53');
      ctx.strokeStyle='#97683f';ctx.lineWidth=2;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(-305,-120+i*34);ctx.lineTo(305,-125+i*34);ctx.stroke();}
      const pieces=d.hits;drawFood({food:this.item.food,state:'raw'},-100,0,3.4);for(let j=0;j<pieces;j++){box(-20+(j%5)*37,-40+Math.floor(j/5)*46,26,28,5,'#d27948');}
      ctx.save();ctx.translate(100,-35+(d.flash>0?Math.sin(d.flash*35)*30:-40));ctx.rotate(-.24);box(-5,-75,38,130,5,'#f2e9d5');box(-5,55,38,55,7,'#3b2a22');ctx.restore();ctx.restore();
      label(`${Math.min(10,d.hits)} / 10 刀`,550,553,28);box(280,590,540,10,5,'#5d4533');box(280,590,540*d.progress,10,5,'#e0a858');
    }else if(this.mode==='cook'){
      label('02 / 近景烹饪 · ESP 代表锅',550,102,24);
      const need=d.window>0;label(need?`现在大幅颠勺！ ${d.window.toFixed(1)}s`:'小幅晃动翻炒 · 保持节奏',550,151,28,need?'#ffc576':'#e2c8a7');
      const offset=d.flash>0?Math.sin((.65-d.flash)*Math.PI/.65)*100:0;
      ctx.save();ctx.translate(550+Math.sin(t*8)*(d.stir?12:0),360);ctx.rotate(d.stir?Math.sin(t*7)*.035:0);
      oval(0,20,232,130,'#d47b3c');oval(0,10,240,135,'#171a16');oval(0,-2,215,117,'#44493a');oval(0,-5,192,100,'#66664b');box(190,-20,170,47,18,'#171a16');
      for(let j=0;j<9;j++){const a=j*2.4+t*(d.stir?1:0);drawFood({food:this.item.food,state:'chopped'},Math.cos(a)*120,Math.sin(a)*48-offset,1.35);}
      ctx.restore();if(d.flash>.1)label(d.flashGood?'完美翻面！':'时机不对 · 注意火候',550,250,22,d.flashGood?'#e7c77d':'#e99b79');
      label(`翻面 ${d.flips} / 2`,820,235,18);label('炒制进度',305,539,15,'#cfa782');box(280,565,540,10,5,'#5d4533');box(280,565,540*d.progress,10,5,'#d9a359');
      for(const v of [.34,.72]){box(280+540*v-2,557,4,26,2,'#f4dec0');}
      label(`焦糊风险 ${Math.round(d.scorch)}%`,550,614,16,d.scorch>60?'#eea07f':'#ceb28e');
    }else{
      label('03 / 流动咖啡 · 平衡端盘',550,102,24);label(d.progress>=1?'到出餐口了！回正盘子，按住 E 稳定交单':'按住 E 前进 · A / D 反向修正盘子',550,144,21,'#e2c19b');
      box(60,185,980,275,55,'#70432c');
      ctx.strokeStyle='#b5834d';ctx.lineWidth=3;for(let j=0;j<10;j++){ctx.beginPath();for(let x=70;x<1035;x+=10){const y=207+j*24+Math.sin(x*.014+t*2+j)*9;x===70?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
      for(let j=0;j<14;j++)bean(80+((j*173-t*80+10000)%930),215+(j*67)%210,14+(j%3)*6,j*.7+t*.08);
      ctx.save();ctx.translate(550,328);ctx.rotate(d.tilt*.3);oval(0,20,204,91,'#34251f66');oval(0,0,210,94,'#e8d3ab');oval(0,-4,182,74,'#f6e8c9');oval(d.tilt*60,-4,142,47,'#75482b');for(let j=0;j<6;j++)drawFood({food:this.item.food,state:'cooked'},(j-2.5)*40+d.tilt*85,Math.sin(j)*18,1.2);ctx.restore();
      label('← 咖啡流动方向',855,420,14,'#e9c390');
      const bx=270,bw=560;box(bx,500,bw,22,11,'#6b3429');box(bx+bw*.17,500,bw*.66,22,8,'#8c8460');box(bx+bw*.375,500,bw*.25,22,5,'#bbbd84');
      oval(550+d.tilt*235,511,12,17,'#fff0cd');label('A 向左压',275,550,17);label('D 向右压',825,550,17);label(Math.abs(d.tilt)<.25?'盘子平稳':Math.abs(d.tilt)<.66?'注意倾斜':'正在洒出！',550,551,24,Math.abs(d.tilt)<.66?'#e6cb9c':'#ffa77c');
      box(280,590,540,8,4,'#5d4533');box(280,590,540*d.progress,8,4,'#d9a359');label(`路程 ${Math.round(d.progress*100)}%  ·  菜品完整度 ${Math.max(0,Math.round(d.integrity))}%`,550,628,17);
      if(d.progress>=1){box(420,572,260,6,3,'#68513d');box(420,572,260*d.steady/1.2,6,3,'#bcc280');}
    }
    ctx.restore();
  }
}
window.CoffeeChallenge=CoffeeChallenge;
