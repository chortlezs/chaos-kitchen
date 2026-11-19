// SPDX-License-Identifier: Apache-2.0
#pragma once

#include <stdbool.h>
#include <stdint.h>

typedef enum {
    CHOP_IDLE,
    CHOP_OUTBOUND,
    CHOP_RETURN,
    CHOP_HOLD,
} chop_phase_t;

/* Private, single-owner state. Angles are degrees, gyro samples degrees/second. */
typedef struct {
    chop_phase_t phase;
    float axis[3];
    float outbound_angle;
    float return_angle;
    int64_t previous_us;
    int64_t started_us;
    int64_t return_started_us;
    int64_t quiet_since_us;
} chop_cycle_t;

/* Count once after a substantial stroke and its opposite return stroke. */
bool chop_cycle_update(chop_cycle_t *cycle, int64_t now_us, float gx, float gy, float gz);
