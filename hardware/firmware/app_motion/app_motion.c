// SPDX-License-Identifier: Apache-2.0

#include "app_motion.h"
#include "chop_cycle.h"
#include "wok_gesture.h"

#include <stdbool.h>
#include <math.h>
#include <stdint.h>

#include "bsp/esp_mosaico.h"
#include "esp_check.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "app_motion";

enum {
    SAMPLE_PERIOD_MS = 10,
    SAMPLE_LOG_PERIOD_MS = 500,
    WOK_HEARTBEAT_MS = 100,
    PLATE_HEARTBEAT_MS = 50,
};

static TaskHandle_t s_task;
static bool s_imu_ready;

static void emit_sample(float ax, float ay, float az, float gx, float gy, float gz)
{
    ESP_LOGI(TAG, "IMU_SAMPLE {\"t_ms\":%lld,\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.1f,\"gy\":%.1f,\"gz\":%.1f}",
             (long long)(esp_timer_get_time() / 1000), ax, ay, az, gx, gy, gz);
}

static void emit_chop(float ax, float ay, float az, float gx, float gy, float gz)
{
    ESP_LOGI(TAG, "MOTION_EVENT {\"action\":\"chop\",\"cycle\":\"down_up\",\"t_ms\":%lld,\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.1f,\"gy\":%.1f,\"gz\":%.1f}",
             (long long)(esp_timer_get_time() / 1000),
             ax, ay, az, gx, gy, gz);
}

static void emit_wok(bool active)
{
    ESP_LOGI(TAG, "MOTION_EVENT {\"action\":\"wok\",\"motion\":\"circle\",\"active\":%s,\"t_ms\":%lld}",
             active ? "true" : "false", (long long)(esp_timer_get_time() / 1000));
}

static void emit_plate(float ax, float ay, float az)
{
    const float tilt_x = atan2f(ax, sqrtf(ay * ay + az * az));
    const float tilt_y = atan2f(ay, sqrtf(ax * ax + az * az));
    const bool use_x = fabsf(tilt_x) >= fabsf(tilt_y);
    // The physical serving motion is mirrored relative to the browser cursor:
    // tilting the board left must move the cursor left, so invert the sensor sign.
    const float roll_rad = -(use_x ? tilt_x : tilt_y);
    const float roll = fmaxf(-1.0f, fminf(1.0f, roll_rad / 0.7853981634f));
    ESP_LOGI(TAG, "MOTION_EVENT {\"action\":\"plate\",\"motion\":\"tilt\",\"roll\":%.3f,\"axis\":\"%s\",\"t_ms\":%lld}",
             roll, use_x ? "x" : "y", (long long)(esp_timer_get_time() / 1000));
}

static void motion_task(void *arg)
{
    (void)arg;
    TickType_t last_wake = xTaskGetTickCount();
    int64_t last_sample_log_us = 0;
    chop_cycle_t cycle = {0};
    wok_gesture_t wok = {0};
    bool was_stirring = false;
    int64_t last_wok_log_us = 0;
    int64_t last_plate_log_us = 0;

    while (true) {
        float ax = 0.0f, ay = 0.0f, az = 0.0f;
        float gx = 0.0f, gy = 0.0f, gz = 0.0f;
        if (bsp_imu_get_accel(&ax, &ay, &az) == ESP_OK &&
            bsp_imu_get_gyro(&gx, &gy, &gz) == ESP_OK) {
            const int64_t now_us = esp_timer_get_time();

            if (now_us - last_sample_log_us >= SAMPLE_LOG_PERIOD_MS * 1000LL) {
                emit_sample(ax, ay, az, gx, gy, gz);
                last_sample_log_us = now_us;
            }

            if (chop_cycle_update(&cycle, now_us, gx, gy, gz)) {
                emit_chop(ax, ay, az, gx, gy, gz);
            }
            const wok_result_t action = wok_gesture_update(&wok, now_us, ax, ay, az, gx, gy, gz);
            if (action.stirring != was_stirring ||
                (action.stirring && now_us - last_wok_log_us >= WOK_HEARTBEAT_MS * 1000LL)) {
                emit_wok(action.stirring);
                last_wok_log_us = now_us;
            }
            was_stirring = action.stirring;
            if (action.flip) {
                ESP_LOGI(TAG, "MOTION_EVENT {\"action\":\"flip\",\"motion\":\"vertical\",\"t_ms\":%lld}",
                         (long long)(now_us / 1000));
            }
            if (now_us - last_plate_log_us >= PLATE_HEARTBEAT_MS * 1000LL) {
                emit_plate(ax, ay, az);
                last_plate_log_us = now_us;
            }
        } else {
            cycle = (chop_cycle_t){0};
            wok = (wok_gesture_t){0};
            if (was_stirring) emit_wok(false);
            was_stirring = false;
        }
        vTaskDelayUntil(&last_wake, pdMS_TO_TICKS(SAMPLE_PERIOD_MS));
    }
}

esp_err_t app_motion_start(void)
{
    if (s_task) {
        return ESP_ERR_INVALID_STATE;
    }
    const bsp_imu_config_t config = BSP_IMU_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(bsp_imu_init(), TAG, "initialize BMI270 failed");
    s_imu_ready = true;
    const esp_err_t start_err = bsp_imu_start(&config);
    if (start_err != ESP_OK) {
        (void)bsp_imu_deinit();
        s_imu_ready = false;
        return start_err;
    }
    const BaseType_t task_err = xTaskCreate(motion_task, "motion_task", 4096, NULL, 5, &s_task);
    if (task_err != pdPASS) {
        (void)bsp_imu_deinit();
        s_imu_ready = false;
        return ESP_ERR_NO_MEM;
    }
    ESP_LOGI(TAG, "BMI270 motion sampler started at %d Hz; chop=down_up cycle-v2; wok=circle flip=vertical wok-v2", 1000 / SAMPLE_PERIOD_MS);
    return ESP_OK;
}

esp_err_t app_motion_stop(void)
{
    if (!s_task) {
        return ESP_OK;
    }
    vTaskDelete(s_task);
    s_task = NULL;
    if (!s_imu_ready) {
        return ESP_OK;
    }
    const esp_err_t stop_err = bsp_imu_stop();
    const esp_err_t deinit_err = bsp_imu_deinit();
    s_imu_ready = false;
    return stop_err != ESP_OK ? stop_err : deinit_err;
}
