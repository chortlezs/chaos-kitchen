# Screen control protocol

Header-only portable validation for a 20-byte BLE screen state. No GSP, FreeRTOS
or transport dependency. All fields are bounded before rendering. See header
for byte layout; the browser owns gameplay decisions. It sends only confirmed
cuts and flip outcomes. Session and event counter suppress repeated effects.
An 80 ms UI tick consumes the latest state; no state for 2 seconds shows waiting.
