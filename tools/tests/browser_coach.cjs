/* Run a local kitchen_server first. No physical devices or paid AI calls used. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const {chromium}=require(path.join(root,'.hardware-runtime/node_modules/playwright'));
const base=process.env.KITCHEN_TEST_URL||'http://127.0.0.1:8877';
const aiLines={slow:['咖啡要凉啦，找回刚才的小跑节奏！'],urgent:['来不及啦！这盘菜还等着你送呢！'],
  recover:['对对对，就是这个节奏！'],balance:['脚下可以快，手上可得稳！']};

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    for(const scene of ['coffee','neon','toilet','fridge']){
      const context=await browser.newContext({viewport:{width:1280,height:800}});
      context.setDefaultTimeout(10000);
      const errors=[];
      const assessments=[];
      const checkAssessment=scene==='coffee'||scene==='fridge';
      const assessmentLine='找回刚才的小跑节奏，下一站就在前面！';
      await context.addInitScript(()=>{
        window.__clock=0;window.__spoken=[];window.__streams=[];window.__cancelled=0;window.__voices=[{lang:'zh-CN'}];
        Date.now=()=>1700000000000+window.__clock;
        window.requestAnimationFrame=()=>0;
        window.EventSource=class{
          constructor(url){this.url=url;window.__streams.push(this);}
          close(){this.closed=true;}
          send(packet){this.onmessage?.({data:JSON.stringify(packet)});}
        };
        Object.defineProperty(window,'SpeechSynthesisUtterance',{value:class{constructor(text){this.text=text;}}});
        Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>window.__voices,
          speak:utterance=>{window.__lastUtterance=utterance;window.__spoken.push({text:utterance.text,rate:utterance.rate,pitch:utterance.pitch});},
          cancel:()=>window.__cancelled++}});
      });
      await context.route('**/api/screen',route=>route.fulfill({json:{accepted:false}}));
      await context.route('**/api/coach/assess',route=>{
        const summary=route.request().postDataJSON();
        assessments.push(summary);
        const message=summary.event==='recover'?aiLines.recover[0]:assessmentLine;
        return route.fulfill({json:{decision:'speak',kind:summary.event,text:message,source:'deepseek'}});
      });
      await context.route('**/api/coach',route=>scene==='toilet'?
        route.fulfill({status:503,json:{error:'Offline fixture'}}):route.fulfill({json:{lines:aiLines,source:'deepseek'}}));
      await context.route('**/*.html*',async route=>{
        const file=new URL(route.request().url()).pathname.split('/').pop();
        if(!['neon-chaos-kitchen.html','frost-kitchen.html'].includes(file)){await route.continue();return;}
        let html=fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n');
        if(file==='neon-chaos-kitchen.html')html=html.replace('requestAnimationFrame(frameLoop);\n})();',
          'window.__game={state,start,practice,toggleMenu,updateCoach,frameLoop,coach};\nrequestAnimationFrame(frameLoop);\n})();');
        else html=html.replace('requestAnimationFrame(frame);\n\n</script>',
          'window.__game={start,frame,getPhase:()=>phase,getScene:()=>scene};\nrequestAnimationFrame(frame);\n\n</script>');
        await route.fulfill({body:html,contentType:'text/html; charset=utf-8'});
      });
      const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/neon-chaos-kitchen.html?scene='+scene+'&foot=1');
      await page.click('#start');
      await page.waitForFunction(()=>window.__game&&window.KitchenAudio,null,{polling:100});
      // Let the user's click unlock the real Web Audio context.
      await page.waitForFunction(()=>document.querySelector('#audio-toggle').textContent==='♪ 声音',null,{polling:100});
      let child;
      if(scene==='fridge'){
        await page.waitForFunction(()=>document.querySelector('#frost-experience').contentWindow.__game,null,{polling:100});
        child=await (await page.$('#frost-experience')).contentFrame();
      }
      await page.evaluate(()=>{
        const foot=window.__streams.find(s=>s.url.includes('8768'));
        foot.send({type:'link',transport:'xiao-ble',connected:true});
      });
      let seq=0;
      async function tick(cadence,n=1){
        for(let i=0;i<n;i++){
          if(child)await child.evaluate(()=>{window.__clock+=200;window.__game.frame(window.__clock);});
          await page.evaluate(({cadence,seq,checkAssessment})=>{
            window.__clock+=200;
            window.__game.frameLoop(window.__clock);
            const foot=window.__streams.find(s=>s.url.includes('8768'));
            if(checkAssessment)foot.send({type:'activity',source:'xiao-foot',label:cadence>=80?'jog':'walk',
              confidence:.85,window_ms:2000,t_ms:seq*680,event_id:'activity:'+seq,sent_at_ms:Date.now()});
            foot.send({type:'pace',source:'xiao-foot',cadence,cycle_ms:seq*680,t_ms:seq*680+20,
              event_id:'pace:'+seq,sent_at_ms:Date.now()});
            window.__game.updateCoach();
          },{cadence,seq:++seq,checkAssessment});
        }
      }
      // No run events: live pace feedback never moves the avatar or grants travel.
      await tick(90,12);await tick(60,16);
      const bubble=page.locator('.kitchen-coach');
      await bubble.waitFor({state:'visible'});
      assert.equal(await bubble.getAttribute('data-kind'),'slow',scene+' slowdown reaches the real UI');
      assert((await page.evaluate(()=>window.__spoken.length))>0,scene+' requests Chinese narration');
      if(checkAssessment){
        assert.equal(await bubble.locator('p').textContent(),assessmentLine);
        assert.equal(assessments[0]?.activity,'walk');
        assert.equal(assessments[0]?.cadence,60);
        assert.equal(assessments[0]?.scene,scene);
        const status=(child||page).locator('#foot-activity');
        assert.equal(await status.textContent(),'脚踝 AI：行走 · 85%');
      }
      if(scene==='coffee'){
        await page.screenshot({path:path.join(root,'.hardware-runtime/coach-slow.png'),animations:'disabled'});
      }
      if(scene==='toilet')assert.notEqual(await bubble.locator('p').textContent(),aiLines.slow[0],'offline fallback is visible');
      if(scene==='fridge'){
        assert((await bubble.evaluate(e=>Number(getComputedStyle(e).zIndex)))>20,'parent bubble appears above the fridge iframe');
        await page.screenshot({path:path.join(root,'.hardware-runtime/coach-fridge.png'),animations:'disabled'});
      }
      await tick(60,28);await tick(90,10);
      await page.waitForFunction(()=>document.querySelector('.kitchen-coach').dataset.kind==='recover',null,{polling:100});
      assert.equal(await bubble.getAttribute('data-kind'),'recover',scene+' recovery follows a slowdown');
      if(checkAssessment)assert.equal(assessments.at(-1)?.activity,'jog');
      await page.evaluate(()=>window.__game.toggleMenu('pause'));
      assert(await bubble.isHidden(),'pause immediately hides the bubble');
      await tick(40,20);assert(await bubble.isHidden(),'paused input cannot re-open a bubble');
      await page.evaluate(()=>{
        window.__game.state.open='menu';window.__game.practice('serve');
      });
      // All four themes use the real shared serving challenge.
      for(let i=0;i<10;i++){
        await page.evaluate(()=>{window.__game.state.phase.tilt=.8;window.__game.state.phase.vel=0;});
        await tick(90);
      }
      assert.equal(await bubble.getAttribute('data-kind'),'balance');assert(await bubble.isVisible());
      if(scene==='coffee'){
        await page.screenshot({path:path.join(root,'.hardware-runtime/coach-balance.png'),animations:'disabled'});
        await page.setViewportSize({width:844,height:390});
        await page.screenshot({path:path.join(root,'.hardware-runtime/coach-mobile.png'),animations:'disabled'});
        const bounds=await bubble.boundingBox(),main=await page.locator('main').boundingBox();
        assert(bounds.x>=main.x&&bounds.x+bounds.width<=main.x+main.width+1,'bubble stays inside mobile viewport');
      }
      const before=await page.evaluate(()=>window.__cancelled);
      await page.click('#audio-toggle');
      assert((await page.evaluate(()=>window.__cancelled))>before,'muting cancels active speech');
      await page.click('#audio-toggle');
      const unavailable=await page.evaluate(()=>{
        window.__voices=[{lang:'en-US'}];
        return window.KitchenAudio.speak('稳稳端好盘子！','balance');
      });
      assert.equal(unavailable,false,'missing Chinese voice falls back to a cue');
      await page.evaluate(()=>{
        window.__voices=[{lang:'zh-CN'}];window.KitchenAudio.speak('稳稳端好盘子！','balance');
        window.__lastUtterance.onerror();
      });
      assert.deepEqual(errors,[],scene+' has no browser errors');
      console.log('PASS browser: '+scene+' slow/recovery/balance, Chinese narration, pause, mute and fallback.');
      await context.close();
    }
    // Standalone fridge uses the same coach without opening a second parent stream.
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/frost-kitchen.html?autostart=1&practice=serve');
    assert.equal(await page.locator('.kitchen-coach').count(),1);
    assert.deepEqual(errors,[]);await page.close();
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
