#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "esp_gsp.h"
#include "kitchen_screen.h"

typedef struct app_hello *app_hello_handle_t;
typedef bool (*app_hello_poll_t)(void *ctx, uint8_t frame[KITCHEN_SCREEN_FRAME_SIZE]);
typedef struct {
    uint32_t count;
    bool celebrating;
    esp_gsp_err_t last_error;
} app_hello_snapshot_t;

/* UI/render-task owned controller. poll must be nonblocking, writes a complete
 * validated frame only on true, and outlive the controller. */
esp_gsp_err_t app_hello_create_linked(esp_gsp_handle_t ui, app_hello_poll_t poll,
                                     void *ctx, app_hello_handle_t *out);
esp_gsp_err_t app_hello_create(esp_gsp_handle_t ui, app_hello_handle_t *out);
/* Read only on UI task or after dispatch stops. */
esp_gsp_err_t app_hello_read(app_hello_handle_t handle, app_hello_snapshot_t *out);
/* Quiesce dispatch first. Retains handle if stopping timer/canvas fails. */
esp_gsp_err_t app_hello_destroy(app_hello_handle_t *handle);
