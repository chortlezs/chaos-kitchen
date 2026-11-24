#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "screen_renderer.h"
#include "screen_cover.h"

int main(int argc,char **argv)
{
    uint16_t *memory=calloc(240*240+2,sizeof(uint16_t));assert(memory);
    uint16_t *pixels=memory+1;memory[0]=0x1234;memory[240*240+1]=0x5678;
    uint8_t frame[20]={1,0,0,0,70,95,7,2,3,1};frame[16]=1;
    for(unsigned theme=0;theme<4;theme++)for(unsigned dish=0;dish<6;dish++)for(unsigned stage=0;stage<9;stage++){
        frame[1]=stage;frame[2]=theme;frame[3]=dish;
        assert(kitchen_screen_valid(frame,20));
        kitchen_render(pixels,frame,stage*3,4,true);
        assert(memory[0]==0x1234&&memory[240*240+1]==0x5678);
        if(argc>1&&dish==0){
            char path[260];snprintf(path,sizeof(path),"%s/theme%u-stage%u.ppm",argv[1],theme,stage);
            FILE *file=fopen(path,"wb");assert(file);fprintf(file,"P6\n240 240\n255\n");
            for(unsigned i=0;i<240*240;i++){
                unsigned char rgb[3]={(pixels[i]>>11)*255/31,((pixels[i]>>5)&63)*255/63,(pixels[i]&31)*255/31};
                fwrite(rgb,1,3,file);
            }
            fclose(file);
        }
    }
    /* Cover is independent of a previous scene, food or a stale BLE frame. */
    for(unsigned theme=0;theme<4;theme++){
        frame[1]=KITCHEN_IDLE;frame[2]=theme;
        kitchen_render(pixels,frame,100,4,true);
        assert(memcmp(pixels,kitchen_cover_pixels,240*240*sizeof(*pixels))==0);
        frame[1]=KITCHEN_WOK;
        kitchen_render(pixels,frame,100,4,false);
        assert(memcmp(pixels,kitchen_cover_pixels,240*240*sizeof(*pixels))==0);
        assert(memory[0]==0x1234&&memory[240*240+1]==0x5678);
    }
    frame[6]=11;assert(!kitchen_screen_valid(frame,20));
    free(memory);puts("PASS: 216 theme/food/stage renders, protocol bounds and framebuffer canaries.");return 0;
}
