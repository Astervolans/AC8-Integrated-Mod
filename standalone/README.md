# AC8MouseAim 独立版 v2.5.1

> ### ⚠️ 相机提示
> **对于体积与原版机体相差较大的新增机体（如 AERIAL UAV TRANSPORT 'LADON'），如果在使用时遇到相机位置不正常，请按 `F3` 切换为原版相机设置。**

从 [AC8 Integrated Mod](https://github.com/CreeperUX/AC8-Integrated-Mod) v2.5.1 中分离出来的**单个 UE4SS mod**：鼠标飞控 + 摄像机 + HMD 头盔瞄准。

**仅限离线单人。严禁用于线上或多人游戏。**

- 本目录（`standalone/`）是它的**源码与文档**。
- **可直接安装的 zip 在 [Releases](../../releases) 里**（与上游一致：仓库不放 DLL 二进制）。

---

## 1. 这是什么

整合包把安装器、启动器、会话控制台、逐次部署与退出清理、存档备份全部打包在一起。本目录只保留 mod 本身，可以：

- 拖进 **ACE8 Mod Launcher 2.0.0**（推荐，见第 3 节）；
- 或手工放进任何已装好 UE4SS 的游戏目录。

两条加载路径互不相干，**不要混淆**：

```
ACE8 Mod Launcher
├─ Pak mods     → ue4ss\Mods\IoStoreLoaderMod\*.utoc   ← IoStoreLoaderMod 只挂载 .utoc/.ucas
└─ Script mods  → ue4ss\Mods\<名字>\Scripts\main.lua   ← UE4SS 加载，本 mod 属于这里
```

IoStoreLoaderMod 的源码里明确只认 `.utoc`（`source/src/loader.c:396`）并跳过 `scripts` 目录（`:413`），
`.utoc` 里装的是游戏资源而非脚本，所以本 mod 不会被它加载，也不需要被它加载。

---

## 2. 前置条件

| 条件 | 说明 |
|---|---|
| 游戏版本 | 构建 **25201480**（Steam AppID 2288340）。其它构建可能改变输入槽位布局。 |
| UE4SS.dll | 必须是 **`680a026890abb4d0df2211251f8defc1681a584275f1521dcc0fe30af480006f`**（`UE4SS3.0.1-1152-ge3ba1016`，20,605,440 字节）。原生模块在 `native/src/lua_bridge.h` 里硬编码了这个 SHA-256，换任何其它版本都会被拒绝，日志写 `bridge refused: UE4SS runtime hash mismatch`。ACE8 Mod Launcher 装的正是这个构建。 |
| VC++ 运行库 | Microsoft Visual C++ 2015-2022 **x64** Redistributable（原生模块导入 `MSVCP140.dll`、`VCRUNTIME140.dll`、`VCRUNTIME140_1.dll`）。 |

> 关于**离线标记**：官方原生模块还要求游戏进程环境里有 `EOS_USE_ANTICHEATCLIENTNULL=1`，而 ACE8 Mod Launcher 不转发环境变量给它启动的游戏（实测，见 [PROVENANCE.md](PROVENANCE.md)）。本目录配套的原生模块已经去掉这道检查，**按第 4 节说明的边界使用**。

---

## 3. 安装

先从 [Releases](../../releases) 下载 `AC8MouseAim-standalone-v2.5.1.zip`，解压得到 `AC8MouseAim\` 文件夹。

### 方式 A：ACE8 Mod Launcher 2.0.0（推荐）

1. 关闭游戏与启动器。
2. 把 `AC8MouseAim\` 文件夹（或整个 zip）拖到启动器窗口，或 Mods 页 → “Add mods…”。
   启动器会识别为 `AC8MouseAim (script mod)`，放进 `ue4ss\Mods\AC8MouseAim`，并写好 `enabled.txt`。
3. 启动器保持 **Modded** 模式，按 Play。

`enabled.txt`（空文件）就是这个 UE4SS 构建启用 script mod 的方式，不需要 `mods.txt` 里加行。

### 方式 B：手工安装

1. 把 `AC8MouseAim\` 复制到
   `<游戏根目录>\Game\Binaries\Win64\ue4ss\Mods\AC8MouseAim\`
   （游戏根目录 = 含 `Game\Binaries\Win64\AceCombat8.exe` 的那一层）。
2. 确认 `AC8MouseAim\enabled.txt` 存在（空文件即可）。若你的 UE4SS 只认 `mods.txt`，
   则在 `ue4ss\Mods\mods.txt` 里加一行 `AC8MouseAim : 1`。
3. 用启动器 / 你惯用的方式以**关闭反作弊**的方式启动游戏。

---

## 4. 原生模块说明（重要边界）

Releases 里的 `ac8_mouse_aim_010.dll` 相对官方版本只改了 **12 个字节**：

```
文件偏移 0x441af   0F 84 68 03 00 00  ->  90 90 90 90 90 90
文件偏移 0x441c7   0F 85 50 03 00 00  ->  90 90 90 90 90 90
```

这两条是 `offline_authorized()` 内联后「环境变量不存在 / 不等于 `1` 就跳到拒绝分支」的条件跳转。
改成 NOP 后永远走「已授权」路径，也就是不再要求 `EOS_USE_ANTICHEATCLIENTNULL`。

**除此之外一切照旧**：`UE4SS.dll` 的 SHA-256 锁定（门 1）**原封不动**，22 个导出符号、
从 `UE4SS.dll` 导入的 6 个 `LuaMadeSimple` 符号、文件大小与 PE 结构都没有变化。

```
官方版    f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf
门 2 关闭 af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d
```

`tools/patch-offline-gate.mjs` 可以从官方 DLL 逐字节复现这个修改（自带校验，见第 8 节）。

> **为什么需要它**：官方那道门要求 `EOS_USE_ANTICHEATCLIENTNULL=1`，而 ACE8 Mod Launcher
> 用 `AceCombat8.exe -eac-nop-loaded -nosplash` 关反作弊、**不设置也不转发**这个变量
> （实测证据见 [PROVENANCE.md](PROVENANCE.md)）。所以在这个启动器下，官方 DLL 无法启动。
>
> **代价与边界**：这道门的作用是「反作弊开着时不要运行本 mod」。ACE8 Mod Launcher 的架构
> 本身就保证了这个前提——Modded 模式关反作弊，切到 Unmodded 时启动器会把 `ue4ss\`、
> `dwmapi.dll`、`~mods`、`LogicMods` **整体移出游戏目录**，mod 根本不存在。
> **但如果你把这份 DLL 用在别的安装方式里（例如手工装的裸 UE4SS），就失去了这层保护。**
> 那种情况下请改回官方 DLL，或自行确保只在关闭反作弊时启动。

---

## 5. 按键

| 按键 | 功能 |
|---|---|
| 移动鼠标 | 指定飞行目标方向，mod 协调飞机姿态飞向该方向 |
| 按住 **C** + 移动鼠标 | mod 自由观察；松开后保留原飞行目标 |
| 按住 **C + 鼠标右键** | 自由观察时附加光学放大（`free_look_zoom`） |
| **F2** | 开关 HMD 头盔瞄准（每次启动默认关闭） |
| **F3** | **原生相对机位 / 拉远跟随机位切换**（新增机体相机异常时按它切回原版机位） |
| **F4** | PEACE / WAR 飞控切换（默认 WAR） |
| **F5** | 性能诊断 |
| **F6** | 视角诊断（会在 `Scripts\` 下生成 gaze-state 文本） |
| **F7** | 显示 / 隐藏 mod HUD 与提示 |
| **Alt+F7** | 显示 / 隐藏机头参考准星（仅本次运行） |
| **F8** | 鼠标飞控总开关 |
| **F9** | 瞄准方向回中 |
| **F10** | 重读 `config.ini` 与 `camera-settings.lua` 并回中 |

注意：**F2/F3/F4** 要在松开 Shift / Ctrl / Alt 之后单按（这两个键默认是油门）。
`V` 是游戏原生视角切换，与 `F3` 不是一回事：用本 mod 时请把游戏切到第三人称。

---

## 6. 配置

`AC8MouseAim\config.ini` 由原生模块直接读取（路径由 DLL 自身位置推导）。改完按 **F10** 立即生效。

| 参数 | 默认 | 含义 |
|---|---:|---|
| `control_mode` | 3 | 3=WAR（默认），0=PEACE（CLASSIC 2.0）；飞行中 F4 可切 |
| `sensitivity` | 0.10 | 鼠标方向灵敏度 |
| `model_assist` | 1 | 0=回到旧基础控制器，1=三轴模型控制 |
| `model_assist_strength` | 0.20 | 已学习参数的混合尺度，不是操纵增益旋钮 |
| `hud_fps` | 120 | 旧外部准星路径的调度目标（原生圆环不受它控制） |
| `hud_renderer` | 3 | 3=原生圆环+按需面板，2=仅原生，1=旧 GPU，0=GDI |
| `hud_boresight` | 1 | 机头参考准星十字；Alt+F7 可临时切换 |
| `camera_mode` | 1 | 0=游戏机位，1=拉远跟随；**F3 切换** |
| `camera_distance_m` / `camera_height_m` | 36 / 6 | 拉远机位参数 |
| `free_look_zoom` | 1.75 | C+右键时的附加放大（1..3） |
| `flight_recording` | 0 | 1=额外写 FE/Shadow CSV 到 `Logs\`（约 10–15 MB/分钟） |
| `pitch_slot` / `roll_slot` | 0 / 2 | 构建 25201480 的输入槽位布局 |

`AC8MouseAim\Scripts\camera-settings.lua` 里是 `follow_rate`（2..20）与 `level_rate`（0..10）。
**该文件没有内置默认值**，缺失或写坏会导致 mod 加载失败，请保持原有格式。

键位在 `config.ini` 的 `[keybindings]` 里用 **Windows 虚拟键码（VK）**：

```ini
[keybindings]
free_look=67        ; C
free_look_zoom=2    ; 鼠标右键
pitch_up=83         ; S
pitch_down=87       ; W
roll_left=65        ; A
roll_right=68       ; D
yaw_left=81         ; Q
yaw_right=69        ; E
```

> `config.ini` 里 `flight_recording` 上方那句注释 `; Launcher: maintenance > save flight records`
> 指的是整合包启动器的界面，在独立版里直接把这个值改成 `1` 即可。
> 该文件按「保持上游字节一致」的原则未作改动。

---

## 7. 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| 游戏正常但完全没有鼠标飞控 | 原生模块没起来 | 看 `Logs\MouseAim-NNNNN.log` 最后一行 |
| 日志 `bridge refused: UE4SS runtime hash mismatch` | `UE4SS.dll` 不是锁定版本 | 换成 `680a0268…006f` 那个构建 |
| 日志 `inactive: offline launch marker missing` | 用的是**官方** DLL，且游戏没拿到标记 | 换用 Releases 里的 DLL（第 4 节） |
| UE4SS 报无法加载 DLL | 缺 VC++ 运行库 | 装 x64 运行库 |
| `UE4SS.log` 没有 `[AC8MouseAim] Loaded.` | `enabled.txt` 缺失或路径层级不对 | 确认 `…\ue4ss\Mods\AC8MouseAim\Scripts\main.lua` 存在 |
| `Disabled: required game-thread callback unavailable.` | UE4SS 不是锁定构建 | 换成锁定构建 |
| 飞控轴反向 | 游戏构建不同 | 调 `pitch_slot`/`roll_slot` 或 `*_sign` |
| **新增机体相机位置不正常** | 机体尺寸与原版差异大 | **按 `F3` 切回原版相机设置** |

日志位置：

```
ue4ss\Mods\AC8MouseAim\Logs\MouseAim-NNNNN.log      原生模块日志
ue4ss\Mods\AC8MouseAim\Scripts\mouse-aim-status.txt 最新状态
ue4ss\UE4SS.log                                     UE4SS 与 Lua 侧
```

---

## 8. 自行构建原生模块

官方 DLL 不在本仓库里（`.gitignore` 排除 `*.dll`），但可以两种方式得到本版本：

```bash
# 方式一：从官方发布包里取出 DLL，再用本仓库的工具打补丁（推荐，可校验）
node tools/patch-offline-gate.mjs 官方.ac8_mouse_aim_010.dll 输出.dll

# 方式二：从源码重编（需要 Visual Studio + x86/x64 C++ 工具链）
cd native && build.cmd        # 产出 native/build/ac8_mouse_aim_010.dll（官方版）
```

方式一会逐字节核对补丁位置，只有原文件确实是官方版（`f66a8cf8…`）时才会写出结果，
否则直接报错退出。

---

## 9. 卸载

1. 退出游戏。
2. 删除 `<游戏根目录>\Game\Binaries\Win64\ue4ss\Mods\AC8MouseAim\`。
3. 若手工加了 `mods.txt` 行，删掉 `AC8MouseAim : 1`。
4. 只有在确认没有别的 UE4SS mod 时，才删除 `dwmapi.dll` 与 `ue4ss\` 目录。

mod 本身不写注册表、不装服务、不在游戏目录之外留任何东西。

---

## 10. 许可与来源

- 上游整合与修改部分：MIT © 2026 CreeperUX，见仓库根 [LICENSE](../LICENSE)。
- 原始项目：[FletcherMiya/AC8-Mouse-Aim](https://github.com/FletcherMiya/AC8-Mouse-Aim)。
- UE4SS：MIT。MinHook、MouseFlight 与 HUD 字体许可见仓库根 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) 与 `licenses/`。
- 分离过程、哈希核对与那 12 字节补丁的完整记录见 [PROVENANCE.md](PROVENANCE.md)。

[English](README.en.md)
