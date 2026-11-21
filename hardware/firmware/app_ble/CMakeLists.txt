idf_component_register(SRCS "app_ble.c" INCLUDE_DIRS "include"
    PRIV_REQUIRES bt esp_timer esp_hw_support freertos log)
