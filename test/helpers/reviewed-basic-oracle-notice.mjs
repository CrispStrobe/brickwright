// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';

// The CrispBASIC integration corrected this documentation in ae2364ce.
// It changed no YAML setting. Reverse only its exact comment block while
// retaining the original oracle workflow digest for every executable byte.
const before = "# BBCSDL is zlib-licensed and is NOT bundled or linked into the browser app; it\n# exists only so a real reference can run in CI/dev. Pinned to an immutable\n# commit inside build-bbcsdl-reference.sh (fetch-pinning classes it sha-const).\n";
const after = "# This workflow's BBCSDL console executable is a separate CI/dev reference\n# and is not shipped. CrispBASIC separately packages a restricted WASM build of\n# the zlib-licensed BBCSDL core; its own source locks, host restrictions and\n# distribution notices live in packages/crisp-basic. The console reference here\n# stays pinned in build-bbcsdl-reference.sh (fetch-pinning class sha-const).\n";
export const basicOracleBeforeCrispBasicNotice = (name, workflow) => {
    if (name !== 'basic-oracle') return workflow;
    assert.equal(workflow.split(after).length, 2, 'one exact reviewed CrispBASIC oracle notice');
    assert.equal(workflow.split(before).length, 1, 'no duplicate predecessor oracle notice');
    return workflow.replace(after, before);
};

// The HDD control is itself sealed historical source. Reverse the exact new
// import and call before its existing repository/fixture/concurrency reviews;
// unrelated source bytes and every historical hash remain unchanged.
const controlImport = "import {basicOracleBeforeCrispBasicNotice} from './helpers/reviewed-basic-oracle-notice.mjs';\n";
const beforeCall = "createHash('sha256').update(heldBeforeConcurrencyPolicy(name,workflow).replace(block,'  push:\\n'))";
const afterCall = "createHash('sha256').update(basicOracleBeforeCrispBasicNotice(name, heldBeforeConcurrencyPolicy(name,workflow)).replace(block,'  push:\\n'))";
export const hddBeforeCrispBasicNoticeControl = (file, text) => {
    if (file !== 'test/i80386-hdd-gui-actual.test.mjs') return text;
    assert.equal(text.split(controlImport).length, 2, 'one exact reviewed oracle notice import');
    assert.equal(text.split(afterCall).length, 2, 'one exact reviewed oracle notice projection call');
    return text.replace(controlImport, '').replace(afterCall, beforeCall);
};
