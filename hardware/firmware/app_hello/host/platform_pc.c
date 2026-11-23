#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "app_hello.h"
#include "gsp_sim_bridge.h"
static struct {app_hello_handle_t controller;unsigned tick;bool demo;} backend;
static bool demo_poll(void *ctx,uint8_t frame[20])
{
    (void)ctx;
    if(!backend.demo)return false;
    const unsigned tick=backend.tick++,phase=(tick/15)%9,theme=(tick/135)%4;
    memset(frame,0,20);frame[0]=1;frame[1]=phase;frame[2]=theme;frame[3]=(tick/135)%6;
    frame[4]=(tick%15)*7;frame[5]=96;frame[6]=(tick%15)*10/15;frame[7]=phase>=4?2:1;
    frame[8]=3;frame[9]=phase==2?1:phase==3?2:0;frame[10]=tick/3;frame[16]=1;
    return true;
}
esp_gsp_err_t gsp_bridge_app_init(esp_gsp_handle_t ui)
{
    backend.demo=getenv("KITCHEN_SCREEN_DEMO")!=NULL;
    return app_hello_create_linked(ui,demo_poll,NULL,&backend.controller);
}
void gsp_bridge_app_deinit(esp_gsp_handle_t ui)
{
    (void)ui;
    app_hello_snapshot_t snapshot;
    if(app_hello_read(backend.controller,&snapshot)==ESP_GSP_OK)
        fprintf(stderr,"kitchen_screen frames=%u error=%d\n",(unsigned)snapshot.count,(int)snapshot.last_error);
    const esp_gsp_err_t err=app_hello_destroy(&backend.controller);
    if(err!=ESP_GSP_OK)fprintf(stderr,"kitchen_screen cleanup=%d\n",err);
}
