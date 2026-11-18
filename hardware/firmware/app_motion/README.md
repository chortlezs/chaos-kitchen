# app_motion

Owns the ESP-Mosaico BMI270 sampler used by the browser game controller. It
samples acceleration and angular velocity at 100 Hz, emits a bounded diagnostic
sample twice per second, and emits a semantic `chop` event after a deliberate
stroke and its opposite return stroke. This version keeps gesture
classification on the device but keeps game state in the browser.

The event lines are written through ESP-Iris logs so the host bridge can consume
them without opening COM6/COM7 directly (ESP-Iris owns those USB interfaces):

```text
IMU_SAMPLE {"ax":0.01,"ay":0.02,"az":0.99,"gx":1.2,"gy":-0.3,"gz":2.1}
MOTION_EVENT {"action":"chop","cycle":"down_up","t_ms":1234}
```

`app_motion_start()` owns the sampler task and BMI270 lifetime. The task has no
UI dependency and is safe to run beside the GSP controller. Stop is provided for
future runtime shutdown; the current device app keeps the sampler alive until
reboot.

`chop_cycle.c` is a platform-independent, single-owner recognizer used unchanged
by the sampler and the host regression tests. The first strong movement chooses
an angular axis, so either hand and different board orientations are supported.
Start each trial at the raised position: the first stroke is interpreted as the
down stroke; absolute up/down is not inferred from position integration.

A stroke starts above 260 degrees/second. It must travel at least 12 degrees,
then reverse on the same axis above 160 degrees/second. The return must cover
at least 65% of the first stroke (and at least 12 degrees). Each half must last
at least 40 ms and the whole cycle at least 160 ms. Exactly one event is emitted
on the return, with no event on the first stroke. The remaining return movement
is suppressed until another outgoing stroke or 80 ms of quiet. A 2-second
timeout, a sample gap above 100 ms, or a sensor error drops incomplete cycles.
Thresholds are initial settings for the tested wrist swing; translating the
board without angular movement is not recognized by this version.

Host check (from this game's repository root, GCC on PATH; create `.hardware-runtime` first):

```powershell
gcc -std=c99 -Wall -Werror -I hardware/firmware/app_motion hardware/firmware/app_motion/chop_cycle.c tools/tests/test_chop_cycle.c -lm -o .hardware-runtime/test_chop_cycle.exe
./.hardware-runtime/test_chop_cycle.exe
```
