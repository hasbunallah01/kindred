// Base config input stub.
//
// This file exists so that `tsc --noEmit -p tsconfig.base.json` (the smoke test
// for the shared TypeScript config) can resolve at least one input file. Real
// source lives in apps/ and packages/ and uses per-package tsconfigs that
// `extend` tsconfig.base.json. This stub will be removed once any real
// TypeScript source exists in the workspace.
export {};
