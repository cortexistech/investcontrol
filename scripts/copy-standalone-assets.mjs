#!/usr/bin/env node
// Next's `output: "standalone"` build produces a minimal server.js but, by design, does not
// copy the public/ and .next/static/ folders into it (Next expects those to be served by a
// CDN in a typical deployment). We're serving them ourselves inside Electron, so copy them in
// manually, exactly as Next's own docs for standalone output instruct.
//
// The whole standalone/node_modules folder (next, react, and everything else next build traced)
// gets moved under vendor-native/node_modules for one reason: electron-builder unconditionally
// strips any directory literally named node_modules that it copies via extraResources — ship
// standalone/node_modules as-is and the packaged .dmg/.exe ends up with no "next" package at
// all, and the app fails to boot. scripts/electron-after-pack.cjs moves it back to the standard
// location once electron-builder's copy (and pruning) pass is done; a differently-named parent
// directory is invisible to that pruning, and node_modules only reappears one level deeper so
// that everything inside can still resolve each other via Node's ordinary node_modules walk in
// the meantime.
//
// better-sqlite3 additionally gets overwritten with an explicitly-resolved copy: Next's tracer
// (outputFileTracingIncludes in next.config.ts) is supposed to pull the native .node binary in
// on its own, but has proven unreliable — on at least one build it produced a completely empty
// directory, silently breaking every database call. Copying it ourselves, resolved the same way
// Node actually resolves it, removes that guesswork regardless of what the tracer did or didn't
// do. Its own runtime requires ("bindings", which itself requires "file-uri-to-path" — the
// actual require() graph, not the fuller package.json "dependencies" list, which also pulls in
// prebuild-install: install-time only, never require()'d once installed) get the same treatment.
//
// electron-rebuild fetches the Electron-ABI prebuild via prebuild-install, which drops it at
// bin/<platform>-<arch>-<abi>/better-sqlite3.node — a layout the "bindings" package's own
// built-in search list doesn't know about (it checks build/Release, lib/binding/node-v<abi>-...,
// and a handful of other conventional spots, but not this one). Left alone, that mismatch
// crashes every database call with "Could not locate the bindings file". A copy at the one path
// bindings checks first sidesteps needing to know its whole search list.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneDir = path.join(root, ".next", "standalone");
const require = createRequire(import.meta.url);

if (!existsSync(standaloneDir)) {
  console.error(`${standaloneDir} não existe — rode "next build" com output: "standalone" primeiro.`);
  process.exit(1);
}

cpSync(path.join(root, "public"), path.join(standaloneDir, "public"), { recursive: true, force: true });
console.log("Copiado public -> .next/standalone/public");
cpSync(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"), {
  recursive: true,
  force: true,
});
console.log("Copiado .next/static -> .next/standalone/.next/static");

const vendorNativeModulesDir = path.join(standaloneDir, "vendor-native", "node_modules");
rmSync(path.join(standaloneDir, "vendor-native"), { recursive: true, force: true });
mkdirSync(path.dirname(vendorNativeModulesDir), { recursive: true });
const tracedNodeModules = path.join(standaloneDir, "node_modules");
if (existsSync(tracedNodeModules)) {
  cpSync(tracedNodeModules, vendorNativeModulesDir, { recursive: true });
  rmSync(tracedNodeModules, { recursive: true, force: true });
} else {
  mkdirSync(vendorNativeModulesDir, { recursive: true });
}

function resolvePackageDir(name, fromDir) {
  const entry = require.resolve(name, { paths: [fromDir] });
  let dir = path.dirname(entry);
  while (!existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`package.json não encontrado para ${name} (a partir de ${entry})`);
    dir = parent;
  }
  return dir;
}

// Each entry is resolved starting from where the previous one lives, mirroring the actual
// require() chain: adapter -> better-sqlite3 -> bindings -> file-uri-to-path.
let fromDir = path.dirname(require.resolve("@prisma/adapter-better-sqlite3"));
for (const name of ["better-sqlite3", "bindings", "file-uri-to-path"]) {
  fromDir = resolvePackageDir(name, fromDir);
  const to = path.join(vendorNativeModulesDir, name);
  rmSync(to, { recursive: true, force: true });
  cpSync(fromDir, to, { recursive: true });
  console.log(`Copiado ${path.relative(root, fromDir)} -> ${path.relative(root, to)}`);
}

const betterSqlite3CopyDir = path.join(vendorNativeModulesDir, "better-sqlite3");
// node-gyp always writes the binary it just built to build/Release — that's the one electron-rebuild
// actually compiled for the arch/ABI requested in this run. Prefer it over scanning bin/**, which is
// prebuild-install's cache of every arch ever rebuilt on this machine (e.g. a stale arm64 prebuild
// left over from a previous cross-build): picking "the first .node file found" there is a coin flip
// on which architecture ships, not necessarily the one just requested.
const releaseBinaryRelPath = path.join("build", "Release", "better_sqlite3.node");
const nodeFile = existsSync(path.join(betterSqlite3CopyDir, releaseBinaryRelPath))
  ? releaseBinaryRelPath
  : readdirSync(betterSqlite3CopyDir, { recursive: true }).find((f) => f.endsWith(".node"));
if (!nodeFile) {
  console.error(`Nenhum binário .node encontrado em ${betterSqlite3CopyDir} — o electron-rebuild rodou?`);
  process.exit(1);
}
const canonicalDir = path.join(betterSqlite3CopyDir, "build", "Release");
mkdirSync(canonicalDir, { recursive: true });
const sourcePath = path.join(betterSqlite3CopyDir, nodeFile);
const targetPath = path.join(canonicalDir, "better_sqlite3.node");
if (sourcePath !== targetPath) cpSync(sourcePath, targetPath);
console.log(`Binário nativo (${nodeFile}) também disponível em build/Release/better_sqlite3.node para o "bindings"`);
