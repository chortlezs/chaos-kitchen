# XIAO Sense foot sensor: acquisition and calibration

Target: **Seeed Studio XIAO nRF52840 Sense**, USB VID:PID `2886:8045`,
bootloader PID `0045`. This application is independent of ESP-MOSAICO/ESP-IDF.
It reads the onboard LSM6DS3TR-C at 100 Hz, emits USB JSON at 20 Hz and BLE
notifications at 50 Hz. It does not wait for a USB serial connection at startup.
BLE transmission runs in its own FreeRTOS worker. A one-frame overwrite queue
keeps the newest telemetry and prevents radio congestion from blocking sampling.

This stage collects data. Running classification and automatic routes require
actual ankle-mounted calibration and are not implemented by this acquisition firmware.
With one ankle sensor, a complete cycle measures that foot, rather than both feet.

## Pinned local tools

- Arduino CLI 1.5.1: `D:\esp\xiao-tools\cli\arduino-cli.exe`
- Config: `D:\esp\xiao-tools\arduino-cli.yaml`
- Seeed nRF52 Boards: `Seeeduino:nrf52@1.1.13`
- FQBN: `Seeeduino:nrf52:xiaonRF52840Sense`
- Sensor library: `Seeed Arduino LSM6DS3@2.0.8`
- Compiler, packages, cache, sketchbook and ASCII build paths live under D drive.
- Python receiver uses existing `pyserial` and `bleak==1.1.1`.

Board index: https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
Official guide: https://wiki.seeedstudio.com/XIAO_BLE/
IMU guide: https://wiki.seeedstudio.com/XIAO-BLE-Sense-IMU-Usage/

## Build and install application

```powershell
.\tools\build-xiao.ps1
.\tools\build-xiao.ps1 -Upload
```

The uploader checks the target VID/PID before uploading, selecting the sole Sense
board; use `-Port COM10` to explicitly choose among multiple devices. Port numbers may change
after entering the bootloader. Normal uploads preserve the board's bootloader;
do not use burn-bootloader or an ESP flashing tool.

## Collect a bounded recording

```powershell
& D:\anaconda3\python.exe tools/xiao-foot.py --transport usb --seconds 10 --label still --output .hardware-runtime/foot-usb-still.csv
& D:\anaconda3\python.exe tools/xiao-foot.py --transport ble --seconds 10 --label still --output .hardware-runtime/foot-ble-still.csv
```

No manual Windows Bluetooth pairing is needed. If multiple foot sensors are
present, pass `--address <BLE address>`; identity is read before subscribing.
The existing hand controller has a different BLE service and is ignored.
Recordings include device uptime, arrival wall time, acceleration in **g**, and
angular velocity in **degrees/second**. Summary reports sample rate, acceleration
norm range, and missing notifications. Static acceleration magnitude should be
near 1 g; individual axes depend on orientation.

Only mount on an ankle once battery power, an insulated enclosure and secure
attachment are ready. With USB only, keep the board on the desk and perform
gentle hand lift/return and rotation checks. A pre-soldered header does not
include a battery. Later calibration should label still, stepping, jogging and
stopping, with the same final enclosure and wearing direction.

## Device validation: 2026-11-21

Application USB port changed from COM8 to COM10 after installation, as expected
for USB re-enumeration. MCU identity: `xiao-foot:v1:4267bcf30434165d`;
BLE address observed on this PC: `D3:5E:F1:12:F2:F2`.

- USB: 161 samples over 8.0 seconds, 20.0 Hz.
- Tuned BLE stationary check: 405 samples, 50.0 Hz, no missing notifications.
- Hand lift/return and rotation check: 3005 samples over 60.1 seconds,
  49.98 Hz, one missing notification; acceleration norm 0.663..1.390 g,
  angular-rate peak 321.3 degrees/second.
- Stationary gyro bias is measurable and must be calibrated before classification.
- Raw CSV, baseline and acceptance JSON are in ignored `.hardware-runtime/foot-*`.
- The board is currently USB powered; battery-only and ankle-running validation
  remain for the next stage.

## BLE protocol

Name `Kitchen-Foot-XXXX`, service `b1730011-2a7d-4e51-913c-4f79b150cc01`,
notify `b1730012-2a7d-4e51-913c-4f79b150cc01`, read identity
`b1730013-2a7d-4e51-913c-4f79b150cc01`. Identity is
`xiao-foot:v1:<16 hexadecimal MCU ID digits>`.

Default-MTU-safe 20-byte little-endian frame: `<BBHIhhhhhh>`:
version=1, kind=1, u16 sequence, u32 uptime milliseconds, six signed i16 readings
ax/ay/az in milli-g, gx/gy/gz in tenths of degrees/second. Sequence wraps at
65536; recreate the decoder after each BLE reconnect. No historical data is replayed.
