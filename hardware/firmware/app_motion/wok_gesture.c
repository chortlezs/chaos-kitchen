// SPDX-License-Identifier: Apache-2.0
#include "wok_gesture.h"
#include <math.h>

#define PI_F 3.14159265358979323846f
#define CIRCLE_MIN_G 0.045f
#define CIRCLE_MAX_VERTICAL_G 0.40f
#define MIN_FLAT_COS 0.80f
#define MAX_TILT_RATE_DPS 200.0f
#define MAX_POINT_TURN_RAD 1.20f
#define MIN_POINT_TURN_RAD 0.004f
#define CIRCLE_TURN_DECAY_SECONDS 0.9f
#define CIRCLE_CONFIRM_RAD 1.4f
#define CIRCLE_WARMUP_US 250000LL
#define CIRCLE_STOP_US 250000LL
#define FLIP_MIN_UP_G 0.25f
#define FLIP_MIN_IMPULSE 0.008f
#define FLIP_LATERAL_FRACTION 0.5f
#define FLIP_CONFIRM_US 10000LL
#define FLIP_COOLDOWN_US 700000LL
#define FLIP_QUIET_US 180000LL
#define MAX_SAMPLE_GAP_US 100000LL

static void reset_circle(wok_gesture_t *state)
{
    state->point_valid = false;
    state->stirring = false;
    state->turn = 0.0f;
}

wok_result_t wok_gesture_update(wok_gesture_t *state, int64_t now_us,
                                float ax, float ay, float az, float gx, float gy, float gz)
{
    wok_result_t result = {0};
    if (!isfinite(ax) || !isfinite(ay) || !isfinite(az) ||
        !isfinite(gx) || !isfinite(gy) || !isfinite(gz) || now_us <= 0) {
        *state = (wok_gesture_t){0};
        return result;
    }
    const int64_t gap = now_us - state->previous_us;
    if (!state->initialized || gap <= 0 || gap > MAX_SAMPLE_GAP_US) {
        *state = (wok_gesture_t){0};
        if (sqrtf(ax * ax + ay * ay + az * az) < 0.5f) return result;
        state->gravity[0] = ax;
        state->gravity[1] = ay;
        state->gravity[2] = az;
        state->previous_us = now_us;
        state->last_flip_us = now_us - FLIP_COOLDOWN_US;
        state->initialized = true;
        return result;
    }
    state->previous_us = now_us;
    const float dt = gap / 1000000.0f;
    const float gravity_alpha = dt / (0.65f + dt);
    const float horizontal_alpha = dt / (0.025f + dt);
    const float values[3] = {ax, ay, az};
    for (unsigned i = 0; i < 3; ++i) {
        state->gravity[i] += gravity_alpha * (values[i] - state->gravity[i]);
    }
    for (unsigned i = 0; i < 2; ++i) {
        const float linear = values[i] - state->gravity[i];
        state->horizontal[i] += horizontal_alpha * (linear - state->horizontal[i]);
    }
    const float gravity_norm = sqrtf(state->gravity[0] * state->gravity[0] +
                                    state->gravity[1] * state->gravity[1] +
                                    state->gravity[2] * state->gravity[2]);
    const float roll_pitch_rate = sqrtf(gx * gx + gy * gy);
    const bool flat = gravity_norm > 0.5f && fabsf(state->gravity[2]) / gravity_norm >= MIN_FLAT_COS &&
                      roll_pitch_rate <= MAX_TILT_RATE_DPS;
    const float up = az * (state->gravity[2] >= 0.0f ? 1.0f : -1.0f) - 1.0f;
    const float lateral = sqrtf(state->horizontal[0] * state->horizontal[0] +
                               state->horizontal[1] * state->horizontal[1]);

    /* Confirm a real upward impulse, then lock through its downward/landing rebound. */
    if (state->flip_latched) {
        if (fabsf(up) < 0.20f && roll_pitch_rate < 80.0f) {
            if (!state->quiet_since_us) state->quiet_since_us = now_us;
            if (now_us - state->quiet_since_us >= FLIP_QUIET_US &&
                now_us - state->last_flip_us >= FLIP_COOLDOWN_US) state->flip_latched = false;
        } else {
            state->quiet_since_us = 0;
        }
    }
    const bool impulse = flat && up >= FLIP_MIN_UP_G && up >= lateral * FLIP_LATERAL_FRACTION;
    if (impulse && !state->flip_latched) {
        if (!state->impulse_started_us) state->impulse_started_us = now_us;
        state->impulse += up * dt;
        if (now_us - state->impulse_started_us >= FLIP_CONFIRM_US &&
            state->impulse >= FLIP_MIN_IMPULSE && now_us - state->last_flip_us >= FLIP_COOLDOWN_US) {
            result.flip = true;
            state->flip_latched = true;
            state->last_flip_us = now_us;
            state->quiet_since_us = 0;
        }
    } else {
        state->impulse_started_us = 0;
        state->impulse = 0.0f;
    }
    if (!flat || fabsf(up) > CIRCLE_MAX_VERTICAL_G || result.flip ||
        state->flip_latched) {
        reset_circle(state);
        return result;
    }

    /* A short reversal subtracts evidence instead of discarding the whole circle. */
    state->turn *= expf(-dt / CIRCLE_TURN_DECAY_SECONDS);
    if (lateral >= CIRCLE_MIN_G) {
        const float angle = atan2f(state->horizontal[1], state->horizontal[0]);
        if (!state->point_valid) {
            state->point_valid = true;
            state->circle_started_us = now_us;
            state->last_turn_us = now_us;
            state->turn = 0.0f;
        } else {
            float delta = angle - state->previous_angle;
            if (delta > PI_F) delta -= 2.0f * PI_F;
            if (delta < -PI_F) delta += 2.0f * PI_F;
            if (fabsf(delta) > MAX_POINT_TURN_RAD) {
                reset_circle(state); /* A line reversing direction is not a circle. */
            } else if (fabsf(delta) >= MIN_POINT_TURN_RAD) {
                state->turn = fmaxf(-4.0f * PI_F, fminf(4.0f * PI_F, state->turn + delta));
                state->last_turn_us = now_us;
                if (fabsf(state->turn) >= CIRCLE_CONFIRM_RAD && now_us - state->circle_started_us >= CIRCLE_WARMUP_US) {
                    state->stirring = true;
                }
            }
        }
        state->previous_angle = angle;
    }
    if (now_us - state->last_turn_us >= CIRCLE_STOP_US) reset_circle(state);
    result.stirring = state->stirring;
    return result;
}
