# Kitchen device screen

480x480 GSP Canvas, rendering a 240x240 RGB565 pixel scene at 2x nearest-neighbour.
Food, pan, chopping board, tray and chef assets are exported from the browser's
KitchenItems/KitchenCookware/KitchenArt via `tools/generate-screen-assets.cjs`.
The 80 ms GSP timer owns renderer state and reuses one 115,200-byte framebuffer;
no image decoding, allocations or Bluetooth operations run in the draw callback.

`app_hello_create_linked` borrows a nonblocking poll callback/context for life.
The main adapter polls app_ble's critical-section protected latest-state mailbox.
State expires after 2 seconds without fresh control packets; old event counters
do not repeat cut/flip effects. Input never changes game scores on the board.
Pause, idle, map, chopping, stirring, flip window, serving and results are explicit
states. app_motion and its 100 Hz gesture sampling remain independent.

Portable app_hello/screen_renderer code is shared with the native sim backend.
Device operations must use the workspace's mosaico.py and retained update flow.
