/* Time-series behaviour checks: cadence trends, boundaries and plate priority. */
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const window={};
vm.runInNewContext(fs.readFileSync('kitchen-coach.js','utf8'),{window,Date,Math,Number,Object,String,Array,Map,Infinity});
let t=0,cycle=0,cues=[];
const sceneLines=window.KitchenCoach.sceneLines;
const localLines=[];
for(const scene of ['neon','fridge','toilet','coffee'])for(const kind of ['slow','urgent','recover','balance','praise']){
  assert.equal(sceneLines[scene][kind].length,2,scene+' '+kind+' has two local lines');
  for(const line of sceneLines[scene][kind]){assert(line.length>0&&line.length<=40,'local line length');localLines.push(line);}
}
assert.equal(new Set(localLines).size,40,'every scene has unique local lines');
const coach=window.KitchenCoach.create({now:()=>t,onCue:event=>cues.push(event)});
const context={active:true,key:'round:map:bin',stage:'map',theme:'coffee',foot:true,runExpected:true,tilt:0,seconds:90};
function tick(cadence=90,seconds=1,changes={},live=true){
  Object.assign(context,changes);
  for(let i=0;i<Math.round(seconds*5);i++){
    t+=200;coach.update(context);
    if(live)coach.observe({cadence,cycle_ms:++cycle});
    coach.update(context);
  }
}
function fresh(){coach.reset();cues=[];Object.assign(context,{active:true,key:'round:map:bin',stage:'map',foot:true,runExpected:true,tilt:0,seconds:90});tick(90,2);}
fresh();assert.equal(coach.baseline,90);
tick(60,.6);assert.equal(cues.length,0,'a brief change does not nag');
tick(90,1);tick(60,2);assert.equal(cues.at(-1).kind,'slow');
tick(60,9);assert.equal(cues.length,1,'one reminder per sustained slow episode');
tick(90,2);assert.equal(cues.at(-1).kind,'recover');
tick(90,4);assert.equal(cues.length,2,'steady pace does not repeat praise');
fresh();tick(90,4);assert.equal(cues.length,0,'praise waits for sustained movement');
tick(90,3);assert.equal(cues.at(-1).kind,'praise');
tick(90,9);assert.equal(cues.filter(e=>e.kind==='praise').length,1,'praise has its own cooldown');
tick(90,11);assert.equal(cues.filter(e=>e.kind==='praise').length,2,'continuous movement can praise again after cooldown');

fresh();tick(60,3,{seconds:20});assert.equal(cues.at(-1).kind,'urgent');
fresh();tick(0,4,{},false);assert.equal(cues.length,0,'missing telemetry is not slow running');
fresh();tick(60,.8);tick(60,4,{active:false});tick(60,1,{active:true});
assert.equal(cues.length,0,'pause clears evidence instead of accumulating slow time');
fresh();tick(60,4,{foot:false});assert.equal(cues.length,0,'disconnection cannot trigger pace reminders');
fresh();tick(60,4,{key:'round:chop',stage:'chop',runExpected:false});assert.equal(cues.length,0,'station work is not running');
fresh();tick(60,4,{runExpected:false});assert.equal(cues.length,0,'arrival does not invite a running prompt');
fresh();tick(60,4,{key:'round:serve',stage:'serve',tilt:.8});
assert.deepEqual(cues.map(e=>e.kind),['balance'],'unstable plate takes priority over acceleration');
tick(60,6,{tilt:.8});assert.equal(cues.length,1,'continuous wobbling produces only one warning');
fresh();tick(0,.4,{key:'round:serve',stage:'serve',tilt:.8,foot:false});
tick(0,1,{tilt:.1});assert.equal(cues.length,0,'brief plate wobble is ignored');
tick(0,1,{tilt:.8});assert.equal(cues.at(-1).kind,'balance','keyboard/touch balance remains supported');
fresh();tick(90,.4,{key:'round:serve',stage:'serve'});tick(60,3);
assert.equal(cues.at(-1).kind,'slow');
tick(60,1,{tilt:.8});assert.equal(cues.at(-1).kind,'balance','plate warning can interrupt a recent running reminder');

// Heartbeats do not turn one physical cycle into four baseline observations.
coach.reset();coach.update(context);
for(let i=0;i<30;i++){t+=200;coach.update({...context,stage:'map',key:'learn',foot:true,runExpected:true});coach.observe({cadence:90,cycle_ms:123});}
assert.equal(coach.baseline,0);

// The actual transport validates and routes pace separately from distance credit.
let paceCount=0,cycles=0,clock=10000;
vm.runInNewContext(fs.readFileSync('foot-input.js','utf8'),{window,Date:{now:()=>clock},Set,Number,JSON});
const input=window.KitchenFoot.create({onPace:()=>paceCount++,onCycle:()=>cycles++});
input.accept({type:'link',transport:'xiao-ble',connected:true});
const packet={type:'pace',source:'xiao-foot',cadence:60,cycle_ms:2000,t_ms:2100,sent_at_ms:clock,event_id:'pace:1'};
input.accept(packet);input.accept(packet);
for(const invalid of [{cadence:NaN},{cadence:-1},{cadence:241},{cycle_ms:{}},{sent_at_ms:clock-900},{sent_at_ms:clock+3000}])
  input.accept({...packet,event_id:JSON.stringify(invalid),...invalid});
assert.equal(paceCount,1);assert.equal(cycles,0,'pace telemetry never grants distance');
input.accept({type:'link',transport:'xiao-ble',connected:false});
input.accept({...packet,event_id:'pace:2'});assert.equal(paceCount,1);
console.log('PASS: 1s slowdown, scene praise, recovery, personal baseline, urgency, live-data gating, pause/arrival/disconnect, balance priority, cooldown and pace transport.');
