// SPDX-License-Identifier: Apache-2.0
#include "chop_cycle.h"

#include <assert.h>
#include <math.h>
#include <stdio.h>

static chop_cycle_t cycle;
static int64_t now_us;
static unsigned events;

static void reset(void)
{
    cycle = (chop_cycle_t){0};
    now_us = 1000000;
    events = 0;
}

static void feed(float x, float y, float z, int duration_ms)
{
    for (int i = 0; i < duration_ms; i += 10) {
        now_us += 10000;
        events += chop_cycle_update(&cycle, now_us, x, y, z);
    }
}

int main(void)
{
    reset();
    feed(0, 0, -350, 200);
    assert(events == 0); /* Down alone is not a chop. */
    feed(0, 0, 0, 500); /* A pause at the bottom keeps the half cycle. */
    assert(events == 0);
    feed(0, 0, 350, 200);
    assert(events == 1);
    feed(0, 0, 350, 1000);
    assert(events == 1); /* A long return cannot retrigger. */

    reset();
    for (unsigned i = 1; i <= 10; ++i) {
        feed(0, 0, -400, 180);
        assert(events == i - 1);
        feed(0, 0, 400, 180);
        assert(events == i); /* Continuous cuts, without a neutral pause. */
    }

    reset();
    feed(0, 0, 320, 180);
    feed(0, 0, -320, 180);
    assert(events == 1); /* Mirrored grip. */
    feed(0, 0, 0, 200);
    feed(0, -400, 0, 180);
    feed(0, 400, 0, 180);
    assert(events == 2); /* A new grip after resting. */

    reset();
    feed(0, 0, -400, 200);
    feed(0, 0, 400, 20); /* Small bounce at the bottom. */
    feed(0, 0, 0, 100);
    assert(events == 0);
    feed(0, 0, 400, 200);
    assert(events == 1);

    reset();
    feed(0, 0, -400, 200);
    feed(400, 0, 0, 200); /* Motion on another axis is not the return. */
    assert(events == 0);
    feed(0, 0, 400, 200);
    assert(events == 1);

    reset();
    feed(0, 0, -350, 180);
    feed(0, 0, 0, 2300); /* Expired half cycle must not pair with a later lift. */
    feed(0, 0, 350, 180);
    assert(events == 0);

    reset();
    feed(0, 0, -350, 180);
    now_us += 200000;
    feed(0, 0, 350, 180); /* Missing samples discard the old half cycle. */
    assert(events == 0);

    reset();
    for (int i = 0; i < 500; ++i) {
        feed(25, -35, i % 2 ? 70 : -70, 10);
    }
    assert(events == 0); /* Resting sensor noise. */
    feed(0, 0, 1000, 10);
    feed(0, 0, -1000, 10);
    feed(0, 0, 0, 100);
    assert(events == 0); /* Brief spikes. */

    reset();
    feed(0, 0, -400, 180);
    feed(NAN, 0, 0, 10);
    feed(0, 0, 400, 180);
    assert(events == 0);

    puts("PASS: full-cycle cuts, repeated cuts, grips, bounce, timeout, gaps and noise");
    return 0;
}
