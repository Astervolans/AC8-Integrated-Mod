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
