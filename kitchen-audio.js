/* Original chiptune scores and effects, synthesized locally with Web Audio. */
(function(root){
  const scores={
    cover:{bpm:176,key:57,voice:'square',harmony:[0,5,3,7,0,5,8,7],play:arcade},
    neon:{bpm:174,key:52,voice:'sawtooth',harmony:[0,0,1,0,0,3,1,7],play:techno},
    fridge:{bpm:204,key:59,voice:'triangle',harmony:[0,8,5,7,0,3,8,7],steps:12,division:3,play:frostArpeggios},
    toilet:{bpm:184,key:55,voice:'triangle',harmony:[0,0,5,3,0,7,5,2],swing:.12,play:breakbeat},
    coffee:{bpm:198,key:53,voice:'square',harmony:[0,0,5,0,7,5,0,7],swing:.18,play:roasterGroove}
  };
  const titleLead=[0,null,12,7,10,7,null,3,5,null,7,12,15,null,10,7];
  const cyberRiff=[0,null,0,6,0,null,12,null,0,1,null,0,7,null,6,null];
  const iceArpeggio=[24,31,34,38,34,31,26,33,38,41,38,33];
  const waterLead=[7,null,10,12,null,10,null,null,3,7,null,5,null,7,14,null];
  const coffeeLead=[null,15,null,12,10,null,6,7,null,3,5,null,0,null,10,12];
  // Different resonances for brittle ice, electrical arcs, water and roasted beans.
  const materials={
    fridge:{impact:[2100,980,5700],pieces:[3180,4390,2540,3610],shape:'sine',wok:[5200,2850,1740],serve:[4100,2150],entry:[19,12,24,22]},
    neon:{impact:[1480,280,3900],pieces:[790,1800,560,2460],shape:'square',wok:[4200,6900,810],serve:[2550,1320],entry:[0,12,10,19]},
    toilet:{impact:[610,145,1150],pieces:[390,640,540,820],shape:'sine',wok:[2500,1150,380],serve:[1420,440],entry:[0,7,16,24]},
    coffee:{impact:[560,130,2250],pieces:[280,475,350,630],shape:'triangle',wok:[3550,1750,580],serve:[1750,540],entry:[0,3,12,19]}
  };
  const fanfares={
    neon:[[0,7,12,10,15,19],[0,.10,.23,.42,.56,.80],1.10],
    fridge:[[12,19,15,22,24,26],[0,.13,.26,.46,.65,.86],1.16],
    toilet:[[0,4,9,12,16,21],[0,.17,.29,.43,.61,.83],1.08],
    coffee:[[0,3,7,12,15,19],[0,.10,.25,.39,.53,.76],1.03]
  };
  const failNotes=[12,10,8,7,5,3,1,0,-5];
  const failTimes=[0,.23,.49,.79,1.15,1.55,1.99,2.46,3.05];
  const doc=root.document;
  const AudioContext=root.AudioContext||root.webkitAudioContext;
  const storeKey='chaos-kitchen-sound-muted-v2';
  const voiceUrl=doc.currentScript?.src && new URL('assets/excellent-vocoder.wav',doc.currentScript.src);

  const soundNames=['start','enter','select','card','pickup','station','chop','flip','miss','surge','warn','good','excellent','fail','win','hazard'];
  let context,master,music,activity,noiseBuffer,timer,track=null,step=0,nextBeat=0;
  let mood=null,stage='map',urgent=false,action=false,activityLevel=0,embedded=false,button;
  let muted=false, pending=null, resultBus=null, resultUntil=0;
  let announcement=null, recordedExcellent=null;
  try{muted=root.localStorage.getItem(storeKey)==='1';}catch{}
  const hz=note=>440*2**((note-69)/12);

  function tone(dest,t,f,duration,volume,shape,end=f){
    const osc=context.createOscillator(),volumeNode=context.createGain();
    osc.type=shape;
    osc.frequency.setValueAtTime(f,t);
    osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    envelope(osc,volumeNode,dest,t,duration,volume);
  }
  function envelope(source,gain,dest,t,duration,volume,output=source){
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.linearRampToValueAtTime(volume,t+.005);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    output.connect(gain);gain.connect(dest);
    source.onended=()=>{
      source.disconnect();
      if(output!==source)output.disconnect();
      gain.disconnect();
    };
    source.start(t);source.stop(t+duration+.005);
  }
  function noise(dest,t,duration,volume,frequency,type='bandpass'){
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    source.buffer=noiseBuffer;
    filter.type=type;filter.frequency.value=frequency;filter.Q.value=1.1;
    source.connect(filter);
    envelope(source,gain,dest,t,duration,volume,filter);
  }

  function actionBeat(t,i,duration){
    const material=materials[track];
    if(!material)return;
    if(stage==='wok'){
      const [hiss,crackle,ring]=material.wok;
      noise(activity,t,duration*1.28,i%4===0?.175:.105,hiss,'highpass');
      noise(activity,t+.024,.041,i%2?.094:.145,crackle);
      if(i%2===0||urgent)tone(activity,t+.036,ring*(1+i%4*.09),.06,.095,material.shape,ring*.73);
    }else if(stage==='serve'&&i%2===0){
      const [scrape,step]=material.serve;
      noise(activity,t,.09,.15,scrape);
      tone(activity,t+.008,step,.074,.12,material.shape,step*.63);
    }
  }
  function note(t,midi,duration,volume,wave){
    tone(music,t,hz(midi),duration,volume,wave);
  }
  function kick(t,high,low,volume){
    tone(music,t,high,.135,volume,'sine',low);
  }
  function arcade(t,i,rootNote,d,bar){
    if(i%4===0||i===10)kick(t,128,43,.31);
    if(i===4||i===12)noise(music,t,.096,.19,1900);
    if(i%2===0||i%4===3||urgent)noise(music,t,.043,.083,6700,'highpass');
    if(i%2===0)note(t,rootNote-12,d*1.36,.119,'triangle');
    const pitch=titleLead[i];
    if(pitch!==null)note(t,rootNote+pitch+(bar%4===3&&i>=12?12:0),d*1.42,.102,'square');
    if(i===2||i===10)for(const interval of [3,7,12])note(t,rootNote+interval,d,.03,'triangle');
  }
  function techno(t,i,rootNote,d,bar){
    if(i%4===0)kick(t,160,39,.37);
    if(i===4||i===12){
      noise(music,t,.055,.18,1800);
      noise(music,t+.026,.085,.087,2450);
    }
    if(i%4===2||urgent&&i%2===1)noise(music,t,.051,.096,7900,'highpass');
    const pitch=cyberRiff[i];
    if(pitch!==null){
      note(t,rootNote-17+pitch,d*.83,.153,'sawtooth');
      note(t,rootNote-17+pitch,d*.68,.075,'square');
    }
    if(i===0||i===7||i===11){
      for(const interval of [12,18,25])note(t,rootNote+interval+(bar%4===3?1:0),d*.55,.06,'square');
    }
    if(stage!=='map'&&i===15)tone(music,t,962,.063,.075,'sawtooth',190);
  }
  function frostArpeggios(t,i,rootNote,d,bar){
    const pitch=rootNote+iceArpeggio[i]+(bar%2&&i>=9?2:0);
    note(t,pitch,d*2.25,i%3===0?.132:.085,'sine');
    note(t,pitch-12,d*.77,.078,'triangle');
    if(i%3===0)note(t+d*.46,pitch+12,d*.86,.046,'sine');
    if(i===0||i===6){
      kick(t,91,51,.18);
      for(const interval of [-12,0,7])note(t,rootNote+interval,d*5.75,.052,'sine');
    }
    if(i===3||i===9||urgent&&i===11)noise(music,t,.035,.085,9600,'highpass');
    if(stage==='wok'&&i%3===2)note(t,rootNote+15,d*1.9,.05,'triangle');
  }
  function breakbeat(t,i,rootNote,d,bar){
    if(i===0||i===6||i===10||i===15)kick(t,114,51,.285);
    if(i===4||i===11||i===14){
      noise(music,t,.075,.188,2450);
      tone(music,t,300,.062,.09,'triangle',131);
    }
    if(i%2===1)noise(music,t,.034,.077,5300,'highpass');
    if(i===1||i===5||i===8||i===13){
      const f=hz(rootNote-12+(i===13?7:0));
      tone(music,t,f*.76,d*1.74,.192,'sine',f*1.23);
    }
    const pitch=waterLead[i];
    if(pitch!==null){
      const f=hz(rootNote+pitch+(bar%4===3&&i>8?5:0));
      tone(music,t,f*.79,d*.88,.169,'triangle',f*1.35);
    }
    if(i===2||i===8||i===15||urgent&&i===12)tone(music,t,360+i*17,.074,.098,'sine',610+i*32);
  }
  function roasterGroove(t,i,rootNote,d,bar){
    if(i===0||i===3||i===6||i===10||i===13){
      tone(music,t,i%2===0?176:235,.095,.217,'triangle',i%2===0?70:111);
      noise(music,t,.045,.082,1220);
    }
    if(i%2===0||urgent)noise(music,t,.033,.087,4200);
    if(i===0||i===3||i===6||i===10||i===14){
      const n=i===6?7:i===14?10:0;
      note(t,rootNote-12+n,d*1.38,.191,'triangle');
    }
    if(i===2||i===7||i===12){
      for(const interval of [4,7,10])note(t,rootNote+interval,d*.61,.058,'triangle');
    }
    const pitch=coffeeLead[i];
    if(pitch!==null){
      const n=rootNote+pitch+(bar%4===3&&i>=10?12:0);
      note(t,n,d*.61,.149,'square');
      if(i===1||i===10)note(t+.018,n-12,d*.77,.075,'triangle');
    }
    if(stage==='serve'&&i===15)tone(music,t,440,.068,.085,'triangle',147);
  }
  function beat(t,index){
    const song=scores[track],steps=song.steps??16;
    const i=index%steps,bar=Math.floor(index/steps)%song.harmony.length;
    const rootNote=song.key+song.harmony[bar];
    const cadence=60/(song.bpm*(urgent?1.09:1))/(song.division??4);
    const duration=cadence*(1+(i%2===0?1:-1)*(song.swing??0));
    song.play(t,i,rootNote,duration,bar);
    if(action)actionBeat(t,i,duration);
    return duration;
  }
  function schedule(){
    if(context.state!=='running')return;
    if(nextBeat<context.currentTime)nextBeat=context.currentTime+.018;
    while(nextBeat<context.currentTime+.095)nextBeat+=beat(nextBeat,step++);
  }
  function stopMusic(){
    if(timer!=null){root.clearInterval(timer);timer=null;}
    if(music){
      const old=music, t=context.currentTime;
      old.gain.cancelScheduledValues(t);old.gain.setTargetAtTime(0,t,.021);
      root.setTimeout(()=>old.disconnect(),240);
    }
    music=null;track=null;
  }
  function reconcile(){
    const next=context?.state==='running'&&!muted&&!doc.hidden?mood:null;
    const nextLevel=next&&action ? .85 : 0;
    if(activity&&nextLevel!==activityLevel){
      activityLevel=nextLevel;
      activity.gain.setTargetAtTime(nextLevel,context.currentTime,.025);
    }
    if(next===track)return;
    stopMusic();
    if(!next)return;
    track=next;step=0;nextBeat=context.currentTime+.025;
    music=context.createGain();music.gain.value=.48;music.connect(master);
    if(resultUntil>context.currentTime)duck(context.currentTime,0);
    schedule();
    timer=root.setInterval(schedule,24);
  }
  function unlock(){
    if(embedded||muted||!AudioContext)return;
    if(!context){
      try{context=new AudioContext();}catch{return;}
      master=context.createGain();master.gain.value=.46;master.connect(context.destination);
      activity=context.createGain();activity.gain.value=0;activity.connect(master);
      const sampleCount=Math.floor(context.sampleRate*.26);
      noiseBuffer=context.createBuffer(1,sampleCount,context.sampleRate);
      const data=noiseBuffer.getChannelData(0);
      for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
      if(voiceUrl&&root.fetch){
        root.fetch(voiceUrl).then(response=>{
          if(!response.ok)throw new Error('Announcer asset unavailable');
          return response.arrayBuffer();
        }).then(bytes=>context.decodeAudioData(bytes)).then(clip=>{recordedExcellent=clip;}).catch(()=>{});
      }
      context.onstatechange=()=>{
        reconcile();updateButton();
      };
    }
    if(context.state==='running'){reconcile();updateButton();}
    else context.resume().then(()=>{
      reconcile();updateButton();
      const first=pending;pending=null;
      if(first&&first.expires>Date.now())cue(first.name,first.theme,first.heavy);
    }).catch(()=>{pending=null;});
  }
  function send(payload){
    const origin=root.location.origin;
    root.parent.postMessage({type:'frost-audio',...payload},root.location.protocol==='file:'||origin==='null'?'*':origin);
  }
  function sync(theme,nextStage='map',pressure=false,moving=false){
    const next=Object.hasOwn(scores,theme)?theme:null;
    const nextAction=Boolean(next&&moving&&(nextStage==='wok'||nextStage==='serve'));
    if(next===mood&&nextStage===stage&&pressure===urgent&&nextAction===action)return;
    const warning=pressure&&!urgent&&next!==null;
    mood=next;stage=nextStage;urgent=pressure;action=nextAction;
    if(embedded){send({theme:next,stage,urgent,action});return;}
    reconcile();
    if(warning)cue('warn',next);
  }

  function duck(t,duration,level=resultUntil>t?.13:.31){
    if(!music)return;
    music.gain.cancelScheduledValues(t);
    music.gain.setTargetAtTime(level,t,.011);
    music.gain.setTargetAtTime(.48,Math.max(t+duration,resultUntil),.066);
  }
  function stopResult(){
    if(!resultBus)return;
    const old=resultBus,t=context.currentTime;
    old.gain.setTargetAtTime(0,t,.018);
    root.setTimeout(()=>old.disconnect(),90);
    resultBus=null;resultUntil=0;
    if(music){
      music.gain.cancelScheduledValues(t);
      music.gain.setTargetAtTime(.48,t,.066);
    }
  }
  function finishCue(won,theme,t,song,material){
    stopResult();
    resultBus=context.createGain();
    resultBus.gain.value=.92;
    resultBus.connect(master);
    resultUntil=t+(won?2.74:4);
    duck(t,0);
    if(!won){
      failNotes.forEach((note,i)=>{
        const f=hz(song.key+note), start=t+failTimes[i], last=i===failNotes.length-1;
        tone(resultBus,start,f,last?.94:.22,last?.24:.205,song.voice,f*(last?.88:.985));
        tone(resultBus,start+.026,f/2,last?.88:.19,.12,'triangle');
        if(i===0||i===4||last)noise(resultBus,start,.115,.10,material.impact[2]*.55);
      });
      return;
    }
    const [notes,times,landing]=fanfares[theme]||fanfares.neon;
    notes.forEach((note,i)=>{
      const f=hz(song.key+note), start=t+times[i];
      tone(resultBus,start,f,.17,.23,song.voice);
      tone(resultBus,start+.042,f*2,.15,.085,material.shape);
    });
    for(const [i,time] of [0,.27,.53,landing,landing+.29].entries()){
      tone(resultBus,t+time,117,.17,.26,'sine',44);
      noise(resultBus,t+time,.14,.16,material.wok[i%2]);
    }
    for(const [i,note] of [0,4,7,12,19,24].entries()){
      const start=t+landing+i*.052;
      tone(resultBus,start,hz(song.key+note),1.38-i*.06,.12,i%2?song.voice:'triangle');
    }
  }
  function cue(name,theme=mood||'cover',heavy=false){
    if(!soundNames.includes(name))return;
    if(embedded){send({cue:name,heavy:heavy===true});return;}
    if(muted||!context||doc.hidden)return;
    if(context.state!=='running'){
      pending={name,theme,heavy,expires:Date.now()+300};
      return;
    }
    const t=context.currentTime+.008, song=scores[theme]||scores.cover;
    const material=materials[theme]||materials.neon;
    const voiced=name==='excellent'||name==='win'&&heavy;
    if(name==='win'||name==='fail'){
      finishCue(name==='win',theme,t,song,material);
      if(voiced){
        resultBus.gain.setValueAtTime(.20,t);
        resultBus.gain.setTargetAtTime(.92,t+1.15,.07);
        shoutExcellent(t);
      }
      return;
    }
    if(name==='enter')stopResult();
    const [high,low,texture]=material.impact;
    const beep=(f,end,d=.09,vol=.15,wave=song.voice,delay=0)=>tone(master,t+delay,f,d,vol,wave,end);
    const crack=(d,vol,f=texture,delay=0,type='bandpass')=>noise(master,t+delay,d,vol,f,type);
    if(name==='chop'){
      duck(t,.105);
      beep(low*1.25,low*.39,.115,.255,'triangle');
      crack(.054,.35,texture,0,'highpass');
      beep(high,low,.068,.17,material.shape);
      const count=heavy?4:3;
      for(let i=0;i<count;i++){
        const f=material.pieces[i],delay=.014+i*.027;
        const end=theme==='toilet'?f*1.36:f*.67;
        beep(f,end,theme==='fridge'?.15:.088,.159-i*.021,material.shape,delay);
        crack(.04,.115-i*.014,texture*(1-i*.125),delay);
      }
      if(heavy)crack(.165,.22,texture*.49,.08);
      return;
    }
    if(name==='flip'){
      duck(t,.2);
      const [hiss,crackle,ring]=material.wok;
      beep(low*.58,high*.69,.19,.22,'triangle');
      crack(.12,.28,hiss,.025,'highpass');
      for(let i=0;i<4;i++){
        crack(.064,.26-i*.035,crackle+i*165,.111+i*.038);
        beep(ring*(1+i*.42),ring*.54,.074,.13-i*.024,material.shape,.119+i*.039);
      }
      return;
    }
    if(name==='surge'||name==='hazard'){
      duck(t,.16);
      crack(name==='hazard'?.24:.135,.25,texture*.63);
      beep(high*.46,low*.48,.21,.19,material.shape);
      beep(material.serve[1]*1.65,material.serve[1]*.82,.115,.13,material.shape,.06);
      if(name==='hazard')beep(low*.61,low*.23,.29,.14,'triangle',.11);
      return;
    }
    if(voiced){shoutExcellent(t);return;}
    const melodies={
      start:[0,7,12,19],enter:material.entry,select:[7,12],card:[0,3,7,12],pickup:[0,12,19],station:[0,5,12],
      miss:[3,-2],warn:[12,7,12],good:[0,4,7,12]
    };
    const notes=melodies[name], spacing=name==='warn'?.12:.055;
    notes.forEach((note,i)=>{
      const f=hz(song.key+12+note),last=i===notes.length-1;
      beep(f,f,last?.17:.085,.14,song.voice,i*spacing);
    });
    if(name==='enter')crack(.15,.16,texture,.035);
    if(name==='good')beep(hz(song.key),hz(song.key),.24,.11,'triangle',spacing*2);
  }

  function stopAnnouncement(){
    if(!announcement)return;
    announcement();
    announcement=null;
  }
  function shoutExcellent(t){
    stopAnnouncement();
    duck(t,1.46,.085);
    if(recordedExcellent){
      const voice=context.createBufferSource(),gain=context.createGain();
      voice.buffer=recordedExcellent;
      gain.gain.value=1.36;
      voice.connect(gain);gain.connect(master);
      const stop=()=>{voice.stop();};
      voice.onended=()=>{
        voice.disconnect();gain.disconnect();
        if(announcement===stop)announcement=null;
      };
      announcement=stop;
      voice.start(t);
      return;
    }
    if(!voiceUrl||!root.Audio)return;
    const voice=new root.Audio(voiceUrl);
    voice.volume=.64;
    const stop=()=>voice.pause();
    const done=()=>{if(announcement===stop)announcement=null;};
    announcement=stop;
    voice.onended=done;
    voice.play().catch(done);
  }
  function mount(){
    button=doc.getElementById('audio-toggle');
    if(button){
      button.hidden=embedded||!AudioContext;
      button.onclick=()=>{
        if(!muted&&context?.state!=='running'){unlock();return;}
        muted=!muted;
        try{root.localStorage.setItem(storeKey,muted?'1':'0');}catch{}
        updateButton();
        if(muted){
          pending=null;
          stopAnnouncement();stopResult();
          if(master)master.gain.setTargetAtTime(0,context.currentTime,.015);
          reconcile();
        }else{
          if(master)master.gain.setTargetAtTime(.46,context.currentTime,.015);
          unlock();
        }
      };
      updateButton();
    }
    unlock();
  }
  function updateButton(){
    if(!button)return;
    button.setAttribute('aria-pressed',String(muted));
    const needsGesture=!muted&&context?.state!=='running';
    button.textContent=muted?'♪ 静音':needsGesture?'♪ 开启声音':'♪ 声音';
    button.setAttribute('aria-label',muted||needsGesture?'开启声音':'静音');
  }
  function unlockOnGesture(event){
    if(event.target!==button)unlock();
  }
  for(const name of ['pointerdown','pointerup','keydown','click'])doc.addEventListener(name,unlockOnGesture,{capture:true});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stopAnnouncement();reconcile();});
  root.addEventListener('pagehide',()=>{stopMusic();stopResult();stopAnnouncement();});
  root.addEventListener('pageshow',unlock);
  root.KitchenAudio={sync,cue,mount,unlock,relay(){embedded=true;}};
})(window);
