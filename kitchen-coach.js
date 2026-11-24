/* Motion feedback uses live local telemetry; AI prepares short lines off the hot path. */
(function(root){
  'use strict';
  const kinds=['slow','urgent','recover','balance'];
  const lines={
    slow:['脚步慢下来啦，找回刚才的小跑节奏！','菜还在等你，跟着自己的节奏往前跑！'],
    urgent:['来不及啦！这盘菜还等着你送呢！','订单倒计时啦，找回刚才的节奏！'],
    recover:['对对对，就是这个节奏！','节奏回来啦，小厨师给你加颗星！'],
    balance:['脚下可以快，手上可得稳！','盘子在跳舞啦，轻轻往反方向扶一扶！']
  };
  function create({onCue=()=>{},onClear=()=>{},now=()=>Date.now()}={}){
    let context={},key=null,pace=null,activity=null,baseline=0,learning=[],lastCycle=null;
    let lowSince=null,recoverSince=null,wobbleSince=null,steadySince=null;
    let warned=false,wobbleWarned=false,lastCue=-Infinity,lastKind=null;
    const cooldown={};
    const clear=()=>{
      pace=activity=null;lowSince=recoverSince=wobbleSince=steadySince=null;
      warned=wobbleWarned=false;onClear();
    };
    function reset(){
      clear();key=null;baseline=0;learning=[];lastCycle=null;lastCue=-Infinity;lastKind=null;
      for(const name of Object.keys(cooldown))delete cooldown[name];
    }
    function observe(packet){
      if(!context.active||!context.foot||!context.runExpected)return;
      if(!Number.isFinite(packet.cadence)||packet.cadence<0||packet.cadence>240)return;
      pace={cadence:packet.cadence,at:now()};
      // Learn from separate physical cycles, never from repeated heartbeat packets.
      if(!baseline&&packet.cadence>=40&&packet.cycle_ms!==null&&packet.cycle_ms!==lastCycle){
        lastCycle=packet.cycle_ms;learning.push(packet.cadence);
        if(learning.length>=4){
          const sorted=learning.slice().sort((a,b)=>a-b);
          baseline=(sorted[1]+sorted[2])/2;
        }
      }
    }
    function observeActivity(packet){
      if(!context.active||!context.foot||!context.runExpected)return;
      if(!['still','walk','jog','run','other','unknown'].includes(packet.label)||
        !Number.isFinite(packet.confidence)||packet.confidence<0||packet.confidence>1)return;
      activity={label:packet.label,confidence:packet.confidence,at:now()};
    }
    function emit(kind,t){
      if((t-lastCue<4500&&!(kind==='balance'&&lastKind!=='balance'))||t-(cooldown[kind]??-Infinity)<12000)return false;
      lastCue=t;lastKind=kind;cooldown[kind]=t;
      onCue({kind,...context,baseline,cadence:pace?.cadence??null,activity:activity&&t-activity.at<1500?activity:null});return true;
    }
    function update(next){
      context=next;
      const t=now(),nextKey=next.active?String(next.key):null;
      if(nextKey!==key){clear();key=nextKey;}
      if(!next.active){clear();return;}
      // Plate balance also works with keyboard/touch, independently of the foot sensor.
      if(next.stage==='serve'&&Number.isFinite(next.tilt)){
        if(Math.abs(next.tilt)>.62){
          steadySince=null;wobbleSince??=t;
          if(!wobbleWarned&&t-wobbleSince>=700&&emit('balance',t))wobbleWarned=true;
        }else{
          wobbleSince=null;
          if(Math.abs(next.tilt)<.35){steadySince??=t;if(t-steadySince>=1000)wobbleWarned=false;}
        }
      }else wobbleSince=steadySince=null;
      if(!next.foot||!next.runExpected||!pace||t-pace.at>700){
        pace=null;lowSince=recoverSince=null;warned=false;return;
      }
      if(!baseline)return;
      const ratio=pace.cadence/baseline;
      if(ratio<.75){
        recoverSince=null;lowSince??=t;
        if(!warned&&t-lowSince>=2200&&!(next.stage==='serve'&&Math.abs(next.tilt)>.5)){
          if(emit(next.seconds<30?'urgent':'slow',t))warned=true;
        }
      }else if(ratio>=.88){
        lowSince=null;
        if(warned){
          recoverSince??=t;
          if(t-recoverSince>=1200&&!(next.stage==='serve'&&Math.abs(next.tilt)>.5)&&emit('recover',t)){
            warned=false;recoverSince=null;
          }
        }
      }else {lowSince=null;recoverSince=null;}
    }
    return {observe,observeActivity,update,reset,get baseline(){return baseline;}};
  }

  function mount({parent=root.document.querySelector('main')}={}){
    const doc=root.document;
    const bubble=doc.createElement('aside');bubble.className='kitchen-coach';bubble.hidden=true;
    bubble.setAttribute('role','status');bubble.setAttribute('aria-live','polite');bubble.setAttribute('aria-atomic','true');
    bubble.innerHTML='<div class="coach-portrait" aria-hidden="true"><canvas width="96" height="96"></canvas></div><div class="coach-copy"><span class="coach-label">小厨师 · 节奏搭档</span><p></p><span class="coach-note"></span></div>';
    parent.append(bubble);
    const text=bubble.querySelector('p'),note=bubble.querySelector('.coach-note');
    const portrait=bubble.querySelector('canvas').getContext('2d');
    const packs=new Map(),requests=new Map(),counts={};
    let hideAt=0,current={},round=0,latest={},lastPace=null,lastActivity=null,assessment=null,revision=0;
    function hide(){
      if(!bubble.hidden){bubble.hidden=true;root.KitchenAudio?.stopSpeech?.();}
    }
    function prepare(scene,emotion='joy'){
      if(!['coffee','fridge','toilet','neon'].includes(scene))return;
      if(!['joy','sadness','anger','fear','surprise','disgust'].includes(emotion))emotion='joy';
      const cacheKey=scene+':'+emotion;
      current={scene,emotion,cacheKey};
      if(packs.has(cacheKey)||requests.has(cacheKey)||!root.fetch||root.location.protocol==='file:')return;
      const controller=new AbortController(),timer=root.setTimeout(()=>controller.abort(),15000);
      requests.set(cacheKey,controller);
      root.fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({scene,emotion}),signal:controller.signal})
        .then(response=>{if(!response.ok)throw new Error('Coach unavailable');return response.json();})
        .then(data=>{
          if(kinds.every(kind=>Array.isArray(data.lines?.[kind])&&data.lines[kind].length>=1&&
            data.lines[kind].length<=3&&data.lines[kind].every(line=>typeof line==='string'&&line.trim().length>0&&line.length<=40)))
            packs.set(cacheKey,data.lines);
        }).catch(()=>{}).finally(()=>{root.clearTimeout(timer);requests.delete(cacheKey);});
    }
    function clear(){
      revision++;assessment?.abort();assessment=null;lastPace=lastActivity=null;hide();
    }
    function relevant(event){
      if(!latest.active||latest.key!==event.key||!latest.foot||!latest.runExpected||doc.hidden||parent.inert)return false;
      if(!lastPace||Date.now()-lastPace.at>700)return false;
      if(event.stage==='serve'&&Math.abs(latest.tilt||0)>.5)return false;
      const ratio=lastPace.cadence/event.baseline;
      return event.kind==='recover'?ratio>=.88:ratio<.75;
    }
    function show(event,message){
      if(typeof message!=='string'||!message.trim()||message.length>40)return;
      bubble.dataset.kind=event.kind;bubble.dataset.theme=event.theme;
      portrait.clearRect(0,0,96,96);portrait.imageSmoothingEnabled=false;
      root.KitchenArt?.chef(portrait,48,67,1.7,event.theme,0,false);
      text.textContent=message;
      note.textContent=event.kind==='recover'?'节奏找回来啦':event.kind==='balance'?'轻倾修正 · 稳稳端好':'保持你舒服的小跑节奏';
      bubble.hidden=false;hideAt=Date.now()+Math.min(6500,Math.max(4200,message.length*180+800));
      root.KitchenAudio?.speak?.(message,event.kind);
    }
    const engine=create({onClear:clear,onCue:event=>{
      revision++;assessment?.abort();assessment=null;
      const choices=packs.get(current.cacheKey)?.[event.kind]||lines[event.kind];
      const index=counts[event.kind]||0;counts[event.kind]=index+1;
      const message=choices[index%choices.length];
      // Balance stays on the existing immediate path; only ankle feedback uses this assessment.
      if(event.kind==='balance'||!event.activity||!root.fetch||root.location.protocol==='file:'){show(event,message);return;}
      if(event.activity.label==='unknown'||event.activity.confidence<.65)return;
      const token=revision,controller=new AbortController();assessment=controller;
      const timer=root.setTimeout(()=>controller.abort(),2500);
      const fresh=()=>token===revision&&relevant(event)&&lastActivity&&Date.now()-lastActivity.at<1500&&
        lastActivity.label!=='unknown'&&lastActivity.confidence>=.65;
      root.fetch('/api/coach/assess',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({scene:event.theme,emotion:current.emotion||'joy',stage:event.stage,event:event.kind,
          activity:event.activity.label,confidence:event.activity.confidence,cadence:event.cadence,
          baseline:event.baseline,seconds:Math.max(0,Math.min(180,event.seconds))})})
        .then(response=>{if(!response.ok)throw new Error('Assessment unavailable');return response.json();})
        .then(data=>{
          if(!fresh())return;
          if(data.decision==='quiet')return;
          if(data.decision!=='speak'||data.kind!==event.kind||typeof data.text!=='string'||!data.text.trim()||data.text.length>40)
            throw new Error('Invalid assessment');
          show(event,data.text);
        }).catch(()=>{if(fresh())show(event,message);})
        .finally(()=>{root.clearTimeout(timer);if(assessment===controller)assessment=null;});
    }});
    doc.addEventListener('visibilitychange',()=>{if(doc.hidden){engine.reset();hide();}});
    root.addEventListener('pagehide',()=>{engine.reset();for(const controller of requests.values())controller.abort();});
    return {
      prepare,
      observe(packet){lastPace={cadence:packet.cadence,at:Date.now()};engine.observe(packet);},
      observeActivity(packet){lastActivity={label:packet.label,confidence:packet.confidence,at:Date.now()};engine.observeActivity(packet);},
      reset(){round++;engine.reset();hide();},
      update(snapshot){
        latest={...snapshot,key:round+':'+snapshot.key,active:snapshot.active&&!doc.hidden&&!parent.inert};
        engine.update(latest);
        if(Date.now()>=hideAt)hide();
      }
    };
  }
  root.KitchenCoach={create,mount};
})(window);
