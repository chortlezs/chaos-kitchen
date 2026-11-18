const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{};
const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',classList:{toggle:noop},append:noop,replaceChildren:noop});
  return elements.get(id);
}
const context=new Proxy({}, {get:()=>noop,set:()=>true});
const canvas={getContext:()=>context,addEventListener:noop};
const document={
  body:{classList:{toggle:noop}},
  querySelector:s=>s==='#game'?canvas:element(s),
  querySelectorAll:()=>[],
  getElementById:element,
  createElement:()=>({value:'',textContent:''})
};
const window={location:{search:'?scene=toilet'},addEventListener:noop};
const sandbox={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};
const html=fs.readFileSync('neon-chaos-kitchen.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.test={state,selectScene,start,phase,map,drawChop,drawWok,drawServe,balance,returnFromPhase,activeStations,valid,routeTo,walk,inReach,dishes:()=>dishes,keys};\n})();');
vm.runInNewContext(script,sandbox);
const g=sandbox.test;
assert.equal(g.state.scene,'toilet');
assert.equal(g.dishes().length,6);
assert.equal(g.activeStations().length,10);
g.start();assert.equal(g.state.queue.length,3);
assert(g.state.queue.every(o=>o.id<6));
g.map(0);
for(const mode of ['chop','wok','serve']){
  g.phase(mode,0);
  ({chop:g.drawChop,wok:g.drawWok,serve:g.drawServe})[mode](1);
}
g.keys.add('e');g.balance(.1);assert(g.state.phase.route>0,'E advances the plate route');
g.selectScene('neon');assert.equal(g.dishes().length,6,'scene cannot switch during active play');
g.state.open='menu';g.selectScene('neon');assert.equal(g.dishes().length,6);
assert.equal(g.activeStations().length,10);g.start();g.map(0);
g.state.open='menu';g.selectScene('fridge');assert.equal(g.state.scene,'fridge');assert.equal(g.dishes().length,6);g.map(0);
g.state.open='menu';g.selectScene('coffee');assert.equal(g.state.scene,'coffee');assert.equal(g.dishes().length,6);g.map(0);
assert(g.valid(g.state.player.x,g.state.player.y),'coffee spawn is walkable');
const coffeeStops=g.activeStations();
for(const stop of coffeeStops){
  const route=g.routeTo(stop);
  assert(route.length||g.inReach(stop),'coffee station reachable: '+stop.type+' '+stop.dish);
  for(const point of route){
    assert(g.valid(point.x,point.y),'route waypoint is walkable');
    // Follow every segment using the same small movement increments as the game.
    for(let n=0;n<100&&Math.hypot(point.x-g.state.player.x,point.y-g.state.player.y)>.05;n++){
      const dx=point.x-g.state.player.x,dy=point.y-g.state.player.y,len=Math.hypot(dx,dy),step=Math.min(2,len);
      g.walk(dx/len*step,dy/len*step);
    }
    assert(Math.hypot(point.x-g.state.player.x,point.y-g.state.player.y)<.1,'route can actually be walked: '+JSON.stringify({stop,point,player:g.state.player}));
  }
  assert(g.inReach(stop),'station can be interacted with after walking');
}
assert(!g.valid(480,210),'grinder area cannot be entered');
for(let id=0;id<6;id++){
  element('dish-select').value=String(id);g.start();
  assert.equal(g.state.queue.length,1,'coffee level has exactly one meal');
  assert.equal(g.state.queue[0].id,id,'selected food is the only order');
  const sources=g.activeStations().filter(o=>o.type==='bin');assert.equal(sources.length,1,'one ingredient pickup per level');assert.equal(sources[0].dish,id,'pickup matches selected food');
  assert(g.routeTo(sources[0]).length,'selected ingredient pickup is reachable');
  for(const mode of ['chop','wok','serve']){g.phase(mode,id);assert.equal(g.state.phase.id,id);({chop:g.drawChop,wok:g.drawWok,serve:g.drawServe})[mode](1);}
  g.phase('serve',id);g.state.phase.done={success:true,label:'完成'};
  g.returnFromPhase();
  assert.equal(g.state.served,1);assert.equal(g.state.open,'end','one meal completes the level');
}
console.log('PASS: all six coffee levels finish after their selected single meal.');
element('dish-select').value='auto';element('office-event').value='今天又被老板催了';g.start();assert.equal(g.state.queue[0].id,1,'event matches boss');
element('dish-select').value='4';g.start();assert.equal(g.state.queue[0].id,4,'manual choice overrides event');
g.state.open='menu';g.selectScene('fridge');assert(element('frost-experience').hidden,'selecting fridge stays in shared menu');
element('dish-select').value='3';g.start();assert.equal(element('frost-experience').src,'frost-kitchen.html?level=3&autostart=1');
console.log('PASS: coffee pickup and four workstations reachable through actual walking.');
console.log('PASS: one-page office, fridge, toilet and coffee scenes; six foods; close-ups and E-to-advance.');
