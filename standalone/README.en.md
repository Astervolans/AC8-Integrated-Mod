# AC8MouseAim — Standalone v2.5.1

> ### ⚠️ Camera note
> **For newly added aircraft whose size differs greatly from the original (for example AERIAL UAV TRANSPORT 'LADON'), if the camera position looks wrong in use, press `F3` to switch back to the original camera setting.**

A **single UE4SS mod separated out of** [AC8 Integrated Mod](https://github.com/CreeperUX/AC8-Integrated-Mod) v2.5.1: mouse flight control, cameras and HMD helmet aiming.

**Offline single-player only. Do not use online or in multiplayer.**

- This folder (`standalone/`) holds the **sources and documentation**.
- **The ready-to-install zip is in [Releases](../../releases)** — same as upstream, the repository carries no DLL binaries.

---

## 1. What it is

The integrated package bundles an installer, a launcher, a session console, per-launch deployment, exit cleanup and save backups. This folder keeps only the mod itself, so it can be:

- dropped into **ACE8 Mod Launcher 2.0.0** (recommended, section 3), or
- copied into any game folder that already has UE4SS.

The two loading paths are independent — do not confuse them:

```
ACE8 Mod Launcher
├─ Pak mods     → ue4ss\Mods\IoStoreLoaderMod\*.utoc   ← IoStoreLoaderMod mounts .utoc/.ucas only
└─ Script mods  → ue4ss\Mods\<name>\Scripts\main.lua   ← loaded by UE4SS; this mod belongs here
```

IoStoreLoaderMod accepts only `.utoc` (`source/src/loader.c:396`) and explicitly skips `scripts`
directories (`:413`). A `.utoc` carries cooked game assets, not scripts, so this mod is neither
loadable by it nor in need of it.

---

## 2. Requirements

| Requirement | Detail |
|---|---|
| Game version | Build **25201480** (Steam AppID 2288340). Other builds may change the input slot layout. |
| UE4SS.dll | Must be **`680a026890abb4d0df2211251f8defc1681a584275f1521dcc0fe30af480006f`** (`UE4SS3.0.1-1152-ge3ba1016`, 20,605,440 bytes). The native module hard-codes that SHA-256 in `native/src/lua_bridge.h`; any other build is refused with `bridge refused: UE4SS runtime hash mismatch`. ACE8 Mod Launcher installs exactly this build. |
| VC++ runtime | Microsoft Visual C++ 2015-2022 **x64** Redistributable (the DLL imports `MSVCP140.dll`, `VCRUNTIME140.dll`, `VCRUNTIME140_1.dll`). |

> **Offline marker:** the official native module additionally requires
> `EOS_USE_ANTICHEATCLIENTNULL=1` in the game process environment, but ACE8 Mod Launcher does not
> forward its environment to the game it starts (measured — see [PROVENANCE.md](PROVENANCE.md)).
> The native module shipped with this folder drops that check; respect the boundary in section 4.

---

## 3. Install

Download `AC8MouseAim-standalone-v2.5.1.zip` from [Releases](../../releases) and unpack the `AC8MouseAim\` folder.

**Option A — ACE8 Mod Launcher 2.0.0 (recommended):** close the game and launcher, drop the
`AC8MouseAim\` folder (or the whole zip) onto the launcher window, or use Mods → "Add mods…".
The launcher recognises it as `AC8MouseAim (script mod)`, installs it into
`ue4ss\Mods\AC8MouseAim` and writes `enabled.txt`. Then stay in **Modded** mode and press Play.

**Option B — manual:** copy `AC8MouseAim\` to
`<game root>\Game\Binaries\Win64\ue4ss\Mods\AC8MouseAim\` (game root = the folder containing
`Game\Binaries\Win64\AceCombat8.exe`), make sure `AC8MouseAim\enabled.txt` exists (an empty file is
enough), or add `AC8MouseAim : 1` to `ue4ss\Mods\mods.txt` if your UE4SS build only reads that.

An empty `enabled.txt` is how this UE4SS build enables a script mod; no `mods.txt` line is needed.

---

## 4. About the native module (important boundary)

The `ac8_mouse_aim_010.dll` in Releases differs from the official one by exactly **12 bytes**:

```
file offset 0x441af   0F 84 68 03 00 00  ->  90 90 90 90 90 90
file offset 0x441c7   0F 85 50 03 00 00  ->  90 90 90 90 90 90
```

Those are the two conditional jumps of the inlined `offline_authorized()`. NOP-ing them makes
execution always take the authorised path, so `EOS_USE_ANTICHEATCLIENTNULL` is no longer required.

**Everything else is untouched:** the `UE4SS.dll` SHA-256 pin (gate 1) still applies, all 22 exports
and the 6 `LuaMadeSimple` imports from `UE4SS.dll` are unchanged, and size and PE structure are identical.

```
official   f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf
gate off   af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d
```

`tools/patch-offline-gate.mjs` reproduces this from the official DLL, byte for byte, and verifies
the input first (section 8).

> **Why it is needed:** the official gate demands `EOS_USE_ANTICHEATCLIENTNULL=1`, but ACE8 Mod
> Launcher disables anti-cheat with `AceCombat8.exe -eac-nop-loaded -nosplash` and neither sets nor
> forwards that variable (measurements in [PROVENANCE.md](PROVENANCE.md)). Under that launcher the
> official DLL cannot start.
>
> **Boundary:** the gate exists so the mod does not run while anti-cheat is active. ACE8 Mod
> Launcher already guarantees that — Modded mode runs with anti-cheat off, and switching to
> Unmodded moves `ue4ss\`, `dwmapi.dll`, `~mods` and `LogicMods` out of the game folder, so the mod
> is not installed at all. **But in any other installation (for example a hand-made bare UE4SS
> setup) that protection is gone.** Use the official DLL there, or make sure you only launch with
> anti-cheat off.

---

## 5. Keybinds

| Key | Action |
|---|---|
| Mouse movement | Sets the flight target direction; the mod coordinates aircraft attitude |
| Hold **C** + mouse | Mod free look; the previous flight target is kept on release |
| Hold **C + RMB** | Extra optical zoom during free look (`free_look_zoom`) |
| **F2** | Toggle HMD (off at every start) |
| **F3** | **Native relative / far follow camera** (press it when a newly added aircraft has a wrong camera) |
| **F4** | PEACE / WAR flight controller (WAR is the default) |
| **F5** | Performance diagnostics |
| **F6** | View diagnostics (writes a gaze-state file into `Scripts\`) |
| **F7** | Show / hide mod HUD and notices |
| **Alt+F7** | Show / hide the nose reference gun cross (this session only) |
| **F8** | Master toggle for mouse flight control |
| **F9** | Recenter the aim direction |
| **F10** | Reload `config.ini` and `camera-settings.lua`, then recenter |

Release Shift / Ctrl / Alt before pressing F2, F3 or F4 — those modifiers are the throttle keys.
`V` is the game's own view toggle and is not the same as `F3`; use the third-person view with this mod.

---

## 6. Configuration

`AC8MouseAim\config.ini` is read by the native module; press **F10** to apply most changes.
Notable entries: `control_mode` (3=WAR, 0=PEACE), `sensitivity`, `model_assist`, `hud_renderer`,
`hud_boresight`, `camera_mode` (**F3** toggles it), `camera_distance_m`/`camera_height_m`,
`free_look_zoom`, `flight_recording` (set to `1` for FE/Shadow CSV logs in `Logs\`), and
`pitch_slot`/`roll_slot`.

`AC8MouseAim\Scripts\camera-settings.lua` holds `follow_rate` (2..20) and `level_rate` (0..10).
It has **no compiled-in default** — a missing or malformed file makes the mod fail to load.

Keybinds live in the `[keybindings]` section as **Windows virtual-key codes**: `free_look=67` (C),
`free_look_zoom=2` (RMB), `pitch_up=83` (S), `pitch_down=87` (W), `roll_left=65` (A),
`roll_right=68` (D), `yaw_left=81` (Q), `yaw_right=69` (E).

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Game runs, no mouse flight control at all | Native module did not start | Read the last line of `Logs\MouseAim-NNNNN.log` |
| `bridge refused: UE4SS runtime hash mismatch` | Wrong `UE4SS.dll` | Use build `680a0268…006f` |
| `inactive: offline launch marker missing` | You are using the **official** DLL and the game has no marker | Use the DLL from Releases (section 4) |
| UE4SS cannot load the DLL | VC++ runtime missing | Install the x64 redistributable |
| No `[AC8MouseAim] Loaded.` in `UE4SS.log` | `enabled.txt` missing or wrong folder depth | Check `…\ue4ss\Mods\AC8MouseAim\Scripts\main.lua` exists |
| `Disabled: required game-thread callback unavailable.` | Wrong UE4SS build | Use the pinned build |
| Wrong axis responds | Different game build | Adjust `pitch_slot`/`roll_slot` or the `*_sign` values |
| **Camera wrong on a newly added aircraft** | Airframe size differs a lot from the original | **Press `F3` to switch back to the original camera** |

---

## 8. Building the native module yourself

The official DLL is not in this repository (`.gitignore` excludes `*.dll`). Two ways to get this build:

```bash
# 1) take the DLL from the official release and apply this repo's tool (recommended, verified)
node tools/patch-offline-gate.mjs official_ac8_mouse_aim_010.dll out.dll

# 2) rebuild from source (needs Visual Studio with the x86/x64 C++ toolchain)
cd native && build.cmd        # produces native/build/ac8_mouse_aim_010.dll (official)
```

Option 1 checks every patch site and refuses to write anything unless the input really is the
official build (`f66a8cf8…`).

---

## 9. Uninstall

Delete `<game root>\Game\Binaries\Win64\ue4ss\Mods\AC8MouseAim\`, remove the `AC8MouseAim : 1`
line if you added one, and only remove `dwmapi.dll` / `ue4ss\` if you are certain no other UE4SS
mod uses them. The mod writes no registry keys, installs no services, and leaves nothing outside
the game folder.

---

## 10. Licence and origin

MIT © 2026 CreeperUX for the mod and the integration (see the repo root [LICENSE](../LICENSE)).
Upstream project: [FletcherMiya/AC8-Mouse-Aim](https://github.com/FletcherMiya/AC8-Mouse-Aim).
UE4SS is MIT; MinHook, MouseFlight and font licences are in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)
and `licenses/`. The full record of the separation, the hash cross-checks and the 12-byte patch is
in [PROVENANCE.md](PROVENANCE.md).

[中文](README.md)
