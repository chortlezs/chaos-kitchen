# 极限出餐 · 多场景厨房原型

## 小厨师运动反馈与语音

先关闭旧版启动窗口，再运行原有的 `启动AI情绪厨房.cmd` 或 `启动V1体感跑步游戏.cmd`，刷新游戏页面即可使用，无需更新设备固件。
脚踝网关每约 200 ms 发送一次节奏状态；慢动作和静止也有状态，数据中断不会当作跑慢。
小厨师从四个独立脚踝周期学习本局个人节奏，低于基准 75% 持续约 1 秒提醒；
恢复到 88% 并持续约 1.2 秒后鼓励。普通提示之间至少间隔 4.5 秒，同类冷却 12 秒；端盘失衡优先打断跑步提醒。
连续保持 88% 以上节奏约 6 秒后会发出场景专属表扬，表扬间隔至少 20 秒。
端盘倾斜超过 0.62 并持续 0.7 秒时提醒反向修正，盘子不稳时优先保持平衡，不催加速。
提示气泡不暂停游戏，在四个场景的地图和共用近景生效，独立冰箱页面也支持。
暂停、菜单、结算、到站和断连不累计变慢证据；切菜、炒菜时不催跑。

DeepSeek 在开局通过 `POST /api/coach` 提前生成四类短台词，按场景和开场情绪调整语气。
生成不阻塞游戏，同场景/情绪的台词在服务端缓存 10 分钟；AI 未配置、超时或返回无效内容时使用本地台词。
接口只发送场景和情绪枚举，不上传原始运动数据。节奏检测是本地算法，未声称还原三维轨迹或判断疲劳。
这版显示在电脑网页，并由电脑浏览器播报，不修改 ESP 屏幕协议。

语音使用系统中文 TTS，提供轻快与着急语气，实际音色取决于电脑安装的中文语音。
网页的「声音 / 静音」同时控制语音；播报时背景音乐降低，暂停、离开页面或静音立即停止。
缺少中文语音时保留字幕并播放提示音。首次进入请点击页面以允许浏览器播放声音。

验证：`node verify-coach.cjs`、`node verify-foot.cjs`、`node verify-dual-hardware.cjs`，
以及 `python -m unittest discover -s tools/tests -p "test_*.py"`。
浏览器验证：先运行 `python tools/kitchen_server.py --port 8877`，再运行 `node tools/tests/browser_coach.cjs`；
该脚本需要 `.hardware-runtime/node_modules/playwright` 和 Microsoft Edge，使用模拟传感器与模拟语音检查四个场景，不调用付费 AI。

## 脚踝 AI 动作分类

脚踝网关现在还会发布 `type: activity` 的本地分类结果。模型使用官方 UCI MHEALTH 数据集的左脚踝加速度训练，
分为静止、行走、慢跑、跑步和其他动作；手持板的切菜、翻炒、翻面与端盘识别保持原来的固件和规则。
模型只观察 2 秒、50 Hz 的加速度窗口，低置信度会显示「不确定」，不会控制移动距离，也不会判断疲劳。

模型文件已放在 `models/ankle-mhealth/`，元数据记录了下载地址、CC BY 4.0 许可、参与者划分和校验值。
训练集使用参与者 1–6，验证集使用 7–8，完全未参与训练的测试集使用 9–10；公开数据测试准确率为 97.14%，
宏平均 F1 为 97.77%，拒绝低置信度后覆盖率为 96.92%、已接受样本准确率为 98.11%。这只是公开数据上的基线，
不能当作 XIAO 佩戴者和原地小跑的实机准确率保证。

首次配置电脑时，用启动脚本所用的 Python 安装 `tools/requirements-ble.txt`。日常游玩直接使用随仓库提供的模型。
如需重训公开数据模型，运行以下命令。

```powershell
python -m pip install -r tools/requirements-ankle.txt
python tools/train_ankle_model.py
```

训练脚本把 UCI MHEALTH 官方压缩包下载到 `.hardware-runtime/datasets/`，仓库提供约 536 KB 的推理模型和元数据。
DeepSeek 接收动作类别、分类分数、节奏、游戏阶段和剩余时间等摘要，
开局预生成短台词并后台预热语音；实时节奏事件直接使用缓存或场景台词，避免二次 AI 判断拖慢反馈。
四场景各有减速、紧急、恢复、平衡和表扬五组本地台词，共 40 句，全部使用各自场景独有的比喻。
运行 `python tools/warm_tts_cache.py` 可将全部固定台词一次性合成并保存到
`%LOCALAPPDATA%\ChaosKitchen\tts-cache`；之后相同台词直接读取本地音频。
教练台词只使用 CosyVoice，不混用浏览器系统语音；语音暂时不可用时只保留字幕和提示音，现有“EXCELLENT”游戏人声音效不受影响。

## ESP 屏幕同步动画

ESP-Mosaico 的 480×480 屏幕复用网页原有像素食材、厨师、砧板和锅具。
开机、网页开场及失去同步时显示与网页同源的金橙色封面，保留完整厨师帽插画、CHAOS KITCHEN 标题及「心情开锅」视觉提示；在网页开始游戏。
四个场景各有配色，进入游戏后屏幕跟随地图移动、切菜、翻炒、翻面提示、端盘、暂停及成功/失败状态变化。
切菜按游戏确认的次数逐渐拆成零件；翻面窗口显示向上箭头；端盘随倾斜晃动，小跑时背景流动。

链路：`kitchen-screen.js` → 本地 `/api/screen` → 8766 蓝牙网关 → BLE 屏幕写入特征 → GSP 动画。
网页只发送有范围限制的游戏状态，不发送描述文本、API Key 或图片。图像编译在固件中，动画由设备本地渲染。
前台页面每约 180 ms 同步状态，设备目标刷新周期 80 ms；实际帧率取决于显示负载。
后台/未聚焦页面不抢占屏幕，断开同步超过 2 秒回到等待状态。原有手势和脚踝接收保持独立。

固件源码保存在 `hardware/firmware/app_hello`、`app_ble`、`kitchen_protocol`。
部署到原 `kitchen_link` 工程时，将这三个组件同步到 `components/`；`main.c` 用
`app_hello_create_linked(application.ui, app_ble_read_screen, NULL, &application.controller)` 初始化屏幕。
字体和 GSP Canvas 位于 `app_hello/ui/`，更新涉及界面资源时必须通过 `mosaico.py iris system-update`，保留原分区与 Vibe Mode。

重导出网页图形：先 `npm install --prefix .hardware-runtime @napi-rs/canvas`，再运行
`node tools/generate-screen-assets.cjs`。生成器直接调用 KitchenItems、KitchenCookware、KitchenArt，中文字体使用 Windows 微软雅黑。
模拟器后端在 `app_hello/host/`，设 `KITCHEN_SCREEN_DEMO=1` 后用 `mosaico.py project sim` 验证各动画状态。
验证：`node verify-screen.cjs`、Python 的 `test_screen_protocol.py`，以及原生 `tools/tests/test_screen_renderer.c`。

## AI 情绪厨房（DeepSeek）

首页点击「心情开锅」→ 描述今天发生的事 → DeepSeek 回应并推荐 → 翻开场景卡与菜品卡 → 确认开锅。
识别按整段描述的语境判断，食材固定映射：快乐→订书机、悲伤→文件夹、愤怒→老板、恐惧→打印机、惊讶→键盘、厌恶→空调。
场景由 AI 在咖啡豆仓、冰封后厨、马桶水箱和赛博办公室中推荐。用户可调整心情或厨房；AI 超时、余额不足或服务不可用时会明确提示，支持手动选择。

双击 `启动AI情绪厨房.cmd` 或原来的 `启动V1体感跑步游戏.cmd`，都将启动带 AI 接口的本地服务，并连接手部/脚部蓝牙。
仅体验页面与 AI（不自动启动硬件）可运行 `python tools/kitchen_server.py`，访问 `http://localhost:8767/`。
`python -m http.server` 仅支持静态页面，不提供 AI 接口。

服务端优先读取环境变量 `DEEPSEEK_API_KEY`，也支持用户目录中的 `%LOCALAPPDATA%\ChaosKitchen\deepseek.json`：

```json
{"api_key": "你的 DeepSeek 密钥", "model": "deepseek-flash"}
```

可用 `KITCHEN_AI_CONFIG` 指定配置文件路径，`DEEPSEEK_MODEL` 覆盖模型。本机已配置的密钥文件位于仓库之外。
密钥不会发送到网页；服务不保存用户描述和聊天记录，网页会将提交的描述交给 DeepSeek。
接口：`POST /api/recommend`，请求 `{"text":"今天发生的事"}`；`GET /api/health` 仅返回配置状态。
按 [DeepSeek 官方 JSON Output 文档](https://api-docs.deepseek.com/guides/json_mode/) 调用，服务端验证情绪/场景并强制执行食材映射。

CosyVoice 使用阿里云百炼的 API Key 与业务空间 ID。环境变量 `DASHSCOPE_API_KEY`、
`DASHSCOPE_WORKSPACE_ID` 优先，也支持仓库外的 `%LOCALAPPDATA%\ChaosKitchen\dashscope.json`：

```json
{"api_key": "你的 DashScope API Key", "workspace_id": "你的百炼业务空间 ID", "region": "cn-beijing"}
```

可用 `KITCHEN_TTS_CONFIG` 指定配置文件路径，并用 `COSYVOICE_MODEL`、`COSYVOICE_VOICE`
覆盖默认的 `cosyvoice-v3-flash` 和 `longanhuan`。语音未配置或合成失败时，页面回退到浏览器中文 TTS。

验证：`python -m unittest discover -s tools/tests -p "test_*.py"`，覆盖固定食材映射、上游错误、超时、无效输出和 HTTP 接口边界。

## 双硬件与新版界面

已合入 `main` 的新版封面、厨师对话、场景/菜品抽卡、四套主题和动画。
Windows 双击 **启动V1体感跑步游戏.cmd**，打开 `http://127.0.0.1:8767/?esp=1&foot=1`。
需使用本机已保存的 XIAO 脚踝校准文件；具体配置见 [脚部传感器说明](hardware/xiao-foot/README.md)。

- XIAO nRF52840 Sense：原地小跑累计固定路程，自动取料、到站进入工序；停止后不再新增路程。
- ESP-MOSAICO：下切并抬回计一刀；水平画圈翻炒；竖直短颠翻面；左右轻倾修正端盘。
- 端盘时原地小跑前进，手持板左右轻倾保持平衡；E/触屏前进按钮继续作为备用。地图也使用小跑移动。
- 每个完整脚踝小跑周期提供 0.68 秒端盘前进，最多保留 0.8 秒余量；停跑后余量耗尽即停，暂停、断线和切换工序立即清空。
- 四个场景均支持双硬件；冰箱地图与共用近景通过页面消息交接，不重复占用硬件输入。
- 暂停、页面隐藏、断线及工序切换会释放输入；菜单中关闭「脚踝小跑移动」可恢复原来的地图操作。

完整输入流程回归：`node verify-dual-hardware.cjs`，覆盖四个场景、六种菜品的 24 组出餐流程。

## 马桶与咖啡机豆仓场景

通过本地服务打开 `index.html` 或 `neon-chaos-kitchen.html` 进入封面。点击「心情开锅」，描述今天的心情，翻开 AI 配好的场景卡和菜品卡后进入厨房。可在配菜页修改心情或厨房。

两个场景统一采用六种核心食材：订书机、老板、文件夹、打印机、键盘、空调。马桶版本表现为浸水、泡发、进水和堵塞状态；咖啡机版本表现为浓缩、豆渣、卡豆、爆豆与蒸汽状态。

操作：WASD 或方向键移动；Shift 快跑；空格拿放。点击食材箱和工作台会自动寻路；切好的菜和熟菜需再次点击拿起。手机提供方向键与近景专用按钮。开场可以直接进入切菜、炒菜或端盘单项练习。

流程：解锁咖啡机豆仓厨房与预设菜品 → 根据订单取食材 → 砧板近景切菜 → 炉灶近景翻炒、翻面 → 取走熟菜并装盘 → 流动咖啡近景平衡端盘 → 交单返回全景。

近景规则：

- 切菜：按住 E 或点按砧板完成十刀。
- 炒菜：按住 E 模拟小幅翻炒，也可小幅拖动锅。进度 34% 和 72% 处出现 2.8 秒翻面窗口，必须按 F 或向上大幅滑动。错过时机、乱颠勺或停炒会增加焦糊风险；焦糊达到 100% 失败。一直按 E 无法自动翻面。
- 端盘：按住 E 前进，A/D 或左右按钮反向修正盘子。咖啡流动持续施加扰动；倾斜超限会洒菜并损失完整度。到达后在中心区域保持 1.2 秒交单。失败会丢失菜品并扣 25 分，可重新取菜。

每局完成一张订单，四个厨房统一使用单份订单。烹饪完后应及时取走，烧焦的菜可扔垃圾桶。点击暂停或窗口失去焦点会暂停游戏和近景挑战。

这是单人、浏览器本地状态原型。赛博办公室、马桶、咖啡机及冰箱场景已接入 ESP-Mosaico：下切后反向抬回计一刀；平持画圈持续翻炒，竖直短促上颠触发翻面；出餐阶段向左/右轻倾板子修正盘面。AI 从现有场景和菜品中推荐本局订单，使用原创简化图形表达俯视厨房与工作台交互。

## V1 硬件切菜与颠锅

板子运行 `kitchen_link` 的 `down_up` 固件后，Windows 双击 `启动V1硬件游戏.cmd`，进入 `http://127.0.0.1:8767/?esp=1`。
启动脚本会复用已运行的 8766 端口 IMU 网关，打开 V1 页面并自动连接。
从「切菜练习」开始，先抬高板子，再下切并抬回。完整往返计一刀，10 刀完成。
颠锅练习中，平持板子在水平面匀速画圈，相当于持续按 E；停止画圈即停止翻炒。
出现翻面提示时，沿竖直方向短促向上颠一下，相当于按一次 F，无须翻转板子。
端盘左右倾斜现在使用增强修正：轻倾会明显推动游标回到绿色区域，水平放置有小死区避免抖动。
提前上颠仍按游戏规则处罚；重复传输不会多翻一次。端盘阶段，板子向左/右轻倾分别修正盘面，前进仍用 E，键盘/触屏继续可用。

普通打开网页时，点击左下角「连接 ESP」即可连接已运行的本地网关。
暂停、菜单、隐藏页面及其他工序会忽略动作；手动断开后可以继续使用 E 和触屏。
请使用本地 HTTP 页面体验硬件，GitHub 仓库页面本身不能直接接收 USB 数据。

固件源码、安装前提、跨电脑启动方法及已知限制见 [硬件接入说明](hardware/README.md)。

BLE 无线版本：安装含 `app_ble` 的固件后，使用 `启动V1蓝牙游戏.cmd`。
电脑需开启蓝牙并安装 `tools/requirements-ble.txt`；接收器会自动连接板子，
页面显示「蓝牙已连接」后可使用电池供电玩游戏。原 USB 启动入口继续保留。
首次配置与指定设备的方法见 [BLE 无线玩法](hardware/README.md#ble-无线玩法)。

验证：`node --check dist/game.js`、`node --check dist/challenges.js`；`node verify.cjs` 验证完整订单（两次翻面及主动平衡）、三种近景绘制、错过翻面烧焦、错误时机惩罚、不保持平衡洒菜、未切食材拒绝下锅、订单队列、碰撞和营业结束。

V1 验证：`node verify-v1.cjs`；硬件切菜验证：`node verify-hardware.cjs`；颠锅验证：`node verify-wok.cjs`；出餐倾斜验证：浏览器检查端盘阶段的左右倾斜修正（持续翻炒、停止/断线释放、阶段隔离、翻面窗口与完整烹饪）。
