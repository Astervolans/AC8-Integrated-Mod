# 来源、改动与核验记录 / Provenance

本文件记录 `standalone/` 里的 AC8MouseAim 独立版是**怎么做出来的**、**改了什么**，
以及**每一处结论的证据**。

## 1. 来源

| 项目 | 值 |
|---|---|
| 上游仓库 | <https://github.com/CreeperUX/AC8-Integrated-Mod> |
| 上游提交 | `main` @ `cce68d50d35ba7eda0cd612fb25baf878b594f1c`（*Release v2.5.1: the first public release of the 2.5 line*） |
| 版本 | `version.json` → `2.5.1`，`status=release`，`release_approved=true` |
| 原生控制器版本 | `2.5.1`（WAR 13.8） |
| 目标游戏 | Steam AppID 2288340，构建 `25201480` |
| 发布产物 | Release `v2.5.1` → `AC8-Integrated-v2.5.1-share.zip` |

取自仓库的路径：`package-template/payload/Game/Binaries/Win64/ue4ss/Mods/AC8MouseAim/`
（该目录在仓库里只有 20 个文件，所有二进制都被 `.gitignore` 排除）。

## 2. 分离过程

1. 用 GitHub API 下载 `main` 分支 zipball，得到仓库源码树。
2. 下载 Release 资产 `AC8-Integrated-v2.5.1-share.zip`，核对官方 `.sha256`：

   ```
   2bf71414c171f7620044e40664ac7b11cfa45fdd9252884b21f05bc954aee687  AC8-Integrated-v2.5.1-share.zip
   ```

3. 从该发布包取出 `payload/.../Mods/AC8MouseAim/` 的 21 个文件（20 个源文件 + 原生 DLL）。
4. 生成只含本 mod 的 `enabled.txt` 启用标记；上游那份 `mods.txt` 同时启用了 `AC8SourceInit`，
   独立版不需要。
5. 其余整合包组件一律不取。

### 2.1 一致性证明：仓库源码 == 发布载荷

逐文件比较「仓库 zipball 版本」与「官方发布包版本」，**换行统一成 LF 之后 20 个文件全部字节相同**；
唯一差异是行尾（仓库 zipball 是 LF，官方发布载荷是 CRLF）。因此两者语义完全相同，
本目录采用仓库版本，且可与官方 `payload-manifest.json` / `FILES.sha256` 对照复核。

## 3. 原生模块 `ac8_mouse_aim_010.dll`

该 DLL 不在仓库里（`.gitignore` 排除 `*.dll`）。仓库只提供源码
`native/src/mouse_aim.cpp` + `native/src/vendor/minhook/`，由 `native/build.cmd` 用 MSVC
（`cl /std:c++20 /MD /O2 /LD`）编译，并把 `native/src/ue4ss_lua.def` 生成的导入库链进去。

本目录的 DLL 从官方 v2.5.1 发布包提取，并用**四份互相独立的清单**交叉核对：

| 来源 | 值 |
|---|---|
| 实测 SHA-256 | `f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf` |
| 发布包 `package-info.json` → `native_sha256` | 一致 |
| 发布包 `payload-manifest.json` | 一致 |
| 发布包 `FILES.sha256` | 一致 |

二进制契约（实测）：

- PE32+ / x64（machine `0x8664`），8,400,384 字节；
- 导出表 **22 个**符号，与 `Scripts/main.lua:6-21`（14 个）和 `Scripts/native_hud.lua:93-95`
  （8 个 `canvas_*`）逐一对应；
- 从 `UE4SS.dll` 导入 **6 个** `RC::LuaMadeSimple` 符号，与 `native/src/ue4ss_lua.def` 完全一致；
- 依赖 `MSVCP140.dll` / `VCRUNTIME140.dll` / `VCRUNTIME140_1.dll`（VC++ 2015-2022 x64 运行库）、
  `DINPUT8.dll`（DirectInput 回退路径）以及 `DWrite/d3d11/d2d1/dcomp/ole32`（HUD 叠加层）。

## 4. 两道门，以及为什么必须去掉第二道

`native/src/mouse_aim.cpp` 的 `ac8_mouseaim_start` 里有两次检查：

| 门 | 检查 | 本 mod 的处境 |
|---|---|---|
| 1 | `UE4SS.dll` 的 SHA-256 必须等于 `680a026890abb4d0df2211251f8defc1681a584275f1521dcc0fe30af480006f`（`lua_bridge.h:30-32`） | 通过。该哈希与 `runtime-dependencies.json` 钉住的运行时一致 |
| 2 | 进程环境必须有 `EOS_USE_ANTICHEATCLIENTNULL=1`（`mouse_aim.cpp:934-937, 957-960`） | **在 ACE8 Mod Launcher 下无法满足**，见下 |

### 4.1 实测：启动器不把环境传给游戏

三轮实测的时间线（启动器日志、包装脚本时间戳、原生日志三方对齐）：

| 时间 | 事件 | 来源 |
|---|---|---|
| 21:30:10 | 启动器前先设置的 `EOS_USE_ANTICHEATCLIENTNULL=1` | 包装脚本 trace |
| 21:30:14 | 启动器启动（该脚本的子进程，**继承了变量**） | `launcher.log` |
| 21:30:57 | 启动器按 Play，直接启动游戏 | `launcher.log` |
| 21:31:12 | 原生模块**仍然**报 `offline launch marker missing` | `MouseAim-00001.log` |

对启动器二进制的静态检查也一致：

- 镜像里只有**裸字符串** `eos_use_anticheatclientnull`，**不存在任何 `…=1` 赋值字面量**
  （各种大小写均 0 处）——它是用来检测 Steam 旧启动选项并提醒清理的，不是用来设置环境变量；
- 它关闭反作弊靠的是命令行参数：镜像里有 `AceCombat8.exe -eac-nop-loaded -nosplash`；
- 启动器清单是 `requestedExecutionLevel level="asInvoker"`，不走提权/用户令牌那条路径。

**结论：任何环境变量方案在这个启动器下都不可能生效**，包括用户级 `setx`。所以把这个检查去掉。

> **测试范围**：上面的实测**全部在 [ACE8 Mod Launcher & Loader V 2.0.0](https://www.nexusmods.com/acecombat8wingsoftheve/mods/64) 下进行**，
> 也是本独立版唯一验证过的环境。其他安装方式（手动安装 UE4SS、其他启动器／加载器组合、不同 UE4SS 构建）
> 未经验证，不保证有效。

### 4.2 具体改动：12 字节

`offline_authorized()` 被内联进 `ac8_mouseaim_start`。全镜像**只有一处**调用
`GetEnvironmentVariableW`，反汇编如下：

```
      lea  rcx,[L"EOS_USE_ANTICHEATCLIENTNULL"]   ; r8d=16, rdx=清零的缓冲区
0x441a7  ff 15 7b 53 00 00   call [GetEnvironmentVariableW]
0x441ad  85 c0               test eax,eax
0x441af  0f 84 68 03 00 00   je   <拒绝>            ← 补丁 A
0x441b5  48 8d 15 d4 93 00 00 lea  rdx,[L"1"]
0x441bc  48 8d 4d 00         lea  rcx,[rbp]
0x441c0  e8 91 46 00 00      call wcscmp
0x441c5  85 c0               test eax,eax
0x441c7  0f 85 50 03 00 00   jne  <拒绝>            ← 补丁 B
0x441cd  e8 4e ac fd ff      call load_config()    ← 已授权路径
```

把两条条件跳转换成 6 个 NOP 之后，执行永远落到已授权路径：

```
0x441af   0F 84 68 03 00 00  ->  90 90 90 90 90 90
0x441c7   0F 85 50 03 00 00  ->  90 90 90 90 90 90
```

改动结果实测：

```
大小不变        : 8,400,384 字节
变化字节数      : 12（仅上述两个偏移区间）
导出符号        : 22（不变）
UE4SS.dll 导入  : 6（不变）
PE 架构         : 0x8664（不变）
UE4SS.dll 哈希锁定（门 1）: 原封未动
```

```
官方版    f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf
门 2 关闭 af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d
```

`tools/patch-offline-gate.mjs` 可逐字节复现该结果，并会先核对原文件哈希与补丁位置。

### 4.3 为什么在这个边界内可以接受

门 2 的语义是「反作弊开着时不要运行本 mod」。ACE8 Mod Launcher 的架构本身就保证了这个前提：

- **Modded**：`ue4ss\`、`dwmapi.dll`、`~mods`、`LogicMods` 都在游戏目录里，启动器用
  `-eac-nop-loaded` 关掉反作弊；
- **Unmodded**：启动器把这些文件**整体移出游戏目录**，mod 不存在，游戏走 Steam + 反作弊。

两者互斥。**但这份 DLL 一旦脱离这个启动器，这层保护就没有了**——
所以在别的安装方式里应当使用官方 DLL。

## 5. 上游参考：门 1 与两份清单里的哈希

```
680a026890abb4d0df2211251f8defc1681a584275f1521dcc0fe30af480006f  UE4SS.dll（被锁定的构建）
cf440b9eb8643bb7c434acfda696aee57fd981d185dca5e57fb8dbb18f8fc1cd  dwmapi.dll（注入代理）
f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf  ac8_mouse_aim_010.dll（官方）
af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d  ac8_mouse_aim_010.dll（本目录，门 2 关闭）
```

`UE4SS.dll` 的锁定值同时出现在三处并互相一致：`native/src/lua_bridge.h:30-32`、
`runtime-dependencies.json`，以及实际安装的 `UE4SS.dll`。

## 6. 与上游文件的一致性

`standalone/AC8MouseAim/` 下的 20 个源文件（10 个 Lua 脚本、`config.ini`、`README.txt`、
`ui-native/*.png`、`ui-fonts/*`）与官方发布载荷**逐字节一致**，未作任何修改——
包括 `config.ini` 里那句指向整合包启动器界面的注释（`; Launcher: maintenance > save
flight records`），保留原样以便继续按哈希复核，含义与替代做法写在 README 第 6 节。

与上游的差异只有三处，都在 `standalone/` 之外或属于新增内容：

1. 仓库根 `README.md` 顶部增加了一段 fork 说明（相机 / F3 提示）；
2. 新增 `standalone/` 目录（本独立版）；
3. **没有**引入任何诊断脚本、测试脚手架或本机相关路径。

## 7. 游戏更新到 1.01.002 后的移植

### 7.1 症状与日志证据

游戏从构建 25201480 更新到 **1.01.002** 后，同一次启动里出现：

```
native camera refused: executable identity/signature mismatch
HMD unavailable: selection signature mismatch; stock selection retained
```

同时 HUD 计数器全为 0（`stage_try_hz=0.00`、`publish_try_hz=0.00`、`submitted=0`、`projected=0`）。
相机姿态只在被 hook 的 `update_native_camera` 里应用（`native_camera.h:107-119`），hook 被拒 → 该段从不执行，
游戏回到原生机位；而 HUD 的姿态由同一处 `publish_hud_frame()` 喂入，于是参考准星和光标也不再绘制。
飞控不受影响（日志里 `FE_CONTROL mode=WAR`、三轴 `CAPTURE_ADAPTATION` 有真实数值）。

这是模块**按设计工作**：它拒绝挂钩自己不认识的可执行文件（`docs/LIMITATIONS.md:3` 也写明“游戏更新后版本校验可能拒绝启动”）。

### 7.2 变动范围（逐项实测）

| 校验项 | 25201480 | 1.01.002 |
|---|---|---|
| PE TimeDateStamp | `0x6AA0E27D` | `0x6AD2D0A7` |
| PE SizeOfImage | `0x2195A000` | `0x215A2000`（缩约 3.9 MB） |
| 相机 update 序言 | `48 8B C4 48 89 58 18 …` | 位置改变 |
| SelectTarget 入口 | `48 89 5C 24 18 55 57 …` | 位置改变 |

镜像整体缩小、代码重新链接，因此**不存在“只绕过校验就能用”**：RVA 全变，硬挂钩子会写到无关代码。

### 7.3 新常量的推导与独立验证

`tools/port-to-101002.mjs` 用的每个值都不是猜的：

| 常量 | 新值 | 验证方式 |
|---|---|---|
| TimeDateStamp | `0x6AD2D0A7` | 直接读新 exe 的 PE 头 |
| SizeOfImage | `0x215A2000` | 同上 |
| 相机 update 函数 | `0x070B4960` | 15 字节序言有 4 处匹配；**只有它被镜像中某个指针引用** |
| 相机管理器 vtable | `0x0C9BCE20` | 该指针位于 `vtable+241*8`，反推得 vtable；交叉验证：8 字节对齐、前 8 项全为代码指针、第 241 项指回该函数 |
| HMD SelectTarget | `0x07283700` | 21 字节入口特征**全文件唯一** |
| HMD 返回地址 | `0x07D529E0` | 16 字节调用点**全文件唯一**，且 exe 内编码的调用位移等于 `select − return`（独立印证） |
| 缓存 helper 字节位 | `0x048EF260` | 8 字节特征唯一 |
| actor getter canary | `0x03FD739D` | **无法唯一确定**：`mov rax,[rcx+0x1A0]` 有 311 处。它只被 memcmp 引用、从不执行，因此指向另一处含相同指令的位置；其余四项校验保持精确，推导错了仍然会干净拒绝而不是误挂钩子 |

`.rdata` 里找不到任何 vtable —— 这个游戏的段布局很特殊，相机管理器的 vtable 落在 `.tls` 段，
必须做全文件扫描才能定位。

### 7.4 一个值得记住的坑

`install()` 里那段 16 字节 `memcmp` 被编译器**内联成两段 8 字节比较**，第二段的地址因此成为
**另一个独立常量**（`caller + 8`，旧值 `0x07D630D4`）：

```
0x1CE10  48 8b 83 cc 30 d6 07   mov rax,[rbx+0x7D630CC]
0x1CE1E  48 8b 83 d4 30 d6 07   mov rax,[rbx+0x7D630D4]   ← 只改第一段会漏掉这一处
```

只改第一段时，文件级模拟三条判定“全部通过”，运行时却仍报 `selection signature mismatch`。
相机侧用的是真正的 `memcmp()` 调用（单一地址），因此没有这个问题——
**这也正是当时“除 HMD 外全部正常”的原因**。

为此工具末尾加了一道**残留常量终检**：只要文件里还留有任何一个旧常量的 32 位值就拒绝输出。
这道检查正是针对这类“漏改一处”的失误。

### 7.5 结果

```
官方 v2.5.1（25201480，门 2 关闭）  af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d
1.01.002 移植版（门 2 关闭）        632ca87f14d406da98206f2f45a5b24e47f1601d18b1bae566726bbdb45fa512
```

改动 47 字节，全部落在 16 个声明字段内；文件大小、PE 架构、22 个导出符号、6 个 UE4SS 导入符号均不变。

**未改动**：`manager+0x14A0`（POV）、`manager+0x14D0`（FOV）、`pawn+0x1A0`（root）、`root+0x220`（位置）
这四个结构体偏移。实测在 1.01.002 下仍然有效。若将来某次更新让它们失效，
运行时会打出具名拒绝原因（`invalid live camera/aircraft data (vtable|root component|fov|actor position|pov)`），
属于**安全失败**（不崩、只是相机不生效），可据此逐个重推。

已实测：相机、拉远机位、参考准星、鼠标飞控、HMD 全部正常。
