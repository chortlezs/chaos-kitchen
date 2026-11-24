/* Motion feedback uses live local telemetry; AI prepares short lines off the hot path. */
(function(root){
  'use strict';
  const kinds=['slow','urgent','recover','balance','praise'];
  let sceneLines={
    neon:{
      slow:['脚步慢啦，霓虹线路都替你着急！','先别断电，找回刚才的冲刺节奏！'],
      urgent:['订单快闪红了，踩着电流往前冲！','倒计时响啦，把节奏重新接上线！'],
      recover:['线路接通啦，就是这个闪光节奏！','电流回来了，小厨师给你满格点赞！'],
      balance:['盘子在过电，左右轻扶稳住电流！','别让电弧晃盘，手上轻轻反向压！'],
      praise:['你真棒，霓虹都被你跑成直线啦！','节奏满格，整层办公室都亮起来了！']
    },
    fridge:{
      slow:['冰面有点拖脚，找回刚才那股热乎劲！','冻品还在等你，别让脚步被冰霜慢下来！'],
      urgent:['订单快冻住了，踩着冰面赶紧跑回来！','冷风催着呢，快把刚才的节奏跑热！'],
      recover:['冰面稳住了，这股节奏让后厨都升温啦！','脚步暖起来啦，小厨师给你一颗冰晶星！'],
      balance:['盘子往冰边滑了，反向轻扶把它拽回！','冷风在推盘，手上稳稳托住别打滑！'],
      praise:['你真棒，冰面再滑也被你跑出热气啦！','脚步稳得像钉在冰上，这波节奏真漂亮！']
    },
    toilet:{
      slow:['水花慢啦，漩涡还在等你转起来！','脚步别让水冲散，找回刚才的节奏！'],
      urgent:['订单要冲走啦，顺着漩涡快跑起来！','倒计时在冒泡，赶紧找回小跑水流！'],
      recover:['水流转顺啦，就是这个稳稳的节奏！','漩涡跟上你啦，小厨师给你一朵水花！'],
      balance:['盘子被水推偏了，朝反方向轻扶！','水流在捣乱，手上稳稳把盘带回！'],
      praise:['你真棒，整股漩涡都追不上你的脚步！','水流再好动，也被你的节奏带顺啦！']
    },
    coffee:{
      slow:['豆香都慢下来了，快把节奏重新磨起来！','咖啡还在等你，找回刚才的小跑转速！'],
      urgent:['浓缩要凉啦，踩着豆香把订单送出去！','倒计时滴答响，赶紧把转速拉回来！'],
      recover:['转速回来啦，这股节奏像刚磨好的豆香！','豆仓又转顺了，小厨师给你加满香气！'],
      balance:['豆浪在晃盘，轻轻朝反方向扶稳！','杯口还热着呢，手上稳住别让豆浪推翻！'],
      praise:['你真棒，这股节奏比头道浓缩还带劲！','豆仓晃个不停，也被你的脚步磨得顺滑！']
    }
  };
  if(root.fetch&&root.location?.protocol!=='file:')
    root.fetch('coach-lines.json',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error('Coach lines unavailable');
      return response.json();
    }).then(data=>{
      const valid=['neon','fridge','toilet','coffee'].every(scene=>
        kinds.every(kind=>Array.isArray(data?.[scene]?.[kind])&&data[scene][kind].length===2&&
          data[scene][kind].every(line=>typeof line==='string'&&line.length>0&&line.length<=40)));
      if(valid)sceneLines=data;
    }).catch(()=>{});
  function create({onCue=()=>{},onClear=()=>{},now=()=>Date.now()}={}){
    let context={},key=null,pace=null,activity=null,baseline=0,learning=[],lastCycle=null;
    let lowSince=null,recoverSince=null,wobbleSince=null,steadySince=null,praiseSince=null;
    let warned=false,wobbleWarned=false,lastCue=-Infinity,lastKind=null;
    const cooldown={};
    const clear=()=>{
      pace=activity=null;lowSince=recoverSince=wobbleSince=steadySince=praiseSince=null;
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
      const cooldownMs=kind==='praise'?20000:12000;
      if((t-lastCue<4500&&!(kind==='balance'&&lastKind!=='balance'))||t-(cooldown[kind]??-Infinity)<cooldownMs)return false;
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
        pace=null;lowSince=recoverSince=praiseSince=null;warned=false;return;
      }
      if(!baseline){praiseSince=null;return;}
      const ratio=pace.cadence/baseline;
      if(ratio<.75){
        recoverSince=praiseSince=null;lowSince??=t;
        if(!warned&&t-lowSince>=1000&&!(next.stage==='serve'&&Math.abs(next.tilt)>.5)){
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
        praiseSince??=t;
        if(t-praiseSince>=6000&&!(next.stage==='serve'&&Math.abs(next.tilt)>.5))emit('praise',t);
      }else {lowSince=null;recoverSince=praiseSince=null;}
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
    let hideAt=0,current={},round=0,latest={},lastPace=null,lastActivity=null;
    function hide(){
      if(!bubble.hidden){bubble.hidden=true;root.KitchenAudio?.stopSpeech?.();}
    }
    function prepare(scene,emotion='joy'){
      if(!['coffee','fridge','toilet','neon'].includes(scene))return;
      if(!['joy','sadness','anger','fear','surprise','disgust'].includes(emotion))emotion='joy';
      const cacheKey=scene+':'+emotion;
      current={scene,emotion,cacheKey};
      for(const kind of ['slow','urgent','recover','praise','balance'])
        root.KitchenAudio?.warm?.(sceneLines[scene][kind][0],kind);
      if(packs.has(cacheKey)||requests.has(cacheKey)||!root.fetch||root.location.protocol==='file:')return;
      const controller=new AbortController(),timer=root.setTimeout(()=>controller.abort(),15000);
      requests.set(cacheKey,controller);
      root.fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({scene,emotion}),signal:controller.signal})
        .then(response=>{if(!response.ok)throw new Error('Coach unavailable');return response.json();})
        .then(data=>{
          const valid=kinds.every(kind=>Array.isArray(data.lines?.[kind])&&data.lines[kind].length>=1&&
            data.lines[kind].length<=3&&data.lines[kind].every(line=>typeof line==='string'&&line.trim().length>0&&line.length<=40));
          if(!valid)return;
          packs.set(cacheKey,data.lines);
          for(const kind of kinds)root.KitchenAudio?.warm?.(data.lines[kind][0],kind);
        }).catch(()=>{}).finally(()=>{root.clearTimeout(timer);requests.delete(cacheKey);});
    }
    function clear(){
      lastPace=lastActivity=null;hide();
    }
    function show(event,message){
      if(typeof message!=='string'||!message.trim()||message.length>40)return;
      bubble.dataset.kind=event.kind;bubble.dataset.theme=event.theme;
      portrait.clearRect(0,0,96,96);portrait.imageSmoothingEnabled=false;
      root.KitchenArt?.chef(portrait,48,67,1.7,event.theme,0,false);
      text.textContent=message;
      note.textContent=event.kind==='recover'?'节奏找回来啦':event.kind==='balance'?'轻倾修正 · 稳稳端好':event.kind==='praise'?'持续运动 · 节奏真稳':'保持你舒服的小跑节奏';
      bubble.hidden=false;hideAt=Date.now()+Math.min(6500,Math.max(4200,message.length*180+800));
      root.KitchenAudio?.speak?.(message,event.kind);
    }
    const engine=create({onClear:clear,onCue:event=>{
      const index=counts[event.kind]||0;counts[event.kind]=index+1;
      const local=sceneLines[event.theme][event.kind];
      const pack=packs.get(current.cacheKey)?.[event.kind];
      const preferred=pack?.[index%pack.length];
      // Prefer an already-voiced AI line; otherwise use the warm local line immediately.
      const message=preferred&&root.KitchenAudio?.hasSpeech?.(preferred,event.kind)?preferred:local[index%local.length];
      show(event,message);
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
  root.KitchenCoach={create,mount,sceneLines};
})(window);
