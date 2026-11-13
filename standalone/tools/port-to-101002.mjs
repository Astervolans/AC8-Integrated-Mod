#!/usr/bin/env node
/**
 * port-to-101002.mjs — re-point the AC8MouseAim native module at game build 1.01.002.
 *
 * Usage:
 *     node tools/port-to-101002.mjs <official v2.5.1 ac8_mouse_aim_010.dll> <output.dll>
 *
 * The official module is compiled for game build 25201480 and hard-codes that
 * build's identity and code addresses. Build 1.01.002 re-linked the executable,
 * so every one of those constants moved and the module refuses to install:
 *
 *     native camera refused: executable identity/signature mismatch
 *     HMD unavailable: selection signature mismatch; stock selection retained
 *
 * …which is the module working as designed: it will not hook a binary it does
 * not recognise. The camera then never activates (the game keeps its stock
 * camera) and, because the HUD is driven from the camera hook, the reference
 * gun cross and target marker stop being drawn.
 *
 * ---------------------------------------------------------------------------
 * How each new value was derived (all read-only analysis of AceCombat8.exe)
 * ---------------------------------------------------------------------------
 *   TimeDateStamp / SizeOfImage  read straight out of the new PE header.
 *   camera update fn             its 15-byte prologue occurs 4x; the real one is
 *                                the only occurrence referenced by a pointer
 *                                anywhere in the image.
 *   camera manager vtable        that pointer sits at vtable+241*8, so
 *                                vtable = slot - 0x788. Cross-checked: 8-byte
 *                                aligned, first 8 entries are all code pointers,
 *                                and slot 241 points back at the function.
 *   HMD SelectTarget             its 21-byte entry signature is unique.
 *   HMD release return           its 16-byte caller site is unique, and the
 *                                call displacement encoded in the exe equals
 *                                select - return (independent confirmation).
 *   cache-helper byte site       its 8-byte pattern is unique.
 *   actor-getter canary          NOT resolvable: `mov rax,[rcx+0x1A0]` occurs
 *                                311x. It is referenced only by a memcmp, never
 *                                executed, so it is re-pointed at another
 *                                occurrence of the identical instruction. The
 *                                other four identity checks stay exact, so a
 *                                wrong derivation still fails closed instead of
 *                                hooking the wrong code.
 *
 * The offline-gate patch from patch-offline-gate.mjs is applied in the same
 * pass, because the resulting module is meant for ACE8 Mod Launcher, which
 * never provides EOS_USE_ANTICHEATCLIENTNULL.
 *
 * ---------------------------------------------------------------------------
 * Trap worth knowing when porting a future build
 * ---------------------------------------------------------------------------
 * A 16-byte memcmp inside install() was inlined as TWO 8-byte compares, so the
 * second chunk carries its own address constant (site + 8). Patching only the
 * first chunk makes the check fail at runtime with a "signature mismatch" that
 * a file-level emulation of the first address cannot explain. The stale-value
 * sweep at the end of this script exists to catch exactly that class of miss.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OFFICIAL_V251 = "f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf";
const PORTED_101002 = "632ca87f14d406da98206f2f45a5b24e47f1601d18b1bae566726bbdb45fa512";
const sha = (x) => createHash("sha256").update(x).digest("hex");

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node tools/port-to-101002.mjs <official-v2.5.1.dll> <output.dll>");
  process.exit(2);
}

const b = Buffer.from(readFileSync(input));
const original = Buffer.from(b);
const inSha = sha(b);
if (inSha === PORTED_101002) { console.log("input is already the 1.01.002 port; nothing to do."); process.exit(0); }
if (inSha !== OFFICIAL_V251) {
  console.error("REFUSING: input is not the official v2.5.1 module.");
  console.error(`  expected ${OFFICIAL_V251}`);
  console.error(`  got      ${inSha}`);
  console.error("Extract ac8_mouse_aim_010.dll from AC8-Integrated-v2.5.1-share.zip and retry.");
  process.exit(1);
}
console.log(`input  ${b.length} bytes  ${inSha}`);

// ---- derived for game build 1.01.002 (PE TimeDateStamp 0x6AD2D0A7) --------------
const NEW_TDS      = 0x6AD2D0A7;   // NT.FileHeader.TimeDateStamp
const NEW_SOI      = 0x215A2000;   // NT.OptionalHeader.SizeOfImage
const NEW_CAM      = 0x070B4960;   // camera update fn          (was 0x070C8ED0)
const NEW_VT       = 0x0C9BCE20;   // camera manager vtable     (was 0x0C9D3160)
const NEW_SLOT     = 0x0C9BD5A8;   // == NEW_VT + 241*8
const NEW_CACHE    = 0x048EF260;   // cache-helper byte site    (was 0x048FC6B0)
const NEW_ACTOR    = 0x03FD739D;   // canary re-point, see note above
const NEW_SELECT   = 0x07283700;   // HMD SelectTarget          (was 0x07296F40)
const NEW_RETURN   = 0x07D529E0;   // HMD release return addr   (was 0x07D630E0)
const NEW_CALLER   = 0x07D529CC;   // HMD caller bytes          (was 0x07D630CC)
const NEW_DISPSITE = 0x07D529DC;   // HMD displacement site     (was 0x07D630DC)
const NEW_DISP     = (NEW_SELECT - NEW_RETURN) >>> 0;

// [fileOffset, expectedOldValue, newValue, description, kind]
const PATCHES = [
  // offline gate off (ACE8 Mod Launcher never forwards EOS_USE_ANTICHEATCLIENTNULL)
  [0x441af, 0x0f8468030000, 0, "gate A  je refuse -> 6x NOP", "nops"],
  [0x441c7, 0x0f8550030000, 0, "gate B  jne refuse -> 6x NOP", "nops"],

  // identity checks
  [0x1d0f4, 0x6AA0E27D, NEW_TDS,   "TimeDateStamp   cmp [rcx+0x18]"],
  [0x1d11a, 0x2195A000, NEW_SOI,   "SizeOfImage     cmp [rcx+0x50]"],
  [0x1d127, 0x070C8ED0, NEW_CAM,   "camera update   lea rdi,[rax+rva]"],
  [0x1d148, 0x048FC6B0, NEW_CACHE, "cache helper    lea rcx,[rbx+rva]"],
  [0x1d166, 0x03FD7449, NEW_ACTOR, "actor canary    lea rcx,[rbx+rva]"],

  // functional camera
  [0x0d1eb, 0x0C9D3160, NEW_VT,    "manager vtable  add rax,rva; cmp [rsi],rax"],
  [0x1d184, 0x0C9D38E8, NEW_SLOT,  "vtable slot 241 add rbx,rva; cmp [rbx],rdi"],

  // functional HMD (note the two caller chunks)
  [0x1cdf3, 0x07296F40, NEW_SELECT, "SelectTarget    lea rcx,[rax+rva] (verify)"],
  [0x1ce72, 0x07296F40, NEW_SELECT, "SelectTarget    add rbx,rva      (hook target)"],
  [0x332d0, 0x07D630E0, NEW_RETURN, "release return  add rax,rva; cmp r10,rax"],
  [0x1ce10, 0x07D630CC, NEW_CALLER, "caller chunk 0  mov rax,[rbx+rva]"],
  [0x1ce1e, 0x07D630D4, NEW_CALLER + 8, "caller chunk 1  mov rax,[rbx+rva]"],
  [0x1ce2b, 0x07D630DC, NEW_DISPSITE, "disp site     cmp [rbx+rva]"],
  [0x1ce2f, 0xFF533E60, NEW_DISP,   "disp expected cmp dword [..], imm32"],
];

// ---- verify every site before touching it --------------------------------------
console.log("\nverifying patch sites:");
let bad = 0;
for (const [off, expect, , label, kind] of PATCHES) {
  if (kind === "nops") {
    const have = b.subarray(off, off + 6).toString("hex");
    const want = expect.toString(16).padStart(12, "0");
    const ok = have === want;
    console.log(`  ${ok ? "ok  " : "FAIL"} 0x${off.toString(16)}  ${have}   ${label}`);
    if (!ok) bad++;
  } else {
    const have = b.readUInt32LE(off) >>> 0;
    const ok = have === (expect >>> 0);
    console.log(`  ${ok ? "ok  " : "FAIL"} 0x${off.toString(16)}  have ${have.toString(16).padStart(8, "0")}  want ${(expect >>> 0).toString(16).padStart(8, "0")}   ${label}`);
    if (!ok) bad++;
  }
}
if (bad) { console.error(`\nREFUSING: ${bad} site(s) did not match`); process.exit(1); }

// ---- apply -------------------------------------------------------------------
console.log("\napplying:");
for (const [off, , value, label, kind] of PATCHES) {
  if (kind === "nops") { b.fill(0x90, off, off + 6); console.log(`  0x${off.toString(16)}  90 90 90 90 90 90   ${label}`); }
  else { b.writeUInt32LE(value >>> 0, off); console.log(`  0x${off.toString(16)}  ${(value >>> 0).toString(16).padStart(8, "0")}   ${label}`); }
}

// ---- every changed byte must be inside a declared field ------------------------
const changed = [];
for (let i = 0; i < b.length; i++) if (b[i] !== original[i]) changed.push(i);
if (b.length !== original.length) { console.error("REFUSING: size changed"); process.exit(1); }
const fields = PATCHES.map(([off, , , , kind]) => [off, off + (kind === "nops" ? 6 : 4) - 1]);
const stray = changed.filter((o) => !fields.some(([s, e]) => o >= s && o <= e));
if (stray.length) { console.error(`REFUSING: changed byte(s) outside declared fields: ${stray.slice(0, 8).map((o) => "0x" + o.toString(16)).join(", ")}`); process.exit(1); }
console.log(`\nsize unchanged : true`);
console.log(`bytes changed  : ${changed.length}, all inside the ${fields.length} declared fields`);

// ---- no stale copy of any old constant may survive -----------------------------
const OLD_VALUES = [0x6AA0E27D, 0x2195A000, 0x070C8ED0, 0x0C9D3160, 0x0C9D38E8,
                    0x048FC6B0, 0x03FD7449, 0x07296F40, 0x07D630E0, 0x07D630CC,
                    0x07D630D4, 0x07D630DC, 0xFF533E60];
let stale = 0;
for (const v of OLD_VALUES) {
  const pat = Buffer.alloc(4); pat.writeUInt32LE(v >>> 0);
  let at = 0, n = 0, first = -1;
  while ((at = b.indexOf(pat, at)) !== -1) { if (!n) first = at; n++; at += 1; }
  if (n) { stale += n; console.log(`  STALE 0x${(v >>> 0).toString(16).padStart(8, "0")} x${n} first at 0x${first.toString(16)}`); }
}
if (stale) { console.error(`REFUSING: ${stale} stale constant(s) remain - a patch site was missed`); process.exit(1); }
console.log("  no stale constant remains");

writeFileSync(output, b);
const outSha = sha(b);
console.log(`\nwrote ${output}\nsha256 ${outSha}`);
if (outSha !== PORTED_101002) {
  console.error(`WARNING: result does not match the published 1.01.002 port ${PORTED_101002}`);
  process.exit(1);
}
console.log("matches the published 1.01.002 build.");
