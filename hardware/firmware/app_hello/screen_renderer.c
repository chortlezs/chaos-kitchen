#include "screen_renderer.h"
#include "screen_assets.h"
#include <math.h>
#include <stddef.h>

typedef struct {uint16_t bg,panel,edge,accent,light,muted;} palette_t;
#define RGB(r,g,b) (uint16_t)((((r)>>3)<<11)|(((g)>>2)<<5)|((b)>>3))
static const palette_t palettes[]={
 {RGB(6,6,34),RGB(20,18,67),RGB(56,223,255),RGB(255,71,232),RGB(239,254,255),RGB(65,60,114)},
 {RGB(16,37,67),RGB(29,58,89),RGB(150,215,235),RGB(120,236,255),RGB(242,253,255),RGB(66,102,138)},
 {RGB(31,68,80),RGB(49,85,104),RGB(188,233,220),RGB(236,203,123),RGB(255,247,223),RGB(82,137,145)},
 {RGB(45,27,22),RGB(76,48,34),RGB(237,191,124),RGB(226,163,93),RGB(255,240,199),RGB(128,80,53)}
};
typedef struct {uint16_t *pixels;} canvas_t;
static void rect(canvas_t *c,int x,int y,int w,int h,uint16_t color)
{
    if(x<0){w+=x;x=0;}if(y<0){h+=y;y=0;}
    if(x+w>240)w=240-x;
    if(y+h>240)h=240-y;
    if(w<=0||h<=0)return;
    for(int j=y;j<y+h;j++)for(int i=x;i<x+w;i++)c->pixels[j*240+i]=color;
}
static void panel(canvas_t *c,int x,int y,int w,int h,const palette_t *p)
{
    rect(c,x+3,y+3,w,h,p->muted);rect(c,x,y,w,h,p->edge);
    rect(c,x+2,y+2,w-4,h-4,p->panel);rect(c,x+7,y+4,w-14,1,p->light);
}
static void sprite(canvas_t *c,const kitchen_sprite_t *s,int x,int y)
{
    for(uint32_t i=0;i<s->count;i++){
        const uint16_t *v=s->spans+i*4;
        rect(c,x+v[0],y+v[1],v[2],1,v[3]);
    }
}
static void centered(canvas_t *c,const kitchen_sprite_t *s,int y){sprite(c,s,(240-s->width)/2,y);}
static void tilted_sprite(canvas_t *c,const kitchen_sprite_t *s,int x,int y,int16_t tilt)
{
    const float angle=tilt*.00022f,cs=cosf(angle),sn=sinf(angle);
    const int cx=s->width/2,cy=s->height/2;
    for(uint32_t i=0;i<s->count;i++){
        const uint16_t *v=s->spans+i*4;
        for(int j=0;j<v[2];j++){
            const int px=v[0]+j-cx,py=v[1]-cy;
            rect(c,x+cx+(int)(px*cs-py*sn),y+cy+(int)(px*sn+py*cs),2,2,v[3]);
        }
    }
}
static void digit(canvas_t *c,int n,int x,int y,int scale,uint16_t color)
{
    static const uint16_t bits[]={0x7b6f,0x2492,0x73e7,0x73cf,0x5bc9,0x79cf,0x79ef,0x7249,0x7bef,0x7bcf};
    const uint16_t v=bits[n%10];
    for(int j=0;j<5;j++)for(int i=0;i<3;i++)if(v&(1u<<(14-j*3-i)))rect(c,x+i*scale,y+j*scale,scale,scale,color);
}
static void number(canvas_t *c,int n,int x,int y,int scale,uint16_t color)
{
    if(n>=100)digit(c,n/100,x-8*scale,y,scale,color);
    if(n>=10)digit(c,n/10,x-4*scale,y,scale,color);
    digit(c,n,x,y,scale,color);
}
static void particles(canvas_t *c,const palette_t *p,unsigned tick,int count,int mode)
{
    for(int i=0;i<count;i++){
        const int x=18+(i*53+tick*(mode?2:1))%205;
        const int y=76+(i*29+tick*(mode?5:2))%118;
        rect(c,x,y,mode?3:2,mode?5:2,i%3?p->accent:p->light);
        if(!mode){rect(c,x-2,y+1,6,1,p->edge);}
    }
}
static void arrow(canvas_t *c,int y,const palette_t *p)
{
    for(int row=0;row<18;row++)rect(c,120-row,y+row,row*2+1,2,p->light);
    rect(c,114,y+15,13,26,p->accent);
}
void kitchen_render(uint16_t *pixels,const uint8_t f[20],unsigned tick,unsigned effect,bool linked)
{
    canvas_t c={pixels};
    const unsigned stage=linked?f[1]:KITCHEN_IDLE,theme=f[2]<4?f[2]:0,dish=f[3]<6?f[3]:0;
    const palette_t *p=&palettes[theme];
    rect(&c,0,0,240,240,p->bg);
    for(int x=0;x<240;x+=16)rect(&c,x,67,1,127,p->panel);
    for(int y=67;y<195;y+=16)rect(&c,0,y,240,1,p->panel);
    rect(&c,0,0,240,3,p->edge);rect(&c,0,237,240,3,p->accent);
    centered(&c,&connected,3);
    centered(&c,kitchen_theme[theme],22);
    panel(&c,10,45,220,28,p);centered(&c,kitchen_title[stage],49);
    const int bob=(int)(sinf(tick*.26f)*3);
    const kitchen_sprite_t *food=kitchen_food[theme*6+dish];
    const int16_t tilt=(int16_t)((uint16_t)f[12]|((uint16_t)f[13]<<8));
    if(stage==KITCHEN_CHOP){
        sprite(&c,kitchen_board[theme],12,97);
        if(f[6]<3)sprite(&c,food,68+(effect?((tick%2)?2:-2):0),99);
        else for(unsigned part=0;part<3;part++){
            const int spread=f[6]*2;
            sprite(&c,kitchen_parts[(theme*6+dish)*3+part],68+((int)part-1)*spread,99+(part==1?4:0));
        }
        const int ky=effect?116:89+bob;
        rect(&c,171,ky,7,37,p->light);rect(&c,178,ky+5,4,32,p->edge);
        rect(&c,171,ky-17,9,18,p->accent);rect(&c,172,ky+35,8,3,p->muted);
        if(effect)particles(&c,p,tick,12,0);
        number(&c,f[6],205,85,3,p->light);
    }else if(stage==KITCHEN_WOK||stage==KITCHEN_FLIP){
        const int sway=(f[8]&1)?(int)(sinf(tick*.7f)*5):0;
        sprite(&c,kitchen_pan[theme],20+sway,100);
        const int lift=effect&&f[9]==KITCHEN_EVENT_FLIP?24-(int)(tick%5)*4:0;
        sprite(&c,food,68+sway,84-lift);
        if(f[8]&1)for(int i=0;i<5;i++)rect(&c,73+i*20,171-(tick+i*3)%13,6,9,p->accent);
        if(stage==KITCHEN_FLIP){arrow(&c,77+(tick%3)*2,p);rect(&c,5,76,3,114,tick%2?p->accent:p->light);rect(&c,232,76,3,114,tick%2?p->accent:p->light);}
        if(effect)centered(&c,f[9]==KITCHEN_EVENT_MISS?&miss:&good,78);
    }else if(stage==KITCHEN_SERVE){
        const int shift=tilt/55;
        for(int i=0;i<9;i++){const int y=79+(i*15+((f[8]&2)?tick*3:0))%115;rect(&c,40-(y-79)/4,y,160+(y-79)/2,1,p->muted);}
        tilted_sprite(&c,kitchen_tray[theme],10+shift,84+bob,tilt);
        tilted_sprite(&c,food,68+shift,85+bob,tilt);
        rect(&c,41,184,158,6,p->muted);rect(&c,106,184,28,6,p->edge);
        rect(&c,118+tilt/16,180,4,14,p->light);
        if(f[5]<50&&tick%2)rect(&c,4,76,3,118,p->accent);
    }else{
        const int cx=stage==KITCHEN_MAP?25:70;
        sprite(&c,kitchen_chef[theme],cx,80+bob);
        if(stage==KITCHEN_MAP)sprite(&c,food,122,107+bob);
        if(stage==KITCHEN_WIN)particles(&c,p,tick,35,1);
        if(stage==KITCHEN_FAIL){rect(&c,83,135,7,3,p->accent);rect(&c,144,135,7,3,p->accent);}
        if(stage==KITCHEN_PAUSE){rect(&c,107,127,9,30,p->light);rect(&c,125,127,9,30,p->light);}
    }
    if(stage!=KITCHEN_IDLE&&stage!=KITCHEN_PAUSE){
        centered(&c,kitchen_dish[dish],191);
        panel(&c,16,214,208,9,p);
        const int progress=stage==KITCHEN_CHOP?f[6]*10:f[4];
        rect(&c,19,217,progress*202/100,3,p->accent);
        number(&c,progress,211,198,1,p->light);
    }
    if(!linked)centered(&c,&disconnected,215);
    else centered(&c,kitchen_hint[stage],220);
}
