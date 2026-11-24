const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const noop=()=>{},elements=new Map();
function element(id){
  if(!elements.has(id)){
    const classes=new Set();
    elements.set(id,{value:'',hidden:false,textContent:'',innerHTML:'',dataset:{},
      classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},
      append:noop,replaceChildren:noop,focus:noop});
  }
  return elements.get(id);
}
const drawing=new Proxy({},{get:()=>noop,set:()=>true});
const canvas={getContext:()=>drawing,addEventListener:noop,focus:noop};
const document={hidden:false,body:{classList:{toggle:noop}},
  querySelector:s=>s==='#game'?canvas:element(s),querySelectorAll:()=>[],getElementById:element,
  createElement:()=>({value:'',textContent:'',classList:{toggle:noop}})};
const window={location:{search:'?scene=toilet',origin:'http://localhost'},addEventListener:noop};
const sandbox={document,window,requestAnimationFrame:noop,URLSearchParams,Math,console};
const html=fs.readFileSync('neon-chaos-kitchen.html','utf8').replace(/\r\n/g,'\n');
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace('requestAnimationFrame(frameLoop);\n})();',
  'globalThis.test={state,selectScene,start,phase,returnFromPhase};\n})();');
vm.runInNewContext(source,sandbox);
const game=sandbox.test;

for(const scene of ['neon','toilet','coffee']){
  game.state.open='menu';game.selectScene(scene);
  element('dish-select').value='1';
  game.start();
  for(const mode of ['chop','wok','serve']){
    game.phase(mode,1);
    game.state.held={id:1,stage:mode==='chop'?0:1};
    game.state.phase.done={success:true,label:mode==='wok'?'GOOD · 工件重组完成':'EXCELLENT · 完成'};
    game.returnFromPhase();
  }
  assert.equal(game.state.open,'end',scene+' reaches success screen');
  assert.equal(game.state.served,1,scene+' serves one order');
  assert.equal(element('menu-title').textContent,'大成功！！！',scene+' success title');
  assert.match(element('menu-copy').innerHTML,/% 完整度$/,'complete-level summary');
  assert.match(element('menu-hint').textContent,/切菜 EXCELLENT　·　颠锅 GOOD　·　端盘 EXCELLENT/,'three-stage grades');
  assert.equal(element('overlay').dataset.mode,'success','result theme hook');
  assert.equal(element('next-level').hidden,false,'next level available');
  assert.equal(element('next-level').classList.contains('primary'),true,'next level is primary');
  assert.equal(element('start').classList.contains('primary'),false,'restart is secondary');
  assert.equal(element('end-return').hidden,false,'return-to-levels visible');
  assert.equal(element('opening-return').hidden,true,'opening return replaced');
  assert.equal(element('scene-choice').hidden,true,'level selector hidden during result');
  assert.equal(element('practice').hidden,true,'practice tools hidden during result');
}

const css=fs.readFileSync('kitchen-theme.css','utf8');
for(const scene of ['neon','toilet','coffee']){
  assert(css.includes('body.'+scene+'-scene main #overlay[data-mode="success"]')||scene!=='neon',
    scene+' success palette override exists');
}
assert.match(css,/body\.neon-scene main #overlay\[data-mode="success"\]/);
assert.match(css,/body\.toilet-scene main #overlay\[data-mode="success"\]/);
assert.match(css,/body\.coffee-scene main #overlay\[data-mode="success"\]/);
console.log('PASS: neon office, toilet and coffee use the frost result hierarchy with scene-specific palettes.');
