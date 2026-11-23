#include "app_hello.h"
#define GSP_BUNDLE_ENABLE_RAW_IDS
#include "bundle_gsp.h"
#include "screen_renderer.h"
#include <stdlib.h>
#include <string.h>

/* One render-task owner: timer polls an external latest-state mailbox. */
struct app_hello {
    esp_gsp_handle_t ui;
    app_hello_poll_t poll;
    void *poll_ctx;
    void *timer;
    uint16_t *pixels;
    uint8_t frame[20];
    unsigned tick, age, effect, count;
    esp_gsp_err_t last_error;
};

static void draw(const esp_gsp_canvas_surface_t *surface,void *ctx)
{
    const struct app_hello *s=ctx;
    for(unsigned y=0;y<surface->height;y++){
        uint8_t *row=(uint8_t *)surface->pixels+y*surface->stride_bytes;
        const unsigned source_y=(surface->y+y)/2;
        for(unsigned x=0;x<surface->width;x++){
            const uint16_t pixel=s->pixels[source_y*240+(surface->x+x)/2];
            if(surface->pixel_format==ESP_GSP_CANVAS_PIXEL_RGB565)memcpy(row+x*2,&pixel,2);
            else{row[x*3]=(pixel>>11)*255/31;row[x*3+1]=((pixel>>5)&63)*255/63;row[x*3+2]=(pixel&31)*255/31;}
        }
    }
}
static void tick(esp_gsp_handle_t ui,void *ctx)
{
    struct app_hello *s=ctx;
    uint8_t next[20];
    s->tick++;if(s->age<1000)s->age++;if(s->effect)s->effect--;
    if(s->poll&&s->poll(s->poll_ctx,next)&&kitchen_screen_valid(next,sizeof(next))){
        if(next[9]&&(memcmp(next+16,s->frame+16,4)||memcmp(next+10,s->frame+10,2)))s->effect=6;
        memcpy(s->frame,next,20);s->age=0;s->count++;
    }
    kitchen_render(s->pixels,s->frame,s->tick,s->effect,s->age<25);
    s->last_error=esp_gsp_canvas_invalidate(ui,GSP_HELLO_BIND_SURFACE);
}
esp_gsp_err_t app_hello_create_linked(esp_gsp_handle_t ui,app_hello_poll_t poll,void *ctx,app_hello_handle_t *out)
{
    if(!out)return ESP_GSP_ERR_INVALID_ARG;
    *out=NULL;if(!ui)return ESP_GSP_ERR_INVALID_ARG;
    struct app_hello *s=calloc(1,sizeof(*s));if(!s)return ESP_GSP_ERR_NO_MEM;
    s->pixels=calloc(240*240,sizeof(uint16_t));
    if(!s->pixels){free(s);return ESP_GSP_ERR_NO_MEM;}
    s->ui=ui;s->poll=poll;s->poll_ctx=ctx;s->age=1000;s->frame[0]=1;
    kitchen_render(s->pixels,s->frame,0,0,false);
    esp_gsp_err_t err=esp_gsp_canvas_set_draw_cb(ui,GSP_HELLO_BIND_SURFACE,draw,s);
    if(err!=ESP_GSP_OK){free(s->pixels);free(s);return err;}
    s->timer=esp_gsp_timer_create(ui,KITCHEN_TICK_MS,tick,s);
    if(!s->timer){
        /* Keep callback storage alive if detaching fails; caller sees failure. */
        err=esp_gsp_canvas_stop(ui,GSP_HELLO_BIND_SURFACE);
        if(err==ESP_GSP_OK&&esp_gsp_flush(ui,1000)==ESP_GSP_OK){free(s->pixels);free(s);}
        return ESP_GSP_ERR_NO_MEM;
    }
    *out=s;return ESP_GSP_OK;
}
esp_gsp_err_t app_hello_create(esp_gsp_handle_t ui,app_hello_handle_t *out)
{
    return app_hello_create_linked(ui,NULL,NULL,out);
}
esp_gsp_err_t app_hello_read(app_hello_handle_t s,app_hello_snapshot_t *out)
{
    if(!s||!out)return ESP_GSP_ERR_INVALID_ARG;
    *out=(app_hello_snapshot_t){.count=s->count,.celebrating=s->frame[1]==KITCHEN_WIN,.last_error=s->last_error};
    return ESP_GSP_OK;
}
esp_gsp_err_t app_hello_destroy(app_hello_handle_t *handle)
{
    if(!handle)return ESP_GSP_ERR_INVALID_ARG;
    struct app_hello *s=*handle;if(!s)return ESP_GSP_OK;
    if(s->timer){const esp_gsp_err_t e=esp_gsp_timer_delete(s->ui,s->timer);if(e!=ESP_GSP_OK)return e;s->timer=NULL;}
    esp_gsp_err_t e=esp_gsp_canvas_stop(s->ui,GSP_HELLO_BIND_SURFACE);if(e!=ESP_GSP_OK)return e;
    e=esp_gsp_flush(s->ui,1000);if(e!=ESP_GSP_OK)return e;
    free(s->pixels);free(s);*handle=NULL;return ESP_GSP_OK;
}
