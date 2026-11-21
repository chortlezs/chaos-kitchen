#include "app_ble.h"

#include <math.h>
#include <stdatomic.h>
#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "esp_mac.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

static const char *TAG = "app_ble";
enum { FRAME_SIZE = 20, QUEUE_LENGTH = 12, MAX_AGE_US = 150000 };

// b1730001-2a7d-4e51-913c-4f79b150cc01, characteristics 0002 / 0003.
#define KITCHEN_UUID(n) BLE_UUID128_INIT(0x01,0xcc,0x50,0xb1,0x79,0x4f,0x3c,0x91,0x51,0x4e,0x7d,0x2a,n,0x00,0x73,0xb1)
static const ble_uuid128_t service_uuid = KITCHEN_UUID(1);
static const ble_uuid128_t event_uuid = KITCHEN_UUID(2);
static const ble_uuid128_t identity_uuid = KITCHEN_UUID(3);

typedef struct {
    uint8_t bytes[FRAME_SIZE];
    unsigned generation;
    int64_t created_us;
} queued_frame_t;

// Host task owns connection/GATT state. Motion task only queues immutable frames.
static struct {
    QueueHandle_t queue;
    struct ble_npl_event send_event;
    atomic_uint subscribed_generation;
    unsigned generation;
    uint16_t connection;
    uint16_t event_handle;
    uint8_t address_type;
    uint32_t boot;
    uint32_t sequence;
    char name[28];
    char identity[48];
    bool started;
} context;

static void advertise(void);

static int access_value(uint16_t connection, uint16_t handle,
                        struct ble_gatt_access_ctxt *ctxt, void *arg)
{
    (void)connection; (void)handle; (void)arg;
    if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR ||
        ble_uuid_cmp(ctxt->chr->uuid, &identity_uuid.u) != 0) {
        return BLE_ATT_ERR_READ_NOT_PERMITTED;
    }
    return os_mbuf_append(ctxt->om, context.identity, strlen(context.identity)) == 0
        ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def services[] = {
    {.type = BLE_GATT_SVC_TYPE_PRIMARY, .uuid = &service_uuid.u,
     .characteristics = (struct ble_gatt_chr_def[]) {
         {.uuid = &event_uuid.u, .access_cb = access_value,
          .flags = BLE_GATT_CHR_F_NOTIFY, .val_handle = &context.event_handle},
         {.uuid = &identity_uuid.u, .access_cb = access_value, .flags = BLE_GATT_CHR_F_READ},
         {0}}},
    {0}
};

static void clear_subscription(void)
{
    atomic_store(&context.subscribed_generation, 0);
    xQueueReset(context.queue);
}

static int gap_event(struct ble_gap_event *event, void *arg)
{
    (void)arg;
    switch (event->type) {
    case BLE_GAP_EVENT_CONNECT:
        clear_subscription();
        if (event->connect.status == 0) {
            context.connection = event->connect.conn_handle;
            ESP_LOGI(TAG, "BLE connected handle=%u", context.connection);
        } else {
            advertise();
        }
        break;
    case BLE_GAP_EVENT_DISCONNECT:
        clear_subscription();
        context.connection = BLE_HS_CONN_HANDLE_NONE;
        ESP_LOGI(TAG, "BLE disconnected reason=%d", event->disconnect.reason);
        advertise();
        break;
    case BLE_GAP_EVENT_SUBSCRIBE:
        if (event->subscribe.attr_handle == context.event_handle) {
            clear_subscription();
            if (event->subscribe.cur_notify) {
                if (++context.generation == 0) ++context.generation;
                atomic_store(&context.subscribed_generation, context.generation);
            }
            ESP_LOGI(TAG, "BLE motion notifications=%u", event->subscribe.cur_notify);
        }
        break;
    case BLE_GAP_EVENT_ADV_COMPLETE:
        advertise();
        break;
    default:
        break;
    }
    return 0;
}

static void advertise(void)
{
    struct ble_hs_adv_fields fields = {0};
    fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
    fields.uuids128 = &service_uuid;
    fields.num_uuids128 = 1;
    fields.uuids128_is_complete = 1;
    int rc = ble_gap_adv_set_fields(&fields);
    if (rc == 0) {
        struct ble_hs_adv_fields response = {0};
        response.name = (uint8_t *)context.name;
        response.name_len = strlen(context.name);
        response.name_is_complete = 1;
        rc = ble_gap_adv_rsp_set_fields(&response);
    }
    if (rc == 0) {
        struct ble_gap_adv_params params = {0};
        params.conn_mode = BLE_GAP_CONN_MODE_UND;
        params.disc_mode = BLE_GAP_DISC_MODE_GEN;
        rc = ble_gap_adv_start(context.address_type, NULL, BLE_HS_FOREVER,
                              &params, gap_event, NULL);
    }
    if (rc != 0) ESP_LOGE(TAG, "BLE advertising failed rc=%d", rc);
    else ESP_LOGI(TAG, "BLE advertising name=%s identity=%s", context.name, context.identity);
}

static void on_reset(int reason)
{
    clear_subscription();
    context.connection = BLE_HS_CONN_HANDLE_NONE;
    ESP_LOGW(TAG, "BLE host reset reason=%d", reason);
}

static void on_sync(void)
{
    int rc = ble_hs_util_ensure_addr(0);
    if (rc == 0) rc = ble_hs_id_infer_auto(0, &context.address_type);
    if (rc != 0) ESP_LOGE(TAG, "BLE identity failed rc=%d", rc);
    else advertise();
}

static void send_queued(struct ble_npl_event *event)
{
    (void)event;
    queued_frame_t frame;
    while (xQueueReceive(context.queue, &frame, 0) == pdTRUE) {
        if (frame.generation != atomic_load(&context.subscribed_generation) ||
            esp_timer_get_time() - frame.created_us > MAX_AGE_US) continue;
        struct os_mbuf *mbuf = ble_hs_mbuf_from_flat(frame.bytes, FRAME_SIZE);
        if (!mbuf) continue;
        // NimBLE consumes mbuf on both success and failure. No retry of old actions.
        const int rc = ble_gatts_notify_custom(context.connection, context.event_handle, mbuf);
        if (rc != 0) ESP_LOGD(TAG, "BLE notify dropped rc=%d", rc);
    }
}

static void host_task(void *arg)
{
    (void)arg;
    nimble_port_run();
    nimble_port_freertos_deinit();
}

static void put_u32(uint8_t *out, uint32_t value)
{
    for (unsigned i = 0; i < 4; ++i) out[i] = (uint8_t)(value >> (8 * i));
}

void app_ble_publish(app_ble_action_t action, bool active, float roll, char axis)
{
    if (!context.started) return;
    const unsigned generation = atomic_load(&context.subscribed_generation);
    if (!generation) return;
    queued_frame_t frame = {.generation = generation, .created_us = esp_timer_get_time()};
    frame.bytes[0] = 1;
    frame.bytes[1] = action;
    frame.bytes[2] = active ? 1 : 0;
    put_u32(frame.bytes + 4, context.boot);
    put_u32(frame.bytes + 8, ++context.sequence);
    put_u32(frame.bytes + 12, (uint32_t)(frame.created_us / 1000));
    const int16_t tilt = (int16_t)lroundf(fmaxf(-1, fminf(1, roll)) * 1000);
    frame.bytes[16] = (uint8_t)tilt;
    frame.bytes[17] = (uint8_t)((uint16_t)tilt >> 8);
    frame.bytes[18] = axis == 'y' ? 1 : 0;
    if (xQueueSend(context.queue, &frame, 0) == pdTRUE) {
        ble_npl_eventq_put(nimble_port_get_dflt_eventq(), &context.send_event);
    }
}

esp_err_t app_ble_start(void)
{
    if (context.started) return ESP_ERR_INVALID_STATE;
    uint8_t mac[6];
    esp_err_t err = esp_read_mac(mac, ESP_MAC_WIFI_STA);
    if (err != ESP_OK) return err;
    snprintf(context.name, sizeof(context.name), "Kitchen-Mosaico-%02X%02X", mac[4], mac[5]);
    snprintf(context.identity, sizeof(context.identity), "kitchen_link:v1:%02x%02x%02x%02x%02x%02x",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    context.queue = xQueueCreate(QUEUE_LENGTH, sizeof(queued_frame_t));
    if (!context.queue) return ESP_ERR_NO_MEM;
    err = nimble_port_init();
    if (err != ESP_OK) {
        vQueueDelete(context.queue);
        context.queue = NULL;
        return err;
    }
    context.connection = BLE_HS_CONN_HANDLE_NONE;
    context.boot = esp_random();
    ble_hs_cfg.reset_cb = on_reset;
    ble_hs_cfg.sync_cb = on_sync;
    ble_svc_gap_init();
    ble_svc_gatt_init();
    int rc = ble_svc_gap_device_name_set(context.name);
    if (rc == 0) rc = ble_gatts_count_cfg(services);
    if (rc == 0) rc = ble_gatts_add_svcs(services);
    if (rc != 0) {
        ESP_LOGE(TAG, "BLE GATT init failed rc=%d", rc);
        (void)nimble_port_deinit();
        vQueueDelete(context.queue);
        context.queue = NULL;
        return ESP_FAIL;
    }
    ble_npl_event_init(&context.send_event, send_queued, NULL);
    context.started = true;
    nimble_port_freertos_init(host_task);
    return ESP_OK;
}
