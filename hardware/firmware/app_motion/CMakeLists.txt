idf_component_register(
    SRCS "app_motion.c" "chop_cycle.c"
    INCLUDE_DIRS "include"
    PRIV_REQUIRES esp-mosaico-bsp freertos log)
