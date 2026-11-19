// SPDX-License-Identifier: Apache-2.0
#include "wok_gesture.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>

static wok_gesture_t state;
static int64_t now_us;
static unsigned flips, stirring_samples;
static wok_result_t last;

static void feed(float ax, float ay, float az, float gx, float gy, float gz, int ms)
{
    for (int i = 0; i < ms; i += 10) {
        now_us += 10000;
        last = wok_gesture_update(&state, now_us, ax, ay, az, gx, gy, gz);
        flips += last.flip;
        stirring_samples += last.stirring;
    }
}

static void reset(void)
{
    state = (wok_gesture_t){0};
    now_us = 1000000;
    flips = stirring_samples = 0;
    feed(0, 0, 1, 0, 0, 0, 1000);
}

static void circle(int direction, float amplitude, int ms)
{
    for (int i = 0; i < ms; i += 10) {
        const float angle = direction * 6.2831853f * i / 1000.0f;
        feed(amplitude * cosf(angle), amplitude * sinf(angle), 1, 0, 0, 5, 10);
    }
}

static void replay_user_trace(const char *path)
{
    FILE *file = fopen(path, "r");
    assert(file);
    wok_gesture_t replay = {0};
    long long ms;
    float ax, ay, az, gx, gy, gz;
    unsigned flip_count = 0, circle_count = 0, circle_active = 0;
    while (fscanf(file, "%lld,%f,%f,%f,%f,%f,%f", &ms, &ax, &ay, &az, &gx, &gy, &gz) == 7) {
        const wok_result_t result = wok_gesture_update(&replay, ms * 1000, ax, ay, az, gx, gy, gz);
        flip_count += result.flip;
        if (ms >= 3000 && ms < 13000) {
            ++circle_count;
            circle_active += result.stirring;
            assert(!result.flip); /* Actual circles must not cause F. */
        }
        if (ms < 1500 || (ms >= 14000 && ms < 16000) || (ms >= 23000 && ms <= 27000)) {
            assert(!result.stirring && !result.flip); /* Actual rest sections. */
        }
        if (result.flip) assert(ms >= 16000 && ms < 23000);
    }
    fclose(file);
    assert(flip_count == 5);
    assert(circle_count > 200 && circle_active * 100 >= circle_count * 85);
    printf("PASS user trace: %u flips / 5 tosses; stirring active %u / %u samples in the circle section\n",
           flip_count, circle_active, circle_count);
}

int main(int argc, char **argv)
{
    reset();
    circle(1, .35f, 2000);
    assert(stirring_samples > 100);
    assert(last.stirring && flips == 0);
    feed(0, 0, 1, 0, 0, 0, 500);
    assert(!last.stirring);

    reset();
    circle(-1, .25f, 2200);
    assert(last.stirring && flips == 0);

    reset();
    for (int i = 0; i < 300; ++i) {
        feed(.4f * sinf(6.2831853f * i / 100.0f), 0, 1, 0, 0, 0, 10);
    }
    assert(stirring_samples == 0 && flips == 0); /* Linear shaking is not circling. */

    reset();
    feed(0, 0, 2.2f, 0, 0, 0, 70);
    assert(flips == 1 && !last.stirring);
    feed(0, 0, .1f, 0, 0, 0, 90);
    feed(0, 0, 2.0f, 0, 0, 0, 80);
    assert(flips == 1); /* Landing rebound belongs to the same toss. */
    feed(0, 0, 1, 0, 0, 0, 1000);
    feed(0, 0, 2.2f, 0, 0, 0, 70);
    assert(flips == 2);

    reset();
    feed(0, 0, 3, 0, 0, 0, 10);
    feed(0, 0, 1, 0, 0, 0, 200);
    assert(flips == 0); /* One noisy sample cannot trigger F. */
    feed(0, 0, .1f, 0, 0, 0, 100);
    assert(flips == 0); /* A downward-only motion is not an upward toss. */

    reset();
    feed(1, 0, 0, 0, 0, 0, 1500);
    feed(1.7f, 0, 0, 0, 0, 400, 150);
    feed(.3f, 0, 0, 0, 0, -400, 150);
    assert(flips == 0 && stirring_samples == 0); /* Upright chopping is excluded. */

    reset();
    circle(1, .03f, 2000);
    assert(stirring_samples == 0 && flips == 0); /* Hand tremor. */

    reset();
    circle(1, .35f, 1500);
    assert(last.stirring);
    now_us += 200000;
    feed(0, 0, 1, 0, 0, 0, 10);
    assert(!last.stirring);
    circle(1, .35f, 1500);
    assert(last.stirring);
    feed(NAN, 0, 1, 0, 0, 0, 10);
    assert(!last.stirring);

    puts("PASS: clockwise/counterclockwise circles, stop, straight shake, vertical toss, rebound, noise, upright chop and sensor gaps");
    if (argc > 1) replay_user_trace(argv[1]);
    return 0;
}
