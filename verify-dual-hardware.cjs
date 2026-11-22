/* Full semantic hand + foot input through the actual main/iframe game logic. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const noop=()=>{},elements=new Map(),streams=[],events=new Map();
let wall=0,sequence=0,child=null;
const base=Date.now();
class Clock extends Date{static now(){return base+wall;}}
const drawing=new Proxy({},{get:()=>noop,set:()=>true});
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',hidden:false,src:'about:blank',textContent:'',innerHTML:'',
    classList:{toggle:noop},append:noop,replaceChildren:noop,focus:noop});
  return elements.get(id);
}
class EventSource{
  constructor(url){this.url=url;streams.push(this);}close(){this.closed=true;}
  send(p){this.onmessage({data:JSON.stringify(p)});}
}
const canvas={getContext:()=>drawing,addEventListener:noop,focus:noop};
const document={hidden:false,body:{classList:{toggle:noop}},querySelector:s=>s==='#game'?canvas:element(s),
  querySelectorAll:()=>[],getElementById:element,createElement:()=>({})};
const window={location:{search:'?scene=toilet&esp=1&foot=1',origin:'http://localhost',protocol:'http:'},
  performance:{now:()=>wall},EventSource,addEventListener:(name,fn)=>{
    if(!events.has(name))events.set(name,[]);events.get(name).push(fn);
  }};
const sandbox={window,document,URLSearchParams,Math,console,Date:Clock,requestAnimationFrame:noop};vm.createContext(sandbox);
for(const file of ['hardware-chop.js','foot-input.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
const main=fs.readFileSync('neon-chaos-kitchen.html','utf8').replace(/\r\n/g,'\n').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.game={state,start,selectScene,input,toggleMenu,advance};\n})();');
vm.runInContext(main,sandbox);const game=sandbox.game;
const hand=streams.find(s=>s.url.includes('8766')),foot=streams.find(s=>s.url.includes('8768'));
assert(hand&&foot,'one hand stream and one foot stream');
const link=connected=>foot.send({type:'link',transport:'xiao-ble',connected});link(true);
function motion(extra){hand.send({type:'motion',t_ms:Math.round(wall),event_id:'h'+(++sequence),sent_at_ms:Clock.now(),...extra});}
function run(extra={}){foot.send({type:'motion',source:'xiao-foot',action:'run',cycle:'single_foot',cycles:1,
  event_id:'f'+(++sequence),t_ms:Math.round(wall),sent_at_ms:Clock.now(),...extra});}
function tick(seconds=.04){for(let t=0;t<seconds-.0001;t+=.04){wall+=40;game.advance(.04);if(child)child.tick(.04);}}
function until(predicate,message,limit=60){
  for(let n=0;!predicate()&&n<limit/.04;n++){
    if(n%17===0)run();tick();
    assert(!game.state.toiletDrain&&!game.state.coffeeDrain,'fixed route stays out of map hazards');
  }
  assert(predicate(),message+': '+JSON.stringify({scene:game.state.scene,view:game.state.view,open:game.state.open,player:game.state.player}));
}
function completePhase(mode){
  assert.equal(game.state.view,mode);
  if(mode==='chop')for(let i=0;i<10;i++){motion({action:'chop',cycle:'down_up'});tick(.2);}
  if(mode==='wok')for(let n=0;n<1200&&!game.state.phase.done;n++){
    motion({action:'wok',motion:'circle',active:true});
    if(game.state.phase.flipWindow>0)motion({action:'flip',motion:'vertical'});
    tick(.04);
  }
  if(mode==='serve'){
    game.input('e',true);
    for(let n=0;n<450&&!game.state.phase.done;n++){
      const p=game.state.phase;
      motion({action:'plate',motion:'tilt',roll:Math.max(-1,Math.min(1,-p.tilt*1.5-p.vel*.6))});tick(.04);
    }
    game.input('e',false);
  }
  assert.equal(game.state.phase.done?.success,true,'hardware completes '+mode);
  tick(3);
}
for(const scene of ['neon','toilet','coffee'])for(let id=0;id<6;id++){
  game.state.open='menu';game.selectScene(scene);element('dish-select').value=String(id);game.start();
  for(const mode of ['chop','wok','serve']){
    until(()=>game.state.view===mode,scene+' '+id+' reaches '+mode);
    const old=game.state.footCycles;run();assert.equal(game.state.footCycles,old,'foot motion cannot advance during cooking');
    completePhase(mode);
  }
  assert.equal(game.state.served,1);assert.equal(game.state.open,'end');
}
console.log('PASS: all 18 classic scene/food combinations finish using foot routes and real hand-input callbacks.');

// Connect actual child script and parent postMessage handlers without a second SSE.
const iframe=element('frost-experience');
function loadChild(id){
  const childElements=new Map(),handlers=[];
  const el=name=>{
    if(!childElements.has(name))childElements.set(name,{hidden:false,textContent:'',children:[],className:'',
      append:noop,prepend:noop,replaceChildren:noop,addEventListener:noop,focus:noop,classList:{toggle:noop}});
    return childElements.get(name);
  };
  const parentProxy={postMessage:data=>{for(const fn of events.get('message')||[])fn({source:iframe.contentWindow,origin:'http://localhost',data});}};
  iframe.contentWindow={postMessage:data=>{for(const fn of handlers)fn({source:parentProxy,origin:'http://localhost',data});}};
  const childCanvas={getContext:()=>drawing,addEventListener:noop,focus:noop};
  const cw={location:{search:`?autostart=1&level=${id}&foot=1`,origin:'http://localhost',protocol:'http:'},
    parent:parentProxy,frameElement:iframe,addEventListener:(name,fn)=>{if(name==='message')handlers.push(fn);}};
  const cd={hidden:false,querySelector:()=>childCanvas,getElementById:el,addEventListener:noop,
    createElement:()=>({getContext:()=>drawing,addEventListener:noop})};
  const box={window:cw,document:cd,URLSearchParams,Math,console,Date:Clock,requestAnimationFrame:noop,
    Image:class{constructor(){this.complete=false;}}};vm.createContext(box);
  vm.runInContext(fs.readFileSync('foot-input.js','utf8'),box);
  const source=fs.readFileSync('frost-kitchen.html','utf8').replace(/\r\n/g,'\n').match(/<script>([\s\S]*?)<\/script>/)[1]
    +'\nglobalThis.game={tick,input,pause,get state(){return {scene,overlay,step,player,runBudget,footCycles,result}}};';
  vm.runInContext(source,box);
  box.game.deliverFoot=(packet,origin='http://localhost',source=parentProxy)=>{
    for(const fn of handlers)fn({source,origin,data:{type:'kitchen-foot-relay',packet}});
  };
  return box.game;
}
for(let id=0;id<6;id++){
  game.state.open='menu';game.selectScene('fridge');element('dish-select').value=String(id);game.start();
  assert.match(iframe.src,/foot=1/);child=loadChild(id);
  const initial={...child.state.player};tick(.4);assert.deepEqual({...child.state.player},initial,'fridge cannot move without running');
  child.input('d');tick(.4);assert.deepEqual({...child.state.player},initial,'fridge ignores direction keys in running mode');
  const forged={type:'motion',source:'xiao-foot',action:'run',cycle:'single_foot',cycles:2,event_id:'untrusted:'+id,t_ms:wall,sent_at_ms:Clock.now()};
  child.deliverFoot(forged,'http://untrusted');child.deliverFoot(forged,'http://localhost',{});
  assert.equal(child.state.footCycles,0,'iframe rejects wrong origin and wrong parent source');
  child.pause();run();tick(.4);assert.deepEqual({...child.state.player},initial,'paused fridge ignores running');child.pause();
  iframe.hidden=true;run();iframe.hidden=false;assert.equal(child.state.footCycles,0,'hidden iframe ignores running');
  run();link(false);const disconnected={...child.state.player};tick(.4);
  assert.deepEqual({...child.state.player},disconnected,'relayed disconnect clears fridge credit');link(true);
  for(const mode of ['chop','wok','serve']){
    until(()=>game.state.frostRound&&game.state.view===mode,'fridge '+id+' reaches shared '+mode,75);
    assert(iframe.hidden,'map hidden during shared hand-control phase');
    completePhase(mode);
  }
  assert.equal(child.state.result?.ok,true,'fridge food '+id+' served');child=null;
}
assert.equal(streams.length,2,'all four scenes reuse exactly two hardware streams');
console.log('PASS: all six fridge orders use relayed running, shared hardware minigames, pause boundaries and reconnect release, with no duplicate hardware streams.');
