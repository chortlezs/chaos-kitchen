idf_component_register(
    SRCS "app_motion.c" "chop_cycle.c" "wok_gesture.c"
    INCLUDE_DIRS "include"
    PRIV_REQUIRES app_ble esp-mosaico-bsp freertos log)
