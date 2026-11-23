#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "kitchen_screen.h"
enum {KITCHEN_PIXELS=240, KITCHEN_TICK_MS=80};
/* Pure renderer shared by device, simulator and native regression tests. */
void kitchen_render(uint16_t *pixels, const uint8_t frame[20], unsigned tick,
                    unsigned effect_ticks, bool connected);
