/* Only compact gameplay state leaves the browser; artwork stays on the board. */
(function(root){
  'use strict';
  function create({send}={}){
    const session=(root.crypto?.getRandomValues(new Uint32Array(1))[0]||Math.floor(Math.random()*0xfffffffe)+1)>>>0;
    let last=0,inflight=false,previous=null,counter=0,effect=0;
    const integer=(n,min,max)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));
    function sync(data){
      // Only the foreground game drives the physical screen when several tabs exist.
      if(root.document?.hidden||root.document?.hasFocus&&!root.document.hasFocus())return;
      const stamp=Date.now();
      if(stamp-last<180||inflight)return;
      last=stamp;
      const stage=data.stage;
      if(previous&&(stage===previous.stage||['wok','flip'].includes(stage)&&['wok','flip'].includes(previous.stage))&&data.dish===previous.dish){
        if(data.cuts>previous.cuts){counter=(counter+1)&65535;effect=1;}
        else if(data.flips>previous.flips){counter=(counter+1)&65535;effect=2;}
        else if((stage==='wok'||stage==='flip')&&data.burn>previous.burn+5){counter=(counter+1)&65535;effect=3;}
      }
      previous={...data};
      const payload={stage,theme:data.theme,dish:integer(data.dish,0,5),progress:integer(data.progress,0,100),
        integrity:integer(data.integrity??100,0,100),cuts:integer(data.cuts,0,10),flips:integer(data.flips,0,2),
        flags:(data.active?1:0)|(data.running?2:0),event:effect,event_counter:counter,
        tilt:integer((data.tilt||0)*1000,-1000,1000),seconds:integer(data.seconds,0,65535),session};
      if(send){send(payload);return;}
      if(!root.fetch||root.location.protocol==='file:')return;
      inflight=true;
      const control=new AbortController(),timeout=root.setTimeout(()=>control.abort(),1200);
      root.fetch('/api/screen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:control.signal})
        .catch(()=>{}).finally(()=>{root.clearTimeout(timeout);inflight=false;});
    }
    return {sync};
  }
  root.KitchenScreen={create};
})(window);
