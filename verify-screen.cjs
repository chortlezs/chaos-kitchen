const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let stamp=0;const sent=[];
const window={crypto:{getRandomValues:array=>(array[0]=123,array)}};
const Clock={now:()=>stamp};
vm.runInNewContext(fs.readFileSync('kitchen-screen.js','utf8'),{window,Date:Clock,Uint32Array,Math,Number});
const screen=window.KitchenScreen.create({send:p=>sent.push(p)});
function sync(extra={}){stamp+=200;screen.sync({stage:'chop',theme:'neon',dish:0,cuts:0,...extra});return sent.at(-1);}
assert.equal(sync().session,123);
const cut=sync({cuts:1});assert.equal(cut.event,1);assert.equal(cut.event_counter,1);
assert.equal(sync({cuts:1}).event_counter,1,'same state never repeats cut effects');
sync({stage:'flip',flips:0});assert.equal(sync({stage:'wok',flips:1}).event,2,'closing the flip window still triggers a success effect');
assert.equal(sync({stage:'pause',tilt:10}).tilt,1000,'tilt is clamped');
const count=sent.length;screen.sync({stage:'idle'});assert.equal(sent.length,count,'screen updates are throttled');
assert.equal(sync({stage:'serve',active:true,running:true}).flags,3);
window.document={hidden:true};const beforeHidden=sent.length;sync();assert.equal(sent.length,beforeHidden,'background tabs cannot take over the board screen');
window.document={hidden:false,hasFocus:()=>false};sync();assert.equal(sent.length,beforeHidden,'unfocused game tabs do not fight foreground play');
console.log('PASS: compact session state, confirmed cut/flip effects, repeat suppression, throttle and tilt bounds.');
