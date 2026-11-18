// SPDX-License-Identifier: Apache-2.0
#pragma once

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/** Start the BMI270 sampler and semantic motion event producer. */
esp_err_t app_motion_start(void);

/** Stop the sampler; safe to call after a failed or repeated start. */
esp_err_t app_motion_stop(void);

#ifdef __cplusplus
}
#endif
