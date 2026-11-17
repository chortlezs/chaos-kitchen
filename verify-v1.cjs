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
  'globalThis.test={state,selectScene,start,phase,map,drawChop,drawWok,drawServe,balance,activeStations,dishes:()=>dishes,keys};\n})();');
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
console.log('PASS: V1 toilet orders, stations, three close-ups, E-to-advance and original neon scene.');
