// SPDX-License-Identifier: BSD-3-Clause
import {execFileSync} from 'node:child_process';
import {isAbsolute} from 'node:path';

// The caller supplies the Git executable explicitly; a PATH lookup could bind
// this receipt to an unrelated tool. The returned ID is still the actual HEAD.
export function nativeBenchmarkSourceHead (gitExecutable, root, run = execFileSync) {
    if (typeof gitExecutable !== 'string' || !isAbsolute(gitExecutable)) {
        throw new Error('Set BW_GIT_EXECUTABLE to the absolute path of Git.');
    }
    const head = run(gitExecutable, ['rev-parse', '--verify', 'HEAD^{commit}'], {cwd: root, encoding: 'utf8'}).trim();
    if (!/^[0-9a-f]{40}$/.test(head)) throw new Error('Git did not return a full source commit.');
    return head;
}
