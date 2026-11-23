const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{},elements=new Map(),streams=[];
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',src:'about:blank',hidden:false,textContent:'',innerHTML:'',
    classList:{toggle:noop},append:noop,replaceChildren:noop});
  return elements.get(id);
}
class EventSource{constructor(url){this.url=url;streams.push(this);}close(){this.closed=true;}
  send(p){this.onmessage({data:JSON.stringify(p)});}}
const context=new Proxy({}, {get:()=>noop,set:()=>true});
const document={hidden:false,body:{classList:{toggle:noop}},querySelector:s=>s==='#game'?{getContext:()=>context,addEventListener:noop}:element(s),
  querySelectorAll:()=>[],getElementById:element,createElement:()=>({})};
const window={location:{search:'?scene=toilet&foot=1'},addEventListener:noop,EventSource};
const box={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};vm.createContext(box);
vm.runInContext(fs.readFileSync('foot-input.js','utf8'),box);
const script=fs.readFileSync('neon-chaos-kitchen.html','utf8').replace(/\r\n/g,'\n').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.game={state,start,phase,practice,conclude,returnFromPhase,input,toggleMenu,selectScene,footMode,step:dt=>{now+=dt;advance(dt)}};\n})();');
vm.runInContext(script,box);
const g=box.game;let s=streams[0],seq=0;
const link=connected=>s.send({type:'link',transport:'xiao-ble',connected});
function run(extra={}){const p={type:'motion',source:'xiao-foot',action:'run',cycle:'single_foot',cycles:1,
  t_ms:++seq*680,event_id:String(seq),sent_at_ms:Date.now(),...extra};s.send(p);return p;}
function tick(n=24){for(let i=0;i<n;i++)g.step(.04);}
link(true);run();assert.equal(g.state.footCycles,0,'menu cycles are discarded');
for(const scene of ['toilet','neon','coffee']){
  g.state.open='menu';g.selectScene(scene);g.start();g.step(.04);
  const before={...g.state.player};tick();assert.deepEqual(g.state.player,before,'no jogging means no map movement');
  g.input('d',true);tick();assert.deepEqual(g.state.player,before,'keyboard cannot advance the running route');
  const first=run();tick();assert(Math.hypot(g.state.player.x-before.x,g.state.player.y-before.y)>0,'a foot cycle moves the character');
  const counted=g.state.footCycles;s.send(first);run({sent_at_ms:Date.now()-10000});
  assert.equal(g.state.footCycles,counted,'duplicate and old cycles cannot advance route');
  g.toggleMenu('pause');run();g.toggleMenu(null);tick();assert.equal(g.state.footCycles,counted,'pause discards, rather than queues input');
  document.hidden=true;run();document.hidden=false;assert.equal(g.state.footCycles,counted,'hidden pages ignore cycles');
  run();link(false);const stopped={...g.state.player};tick();assert.deepEqual(g.state.player,stopped,'disconnect clears remaining movement credit');link(true);
  for(let i=0;i<160&&g.state.view==='map';i++){run();tick();}
  assert.equal(g.state.view,'chop',scene+' automatically collects the order ingredient and enters chopping');
  assert.equal(g.state.runBudget,0,'arrival cannot carry movement into the next stage');
  const steps=g.state.footCycles;run();assert.equal(g.state.footCycles,steps,'cooking ignores foot cycles');
  g.conclude(true,'test chop');g.returnFromPhase();
  for(let i=0;i<160&&g.state.view==='map';i++){run();tick();}
  assert.equal(g.state.view,'wok',scene+' follows the route to cooking');
  g.conclude(true,'test wok');g.returnFromPhase();
  for(let i=0;i<160&&g.state.view==='map';i++){run();tick();}
  assert.equal(g.state.view,'serve',scene+' follows the route to serving');
  g.conclude(true,'test serve');g.returnFromPhase();assert.equal(g.state.served,1);
}
for(const scene of ['neon','toilet','coffee','fridge']){
  g.state.open='menu';g.selectScene(scene);g.practice('serve');
  let p=g.state.phase;
  tick(3);assert.equal(p.route,0,scene+' serving does not advance while standing still');
  const first=run();tick(4);assert(p.route>0,scene+' fresh jogging advances plate travel');
  tick();const stopped=p.route;tick(3);assert.equal(p.route,stopped,'stopped jogging exhausts bounded credit');
  s.send(first);run({sent_at_ms:Date.now()-10000});run({sent_at_ms:Date.now()+10000});
  assert.equal(p.runSeconds,0,'duplicate, stale and future packets do not restart travel');
  run();g.toggleMenu('pause');run();g.toggleMenu(null);
  assert.equal(p.runSeconds,0,'pause clears and discards jogging');
  const resumed=p.route;tick(2);assert.equal(p.route,resumed,'resume requires fresh jogging');
  document.hidden=true;run();g.step(.04);document.hidden=false;
  assert.equal(p.runSeconds,0,'hidden serving ignores jogging');
  run();link(false);const disconnected=p.route;tick(2);
  assert.equal(p.route,disconnected,'foot disconnect immediately stops serving');link(true);
  run();const beforeLinkError=p.route;s.onerror();tick(2);
  assert.equal(p.route,beforeLinkError,'SSE failure immediately stops serving');link(true);
  run({cycles:2});run({cycles:2});assert(p.runSeconds<=.8,'jogging cannot queue a long forward burst');
  g.phase('chop',0);g.phase('serve',0);assert.equal(g.state.phase.runSeconds||0,0,'stage transitions clear serving credit');
  run();element('foot-mode').checked=false;element('foot-mode').onchange();
  const disabled=g.state.phase.route;tick(2);assert.equal(g.state.phase.route,disabled,'disabling foot mode clears serving credit');
  g.input('e',true);tick(2);g.input('e',false);
  assert(g.state.phase.route>disabled,'E remains a serving fallback with foot mode disabled');
  element('foot-mode').checked=true;element('foot-mode').onchange();s=streams.at(-1);link(true);
}
element('foot-mode').checked=false;element('foot-mode').onchange();g.state.open='menu';g.selectScene('toilet');g.start();
const before={...g.state.player};g.input('d',true);tick();assert.notDeepEqual(g.state.player,before,'turning off foot mode restores normal keyboard movement');
console.log('PASS: fixed routes through all stages in three scenes, no automatic drift, no keyboard movement, pause, hidden pages, stale/duplicate cycles, disconnect and fallback.');
console.log('PASS: all four shared serving scenes accept jogging, stop after bounded credit, reject stale/duplicate/future input, clear on pause/disconnect/error/stage changes, and retain E fallback.');
