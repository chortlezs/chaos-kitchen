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
    // Straight right-side handle and deep, elliptical bowl share identical dimensions.
    box(137,-17,126,31,p.edge);box(148,-11,108,19,p.handle);box(160,-9,77,4,p.accent);box(246,-6,6,9,p.edge);
    oval(0,23,168,66,p.edge);oval(0,15,162,65,p.body);
    oval(0,-6,168,62,p.rim);oval(0,-7,157,53,p.edge);oval(0,-5,150,47,p.inside);
    g.strokeStyle=p.shine;g.lineWidth=3;g.beginPath();g.ellipse(0,-7,161,56,0,Math.PI*1.12,Math.PI*1.66);g.stroke();
    for(const xx of [127,140]){oval(xx,-7,3,3,p.rim);}
    if(theme==='fridge')for(let i=0;i<5;i++){const xx=-110+i*49;box(xx,43,4,9+i%2*4,p.accent);box(xx-3,44,10,2,p.shine);}
    if(theme==='neon'){box(-58,61,116,3,p.accent);for(let i=0;i<4;i++)box(176+i*15,-1,7,3,p.shine);}
    if(theme==='toilet'){box(-65,53,130,3,p.shine);}
    if(theme==='coffee'){for(let i=0;i<3;i++)box(-40+i*34,55,5,3,p.accent);}
    g.restore();
  }
  root.KitchenCookware={draw,palettes};
})(window);
