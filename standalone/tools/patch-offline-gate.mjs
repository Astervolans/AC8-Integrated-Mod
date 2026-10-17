#!/usr/bin/env node
/**
 * patch-offline-gate.mjs — turn the official AC8MouseAim native module into the
 * build that does not require EOS_USE_ANTICHEATCLIENTNULL.
 *
 * Usage:
 *     node tools/patch-offline-gate.mjs <official ac8_mouse_aim_010.dll> <output.dll>
 *
 * What it does, and nothing else (12 bytes in total):
 *
 *   offline_authorized() is inlined into ac8_mouseaim_start, and the image
 *   contains exactly one call to GetEnvironmentVariableW:
 *
 *          lea  rcx,[L"EOS_USE_ANTICHEATCLIENTNULL"]  ; r8d=16, rdx=zeroed buffer
 *   0x441a7  ff 15 .. .. .. ..   call [GetEnvironmentVariableW]
 *   0x441ad  85 c0               test eax,eax
 *   0x441af  0f 84 68 03 00 00   je   <refuse>          <- patch A
 *   0x441b5  48 8d 15 .. .. .. .. lea  rdx,[L"1"]
 *   0x441bc  48 8d 4d 00         lea  rcx,[rbp]
 *   0x441c0  e8 .. .. .. ..      call wcscmp
 *   0x441c5  85 c0               test eax,eax
 *   0x441c7  0f 85 50 03 00 00   jne  <refuse>          <- patch B
 *   0x441cd  e8 .. .. .. ..      call load_config()    <- authorised path
 *
 *   Replacing both conditional jumps with six NOPs makes execution always fall
 *   through to the authorised path.
 *
 * The UE4SS.dll SHA-256 pin in the same function is NOT touched, and neither is
 * anything else. The tool refuses to write anything unless the input really is
 * the official build, so a wrong or already-patched file cannot be mangled.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OFFICIAL_SHA256 = "f66a8cf8a298c535b123b9857a904f9ce9241c59e92f908a032c4cb15a1783cf";
const GATE_OFF_SHA256 = "af02554981162ddcb2c87d95752a06c62a3065d95764578082c47c8aaeb2331d";

const CALL_SITE = 0x441a7;                       // call [GetEnvironmentVariableW]
const PATCHES = [
  { at: CALL_SITE + 8,  expect: "0f8468030000", what: "je refuse  (variable absent)" },
  { at: CALL_SITE + 32, expect: "0f8550030000", what: "jne refuse (value != \"1\")" },
];

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node tools/patch-offline-gate.mjs <official.dll> <output.dll>");
  process.exit(2);
}

const buf = readFileSync(input);
const original = Buffer.from(buf);
const sha = (b) => createHash("sha256").update(b).digest("hex");

console.log(`input      : ${input}`);
console.log(`size       : ${buf.length} bytes`);
console.log(`sha256     : ${sha(buf)}`);

if (sha(buf) === GATE_OFF_SHA256) {
  console.log("\nthis file is already the gate-off build; nothing to do.");
  process.exit(0);
}
if (sha(buf) !== OFFICIAL_SHA256) {
  console.error(`\nREFUSING: input is not the official build.`);
  console.error(`  expected ${OFFICIAL_SHA256}`);
  console.error(`  got      ${sha(buf)}`);
  console.error(`Re-extract ac8_mouse_aim_010.dll from AC8-Integrated-v2.5.1-share.zip and retry.`);
  process.exit(1);
}

// structural sanity: the call site must be a call, and the patch sites must hold
// exactly the bytes we expect.
if (buf.subarray(CALL_SITE, CALL_SITE + 2).toString("hex") !== "ff15") {
  console.error(`REFUSING: 0x${CALL_SITE.toString(16)} is not "call [rip+disp32]"; layout changed.`);
  process.exit(1);
}
for (const p of PATCHES) {
  const have = buf.subarray(p.at, p.at + 6).toString("hex");
  console.log(`verify 0x${p.at.toString(16)}  ${have}  ${p.what}`);
  if (have !== p.expect) {
    console.error(`REFUSING: expected ${p.expect} at 0x${p.at.toString(16)}, found ${have}.`);
    process.exit(1);
  }
}

for (const p of PATCHES) {
  buf.write("909090909090", p.at, "hex");
  console.log(`patch  0x${p.at.toString(16)}  ${p.expect} -> 90 90 90 90 90 90`);
}

// prove nothing else moved before writing
let changed = 0;
for (let i = 0; i < buf.length; i++) if (buf[i] !== original[i]) changed++;
if (buf.length !== original.length || changed !== 12) {
  console.error(`REFUSING: expected exactly 12 changed bytes, got ${changed}.`);
  process.exit(1);
}

writeFileSync(output, buf);
const outSha = sha(buf);
console.log(`\nwrote      : ${output}`);
console.log(`sha256     : ${outSha}`);
if (outSha !== GATE_OFF_SHA256) {
  console.error(`WARNING: result does not match the published gate-off hash ${GATE_OFF_SHA256}`);
  process.exit(1);
}
console.log("matches the published gate-off build.");
