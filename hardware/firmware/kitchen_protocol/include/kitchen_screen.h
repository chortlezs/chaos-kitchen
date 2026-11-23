#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

enum {KITCHEN_SCREEN_FRAME_SIZE=20, KITCHEN_SCREEN_VERSION=1};
enum {KITCHEN_IDLE, KITCHEN_MAP, KITCHEN_CHOP, KITCHEN_WOK, KITCHEN_SERVE,
      KITCHEN_WIN, KITCHEN_FAIL, KITCHEN_PAUSE, KITCHEN_FLIP};
enum {KITCHEN_ACTIVE=1, KITCHEN_RUNNING=2, KITCHEN_EVENT_CHOP=1,
      KITCHEN_EVENT_FLIP=2, KITCHEN_EVENT_MISS=3};

/* BLE control: version,stage,theme,dish,progress,integrity,cuts,flips,flags,event,
 * event-counter u16, tilt i16 (-1000..1000), seconds u16, session u32. LE. */
static inline bool kitchen_screen_valid(const uint8_t *p, size_t size)
{
    if (!p || size!=KITCHEN_SCREEN_FRAME_SIZE) return false;
    const int16_t tilt=(int16_t)((uint16_t)p[12]|((uint16_t)p[13]<<8));
    return p[0]==1 && p[1]<=KITCHEN_FLIP && p[2]<4 && p[3]<6 && p[4]<=100 &&
        p[5]<=100 && p[6]<=10 && p[7]<=2 && !(p[8]&~3) && p[9]<=3 &&
        tilt>=-1000 && tilt<=1000;
}
