const fs=require('fs'),vm=require('vm'),assert=require('assert');
const noop=()=>{},elements=new Map(),streams=[];
let wallMs=1000;
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',src:'about:blank',hidden:false,textContent:'',innerHTML:'',
    classList:{toggle:noop},append:noop,replaceChildren:noop});
  return elements.get(id);
}
class FakeEventSource{
  constructor(){streams.push(this);} close(){}
  send(packet){this.onmessage({data:JSON.stringify(packet)});}
}
const canvas={getContext:()=>new Proxy({},{get:()=>noop,set:()=>true}),addEventListener:noop};
const document={hidden:false,body:{classList:{toggle:noop}},querySelector:s=>s==='#game'?canvas:element(s),
  querySelectorAll:()=>[],getElementById:element,createElement:()=>({value:'',textContent:''})};
const window={location:{search:'?scene=toilet&esp=1'},performance:{now:()=>wallMs},
  addEventListener:noop,EventSource:FakeEventSource};
const sandbox={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('hardware-chop.js','utf8'),sandbox);
const source=fs.readFileSync('neon-chaos-kitchen.html','utf8').replace(/\r\n/g,'\n')
  .match(/<script>([\s\S]*?)<\/script>/)[1].replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.test={state,practice,toggleMenu,input,keys,get hardware(){return hardwareInput},step:dt=>{now+=dt;advance(dt)}};\n})();');
vm.runInContext(source,sandbox);
const g=sandbox.test,stream=streams[0];let seq=0;
const emit=packet=>stream.send({type:'motion',t_ms:++seq*100,event_id:String(seq),...packet});
const circle=active=>emit({action:'wok',motion:'circle',active});
const flip=()=>emit({action:'flip',motion:'vertical'});
const step=dt=>{wallMs+=dt*1000;g.step(dt);};

circle(true);g.practice('wok');step(.1);
assert.equal(g.state.phase.progress,0,'menu input cannot carry into cooking');
circle(true);step(.1);
assert(g.state.phase.progress>0,'horizontal circle replaces E');
assert(!g.keys.has('e'),'hardware does not synthesize a held keyboard key');
const before=g.state.phase.progress;
circle(false);step(.1);assert.equal(g.state.phase.progress,before,'stop releases E immediately');
circle(true);step(.1);const atExpiry=g.state.phase.progress;
step(.4);assert.equal(g.state.phase.progress,atExpiry,'missing heartbeat releases E within 350ms');
circle(true);stream.onerror();step(.1);assert.equal(g.state.phase.progress,atExpiry,'SSE error releases E');
circle(true);g.toggleMenu('pause');g.toggleMenu(null);step(.1);
assert.equal(g.state.phase.progress,atExpiry,'pause clears held stirring');

g.practice('wok');flip();assert.equal(g.state.phase.burn,5,'early toss has a forgiving penalty');
assert.equal(g.state.phase.flips,0);
g.state.phase.flipWindow=2.8;
const single={type:'motion',action:'flip',motion:'vertical',t_ms:++seq*100,event_id:String(seq)};
stream.send(single);stream.send(single);
assert.equal(g.state.phase.flips,1,'one toss is one F, including duplicate delivery');
assert.equal(g.state.phase.burn,5,'duplicate flip cannot cause an out-of-window penalty');
assert(!g.hardware.stirring(),'toss releases horizontal stirring');

g.practice('wok');
for(let i=0;i<200&&!g.state.phase.done;i++){
  circle(true);step(.1);
  if(g.state.phase.flipWindow>0)flip();
}
assert(g.state.phase.done?.success,'continuous circle plus two timed tosses finishes cooking');
assert.equal(g.state.phase.flips,2);
for(const mode of ['chop','serve']){
  g.practice(mode);circle(true);flip();step(.1);
  assert(!g.hardware.stirring(),mode+' rejects stirring');
  assert.equal(g.state.phase.flips,0,mode+' rejects flips');
}
g.practice('wok');document.hidden=true;circle(true);flip();document.hidden=false;step(.1);
assert.equal(g.state.phase.progress,0);assert.equal(g.state.phase.flips,0);
g.input('e',true);step(.1);assert(g.state.phase.progress>0,'keyboard E remains usable');g.input('e',false);
g.state.phase.flipWindow=2.8;g.input('f',true);assert.equal(g.state.phase.flips,1,'keyboard F remains usable');
g.input('f',false);
console.log('PASS: circle hold/stop, timeout, disconnect, pause, stage isolation, single F, window penalties, keyboard fallback and full cooking.');
