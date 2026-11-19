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
    g.strokeStyle=p.shine;g.lineWidth=3;g.beginPath();g.ellipse(0,-7,161,56,0,Math.PI*1.12,Math.PI*1.66);g.stroke();
    if(theme==='fridge')for(let i=0;i<5;i++){const xx=-110+i*49;box(xx,43,4,9+i%2*4,p.accent);box(xx-3,44,10,2,p.shine);}
    if(theme==='neon'){box(-58,61,116,3,p.accent);}
    if(theme==='toilet'){box(-65,53,130,3,p.shine);}
    if(theme==='coffee'){for(let i=0;i<3;i++)box(-40+i*34,55,5,3,p.accent);}
    // Front mounting plate, two rivets and a foreshortened straight grip.
    box(-21,46,42,18,p.edge);box(-16,48,32,12,p.rim);
    oval(-9,53,3,3,p.edge);oval(9,53,3,3,p.edge);
    box(-17,59,34,39,p.edge);box(-12,61,24,32,p.handle);
    box(-9,64,5,23,p.accent);box(-8,87,16,5,p.edge);
    g.restore();
  }
  root.KitchenCookware={draw,palettes};
})(window);
