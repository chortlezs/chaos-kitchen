(function(root){
  const skins={
    neon:{paper:'#101238',edge:'#48e8ff',alloy:'#ad4aff',ink:'#f0ffff',colors:['#63f5ff','#ff6df5','#ab94ff','#f4ffff']},
    fridge:{paper:'#19445f',edge:'#b8f7ff',alloy:'#528fc3',ink:'#f4feff',colors:['#a0efff','#ecffff','#6aaee9','#b9b9ff']},
    toilet:{paper:'#21465e',edge:'#a5eadf',alloy:'#6aaebf',ink:'#faffed',colors:['#8ed6d9','#eafff1','#57adc3','#a8eee1']},
    coffee:{paper:'#3b211c',edge:'#ffbf76',alloy:'#b76b44',ink:'#fff0cc',colors:['#ffa75c','#e2b084','#fff0bd','#935535']}
  };
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function create(ctx,w,h,theme){
    let particles=[],impacts=[],grade=null,victory=null,nextAmbient=0;
    const unit=w/960,tau=Math.PI*2;
    const impactLife=.78, gradeHold=1.72, winHold=2.8;
    const burstSizes={chop:72,wok:82,serve:54};
    const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    function polygon(points,color){
      ctx.fillStyle=color;ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.closePath();ctx.fill();
    }
    function line(points,color,width){
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
      points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
      ctx.stroke();
    }
    function oval(x,y,rx,ry,color){
      ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,tau);ctx.fill();
    }
    function emit(mode,t,x,y,power,major){
      const skin=skins[theme()];
      const density=reduced?.55:major?2:1.5;
      const amount=Math.ceil((major?burstSizes[mode]:12)*power*density);
      for(let i=0;i<amount;i++){
        const a=i*2.399963+Math.random()*.32;
        const speed=(major?170+Math.random()*360:45+Math.random()*135)*unit*(.75+power*.25);
        const travel=speed*(major&&!reduced?1.25:1);
        const side=x<w/2?1:-1;
        const vx=mode==='serve'?side*travel*(.55+Math.abs(Math.cos(a))*.55):Math.cos(a)*travel;
        const vy=mode==='wok'?-travel*(.5+Math.abs(Math.sin(a))*.55):Math.sin(a)*travel*.58-75*unit;
        const heavy=major&&!reduced&&i%9===0;
        const delay=major&&!reduced&&i%4===3?.075*unit:0;
        particles.push({mode,t:t+delay,x,y,vx,vy,life:(major?.34:.28)+Math.random()*(major?.65:.38),
          scale:(1.6+Math.random()*(major?7:3.4))*unit*(heavy?1.65:1),heavy,a,
          spin:(Math.random()-.5)*10,color:skin.colors[i%skin.colors.length],kind:i%5});
      }
      const budget=reduced?390:720;
      if(particles.length>budget)particles.splice(0,particles.length-budget);
      if(major){
        impacts.push({mode,t,x,y,power});
        if(impacts.length>12)impacts.shift();
      }
    }
    function hit(mode,t,x,y,power=1){emit(mode,t,x,y,power,true);}
    function ambient(mode,t,x,y,active){
      if(!active||t<nextAmbient)return;
      nextAmbient=t+(mode==='wok'?.083:.15);
      emit(mode,t,x,y,.62,false);
    }
    function shake(t){
      if(reduced)return [0,0];
      let x=0,y=0;
      for(const p of impacts){
        const age=t-p.t;
        if(age<0||age>.48)continue;
        const strength=(1-age/.48)**2*p.power*unit;
        x+=Math.sin(age*97+1.15)*strength*(p.mode==='serve'?34:26);
        y+=Math.cos(age*83)*strength*(p.mode==='chop'?42:24);
      }
      return [clamp(x,-46*unit,46*unit),clamp(y,-49*unit,49*unit)];
    }
    function shard(p,key,age,x,y){
      const s=p.scale,spin=p.a+p.spin*age;
      ctx.save();ctx.translate(x,y);ctx.rotate(spin);
      if(key==='fridge'){
        polygon([[0,-s*1.5],[s*.7,-s*.25],[s*.26,s],[-s*.62,s*.1]],p.color);
        line([[0,-s*1.5],[-s*.2,s*.1],[s*.26,s]],'#f2feff',Math.max(1,s*.14));
        if(p.kind===0||p.heavy)line([[-s,0],[s,0],[0,0],[0,-s],[0,s]],'#dfffff',1.2);
        if(p.heavy)polygon([[0,-s*1.5],[s*.7,-s*.25],[-s*.2,s*.1]],'#ffffff');
      }else if(key==='neon'){
        const reach=s*(p.kind%2?2.55:1.5),pts=[[-reach,0],[-s,-s*.55],[0,s*.34],[s,-s*.65],[reach,-s*.21]];
        line(pts,p.color,Math.max(1.4,s*.54));line(pts,'#f7ffff',.8*unit);
        if(p.heavy)line([[0,s*.34],[s*.6,s*1.15],[s*1.8,s*.8]],p.color,2*unit);
      }else if(key==='toilet'){
        oval(0,0,s*.72,s,p.color);oval(-s*.22,-s*.35,s*.26,s*.38,'#f7fff5');
        if(p.kind===0){ctx.strokeStyle='#f6fff0';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,s*1.4,s*1.05,0,0,tau);ctx.stroke();}
      }else if(p.kind<2){
        oval(0,0,s*1.15,s*.76,p.color);line([[-s*.73,s*.23],[-s*.12,-s*.35],[s*.65,s*.05]],'#ffdbab',1.1);
      }else{
        polygon([[-s,-s*.3],[s*.22,-s*.72],[s*.81,0],[s*.23,s*.74],[-s*.46,s*.4]],p.color);
        if(p.mode==='wok')line([[-s*.4,s*.32],[s*.15,-s*.5]],'#fff1bb',1.25);
      }
      ctx.restore();
    }
    function shockwave(p,age,key,skin){
      const side=p.x<w/2?1:-1;
      const radius=(20+age*(p.mode==='serve'?278:230))*unit*p.power;
      const centerX=p.x+(p.mode==='serve'?side*radius*.54:0);
      const centerY=p.y-(p.mode==='wok'?radius*.42:0);
      const rings=reduced?3:5;
      for(let i=0;i<rings;i++){
        const r=radius*(1+i*.14), ry=r*(p.mode==='serve'?.21:.38);
        const color=i%2?skin.edge:skin.ink, width=Math.max(1,4-i*.7)*unit;
        if(key==='neon'||key==='fridge'){
          const corners=key==='neon'?16:10;
          const points=Array.from({length:corners+1},(_,n)=>{
            const a=n*tau/corners+age*.4, kink=key==='neon'&&n%2?.85:1;
            return [centerX+Math.cos(a)*r*kink,centerY+Math.sin(a)*ry*kink];
          });
          line(points,color,width);
        }else{
          ctx.strokeStyle=color;ctx.lineWidth=width;
          ctx.beginPath();ctx.ellipse(centerX,centerY,r,ry,0,0,tau);ctx.stroke();
        }
      }
      const streaks=reduced?10:18;
      for(let i=0;i<streaks;i++){
        const a=i*tau/streaks,spread=radius*(.7+i%3*.17),length=(28+i%4*12)*unit;
        if(p.mode==='chop'){
          const x=p.x+Math.cos(a)*spread,y=p.y+Math.sin(a)*spread*.64;
          line([[x,y],[x+Math.cos(a)*length,y+Math.sin(a)*length*.65]],skin.edge,2.7*unit);
        }else if(p.mode==='wok'){
          const drift=(i-(streaks-1)/2)*12*unit,x=p.x+drift,y=p.y-spread*.72;
          line([[x,y],[x+drift*.13,y-length*.75]],skin.ink,2.5*unit);
        }else{
          const x=p.x+side*spread,y=p.y+(i-(streaks-1)/2)*6*unit;
          line([[x,y],[x+side*length,y-(i%3-1)*13*unit]],skin.edge,2.4*unit);
        }
      }
    }
    function paint(t){
      const key=theme(),skin=skins[key],life=reduced?.64:impactLife;
      impacts=impacts.filter(p=>t-p.t<life);
      particles=particles.filter(p=>t-p.t<p.life);
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      for(const p of impacts){
        const age=clamp((t-p.t)/life,0,1);
        ctx.globalAlpha=(1-age)**2*(reduced?.5:.72);
        shockwave(p,age,key,skin);
        if(!reduced&&age>.12){
          const echo=(age-.12)/.88;
          ctx.globalAlpha=Math.min(echo*4,1)*(1-echo)**2*.33;
          shockwave({...p,power:p.power*.74},echo,key,skin);
        }
      }
      for(const p of particles){
        const age=t-p.t;
        if(age<0)continue;
        ctx.globalAlpha=(1-age/p.life)**.64;
        shard(p,key,age,p.x+p.vx*age,p.y+p.vy*age+(p.mode==='wok'?150:275)*unit*age*age);
      }
      ctx.restore();
    }
    function rate(t,label,success){
      const word=success?(String(label).match(/^(EXCELLENT|GOOD|PERFECT)/)?.[0]||'GOOD'):'FAILED';
      grade={t,word,note:success?(String(label).split('·')[1]?.trim()||'工序完成'):String(label).split('·')[0].trim()};
    }
    function paintGrade(t){
      if(!grade)return;
      const age=t-grade.t;
      if(age<0||age>gradeHold)return;
      const p=clamp(age/.4,0,1)-1,k=1+2.35*p*p*p+1.35*p*p;
      const s=reduced?1:.29+.82*k;
      const {word,note}=grade,key=theme(),skin=skins[key];
      const width=word.length>7?462:368, edge=word==='FAILED'?'#f9a69b':skin.edge;
      ctx.save();ctx.globalAlpha=clamp((gradeHold-age)/.23,0,1);
      ctx.translate(w/2,(124-(1-s)*35)*unit);ctx.scale(s*unit,s*unit);ctx.lineJoin='round';
      const panel=[[-width/2+19,-58],[width/2-19,-58],[width/2,-40],[width/2,38],[width/2-18,56],[-width/2+18,56],[-width/2,38],[-width/2,-40]];
      if(!reduced){
        const flare=clamp(age/.36,0,1);
        for(const side of [-1,1])for(let i=0;i<8;i++){
          const x=side*(width/2+25+i%3*18+flare*24), y=-47+i*14;
          polygon([[x-side*24,y+2],[x,y-5],[x+side*(19+i%3*8),y],[x,y+3]],i%3?skin.alloy:edge);
        }
      }
      polygon(panel.map(([x,y])=>[x+5,y+9]),'#090d229b');
      polygon(panel,skin.paper);line([...panel,panel[0]],edge,4);
      line([[-width/2+27,46],[width/2-27,46]],skin.alloy,2);
      for(const side of [-1,1])for(let j=0;j<(reduced?7:11);j++){
        const spread=clamp(age/.32,0,1),x=side*(width/2+14+j%3*14+spread*13),y=-50+j*(reduced?17:10);
        const z=4+j%3*2;
        const color=j%2?edge:skin.alloy;
        if(key==='neon')line([[x-side*z,y+z],[x,y-z],[x+side*z,y],[x+side*z*2,y-z]],color,2);
        else if(key==='toilet')oval(x,y,z*.68,z,color);
        else if(key==='coffee'){
          oval(x,y,z,z*.72,color);
          line([[x-z*.55,y+z*.25],[x,y-z*.26],[x+z*.62,y]],skin.paper,1.4);
        }else polygon([[x-z,y],[x,y-z*1.3],[x+z,y],[x,y+z]],color);
      }
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='900 76px Impact, "Arial Black", sans-serif';
      ctx.lineWidth=9;ctx.strokeStyle='#101122';ctx.strokeText(word,0,-7);
      ctx.lineWidth=3;ctx.strokeStyle=word==='FAILED'?'#a15352':skin.alloy;ctx.strokeText(word,0,-10);
      ctx.fillStyle=skin.ink;ctx.fillText(word,0,-10);
      ctx.font='900 16px "PingFang SC", system-ui, sans-serif';ctx.fillStyle=edge;ctx.fillText(note,0,37);
      ctx.restore();
    }
    function celebrate(t){
      grade=null;victory=t;
    }
    function paintCelebration(t){
      if(victory===null)return;
      const age=t-victory;
      if(age<0||age>winHold)return;
      const key=theme(),skin=skins[key];
      const fade=clamp((winHold-age)/.28,0,1);
      ctx.save();
      ctx.globalAlpha=.66*fade;
      ctx.fillStyle=skin.paper;ctx.fillRect(0,0,w,h);
      if(!reduced){
        const bursts=[[.15,.25,0],[.83,.59,.18],[.29,.79,.61],[.77,.18,1.02],[.74,.79,1.47],[.18,.62,1.73]];
        bursts.forEach(([px,py,delay],index)=>{
          const life=(age-delay)/.93;
          if(life<0||life>=1)return;
          const x=w*px,y=h*py,sweep=1-(1-life)**2;
          ctx.globalAlpha=(1-life)*fade;
          for(let i=0;i<35;i++){
            const a=i*tau/35+index*.32,r=(50+(i*29)%131)*unit*sweep;
            const vx=Math.cos(a),vy=Math.sin(a);
            if(i%4===0)line([[x+vx*r*.73,y+vy*r*.73],[x+vx*r,y+vy*r]],skin.edge,2.6*unit);
            const p={scale:(3+i%5)*unit,a,spin:5,mode:'wok',color:skin.colors[i%4],kind:i%5,heavy:i%7===0};
            shard(p,key,life,x+vx*r,y+vy*r+life*life*105*unit);
          }
        });
      }
      const entrance=clamp(age/.42,0,1);
      const scale=reduced?1:.32+.68*(1-(1-entrance)**2)+Math.sin(entrance*Math.PI)*.15;
      ctx.globalAlpha=fade;ctx.translate(w/2,h*.49);ctx.scale(scale*unit,scale*unit);
      const plaque=[[-274,-75],[274,-75],[302,-47],[302,52],[278,75],[-278,75],[-302,52],[-302,-47]];
      const rim=[...plaque,plaque[0]];
      polygon(plaque.map(([x,y])=>[x+9,y+12]),'#08091ec9');
      polygon(plaque,skin.paper);
      line(rim,skin.alloy,14);line(rim,skin.edge,5);
      for(const side of [-1,1]){
        for(let j=0;j<4;j++){
          const x=side*(221+j*16),y=54-j*4;
          polygon([[x-3,y-3],[x+3,y-3],[x+3,y+3],[x-3,y+3]],j%2?skin.edge:skin.alloy);
        }
      }
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
      ctx.font='900 82px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
      ctx.strokeStyle=skin.alloy;ctx.lineWidth=10;ctx.strokeText('大成功！！！',0,-8);
      ctx.fillStyle=skin.ink;ctx.fillText('大成功！！！',0,-8);
      ctx.font='900 19px Impact, "Arial Black", sans-serif';
      ctx.fillStyle=skin.edge;ctx.fillText('ORDER COMPLETE',0,48);
      ctx.restore();
    }
    function reset(){particles=[];impacts=[];grade=null;victory=null;nextAmbient=0;}
    return {hit,ambient,shake,paint,rate,paintGrade,celebrate,paintCelebration,reset,hold:gradeHold,winHold};
  }
  root.KitchenStageFx={create};
})(window);
