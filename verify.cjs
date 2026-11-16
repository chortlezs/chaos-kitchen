const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{},nodes=new Map();
const node=s=>{if(!nodes.has(s))nodes.set(s,{textContent:'',innerHTML:'',hidden:false,classList:{add:noop,remove:noop,toggle:noop},focus:noop,addEventListener:noop,getContext:()=>new Proxy({},{get:()=>noop})});return nodes.get(s)};
const sandbox={document:{querySelector:node,querySelectorAll:()=>[]},window:{addEventListener:noop},requestAnimationFrame:noop,console,Math};
vm.runInNewContext(fs.readFileSync('dist/challenges.js','utf8'),sandbox);
const source=fs.readFileSync('dist/game.js','utf8').replace('reset();requestAnimationFrame(tick);','reset();globalThis.test={begin,update,grab,navigate,draw,valid,get challenge(){return challenge},get player(){return player},get stations(){return stations},get score(){return score},get served(){return served},get state(){return state},get orders(){return orders},get time(){return time},keys:()=>keys};');
vm.runInNewContext(source,sandbox);const g=sandbox.test;
const advance=s=>{for(let i=0;i<s*60;i++)g.update(1/60)},go=(id,s=5)=>{g.navigate(g.stations.find(s=>s.id===id));advance(s);};
g.begin();advance(.1);assert.equal(node('#time').textContent,'03:00');
go('tomato',3);assert.equal(g.player.held.state,'raw');go('chop',4);assert.equal(g.challenge.mode,'chop');g.draw();g.keys().e=true;advance(3);assert.equal(g.challenge.mode,null);assert.equal(g.stations.find(s=>s.id==='chop').item.state,'chopped');
go('chop',.3);go('stove',4);assert.equal(g.challenge.mode,'cook');g.draw();
for(let j=0;j<200&&g.challenge.mode==='cook';j++){g.keys().e=true;if(g.challenge.data.window>0)g.challenge.flip();advance(.1);}
assert.equal(g.challenge.mode,null);assert.equal(g.stations.find(s=>s.id==='stove').item.state,'cooked','timed flips and gentle stirring finish cooking');
go('stove',.3);go('plates',4);assert.equal(g.challenge.mode,'carry');g.draw();
for(let j=0;j<1500&&g.challenge.mode==='carry';j++){const d=g.challenge.data,k=g.keys();k.e=true;k.a=d.tilt>.02||d.velocity>.08;k.d=d.tilt<-.12;advance(1/60);}
assert.equal(g.challenge.mode,null);assert.equal(g.served,1,'active balance completes the route and serves');assert(g.score>=100);assert.equal(g.orders.length,3);assert.equal(g.player.held,null);
g.begin();let stove=g.stations.find(s=>s.type==='stove');stove.item={food:'tomato',state:'chopped',progress:0,heat:0};g.challenge.start('cook',stove.item);g.keys().e=true;advance(25);assert.equal(stove.item.state,'burnt','missed flip windows burn the dish');
g.begin();stove.item={food:'potato',state:'chopped',progress:0,heat:0};g.challenge.start('cook',stove.item);g.challenge.flip();assert.equal(g.challenge.data.scorch,12);assert.equal(g.challenge.data.flips,0);
g.begin();g.player.held={food:'tomato',state:'plated'};g.challenge.start('carry',g.player.held);g.keys().e=true;advance(35);assert.equal(g.player.held,null);assert.equal(g.served,0);assert.equal(g.challenge.mode,null);
g.begin();go('potato',3);go('stove',5);assert.equal(g.player.held.state,'raw');assert.equal(g.challenge.mode,null);advance(180);assert.equal(g.state,'ended');assert.equal(g.time,0);assert.equal(g.valid(500,350),false);
console.log('PASS: complete meal with two timed flips + active balancing; closeup draws; unattended flips burn; early flips penalized; unbalanced carry spills; raw food rejected; order queue; collision; shift end.');
