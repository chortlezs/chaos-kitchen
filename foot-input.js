/* Fresh single-ankle cycles, independent of hand-held cooking gestures. */
(function(root){
  'use strict';
  function create({onCycle=()=>{},onStatus=()=>{},onLost=()=>{},EventSourceImpl=root.EventSource,
    url='http://127.0.0.1:8768/events'}={}){
    let source=null,linked=false;
    const seen=new Set();
    function accept(p){
      if(p?.type==='link'&&p.transport==='xiao-ble'){
        linked=p.connected===true;
        if(!linked)onLost();
        onStatus(linked?'connected':p.state==='ambiguous'?'ambiguous':'connecting');return;
      }
      if(!linked||p?.type!=='motion'||p.source!=='xiao-foot'||p.action!=='run'||p.cycle!=='single_foot'||
        ![1,2].includes(p.cycles)||!Number.isFinite(p.t_ms)||p.t_ms<0||typeof p.event_id!=='string'||
        !Number.isFinite(p.sent_at_ms)||Date.now()-p.sent_at_ms>600||p.sent_at_ms-Date.now()>2000)return;
      if(seen.has(p.event_id))return;
      seen.add(p.event_id);if(seen.size>512)seen.delete(seen.values().next().value);
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
  root.KitchenFoot={create};
})(window);
