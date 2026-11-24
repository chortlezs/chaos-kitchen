/* Export the actual browser artwork into compact RGB565 sprite spans. */
const fs=require('fs'),path=require('path'),vm=require('vm');
const {createCanvas,GlobalFonts,loadImage}=require('../.hardware-runtime/node_modules/@napi-rs/canvas');
(async()=>{
const out=path.resolve(process.argv[2]||'hardware/firmware/app_hello');
fs.mkdirSync(path.join(out,'ui'),{recursive:true});
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyhbd.ttc','Kitchen');
const box={window:{},Math};
for(const file of ['kitchen-items.js','kitchen-cookware.js','kitchen-art.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),box);
const sprites=[];
function asset(name,w,h,paint){
  const canvas=createCanvas(w,h),g=canvas.getContext('2d');g.imageSmoothingEnabled=false;paint(g);
  const pixels=g.getImageData(0,0,w,h).data,spans=[];
  const pixel=(x,y)=>{const i=(y*w+x)*4;return pixels[i+3]<128?-1:((pixels[i]>>3)<<11)|((pixels[i+1]>>2)<<5)|(pixels[i+2]>>3);};
  for(let y=0;y<h;y++)for(let x=0;x<w;){const color=pixel(x,y);if(color<0){x++;continue;}const start=x++;while(x<w&&pixel(x,y)===color)x++;spans.push(start,y,x-start,color);}
  sprites.push({name,w,h,spans});
}
function text(name,line,color='#fff0d1',size=12,w=224){asset(name,w,21,g=>{g.font=`bold ${size}px Kitchen`;g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.fillText(line,w/2,10);});}
const themes=['neon','fridge','toilet','coffee'];
for(const theme of themes){
  for(let id=0;id<6;id++){
    asset(`food_${theme}_${id}`,104,82,g=>box.window.KitchenItems.draw(g,theme,id,52,46,1.12));
    for(let part=0;part<3;part++)asset(`part_${theme}_${id}_${part}`,104,82,g=>box.window.KitchenItems.draw(g,theme,id,52,46,1.12,part));
  }
  asset(`pan_${theme}`,200,112,g=>box.window.KitchenCookware.draw(g,100,49,.55,theme));
  asset(`board_${theme}`,216,100,g=>box.window.KitchenCookware.board(g,108,46,.37,theme));
  asset(`tray_${theme}`,220,118,g=>{
    g.translate(110,57);
    const colors={neon:['#10143c','#7771d8','#d5d5ff','#f7efff'],fridge:['#193356','#5487b3','#b9efff','#f2feff'],toilet:['#315568','#83b9b7','#fff7df','#ffffff'],coffee:['#42291e','#ac7548','#edbf7c','#fff0c7']}[theme];
    [[101,47,9,colors[0]],[99,45,5,colors[1]],[97,43,0,colors[2]],[88,35,-1,colors[3]]].forEach(([rx,ry,y,color])=>{g.fillStyle=color;g.beginPath();g.ellipse(0,y,rx,ry,0,0,Math.PI*2);g.fill();});
    box.window.KitchenArt.tray(g,96,43,theme,0);
  });
  asset(`chef_${theme}`,100,108,g=>box.window.KitchenArt.chef(g,50,81,2.15,theme,0,false));
}
const titles=['等你开锅','下一站，开火！','分解砧板 · 切菜','平持画圈 · 翻炒','稳稳端好这道菜','大成功！','再来一次！','休息一下','现在向上颠！'];
const hints=['把今天的心情，做成一道菜','原地小跑 · 到站开始料理','下切并抬回 · 一下一上一刀','继续画圈，等候翻面提示','小跑前进 · 左右轻倾保持平衡','今天的情绪料理，出锅啦','调整一下，我们再试一次','准备好后，在网页继续','短促向上颠 · 让食材翻个身'];
for(let i=0;i<titles.length;i++){text('title_'+i,titles[i]);text('hint_'+i,hints[i],'#e7ba8c',9);}
for(const [i,name] of ['赛博办公室','冰封后厨','马桶水箱','咖啡豆仓'].entries())text('theme_'+i,name,'#ffffff',10);
for(const [i,name] of ['订书机','老板','文件夹','打印机','键盘','空调'].entries())text('dish_'+i,name,'#fff0d1',12);
text('connected','CHAOS KITCHEN / 体感料理中','#fff0d1',9);
text('disconnected','等待游戏连接…','#f5c78b',12);
text('good','漂亮！','#fff0a3',16,90);text('miss','再找准时机','#ffbcab',12,110);
const h=['#pragma once','#include <stdint.h>','typedef struct {uint16_t width,height;uint32_t count;const uint16_t *spans;} kitchen_sprite_t;'];
const c=['/* Generated from the browser artwork; regenerate with tools/generate-screen-assets.cjs. */','#include "screen_assets.h"'];
for(const s of sprites){h.push(`extern const kitchen_sprite_t ${s.name};`);c.push(`static const uint16_t ${s.name}_pixels[]={${s.spans.join(',')}};`,`const kitchen_sprite_t ${s.name}={${s.w},${s.h},${s.spans.length/4},${s.name}_pixels};`);}
for(const name of ['food','pan','board','tray','chef']){
 h.push(`extern const kitchen_sprite_t *const kitchen_${name}[${name==='food'?24:4}];`);
 c.push(`const kitchen_sprite_t *const kitchen_${name}[]={${themes.flatMap(t=>name==='food'?Array.from({length:6},(_,i)=>`&food_${t}_${i}`):[`&${name}_${t}`]).join(',')}};`);
}
h.push('extern const kitchen_sprite_t *const kitchen_parts[72];');
c.push(`const kitchen_sprite_t *const kitchen_parts[]={${themes.flatMap(t=>Array.from({length:6},(_,i)=>Array.from({length:3},(_,j)=>`&part_${t}_${i}_${j}`))).flat().join(',')}};`);
for(const [name,count] of [['title',9],['hint',9],['theme',4],['dish',6]]){h.push(`extern const kitchen_sprite_t *const kitchen_${name}[${count}];`);c.push(`const kitchen_sprite_t *const kitchen_${name}[]={${Array.from({length:count},(_,i)=>'&'+name+'_'+i).join(',')}};`);}
fs.writeFileSync(path.join(out,'screen_assets.h'),h.join('\n')+'\n');fs.writeFileSync(path.join(out,'screen_assets.c'),c.join('\n')+'\n');
// Preserve the complete landscape cover inside a square, with the same warm
// background, headline and start-button treatment as the browser. RGB565 raw
// pixels use less flash than spans for this detailed, fully opaque artwork.
const cover=createCanvas(240,240),cg=cover.getContext('2d');
const coverArt=await loadImage(path.join(__dirname,'..','assets','opening-cover.webp'));
const gold=cg.createRadialGradient(120,115,4,120,115,190);
gold.addColorStop(0,'#ffe6a1');gold.addColorStop(.6,'#ffc05d');gold.addColorStop(1,'#e88b35');
cg.fillStyle=gold;cg.fillRect(0,0,240,240);
for(let i=0;i<24;i++){
  const angle=i*Math.PI/12;
  cg.fillStyle=i%2?'#fff0b52a':'#e9792020';cg.beginPath();cg.moveTo(120,115);
  cg.lineTo(120+340*Math.cos(angle),115+340*Math.sin(angle));
  cg.lineTo(120+340*Math.cos(angle+.11),115+340*Math.sin(angle+.11));cg.fill();
}
for(const [inset,color] of [[0,'#60271e'],[2,'#ffde82'],[4,'#b75b24'],[5,'#fff0bb']]){
  cg.strokeStyle=color;cg.lineWidth=1;cg.strokeRect(inset+.5,inset+.5,239-inset*2,239-inset*2);
}
cg.textAlign='center';cg.textBaseline='middle';cg.fillStyle='#60271e';
cg.font='bold 14px Kitchen';cg.fillText('AI 情绪厨房',120,23);
cg.imageSmoothingEnabled=true;cg.drawImage(coverArt,8,42,224,224*coverArt.height/coverArt.width);
cg.fillStyle='#60271e';cg.font='bold 10px Kitchen';cg.fillText('把今天的心情，做成一道菜。',120,174);
cg.fillStyle='#60271e';cg.fillRect(60,192,122,27);
cg.fillStyle='#a43a20';cg.fillRect(60,189,122,27);
cg.fillStyle='#60271e';cg.fillRect(58,187,122,27);
const button=cg.createLinearGradient(0,189,0,211);button.addColorStop(0,'#fff4b7');button.addColorStop(1,'#ffb947');
cg.fillStyle=button;cg.fillRect(60,189,118,23);
cg.strokeStyle='#ffed94';cg.strokeRect(61.5,190.5,115,20);
cg.font='bold 16px Kitchen';cg.lineWidth=2;cg.strokeStyle='#59251a';cg.strokeText('心情开锅',119,201);
cg.fillStyle='#fff5d0';cg.fillText('心情开锅',119,201);
cg.font='bold 8px Kitchen';cg.fillStyle='#75311f';cg.fillText('在网页点击，开启今日料理',120,226);
const rgba=cg.getImageData(0,0,240,240).data,coverPixels=[];
for(let i=0;i<rgba.length;i+=4)coverPixels.push(((rgba[i]>>3)<<11)|((rgba[i+1]>>2)<<5)|(rgba[i+2]>>3));
const rows=Array.from({length:240},(_,y)=>coverPixels.slice(y*240,(y+1)*240).join(',')).join(',\n');
fs.writeFileSync(path.join(out,'screen_cover.h'),'#pragma once\n#include <stdint.h>\nextern const uint16_t kitchen_cover_pixels[240*240];\n');
fs.writeFileSync(path.join(out,'screen_cover.c'),'/* Generated from assets/opening-cover.webp; regenerate with tools/generate-screen-assets.cjs. */\n#include "screen_cover.h"\nconst uint16_t kitchen_cover_pixels[240*240]={\n'+rows+'\n};\n');
fs.writeFileSync(path.join(__dirname,'..','.hardware-runtime','cover-preview.png'),cover.toBuffer('image/png'));
const blank=createCanvas(480,480);blank.getContext('2d').fillRect(0,0,480,480);
fs.writeFileSync(path.join(out,'ui','canvas.png'),blank.toBuffer('image/png'));
fs.writeFileSync(path.join(out,'ui','main.json'),JSON.stringify({screen:'hello',w:480,h:480,screen_bg:'#11152b',font:'fonts/DejaVuSans.ttf',font_charset:' ',objects:[{type:'image',parent:-1,x:0,y:0,w:480,h:480,image:'canvas.png',codec:'lossless',bind:'surface',name:'surface'}]},null,2));
console.log(JSON.stringify({sprites:sprites.length,bytes:sprites.reduce((n,s)=>n+s.spans.length*2,0),output:out}));
})().catch(error=>{console.error(error);process.exitCode=1;});
