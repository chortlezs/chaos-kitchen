# BLE motion transport

Owns a NimBLE peripheral independent of ESP-Iris USB. Start once after NVS, before
the motion sampler. No persistent pairing credentials or OTA writes are exposed.
Dependencies: IDF bt/NimBLE, esp_timer, esp_hw_support, FreeRTOS, log.

`app_ble_publish` has one producer (motion task); it is nonblocking and only queues
data when subscribed. The NimBLE host owns GAP and notification calls. A generation
token discards packets from earlier subscriptions, and a 150 ms age limit prevents
queued actions playing back. The 12-frame queue uses bounded memory. The component
and host task live until reboot; initialization failures return to the caller so
USB gameplay continues. Reboot is the teardown boundary.

Advertised name: `Kitchen-Mosaico-XXXX` (last two Wi-Fi MAC bytes).
Service: `b1730001-2a7d-4e51-913c-4f79b150cc01`.
Notify: `b1730002-2a7d-4e51-913c-4f79b150cc01`.
Read identity: `b1730003-2a7d-4e51-913c-4f79b150cc01` (ASCII
`kitchen_link:v1:<12 lowercase Wi-Fi MAC hex digits>`).

Screen write (with response): `b1730004-2a7d-4e51-913c-4f79b150cc01`.
Accepts only validated 20-byte `kitchen_screen.h` packets. NimBLE copies into a
single latest-state mailbox under a short critical section; the GSP render-task
timer consumes it through `app_ble_read_screen`. Disconnect/unsubscribe discards
pending commands. It does not touch motion queues, renderer memory or game rules.

All notifications are exactly 20 bytes (fits default ATT MTU 23), little-endian:

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | u8 | protocol version 1 |
| 1 | u8 | action: chop=1, wok=2, flip=3, plate=4 |
| 2 | u16 | bit 0: wok active; others zero |
| 4 | u32 | random boot token |
| 8 | u32 | notification sequence |
| 12 | u32 | device uptime in milliseconds, wraps at 2^32 |
| 16 | i16 | plate roll, -1000..1000; divide by 1000 |
| 18 | u8 | axis: x=0, y=1 |
| 19 | u8 | reserved zero |

The desktop receiver validates identity before subscribing, stamps host receive
time, and converts to the existing SSE semantic event envelope. BLE and USB are
separate launch modes; never forward both sources into a round.
