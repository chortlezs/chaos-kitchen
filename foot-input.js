/* Fresh single-ankle cycles, independent of hand-held cooking gestures. */
(function(root){
  'use strict';
  const activities={still:'静止',walk:'行走',jog:'慢跑',run:'跑步',other:'其他动作',unknown:'不确定'};
  function describeActivity(packet){
    if(packet?.label==='unknown')return packet.reason==='warming_up'?'脚踝 AI：正在采样…':'脚踝 AI：动作不确定';
    return '脚踝 AI：'+(activities[packet?.label]||'不确定')+' · '+Math.round((packet?.confidence||0)*100)+'%';
  }
  function create({onCycle=()=>{},onPace=()=>{},onActivity=()=>{},onStatus=()=>{},onLost=()=>{},EventSourceImpl=root.EventSource,
    url='http://127.0.0.1:8768/events'}={}){
    let source=null,linked=false;
    const seen=new Set();
    function accept(p){
      if(p?.type==='link'&&p.transport==='xiao-ble'){
        linked=p.connected===true;
        if(!linked)onLost();
        onStatus(linked?'connected':p.state==='ambiguous'?'ambiguous':'connecting');return;
      }
      if(!linked||!['motion','pace','activity'].includes(p?.type)||p.source!=='xiao-foot'||
        !Number.isFinite(p.t_ms)||p.t_ms<0||typeof p.event_id!=='string'||
        !Number.isFinite(p.sent_at_ms)||Date.now()-p.sent_at_ms>600||p.sent_at_ms-Date.now()>2000)return;
      if(p.type==='activity'){
        if(!Object.hasOwn(activities,p.label)||!Number.isFinite(p.confidence)||p.confidence<0||p.confidence>1||p.window_ms!==2000)return;
      }else if(p.type==='pace'){
        if(!Number.isFinite(p.cadence)||p.cadence<0||p.cadence>240||
          !(p.cycle_ms===null||Number.isFinite(p.cycle_ms)&&p.cycle_ms>=0))return;
      }else if(p.action!=='run'||p.cycle!=='single_foot'||![1,2].includes(p.cycles))return;
      if(seen.has(p.event_id))return;
      seen.add(p.event_id);if(seen.size>512)seen.delete(seen.values().next().value);
      if(p.type==='pace'){onPace(p);return;}
      if(p.type==='activity'){onActivity(p);return;}
      if(onCycle(p)===true)onStatus('running');
    }
    function disconnect(){const old=source;source=null;linked=false;if(old)old.close();onLost();onStatus('disabled');}
    function connect(){
      if(source)return;
      if(!EventSourceImpl){onStatus('unsupported');return;}
      onStatus('connecting');
      let stream;
      try{stream=new EventSourceImpl(url);}catch(_){onStatus('retrying');return;}
      source=stream;
      stream.onerror=()=>{if(source===stream){linked=false;onLost();onStatus('retrying');}};
      stream.onmessage=message=>{
        if(source!==stream)return;
        let p;try{p=JSON.parse(message.data);}catch(_){return;}
        accept(p);
      };
    }
    return {connect,disconnect,accept,get connected(){return linked;}};
  }
  root.KitchenFoot={create,describeActivity};
})(window);
