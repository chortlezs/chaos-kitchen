// SPDX-License-Identifier: Apache-2.0
#pragma once
#include <stdbool.h>
#include <stdint.h>

/* Private sampler-owned state; acceleration in g, time in microseconds. */
typedef struct {
    int64_t previous_us, circle_started_us, last_turn_us;
    int64_t impulse_started_us, last_flip_us, quiet_since_us;
    float gravity[3], horizontal[2], previous_angle, turn, impulse;
    bool initialized, point_valid, stirring, flip_latched;
} wok_gesture_t;

typedef struct {
    bool stirring;
    bool flip;
} wok_result_t;

/* Flat horizontal circles hold stirring; a flat upward impulse fires one flip. */
wok_result_t wok_gesture_update(wok_gesture_t *state, int64_t now_us,
                                float ax, float ay, float az, float gx, float gy, float gz);
