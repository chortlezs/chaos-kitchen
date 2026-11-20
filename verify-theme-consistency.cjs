const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const noop=()=>{},elements=new Map(),events=new Map(),draws=[],cookware=[],sent=[];
function element(id){
  if(!elements.has(id))elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',src:'about:blank',
    classList:{toggle:noop},append:noop,replaceChildren:noop,focus:noop,
    contentWindow:{postMessage:data=>sent.push(data)}});
  return elements.get(id);
}
const ctx=new Proxy({fillText:(...args)=>draws.push(args)}, {get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const canvas={getContext:()=>ctx,addEventListener:noop,focus:noop};
const document={hidden:false,body:{classList:{toggle:noop}},querySelector:s=>s==='#game'?canvas:element(s),
  querySelectorAll:()=>[],getElementById:element,createElement:()=>({value:'',textContent:''})};
const window={location:{search:'?scene=toilet',origin:'http://localhost'},addEventListener:(name,fn)=>{
  if(!events.has(name))events.set(name,[]);events.get(name).push(fn);
},KitchenCookware:{board:(_ctx,...args)=>cookware.push(['board',...args]),draw:(_ctx,...args)=>cookware.push(['pan',...args])}};
const sandbox={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};
const html=fs.readFileSync('neon-chaos-kitchen.html','utf8');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.test={state,selectScene,start,practice,phase,drawChop,drawWok,drawServe,toast,drawNotice,conclude,returnFromPhase,advance,hardwareWokReady,hardwareServeReady,effectColor,setTime:t=>now=t};\n})();');
vm.runInNewContext(source,sandbox);const g=sandbox.test;
const scenes=['neon','fridge','toilet','coffee'];
let baseline;
for(const scene of scenes){
  g.state.open='menu';g.selectScene(scene);
  for(let id=0;id<6;id++)for(const mode of ['chop','wok','serve']){
    element('dish-select').value=String(id);g.practice(mode);draws.length=0;cookware.length=0;
    ({chop:g.drawChop,wok:g.drawWok,serve:g.drawServe})[mode](1);
    const layout=draws.filter(([s])=>/^(阶段剩余|炒制进度|A ◀|▶ D|翻面   |路程 )/.test(s)).map(([s,x,y])=>[s.replace(/\d/g,'#'),x,y]);
    if(id===0){baseline??={};if(scene==='neon')baseline[mode]=layout;else assert.deepEqual(layout,baseline[mode],scene+' '+mode+' shared UI placement');}
    if(mode==='chop')assert(cookware.some(([kind,x,y,scale])=>kind==='board'&&x===480&&y===275&&scale===1.1),scene+' board geometry');
    if(mode==='wok')assert(cookware.some(([kind,x,y,scale])=>kind==='pan'&&x===448&&y===302&&scale===1),scene+' pan geometry');
    if(scene==='fridge')assert(!draws.some(([s])=>/电流|过电|赛博/.test(s)),'no cyber copy in fridge');
  }
  g.phase('wok',0);assert(g.hardwareWokReady(),scene+' hardware wok readiness');
  g.phase('serve',0);assert(g.hardwareServeReady(),scene+' hardware plate readiness');
  g.state.toast=null;g.state.noticeQueue=[];g.setTime(0);
  g.toast('靠近工作台',null,1.65,'info');g.drawNotice(0);
  assert.equal(g.state.toast.kind,'info');
  const line=draws.findLast(([s])=>s==='靠近工作台');assert(line[2]>=126&&line[2]<=158,'notice safe slot');
  g.toast('翻早了',null,.72,'warning');assert.equal(g.state.toast.kind,'warning');
  g.toast('普通提醒',null,1.65,'info');assert.equal(g.state.toast.text,'翻早了','low priority cannot overwrite warning');
  g.toast('工序失败',null,1.35,'error');assert.equal(g.state.toast.kind,'error');assert.equal(g.state.noticeQueue.length,0);
  g.drawNotice(2);assert.equal(g.state.toast,null,'notice expires consistently');
}
assert.equal(new Set(scenes.map(scene=>{g.state.scene=scene;return g.effectColor(1);})).size,4,'four theme effect palettes');
// Real-level iframe -> shared phase -> result -> map handoff, with source validation.
const iframe=element('frost-experience');g.state.open='menu';g.selectScene('fridge');g.start();
function message(data,source=iframe.contentWindow){for(const fn of events.get('message')||[])fn({origin:'http://localhost',source,data});}
message({type:'frost-minigame',mode:'wok',id:2,clock:150},{});assert(!g.state.frostRound,'reject wrong source');
for(const mode of ['chop','wok','serve']){
  message({type:'frost-minigame',mode,id:2,clock:150});
  assert(g.state.frostRound);assert.equal(g.state.view,mode);assert.equal(g.state.phase.id,2);assert.equal(g.state.time,150);
  assert(iframe.hidden);assert.equal(g.state.phase.left,{chop:14,wok:35,serve:17}[mode]);
  g.conclude(true,'GOOD · 完成');g.returnFromPhase();
  assert(!iframe.hidden);assert.equal(sent.at(-1).type,'frost-minigame-result');assert(sent.at(-1).success);assert.equal(sent.at(-1).clock,150);
}
console.log('PASS: 72 themed food/stage render cases, identical geometry/UI anchors, no fridge cyber copy, notice priorities/expiry, hardware readiness and formal iframe handoff.');
// Verify the actual child-side bridge without loading embedded image payloads.
const frost=fs.readFileSync('frost-kitchen.html','utf8');
const childEnter=frost.slice(frost.indexOf('function enter(mode){'),frost.indexOf('function finish(ok,message){'));
const childMessages=[],childSent=[],parent={postMessage:data=>childSent.push(data)};
const child={window:{parent,location:{origin:'http://localhost'},addEventListener:(_,fn)=>childMessages.push(fn)},
  scene:'map',delay:0,toast:null,target:null,water:[],sparks:[],phase:null,overlay:'',clock:160,selected:2,step:1,evaluations:[],
  limits:{chop:14,wok:35,serve:17},canvas:{focus:noop},clearKeys:noop,refreshMenu:noop,
  dishes:[['a'],['b'],['冰冻文件夹']],C:{gold:'#abc'},say:noop,
  complete:grade=>child.evaluations.push(grade),finish:(ok,message)=>child.result={ok,message},fail:message=>child.result={ok:false,message}};
vm.createContext(child);vm.runInContext(childEnter,child);
for(const mode of ['chop','wok','serve']){
  child.enter(mode);assert.equal(child.overlay,'shared');assert.equal(childSent.at(-1).mode,mode);
  childMessages[0]({origin:'http://localhost',source:parent,data:{type:'frost-minigame-result',success:true,label:'GOOD · 完成',integrity:95,clock:151}});
  assert.equal(child.overlay,'');assert.equal(child.clock,151);
  if(mode==='serve')assert.equal(child.result.ok,true);
}
child.enter('wok');childMessages[0]({origin:'http://localhost',source:parent,data:{type:'frost-minigame-result',success:false,label:'焦糊报废',clock:100}});
assert.equal(child.scene,'map');assert.equal(child.step,0,'failed round returns to ingredient pickup');
console.log('PASS: fridge child bridge freezes during shared play, resumes clock, advances stages and retries failed ingredients.');
