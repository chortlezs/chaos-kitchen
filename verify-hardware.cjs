const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{},elements=new Map(),streams=[];
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',src:'about:blank',hidden:false,textContent:'',innerHTML:'',
    classList:{toggle:noop},append:noop,replaceChildren:noop});
  return elements.get(id);
}
class FakeEventSource{
  constructor(url){this.url=url;this.closed=false;streams.push(this);}
  close(){this.closed=true;}
  send(packet){this.onmessage({data:typeof packet==='string'?packet:JSON.stringify(packet)});}
}
const context=new Proxy({}, {get:()=>noop,set:()=>true});
const canvas={getContext:()=>context,addEventListener:noop};
const document={hidden:false,body:{classList:{toggle:noop}},querySelector:s=>s==='#game'?canvas:element(s),
  querySelectorAll:()=>[],getElementById:element,createElement:()=>({value:'',textContent:''})};
const window={location:{search:'?scene=toilet&esp=1'},addEventListener:noop,EventSource:FakeEventSource};
const sandbox={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('hardware-chop.js','utf8'),sandbox);
const html=fs.readFileSync('neon-chaos-kitchen.html','utf8').replace(/\r\n/g,'\n');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.test={state,practice,phase,toggleMenu,input,selectScene,keys,step:dt=>{now+=dt;advance(dt)}};\n})();');
vm.runInContext(script,sandbox);
const g=sandbox.test,stream=streams[0];
assert(stream,'?esp=1 auto-connects');
stream.onopen();assert.match(element('hardware-status').textContent,/等待动作/);
let timestamp=1000;
const packet=(extra={})=>({type:'motion',action:'chop',cycle:'down_up',t_ms:timestamp+=200,...extra});
const send=(extra={})=>stream.send(packet(extra));
send();assert.equal(g.state.phase,null,'menu motion is discarded');
g.practice('chop');
for(let i=1;i<=5;i++){g.step(.18);send();assert.equal(g.state.phase.cuts,i,'each complete cycle is exactly one cut');}
const duplicate=packet();stream.send(duplicate);stream.send(duplicate);
assert.equal(g.state.phase.cuts,6,'replayed event is not counted twice');
stream.send('invalid json');stream.send('null');send({cycle:'down'});send({cycle:'up'});
send({action:'wok'});send({t_ms:null});send({sent_at_ms:Date.now()-10000});
assert.equal(g.state.phase.cuts,6,'partial, wrong and stale events are ignored');
g.toggleMenu('pause');const paused=packet();stream.send(paused);g.toggleMenu(null);stream.send(paused);
assert.equal(g.state.phase.cuts,6,'paused events are discarded, not queued');
document.hidden=true;send();document.hidden=false;
assert.equal(g.state.phase.cuts,6,'hidden pages ignore motion');
for(let i=7;i<=10;i++){g.step(.18);send();assert.equal(g.state.phase.cuts,i);}
assert.equal(g.state.phase.done.success,true,'ten hardware cuts complete the normal challenge');
send();assert.equal(g.state.phase.cuts,10,'completion animation cannot gain extra cuts');

for(const scene of ['neon','coffee','toilet']){
  g.state.open='menu';g.selectScene(scene);g.practice('chop');send();
  assert.equal(g.state.phase.cuts,1,scene+' shares hardware input');
}
for(const mode of ['wok','serve']){
  g.practice(mode);send();assert.equal(g.state.phase.cuts,0,mode+' ignores chopping');
}
g.practice('chop');g.input('e',true);assert.equal(g.state.phase.cuts,1,'keyboard fallback works');
g.input('e',false);
element('hardware-connect').onclick();assert(stream.closed,'disconnect closes SSE');
send();assert.equal(g.state.phase.cuts,1,'late events from a closed stream are ignored');
element('hardware-connect').onclick();const reconnected=streams[1];
const fresh=packet({boot_id:'new-boot',t_ms:100});reconnected.send(fresh);reconnected.send(fresh);
assert.equal(g.state.phase.cuts,2,'reconnect and a new boot preserve one-event counting');
assert.equal(streams.length,2,'only one active connection per page');
console.log('PASS: V1 hardware cuts, completion, all classic scenes, deduplication, pause, hidden page, other stages, keyboard and reconnect.');
