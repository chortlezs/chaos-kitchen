#include <Adafruit_TinyUSB.h>
#include <bluefruit.h>
#include <LSM6DS3.h>
#include <Wire.h>
#include <math.h>
#include <FreeRTOS.h>
#include <queue.h>
#include <task.h>

// Foot telemetry has its own service, separate from the hand-held controller.
static const uint8_t SERVICE_UUID[] = {0x01,0xcc,0x50,0xb1,0x79,0x4f,0x3c,0x91,0x51,0x4e,0x7d,0x2a,0x11,0x00,0x73,0xb1};
static const uint8_t SAMPLE_UUID[]  = {0x01,0xcc,0x50,0xb1,0x79,0x4f,0x3c,0x91,0x51,0x4e,0x7d,0x2a,0x12,0x00,0x73,0xb1};
static const uint8_t IDENTITY_UUID[]= {0x01,0xcc,0x50,0xb1,0x79,0x4f,0x3c,0x91,0x51,0x4e,0x7d,0x2a,0x13,0x00,0x73,0xb1};

BLEService foot_service(SERVICE_UUID);
BLECharacteristic sample_characteristic(SAMPLE_UUID);
BLECharacteristic identity_characteristic(IDENTITY_UUID);
LSM6DS3 imu(I2C_MODE, 0x6A);

static constexpr uint32_t SAMPLE_PERIOD_US = 10000; // 100 Hz sensor acquisition.
static constexpr uint32_t BLE_PERIOD_MS = 20;      // 50 Hz wireless telemetry.
static constexpr uint32_t USB_PERIOD_MS = 50;
static uint32_t next_sample_us;
static uint32_t last_ble_ms;
static uint32_t last_usb_ms;
static uint16_t sequence;
static char identity[48];
struct SampleFrame { uint8_t bytes[20]; uint32_t created_ms; };
static QueueHandle_t ble_queue;

// A slow radio must not block the 100 Hz IMU loop. Keep only the newest frame.
static void send_ble(void *) {
    SampleFrame frame;
    while (true) {
        if (xQueueReceive(ble_queue, &frame, portMAX_DELAY) == pdTRUE &&
            millis() - frame.created_ms <= 100 && Bluefruit.connected() &&
            sample_characteristic.notifyEnabled()) {
            sample_characteristic.notify(frame.bytes, sizeof(frame.bytes));
        }
    }
}

static int16_t scaled(float value, float scale) {
    return (int16_t)lroundf(fmaxf(-32767, fminf(32767, value * scale)));
}

static void write_u16(uint8_t *out, uint16_t value) {
    out[0] = value & 255;
    out[1] = value >> 8;
}

static void write_u32(uint8_t *out, uint32_t value) {
    for (unsigned i = 0; i < 4; ++i) out[i] = value >> (8 * i);
}

void setup() {
    Serial.begin(115200);
    // Never wait for Serial: BLE must start when powered by battery alone.
    pinMode(VBAT_ENABLE, OUTPUT);
    digitalWrite(VBAT_ENABLE, LOW);
    pinMode(PIN_CHARGING_CURRENT, OUTPUT);
    digitalWrite(PIN_CHARGING_CURRENT, HIGH); // Select lower charging current.
    pinMode(LED_RED, OUTPUT); digitalWrite(LED_RED, HIGH);
    pinMode(LED_BLUE, OUTPUT); digitalWrite(LED_BLUE, HIGH);
    pinMode(LED_GREEN, OUTPUT); digitalWrite(LED_GREEN, HIGH);

    imu.settings.accelRange = 8;
    imu.settings.gyroRange = 2000;
    imu.settings.accelSampleRate = 104;
    imu.settings.gyroSampleRate = 104;
    while (imu.begin() != 0) {
        Serial.println("FOOT_ERROR IMU initialization failed");
        digitalWrite(LED_RED, LOW);
        delay(1000);
    }

    snprintf(identity, sizeof(identity), "xiao-foot:v1:%08lx%08lx",
             (unsigned long)NRF_FICR->DEVICEID[0], (unsigned long)NRF_FICR->DEVICEID[1]);
    char name[24];
    snprintf(name, sizeof(name), "Kitchen-Foot-%04lX", (unsigned long)(NRF_FICR->DEVICEID[0] & 0xffff));

    Bluefruit.autoConnLed(false);
    Bluefruit.configPrphConn(23, 6, 8, 1);
    Bluefruit.begin(1, 0);
    Bluefruit.setName(name);
    Bluefruit.setTxPower(4);
    Bluefruit.Periph.setConnInterval(12, 24); // 15..30 ms, in 1.25 ms units.
    foot_service.begin();
    sample_characteristic.setProperties(CHR_PROPS_NOTIFY);
    sample_characteristic.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
    sample_characteristic.setFixedLen(20);
    sample_characteristic.begin();
    identity_characteristic.setProperties(CHR_PROPS_READ);
    identity_characteristic.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
    identity_characteristic.setFixedLen(strlen(identity));
    identity_characteristic.begin();
    identity_characteristic.write(identity, strlen(identity));
    Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
    Bluefruit.Advertising.addService(foot_service);
    Bluefruit.ScanResponse.addName();
    Bluefruit.Advertising.restartOnDisconnect(true);
    Bluefruit.Advertising.setInterval(32, 244);
    Bluefruit.Advertising.setFastTimeout(30);
    Bluefruit.Advertising.start(0);
    ble_queue = xQueueCreate(1, sizeof(SampleFrame));
    if (!ble_queue || xTaskCreate(send_ble, "foot_ble", 512, NULL, 1, NULL) != pdPASS) {
        Serial.println("FOOT_ERROR BLE worker allocation failed");
        digitalWrite(LED_RED, LOW);
        while (true) delay(1000);
    }
    Serial.print("FOOT_READY "); Serial.println(identity);
    next_sample_us = micros();
}

void loop() {
    const uint32_t current_us = micros();
    if ((int32_t)(current_us - next_sample_us) < 0) { delay(1); return; }
    next_sample_us += SAMPLE_PERIOD_US;
    if ((int32_t)(current_us - next_sample_us) > (int32_t)SAMPLE_PERIOD_US) {
        next_sample_us = current_us + SAMPLE_PERIOD_US;
    }
    const uint32_t t = millis();
    const float ax = imu.readFloatAccelX(), ay = imu.readFloatAccelY(), az = imu.readFloatAccelZ();
    const float gx = imu.readFloatGyroX(), gy = imu.readFloatGyroY(), gz = imu.readFloatGyroZ();
    const bool valid = isfinite(ax) && isfinite(ay) && isfinite(az) &&
                       isfinite(gx) && isfinite(gy) && isfinite(gz);
    if (!valid) { digitalWrite(LED_RED, LOW); return; }
    digitalWrite(LED_RED, HIGH);
    digitalWrite(LED_GREEN, ((t / 1000) % 2) ? HIGH : LOW);
    digitalWrite(LED_BLUE, Bluefruit.connected() ? LOW : HIGH);

    if (t - last_ble_ms >= BLE_PERIOD_MS) {
        last_ble_ms = t;
        SampleFrame frame = {};
        frame.created_ms = t;
        uint8_t *packet = frame.bytes;
        packet[0] = 1; packet[1] = 1;
        write_u16(packet + 2, ++sequence);
        write_u32(packet + 4, t);
        write_u16(packet + 8, scaled(ax, 1000));
        write_u16(packet + 10, scaled(ay, 1000));
        write_u16(packet + 12, scaled(az, 1000));
        write_u16(packet + 14, scaled(gx, 10));
        write_u16(packet + 16, scaled(gy, 10));
        write_u16(packet + 18, scaled(gz, 10));
        if (Bluefruit.connected()) xQueueOverwrite(ble_queue, &frame);
    }
    if (Serial && Serial.availableForWrite() >= 32 && t - last_usb_ms >= USB_PERIOD_MS) {
        last_usb_ms = t;
        char line[192];
        snprintf(line, sizeof(line), "FOOT_SAMPLE {\"t_ms\":%lu,\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,\"gx\":%.1f,\"gy\":%.1f,\"gz\":%.1f}",
                 (unsigned long)t, ax, ay, az, gx, gy, gz);
        Serial.println(line);
    }
}
