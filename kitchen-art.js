/* The barista's silhouette is shared by all four kitchens. */
(function(root){
  const skins={
    coffee:{dark:'#38231f',shade:'#825337',metal:'#ca935d',light:'#f4d49a',face:'#ffc793',hat:'#fff0cf',hatShade:'#ddbd8f',cloth:'#f6e3bc',trim:'#a8633c',accent:'#ffc276',sole:'#482a23'},
    neon:{dark:'#0d102d',shade:'#293780',metal:'#5268d0',light:'#bceaff',face:'#ffc793',hat:'#effcff',hatShade:'#a8c3ff',cloth:'#555bbc',trim:'#24dfed',accent:'#ff65d2',sole:'#1c244c'},
    toilet:{dark:'#294757',shade:'#407986',metal:'#79b7b9',light:'#f4fff6',face:'#ffc793',hat:'#fff5d5',hatShade:'#bcded6',cloth:'#e9f5e6',trim:'#4daba4',accent:'#ffd376',sole:'#355d65'},
    fridge:{dark:'#19375a',shade:'#41678e',metal:'#78a7d2',light:'#e1faff',face:'#ffc793',hat:'#f6fdff',hatShade:'#b9def7',cloth:'#6e9de0',trim:'#c1edff',accent:'#6ae4f5',sole:'#284665'}
  };
  const TAU=2*Math.PI;
  function oval(g,x,y,rx,ry,color){
    g.fillStyle=color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,TAU);g.fill();
  }
  function box(g,x,y,w,h,color){g.fillStyle=color;g.fillRect(x,y,w,h);}
  function line(g,points,color,width=1){
    g.strokeStyle=color;g.lineWidth=width;g.beginPath();
    points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
  }
  function panel(g,x,y,w,h,p){
    box(g,x+3,y+5,w,h,p.dark);box(g,x,y,w,h,p.shade);
    box(g,x+2,y+2,w-4,h-4,p.metal);box(g,x+4,y+5,w-8,h-9,p.dark);
    box(g,x+6,y+2,w-12,1,p.light);
    for(const u of [x+2,x+w-4])for(const v of [y+2,y+h-4])box(g,u,v,2,2,p.light);
  }
  function badge(g,x,y,theme,color){
    const silhouettes={
      neon:[[-1,-5,4,2],[-3,-3,5,2],[-1,-1,5,2],[-2,1,4,2],[-2,3,2,2]],
      fridge:[[-4,-1,9,2],[-1,-4,2,9],[-3,-3,1,1],[3,-3,1,1],[-3,3,1,1],[3,3,1,1]],
      toilet:[[-1,-5,2,2],[-2,-3,4,2],[-3,-1,6,3],[-2,2,4,2]],
      coffee:[[-3,-3,6,1],[-4,-2,8,4],[-3,2,6,1]]
    };
    for(const [u,v,w,h] of silhouettes[theme])box(g,x+u,y+v,w,h,color);
    if(theme==='coffee')line(g,[[x-2,y+2],[x,y],[x+2,y-2]],skins.coffee.dark);
  }
  function chef(g,x,y,scale,theme,t,moving){
    const p=skins[theme], bob=moving?Math.round(Math.sin(t*16)*2):0;
    g.save();g.translate(Math.round(x),Math.round(y));g.scale(scale,scale);
    oval(g,0,13,19,7,p.dark);oval(g,0,12,16,5,p.shade);oval(g,0,11,11,3,p.trim);
    g.translate(0,bob);
    const fill=(x,y,w,h,c)=>box(g,x,y,w,h,p[c]??c);
    const stride=moving?Math.sign(bob):0;
    fill(-9,8+stride,8,6,'sole');fill(2,8-stride,8,6,'sole');
    fill(-11,-2,22,13,'dark');fill(-9,0,18,8,'cloth');
    fill(-12,1,5,5,'face');fill(8,1,5,5,'face');
    fill(-6,2,12,7,'shade');fill(-4,2,8,1,'trim');
    fill(-10,-11,20,13,'dark');fill(-8,-10,16,10,'face');
    fill(-9,-8,3,6,'trim');fill(7,-8,3,6,'trim');
    fill(-5,-6,2,4,'dark');fill(4,-6,2,4,'dark');
    fill(-7,-2,3,1,'#f68c70');fill(5,-2,3,1,'#f68c70');
    fill(-2,-2,4,2,'#9f4c3a');
    fill(-13,-21,27,13,'dark');fill(-11,-26,10,13,'dark');
    fill(-4,-30,14,16,'dark');fill(8,-24,7,14,'dark');
    fill(-11,-19,24,9,'hatShade');fill(-9,-24,9,8,'hat');
    fill(-3,-28,11,12,'hat');fill(7,-22,6,9,'hatShade');
    fill(-9,-15,20,3,'hat');fill(-9,-11,20,2,'trim');
    fill(-3,1,6,2,'accent');fill(-1,3,2,3,'accent');
    if(theme==='fridge'){
      fill(-10,-9,20,2,'light');fill(-11,-10,3,6,'metal');fill(8,-10,3,6,'metal');
      fill(-6,3,2,6,'light');fill(5,3,2,6,'light');
    }
    if(theme==='toilet'){
      fill(-12,2,5,4,'accent');fill(8,2,5,4,'accent');
      fill(-4,5,8,3,'trim');fill(-3,5,6,1,'light');
    }
    if(theme==='neon'){
      fill(-8,-8,16,2,'dark');fill(-7,-8,7,1,'trim');fill(2,-8,5,1,'accent');
      fill(-8,7,3,1,'trim');fill(6,7,3,1,'accent');
    }
    g.save();g.translate(6,-15);g.scale(.53,.53);badge(g,0,0,theme,p.shade);g.restore();
    g.restore();
  }
  function target(g,x,y,t){
    const a=Math.round(y+Math.sin(t*6)*3);
    g.save();
    oval(g,x,a-1,18,12,'#48231c');
    oval(g,x,a-2,16,11,'#ffe497');
    oval(g,x,a-2,13,8,'#dd7840');
    box(g,x-4,a-8,8,6,'#fff7d4');box(g,x-7,a-2,14,3,'#fff7d4');
    box(g,x-5,a+1,10,2,'#fff7d4');box(g,x-3,a+3,6,2,'#fff7d4');box(g,x-1,a+5,2,2,'#fff7d4');
    g.restore();
  }
  function station(g,x,y,w,theme,stage,active,t){
    const p=skins[theme];
    g.save();g.translate(x,y);
    const side=w*.5;
    for(const dir of [-1,1]){
      const a=dir*(side-5);
      box(g,a-3,-3,6,15,p.dark);box(g,a-2,-2,4,12,p.metal);
      box(g,a-1,-1,2,2,p.light);box(g,a-1,6,2,2,active?p.accent:p.shade);
    }
    if(stage==='wok'||stage==='chop'){
      for(let i=0;i<7;i++)box(g,-21+i*6,12,3,3,active&&(i+Math.floor(t*4))%7<3?p.light:p.shade);
    }
    g.restore();
  }
  function conduit(g,points,theme,p,t){
    line(g,points,p.dark,15);line(g,points,p.shade,11);line(g,points,p.metal,7);
    line(g,points,p.light,theme==='neon'?2:1.5);
    for(const [x,y] of points.slice(1,-1)){
      box(g,x-6,y-6,12,12,p.dark);box(g,x-4,y-4,8,8,p.metal);
      box(g,x-3,y-3,5,2,p.light);
    }
    const [a,b]=points.slice(-2), phase=(t*.55)%1;
    if(theme==='neon'||theme==='toilet'){
      const x=a[0]+(b[0]-a[0])*phase,y=a[1]+(b[1]-a[1])*phase;
      box(g,x-2,y-2,4,4,p.accent);
    }
  }
  function dial(g,x,y,r,p,readout){
    oval(g,x,y+3,r+2,r+2,p.dark);oval(g,x,y,r,r,p.metal);
    oval(g,x,y,r-3,r-3,p.light);oval(g,x,y,r-5,r-5,p.dark);
    for(let j=0;j<9;j++){
      const angle=-Math.PI*1.17+j*.29;
      const point=d=>[x+Math.cos(angle)*d,y+Math.sin(angle)*d];
      line(g,[point(r-9),point(r-5)],j>5?p.accent:p.light);
    }
    const a=-Math.PI*1.16+readout*2.3;
    line(g,[[x,y],[x+Math.cos(a)*(r-8),y+Math.sin(a)*(r-8)]],p.accent,2);
    box(g,x-2,y-2,4,4,p.metal);
  }
  function workshop(g,width,height,theme,stage,t){
    const p=skins[theme];
    g.save();g.scale(width/960,height/540);
    for(const side of [-1,1]){
      g.save();g.translate(side===-1?0:960,0);g.scale(-side,1);
      const leg=stage==='wok'?332:316;
      conduit(g,[[0,159],[38,159],[54,176],[54,leg],[125,leg],[146,leg+20]],theme,p,t);
      panel(g,58,194,102,stage==='wok'?110:89,p);
      badge(g,106,213,theme,p.accent);
      if(stage==='wok'){
        dial(g,106,248,24,p,.47+.11*Math.sin(2*t+side));
        for(let i=0;i<8;i++){
          box(g,77+i*8,284,5,5,p.shade);
          if((i+Math.floor(t*4+8+side))%8<4)box(g,77+i*8,284,5,2,p.light);
        }
      }else{
        for(let i=0;i<6;i++){
          box(g,78+i*10,232,7,31,p.shade);
          box(g,79+i*10,260-(i%3)*5,5,3+(i%3)*5,p.metal);
        }
        if(stage==='serve')line(g,[[78,247],[101,247],[109,238],[117,247],[140,247]],p.accent,2);
      }
      if(theme==='fridge'){
        for(let i=0;i<7;i++){
          const x=62+i*14, length=8+(i*11)%15;
          box(g,x,187,5,length,p.metal);box(g,x+1,187,2,length-2,p.light);
        }
      }else if(theme==='toilet'){
        for(let i=0;i<6;i++){
          const y=194+((i*19+t*17)%107);
          oval(g,164+i%2*5,y,1.4,2.6,p.accent);
        }
      }else if(theme==='neon'){
        for(let i=0;i<6;i++){
          line(g,[[160,208+i*14],[175,208+i*14],[188,215+i*14]],p.shade,2);
          box(g,187,214+i*14,3,3,i===Math.floor(t*4)%6?p.accent:p.metal);
        }
      }else{
        for(let i=0;i<4;i++){
          box(g,40,194+i*33,25,6,p.shade);box(g,40,194+i*33,25,2,p.light);
        }
      }
      panel(g,22,350,128,27,p);
      for(let i=0;i<10;i++){
        const x=31+i*11;
        box(g,x,359,7,9,p.shade);box(g,x,360,2,7,p.metal);
      }
      g.restore();
    }
    g.restore();
  }
  function burner(g,x,y,scale,theme,t,active,progress,burn){
    const p=skins[theme], heated=burn>.58?'#ff704c':p.accent;
    g.save();g.translate(x,y);g.scale(scale,scale);
    oval(g,2,17,175,31,p.dark);oval(g,0,9,171,31,p.shade);
    oval(g,0,-1,170,30,p.metal);oval(g,0,-4,165,28,p.light);
    oval(g,0,-6,155,26,p.shade);oval(g,0,-7,139,20,p.dark);
    for(const [rx,ry] of [[125,18],[105,14],[80,10]]){
      g.strokeStyle=active?heated:p.metal;g.lineWidth=active?2:1;
      g.beginPath();g.ellipse(0,-8,rx,ry,0,0,TAU);g.stroke();
    }
    for(let j=0;j<18;j++){
      const a=j*Math.PI/17, u=Math.cos(a)*162,v=11+Math.sin(a)*18;
      box(g,u-3,v,6,5,p.dark);
      box(g,u-2,v,4,2,active&&(j+Math.floor(t*14))%5<2?heated:p.light);
    }
    for(const side of [-1,1]){
      const px=side*174;
      conduit(g,[[px,9],[px+side*12,9],[px+side*23,-3],[px+side*30,-3]],theme,p,t);
      panel(g,px-22,15,44,21,p);
      for(let j=0;j<5;j++)box(g,px-15+j*6,24,4,4,j<Math.ceil(progress*5)?heated:p.shade);
    }
    if(active){
      for(let i=0;i<14;i++){
        const age=(t*(.55+i%3*.09)+i*.37)%1;
        const u=(i%2?1:-1)*(115+age*46)+Math.sin(i*9+t*5)*10;
        const v=-13-age*66;
        g.globalAlpha=(1-age)*.63;
        if(theme==='coffee')line(g,[[u-3,v+10],[u+3,v+3],[u,v-5]],p.light,2);
        else badge(g,u,v,theme,i%2?p.light:heated);
      }
    }
    g.restore();
  }
  function tray(g,rx,ry,theme,t){
    const p=skins[theme];
    g.save();
    for(let i=0;i<17;i++){
      const a=Math.PI*1.04+i*Math.PI*.056;
      const x=Math.cos(a)*rx*.91,y=Math.sin(a)*ry*.88;
      box(g,x-3,y-1,6,2,i===Math.floor(t*6)%17?p.light:p.metal);
    }
    g.globalAlpha=.65;
    badge(g,0,-ry*.78,theme,p.shade);
    g.restore();
  }
  root.KitchenArt={chef,station,target,workshop,burner,tray};
})(window);
