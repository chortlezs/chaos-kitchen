(function(root){
  const palettes={
    neon:[
      ['#a9128b','#6d1269','#fc42bd','#24efff','#fcf0ff'],
      ['#f5964f','#ff31b5','#ffc276','#26efff','#fff2cf'],
      ['#0edff0','#128cbf','#81f8ff','#f8f55c','#eafffc'],
      ['#aa18d8','#630ab3','#f13ada','#23e8ff','#eaffff'],
      ['#14536c','#102c52','#259db2','#28f4fc','#dcffff'],
      ['#197cd6','#05408b','#67deff','#22ecff','#e8fcff']
    ],
    toilet:[
      ['#e64e88','#9c2656','#ff9bc7','#ffc6dc','#fff0f5'],
      ['#f29f6b','#a54b29','#ffbf8f','#713729','#fff8e5'],
      ['#edc044','#ab7c1c','#ffe980','#fff4b0','#fff9d9'],
      ['#b96aeb','#73339e','#e5a7ff','#eac8ff','#faf0ff'],
      ['#108467','#085940','#42c9ac','#6cf2d1','#e3fff3'],
      ['#298ba9','#0b526f','#72c5e3','#99e6f6','#effcff']
    ],
    coffee:[
      ['#d06a61','#902950','#fc9baa','#fdc6dd','#ecf3ff'],
      ['#ffac5a','#93244e','#ffcf82','#8b376a','#fff3d9'],
      ['#eaa32b','#aa681e','#ffd96b','#fff09b','#fff1d7'],
      ['#a575d2','#5b3b96','#cea7ec','#d7ebff','#faf6ff'],
      ['#198478','#0d4d62','#49bdb1','#7bf8cc','#e4fff5'],
      ['#3a83c2','#1e4a8f','#8ccafb','#a0e0f5','#ecf9ff']
    ],
    fridge:[
      ['#27b4df','#145775','#8feafc','#b6fbff','#edfaff'],
      ['#73baff','#1763a3','#adddff','#1783ca','#f0fbff'],
      ['#2dc5df','#157f9e','#9eedfc','#b6f8ff','#edffff'],
      ['#7d8df2','#484ec3','#bac6ff','#d1dcff','#f3f7ff'],
      ['#188f83','#126063','#57cdc6','#80f3e6','#e7fffb'],
      ['#4b99ea','#265cb6','#9fd1ff','#bdeaff','#f3fbff']
    ]
  };
  // Plane coordinates are shared by the assembled object and its three cut pieces.
  const keys=[];
  for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    keys.push([-21+col*5.8,-8+row*6,4,4,(row+col)%3===1?'light':'paper']);
  }
  const designs=[
    [
      [[-26,-14,47,13,'base'],[-23,-17,40,4,'light'],[-25,-13,44,2,'accent'],[17,-13,8,15,'shade'],[18,-11,5,10,'base']],
      [[-18,1,36,6,'accent'],[-17,1,33,1,'paper'],[12,3,5,3,'light']],
      [[-22,8,48,10,'shade'],[-20,8,43,2,'light'],[-18,12,37,3,'base']]
    ],
    [
      [[-16,-20,32,5,'accent'],[-19,-15,38,8,'accent'],[-14,-17,26,2,'shade'],[13,-14,4,6,'shade']],
      [[-15,-6,30,21,'base'],[-19,-5,5,13,'base'],[14,-5,5,13,'base'],[-13,-6,25,3,'light'],[-11,-3,5,5,'ink'],[6,-3,5,5,'ink'],[-14,5,6,3,'light'],[9,5,5,3,'light']],
      [[-10,6,21,10,'shade'],[-9,6,17,3,'paper'],[-7,12,14,2,'accent']]
    ],
    [
      [[-25,-16,19,10,'base'],[-25,-10,49,27,'shade'],[-22,-14,13,5,'accent'],[-22,-8,42,21,'base']],
      [[-21,-8,42,10,'paper'],[-19,-8,38,3,'light'],[-17,-4,35,1,'accent']],
      [[-22,-1,46,17,'base'],[-20,1,42,3,'light'],[-18,5,37,2,'accent'],[9,9,11,4,'paper'],[-21,14,43,2,'shade']]
    ],
    [
      [[-17,-18,35,13,'paper'],[-14,-16,30,3,'light'],[-12,-13,23,1,'accent']],
      [[-27,-7,54,22,'base'],[-24,-5,48,3,'light'],[-22,-1,43,2,'accent'],[-16,4,32,5,'shade'],[16,-3,7,3,'accent'],[18,-4,3,1,'paper']],
      [[-15,8,31,9,'paper'],[-12,12,24,3,'light'],[-18,16,36,2,'shade']]
    ],
    [
      keys,
      [[-20,-8,41,13,'shade'],[-17,-6,34,10,'base'],[-15,-4,7,3,'accent'],[8,-2,7,4,'light'],[-9,2,19,1,'light']],
      [[-27,-13,54,28,'shade'],[-25,-11,50,24,'base'],[-24,-10,48,2,'accent'],[-23,8,46,4,'shade'],[-18,6,38,4,'accent'],[-17,6,36,1,'paper']]
    ],
    [
      [[-26,-14,53,22,'base'],[-23,-11,47,15,'paper'],[-21,-10,44,3,'light'],[14,-4,7,4,'accent'],[15,-4,4,1,'light']],
      [[-24,2,48,6,'light'],[-22,3,44,2,'accent'],[-18,6,35,2,'shade']],
      [[-24,9,48,6,'shade'],[-20,9,40,2,'base'],[-18,11,36,2,'accent'],[-20,15,41,1,'base']]
    ]
  ];
  const order=[[2,1,0],[1,0,2],[0,1,2],[0,1,2],[2,1,0],[0,1,2]];
  const partBounds=designs.map(parts=>parts.map(boxes=>{
    const left=Math.min(...boxes.map(b=>b[0])),right=Math.max(...boxes.map(b=>b[0]+b[2]));
    const top=Math.min(...boxes.map(b=>b[1])),bottom=Math.max(...boxes.map(b=>b[1]+b[3]));
    return [(left+right)/2,(top+bottom)/2];
  }));
  function decorate(ctx,theme,box){
    if(theme==='coffee'){
      for(const [x,y,angle,s] of [[-24,-21,-.5,.84],[1,-23,.27,.72],[25,-10,-.22,.68]]){
        ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(s,s);
        box(-7,-3,14,6,'#3f231e');box(-5,-4,10,8,'#814531');
        box(-4,0,8,1,'#f4b774');box(-4,-2,3,1,'#b97045');
        ctx.restore();
      }
    }else if(theme==='neon'){
      for(const [x,y,flip] of [[-32,-12,1],[30,-7,-1],[-32,11,-1],[30,13,1]]){
        for(let i=0;i<5;i++){
          box(x+i,y+i*flip,2,1,'#16efff');box(x+i+1,y+i*flip+2,1,1,'#ff39d1');
        }
      }
    }else{
      for(let i=0;i<3;i++){
        const x=-17+i*17,y=-23+(i%2)*2;
        if(theme==='fridge'){
          box(x-2,y,5,1,'#a1f5ff');box(x,y-2,1,5,'#a1f5ff');box(x,y,1,1,'#efffff');
        }else{
          box(x-1,y-1,3,4,'#8aebd3');box(x-2,y+1,5,2,'#aef3df');box(x,y,1,1,'#effffc');
        }
      }
      if(theme==='toilet'){
        box(-16,18,33,2,'#65d5bd');box(-9,20,18,2,'#95e5d5');box(-2,22,4,2,'#87ddce');box(0,23,1,2,'#9ce6d8');
      }
    }
  }
  function draw(ctx,theme,id,x,y,scale=1,part=null){
    const selected=designs[id],swatch=palettes[theme]?.[id];
    if(!selected||!swatch)return;
    const [base,shade,light,accent,paper]=swatch;
    const colors={base,shade,light,accent,paper,ink:'#15132e'};
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    if(part!==null){
      const [cx,cy]=partBounds[id][part];
      ctx.translate(-cx,-cy);
    }
    const box=(x,y,w,h,color)=>{
      ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));
    };
    for(const index of part===null?order[id]:[part]){
      const boxes=selected[index];
      for(const [u,v,w,h,key] of boxes)if(key!=='ink')box(u-1.9,v-1.9,w+3.8,h+3.8,colors.ink);
      for(const [u,v,w,h,key] of boxes)box(u,v,w,h,colors[key]);
    }
    if(id===1&&theme==='neon'&&(part===null||part===1)){
      box(-14,-5,28,6,'#281a64');box(-13,-4,25,1,'#26efff');
      box(-12,-2,5,2,'#fa37cf');box(-4,-2,4,2,'#e8ffff');box(3,-2,7,2,'#f533c2');
    }
    if(part===null)decorate(ctx,theme,box);
    ctx.restore();
  }
  root.KitchenItems={draw};
})(window);
