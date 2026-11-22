# V1 ESP-Mosaico 切菜与颠锅接入

## 当前支持

`neon-chaos-kitchen.html` 是 V1 主入口，支持赛博办公室、冲水马桶和咖啡机豆仓。
其冰箱入口嵌入 `frost-kitchen.html`，该页面也接入相同的硬件输入。
`dist/` 是早期原型，不在本次硬件改动范围内。

板载 BMI270 → ESP 固件识别完整往返 → ESP-Iris USB 日志 → Python SSE 网关 →
V1 调用一次原生切菜函数。没有模拟按住 E，所以不会在浏览器帧循环中重复出刀。
固件定义为第一趟强运动 + 同轴反向返回；先把板子抬高再开始试切。
只下切不抬回不会发出事件，完整往返完成后才计一刀。
炒菜阶段：平持板子水平画圈持续翻炒（E），在翻面提示时竖直短促向上颠一次（F）。
停止画圈后停止翻炒；无需翻转板子。提前上颠保留原有焦糊处罚。

## 这台电脑启动

配套 `kitchen_link` 固件包含 `cycle-v2` 与经过握法校准的 `wok-v2` 识别器。
新板子需使用仓库的最新 `app_motion` 组件，旧版切菜固件不会输出炒菜事件。
本次真实轨迹回放中，5 次上颠识别为 5 次翻面；10 秒画圈段保持翻炒的采样覆盖为
387/404，标注的静止段没有触发。这是同一段轨迹的回放结果，不代表所有握法的准确率。
连接数据线并开机后，双击仓库根目录 `启动V1硬件游戏.cmd`。
该脚本使用 `D:\anaconda3\python.exe`（可用 `MOSAICO_PYTHON` 覆盖，未找到则尝试 PATH 中的 python），
在 8767 端口运行本仓库页面；复用 8766 端口的 ESP-Iris 网关，未运行时启动自带网关。
首次验证请从封面进入「手动选关」，点击「切菜练习」。一下一上做 5 组，应计 5 刀，10 刀结束练习。
已有网页和网关服务时，直接打开 V1 地址即可，避免重复启动。

```text
http://127.0.0.1:8767/?esp=1
```

`scene` 可以是 `neon`、`toilet`、`coffee` 或 `fridge`。
`esp=1` 表示自动连接；普通入口保留手动「连接 ESP」按钮。
网关连通时显示「网关已连接 · 等待动作」，实际收到事件后才显示「动作已收到」。
这两种状态不应被理解成独立的板子在线检测。

## BLE 无线玩法

先通过 USB 安装包含 `app_ble` 的 `kitchen_link` 固件，再使用蓝牙启动入口。
普通 `启动V1硬件游戏.cmd` 继续使用 USB；两个入口不要同时运行。

1. 开启 Windows 蓝牙，给板子充电并开机。
2. 首次在本仓库目录安装接收依赖：

   ```powershell
   & D:\anaconda3\python.exe -m pip install -r tools/requirements-ble.txt
   ```

3. 双击 `启动V1蓝牙游戏.cmd`。程序自动扫描和连接，无需先在 Windows 设置配对。
4. 页面显示「蓝牙已连接」后进入练习；确认收到动作后可拔掉电脑 USB 数据线。
5. 板子仍需电池供电并保持开机。掉电/断线后会自动搜索重连，旧动作不会补发。
6. 结束时在启动窗口按 Ctrl+C，等待蓝牙断开后再关板子。

如果附近有多块 Kitchen 板子，用完整 Wi-Fi MAC 指定本次设备（与 BLE 地址不同）：

```powershell
& D:\anaconda3\python.exe tools/start-hardware.py --transport ble --device-mac 1c2904d089b2
```

`http://127.0.0.1:8766/health` 的 `source=ble` 表示使用 BLE 接收器；
`connected=true` 才表示板子已连接，`last_event_age_ms` 表示最近动作心跳的年龄。
断线会立即清除网页的翻炒和倾斜输入。协议与 UUID 见 `firmware/app_ble/README.md`。
无线固件需要把 `app_ble` 组件加入工程，`main` 在 NVS 初始化后、动作采样启动前调用
`app_ble_start()`；`main` 与 `app_motion` 的组件依赖均需加入 `app_ble`。
同时合并 `firmware/sdkconfig.application.defaults` 的 NimBLE 设置并更新有效 sdkconfig。

## USB 手动启动

需要 Python 3.10+、官方 esp-mosaico-vibe 工具工作区，以及运行配套固件的 ESP-Mosaico。
ESP-IDF 仅编译固件时需要，玩网页时不需要加载编译环境。

```powershell
python tools/start-hardware.py --workspace C:\esp-mosaico-vibe --project C:\esp-mosaico-vibe\projects\kitchen_link
```

或者分别执行（两个终端）：

```powershell
python tools/imu-bridge.py --workspace C:\esp-mosaico-vibe --project C:\esp-mosaico-vibe\projects\kitchen_link
python -m http.server 8767 --bind 127.0.0.1
```

网页默认连接 `http://127.0.0.1:8766/events`。网关调用 `mosaico.py iris logs`，
不直接打开 COM 端口，也不安装固件。USB 仍由官方 ESP-Iris 管理。
新网关丢弃启动前的历史日志；网页对重复事件去重，并丢弃过期事件。
网关强制子进程使用 UTF-8，避免 Windows 启动日志的替换字符中断采集；
日志进程意外退出后会自动重连。翻炒心跳超时期间网页会释放输入。

## 固件

脚踝佩戴的 XIAO nRF52840 Sense 使用独立 Arduino 固件；开发环境、六轴采集、
USB/BLE 记录命令见 [XIAO 脚部传感器说明](xiao-foot/README.md)。
已完成脚踝佩戴校准，并通过独立的本地 BLE 网关接入原地小跑和固定路线。
运行「启动V1体感跑步游戏.cmd」，使用本机保存的校准文件；到站后自动进入工序。
详见上面的 XIAO 说明。手持板仍控制切菜、颠锅与端盘。

`firmware/app_motion/` 保存本次已在设备验证的采集组件（含往返识别器）。
在官方工具创建的 `kitchen_link` 工程中放到 `components/app_motion/`，
在 `main/CMakeLists.txt` 的 `PRIV_REQUIRES` 加入 `app_motion`，
在启动代码包含 `app_motion.h` 并调用 `app_motion_start()`。
保持原工程的 ESP-Iris、Vibe Mode、资源和分区契约，使用官方 `mosaico.py` 更新。
这不是可以直接独立刷写的完整固件工程。组件的采样和阈值详见其 README。

本次固定版本的 ESP32-S31 SDK 在对 flash 映射的 GSP 界面资源做硬件 SHA 时，
出现 `sha_hal_read_digest` 返回全零并 abort 的启动故障，发生在动作任务启动之前。
`firmware/sdkconfig.application.defaults` 提供应用配置：禁用硬件 SHA 加速，
通过软件实现继续完成相同的 SHA-256 校验。将这一项合并到应用 defaults；已有
构建还需更新有效 sdkconfig 后重新编译。不要跳过资源校验或改动分区布局。

设备输出示例：

```text
MOTION_EVENT {"action":"chop","cycle":"down_up","t_ms":12345,"gx":0,"gy":0,"gz":300}
```

网关向网页转发：

```json
{"type":"motion","action":"chop","cycle":"down_up","t_ms":12345}
```

切菜只接受 `cycle=down_up` 的完整往返事件，旧版单峰 `chop` 会被忽略。
翻炒接受 `action=wok,motion=circle,active=true/false`；翻面接受 `action=flip,motion=vertical`。
翻炒状态没有新心跳超过 350 ms 会自动释放，断线和暂停立即清除；不会模拟按住键盘 E。
菜单、暂停、已完成工序、非对应阶段和隐藏页面的动作不会缓存到下一阶段。
端盘只接入左右倾斜修正：向左/右轻倾分别模拟 A/D，固件自动选择 X/Y 中倾斜幅度更大的轴并在事件中带上 `axis` 字段，前进仍由 E 或触屏按钮控制。
板子回到水平时，盘面会自动回中；网关断线或暂停会释放倾斜输入。
切菜依赖转腕；翻炒和翻面需要基本平持。

## 验证

```powershell
node verify-hardware.cjs
node verify-wok.cjs
node verify-plate.cjs
node verify-v1.cjs
node verify.cjs
python -m py_compile tools/imu-bridge.py tools/start-hardware.py
python -m unittest discover -s tools/tests -p "test_*.py"
```

浏览器检查需要启动本地页面。通过「切菜练习」观察计数，再验证暂停和其他工序不会响应切菜。
颠锅练习中先确认画圈能推进火候、停下能停止，再在两次翻面窗口内分别上颠一次。
原生识别器还可用 GCC 运行 `tools/tests/test_wok_gesture.c`，并回放
`tools/tests/fixtures/wok-user-calibration.csv`；命令见固件组件 README。
