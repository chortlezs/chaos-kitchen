/* One cookware silhouette for every kitchen, at every display scale. */
(function(root){
  const palettes={
    neon:{edge:'#10143c',body:'#4339a0',rim:'#73e8ff',inside:'#26234f',shine:'#e4ffff',handle:'#343079',accent:'#ff69d3'},
    fridge:{edge:'#193356',body:'#5487b3',rim:'#b9efff',inside:'#263c60',shine:'#f2feff',handle:'#34669d',accent:'#8cddf5'},
    toilet:{edge:'#315568',body:'#83b9b7',rim:'#fff7df',inside:'#416b76',shine:'#ffffff',handle:'#aa7652',accent:'#eccb7b'},
    coffee:{edge:'#42291e',body:'#ac7548',rim:'#edbf7c',inside:'#563c2c',shine:'#fff0c7',handle:'#805035',accent:'#e2a35d'}
  };
  function draw(g,x,y,scale=1,theme='neon'){
    const p=palettes[theme]||palettes.neon;
    const oval=(x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
    const box=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
    g.save();g.translate(x,y);g.scale(scale,scale);
    // The grip points toward the player at the lower edge of the screen.
    oval(0,23,168,66,p.edge);oval(0,15,162,65,p.body);
    oval(0,-6,168,62,p.rim);oval(0,-7,157,53,p.edge);oval(0,-5,150,47,p.inside);
    // The recessed cooking surface, brushed rim and front bevel remain readable in close-up.
    for(const [rx,ry,color] of [[143,42,p.body],[110,31,p.edge],[78,22,p.body]]){
      g.strokeStyle=color;g.lineWidth=1.6;g.beginPath();g.ellipse(0,-5,rx,ry,0,0,Math.PI*2);g.stroke();
    }
    for(let i=0;i<21;i++){
      const a=i*Math.PI/20,x=Math.cos(a)*154,y=-8+Math.sin(a)*52;
      box(x-2,y-1,4,i%4===0?3:1,i%4===0?p.shine:p.accent);
    }
    g.strokeStyle=p.shine;g.lineWidth=3;g.beginPath();g.ellipse(0,-7,161,56,0,Math.PI*1.12,Math.PI*1.66);g.stroke();
    g.strokeStyle=p.rim;g.lineWidth=2;g.beginPath();
    g.ellipse(0,20,162,61,0,Math.PI*.15,Math.PI*.76);g.stroke();
    for(const side of [-1,1]){
      box(side*106-13,51,26,8,p.edge);box(side*106-11,52,22,4,p.body);
      box(side*106-9,52,5,1,p.shine);box(side*106+5,55,4,2,p.accent);
    }
    if(theme==='fridge')for(let i=0;i<5;i++){const xx=-110+i*49;box(xx,43,4,9+i%2*4,p.accent);box(xx-3,44,10,2,p.shine);}
    if(theme==='neon'){box(-58,61,116,3,p.accent);}
    if(theme==='toilet'){box(-65,53,130,3,p.shine);}
    if(theme==='coffee'){for(let i=0;i<3;i++)box(-40+i*34,55,5,3,p.accent);}
    // Front mounting plate, two rivets and a foreshortened straight grip.
    box(-21,46,42,18,p.edge);box(-16,48,32,12,p.rim);
    oval(-9,53,3,3,p.edge);oval(9,53,3,3,p.edge);
    box(-17,59,34,39,p.edge);box(-12,61,24,32,p.handle);
    box(-9,64,5,23,p.accent);box(-8,87,16,5,p.edge);
    for(let i=0;i<4;i++)box(-1,66+i*5,10,2,p.edge);
    box(-7,90,14,2,p.shine);
    g.restore();
  }
  function board(g,x,y,s=1,theme='neon'){
    const p=palettes[theme]||palettes.neon;
    const shape=[[-280,-110],[260,-110],[280,-90],[280,90],[260,110],[-260,110],[-280,90],[-280,-90]];
    const fill=(points,c)=>{g.fillStyle=c;g.beginPath();points.forEach(([a,b],i)=>i?g.lineTo(a,b):g.moveTo(a,b));g.closePath();g.fill();};
    g.save();g.translate(x,y);g.scale(s,s);
    fill(shape.map(([a,b])=>[a,b+14]),p.edge);fill(shape,p.rim);
    fill([[-264,-94],[248,-94],[264,-78],[264,78],[248,94],[-248,94],[-264,78],[-264,-78]],theme==='toilet'?'#e7cb96':theme==='coffee'?'#c28a52':theme==='fridge'?'#9bcad9':'#8b7ac5');
    for(let i=0;i<7;i++){g.fillStyle=p.shine;g.globalAlpha=.18;g.fillRect(-225,-72+i*24,430-(i%3)*22,2);}g.globalAlpha=1;
    g.strokeStyle=p.edge;g.lineWidth=2;g.beginPath();
    [[-245,-76],[238,-76],[247,-66],[247,67],[236,77],[-236,77],[-247,66],[-247,-66]]
      .forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
    g.closePath();g.stroke();
    g.fillStyle=p.edge;g.fillRect(215,-77,24,9);
    g.fillStyle=p.shine;g.fillRect(-242,-84,95,3);
    for(let i=0;i<13;i++){
      const x=-225+i*15;
      g.fillStyle=i%3===0?p.shine:p.accent;g.fillRect(x,86,2,i%3===0?9:4);
    }
    for(const x of [-251,248])for(const y of [-88,85]){
      g.fillStyle=p.edge;g.fillRect(x,y,7,7);
      g.fillStyle=p.shine;g.fillRect(x+1,y+1,4,1);
    }
    if(theme==='fridge')for(let i=0;i<6;i++){g.fillStyle=p.shine;g.fillRect(-190+i*71,97,4,13+i%2*5);}
    if(theme==='neon'){g.fillStyle=p.accent;g.fillRect(-55,103,110,3);}
    g.restore();
  }
  root.KitchenCookware={draw,board,palettes};
})(window);
