const assert=require('assert/strict'),vm=require('vm'),fs=require('fs');
const events=[];
class FakeEventSource{constructor(){events.push(this);}close(){}send(packet){this.onmessage({data:JSON.stringify(packet)});}}
const window={EventSource:FakeEventSource,performance:{now:()=>clock},location:{search:''},addEventListener:()=>{}};
const sandbox={window,URLSearchParams,Math};let clock=1000;
vm.runInNewContext(fs.readFileSync('hardware-chop.js','utf8'),sandbox);
let accepted=0,latest=null,status=[];
const input=sandbox.window.KitchenHardware.create({
  onPlate(packet){accepted++;latest=packet;return true;},
  onStatus:s=>status.push(s)
});
input.connect();events[0].onopen();
events[0].send({type:'motion',action:'plate',motion:'tilt',roll:.55,t_ms:100,event_id:'p1'});
assert.equal(accepted,1);assert.equal(input.plate().roll,.55);assert.equal(status.at(-1),'plate');
clock+=200;assert.equal(input.plate().roll,.55);
clock+=100;assert.equal(input.plate(),null,'plate input expires without a fresh heartbeat');
events[0].send({type:'motion',action:'plate',motion:'tilt',roll:-.45,t_ms:200,event_id:'p2'});
assert.equal(input.plate().roll,-.45);
input.clearPlate();assert.equal(input.plate(),null);
events[0].send({type:'motion',action:'plate',motion:'tilt',roll:.3,t_ms:300,event_id:'p3'});
events[0].send({type:'link',transport:'ble',state:'disconnected',connected:false});
assert.equal(input.plate(),null,'BLE disconnect clears held tilt immediately');
assert.equal(status.at(-1),'bleScanning');
events[0].send({type:'link',transport:'ble',state:'connected',connected:true});
assert.equal(status.at(-1),'bleConnected');
events[0].send({type:'motion',action:'plate',motion:'tilt',roll:.3,t_ms:400,event_id:'p4'});
events[0].onerror();assert.equal(input.plate(),null,'SSE errors clear tilt immediately');
input.disconnect();assert.equal(input.active,false);
console.log('PASS: plate roll transport, expiry, sign changes, clear and disconnect.');
