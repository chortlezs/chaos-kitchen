# V1 ESP-Mosaico 切菜接入

## 当前支持

`neon-chaos-kitchen.html` 是 V1 主入口，支持赛博办公室、冲水马桶和咖啡机豆仓。
其冰箱入口嵌入 `frost-kitchen.html`，该页面也接入相同的硬件输入。
`dist/` 是早期原型，不在本次硬件改动范围内。

板载 BMI270 → ESP 固件识别完整往返 → ESP-Iris USB 日志 → Python SSE 网关 →
V1 调用一次原生切菜函数。没有模拟按住 E，所以不会在浏览器帧循环中重复出刀。
固件定义为第一趟强运动 + 同轴反向返回；先把板子抬高再开始试切。
只下切不抬回不会发出事件，完整往返完成后才计一刀。

## 这台电脑启动

板子已安装并验证 `kitchen_link` 的 `cycle-v2` 固件，无须重复刷写。
连接数据线并开机后，双击仓库根目录 `启动V1硬件游戏.cmd`。
该脚本使用 `D:\anaconda3\python.exe`（可用 `MOSAICO_PYTHON` 覆盖，未找到则尝试 PATH 中的 python），
在 8767 端口运行本仓库页面；复用 8766 端口的 ESP-Iris 网关，未运行时启动自带网关。
首次验证请点击「切菜练习」，一下一上做 5 组，应计 5 刀；10 刀结束练习。
已有网页和网关服务时，直接打开 V1 地址即可，避免重复启动。

```text
http://127.0.0.1:8767/neon-chaos-kitchen.html?scene=toilet&esp=1
```

`scene` 可以是 `neon`、`toilet`、`coffee` 或 `fridge`。
`esp=1` 表示自动连接；普通入口保留手动「连接 ESP」按钮。
网关连通时显示「网关已连接 · 等待动作」，实际收到事件后才显示「动作已收到」。
这两种状态不应被理解成独立的板子在线检测。

## 其他电脑 / 手动启动

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

## 固件

`firmware/app_motion/` 保存本次已在设备验证的采集组件（含往返识别器）。
在官方工具创建的 `kitchen_link` 工程中放到 `components/app_motion/`，
在 `main/CMakeLists.txt` 的 `PRIV_REQUIRES` 加入 `app_motion`，
在启动代码包含 `app_motion.h` 并调用 `app_motion_start()`。
保持原工程的 ESP-Iris、Vibe Mode、资源和分区契约，使用官方 `mosaico.py` 更新。
这不是可以直接独立刷写的完整固件工程。组件的采样和阈值详见其 README。

设备输出示例：

```text
MOTION_EVENT {"action":"chop","cycle":"down_up","t_ms":12345,"gx":0,"gy":0,"gz":300}
```

网关向网页转发：

```json
{"type":"motion","action":"chop","cycle":"down_up","t_ms":12345}
```

只接受 `cycle=down_up` 的完整往返事件，旧版单峰 `chop` 会被忽略。
菜单、暂停、已完成工序、非切菜阶段和隐藏页面的动作不会缓存到下一阶段。
端盘和颠锅尚未接入硬件。纯平移而几乎不转腕的动作暂不属于本识别器支持范围。

## 验证

```powershell
node verify-hardware.cjs
node verify-v1.cjs
node verify.cjs
python -m py_compile tools/imu-bridge.py tools/start-hardware.py
python -m unittest discover -s tools/tests -p "test_*.py"
```

浏览器检查需要启动本地页面。通过「切菜练习」观察计数，再验证暂停和其他工序不会响应切菜。
