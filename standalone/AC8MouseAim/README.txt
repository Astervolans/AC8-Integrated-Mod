WorldAim1.3.6 — world-space aiming (the mouse sets a target direction, not a
fixed screen cursor).

AC8MouseAim v2.5.1, separated from the AC8 Integrated Mod, prepared for
ACE8 Mod Launcher 2.0.0.

UNMODIFIED OFFICIAL BUILD. Scripts\ac8_mouse_aim_010.dll is byte-identical to
the one in the CreeperUX v2.5.1 release:

    f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf

This is deliberately NOT the third-party "unlocked" build. That build replaces
the five bytes at 0x15350 (48 89 5C 24 08 -> B0 01 C3 90 90) so that
compatible_lua_runtime() just returns true and the UE4SS.dll SHA-256 pin is
skipped. ACE8 Mod Launcher installs exactly the UE4SS build the pin expects
(UE4SS.dll = 680a0268...006f), so the pin already passes here and the patch
buys nothing but loses an ABI check.

IMPORTANT: this mod still refuses to start unless the game process sees
EOS_USE_ANTICHEATCLIENTNULL=1. ACE8 Mod Launcher does not set it — it disables
anti-cheat with the "-eac-nop-loaded" argument instead. Start the launcher with
Start-ACE8-Modded.cmd (in the package root next to this folder) so the game
inherits the marker.

See README.md in the package root for the diagnosis, install steps, keybinds
and configuration.
