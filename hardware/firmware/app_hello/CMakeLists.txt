idf_component_register(SRCS "app_hello.c" "screen_renderer.c" "screen_assets.c"
    INCLUDE_DIRS "include" REQUIRES esp-gsp kitchen_protocol)
include("${MOSAICO_UTILS_ROOT}/mosaico-tools/cmake/gsp_bundle.cmake")
mosaico_gsp_add_ui_bundle(${COMPONENT_LIB} "ui/main.json")
