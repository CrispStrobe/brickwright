#!/usr/bin/env node
// SPDX-License-Identifier: BSD-3-Clause
// Same actual VM/Jolt pipeline as functional smoke, with mandatory completion/output criteria.
process.argv.push('--require-completion');
await import('./test-robot-lab-functional.mjs');
