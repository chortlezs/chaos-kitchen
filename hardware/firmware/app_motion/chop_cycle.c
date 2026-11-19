// SPDX-License-Identifier: Apache-2.0
#include "chop_cycle.h"

#include <math.h>

/* Hysteresis separates intentional movement from tremor and sensor noise. */
#define START_DPS 260.0f
#define RETURN_DPS 160.0f
#define QUIET_DPS 80.0f
#define MIN_ANGLE_DEG 12.0f
#define RETURN_FRACTION 0.65f
#define MAX_SAMPLE_GAP_US 100000LL
#define CYCLE_TIMEOUT_US 2000000LL
#define MIN_STROKE_US 40000LL
#define MIN_CYCLE_US 160000LL
#define QUIET_RESET_US 80000LL

static void start_stroke(chop_cycle_t *cycle, int64_t now_us,
                         float gx, float gy, float gz, float magnitude)
{
    cycle->phase = CHOP_OUTBOUND;
    cycle->axis[0] = gx / magnitude;
    cycle->axis[1] = gy / magnitude;
    cycle->axis[2] = gz / magnitude;
    cycle->outbound_angle = 0.0f;
    cycle->return_angle = 0.0f;
    cycle->started_us = now_us;
    cycle->quiet_since_us = 0;
}

bool chop_cycle_update(chop_cycle_t *cycle, int64_t now_us, float gx, float gy, float gz)
{
    if (!isfinite(gx) || !isfinite(gy) || !isfinite(gz) || now_us <= 0) {
        *cycle = (chop_cycle_t){0};
        return false;
    }
    const int64_t delta_us = now_us - cycle->previous_us;
    const bool gap = cycle->previous_us == 0 || delta_us <= 0 || delta_us > MAX_SAMPLE_GAP_US;
    cycle->previous_us = now_us;
    if (gap) {
        cycle->phase = CHOP_IDLE;
    }
    const float dt = gap ? 0.0f : (float)delta_us / 1000000.0f;
    const float magnitude = sqrtf(gx * gx + gy * gy + gz * gz);

    if (cycle->phase == CHOP_IDLE) {
        if (magnitude >= START_DPS) {
            start_stroke(cycle, now_us, gx, gy, gz, magnitude);
        }
        return false;
    }

    const float projected = gx * cycle->axis[0] + gy * cycle->axis[1] + gz * cycle->axis[2];
    if (cycle->phase == CHOP_HOLD) {
        /* The remaining upward motion cannot become a new downward stroke. */
        if (projected >= START_DPS) {
            start_stroke(cycle, now_us, gx, gy, gz, magnitude);
        } else if (magnitude < QUIET_DPS) {
            if (cycle->quiet_since_us == 0) {
                cycle->quiet_since_us = now_us;
            } else if (now_us - cycle->quiet_since_us >= QUIET_RESET_US) {
                cycle->phase = CHOP_IDLE;
            }
        } else {
            cycle->quiet_since_us = 0;
        }
        return false;
    }

    if (now_us - cycle->started_us > CYCLE_TIMEOUT_US) {
        cycle->phase = CHOP_HOLD;
        cycle->quiet_since_us = 0;
        return false;
    }
    if (cycle->phase == CHOP_OUTBOUND) {
        if (projected > QUIET_DPS) {
            cycle->outbound_angle += projected * dt;
        }
        if (projected <= -RETURN_DPS) {
            if (cycle->outbound_angle < MIN_ANGLE_DEG ||
                now_us - cycle->started_us < MIN_STROKE_US) {
                /* A brief spike followed by a bounce is not half a cut. */
                start_stroke(cycle, now_us, gx, gy, gz, magnitude);
                return false;
            }
            cycle->phase = CHOP_RETURN;
            cycle->return_started_us = now_us;
        }
    }
    if (cycle->phase == CHOP_RETURN) {
        if (projected < -QUIET_DPS) {
            cycle->return_angle += -projected * dt;
        } else if (projected >= START_DPS) {
            /* An incomplete return is discarded before the next stroke. */
            start_stroke(cycle, now_us, gx, gy, gz, magnitude);
            return false;
        }
        const float required = fmaxf(MIN_ANGLE_DEG, cycle->outbound_angle * RETURN_FRACTION);
        if (cycle->return_angle >= required &&
            now_us - cycle->return_started_us >= MIN_STROKE_US &&
            now_us - cycle->started_us >= MIN_CYCLE_US) {
            cycle->phase = CHOP_HOLD;
            cycle->quiet_since_us = 0;
            return true;
        }
    }
    return false;
}
