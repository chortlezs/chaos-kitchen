#pragma once

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"
#include "kitchen_screen.h"

typedef enum {
    APP_BLE_CHOP = 1,
    APP_BLE_WOK = 2,
    APP_BLE_FLIP = 3,
    APP_BLE_PLATE = 4,
} app_ble_action_t;

/** Start once after NVS initialization. USB/Iris remains independent. */
esp_err_t app_ble_start(void);

/** Nonblocking, single motion-task producer. Drops offline/stale data; never replays it.
 * roll is [-1,1], axis is 'x' or 'y', active only applies to wok. */
void app_ble_publish(app_ble_action_t action, bool active, float roll, char axis);

/** Nonblocking latest-state mailbox, called on UI task. true consumes one frame.
 * No references escape the short critical section. */
bool app_ble_read_screen(void *ctx, uint8_t frame[KITCHEN_SCREEN_FRAME_SIZE]);
