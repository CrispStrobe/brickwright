// SPDX-License-Identifier: BSD-3-Clause
import {createNativeSession} from '../index.mjs';
import {nativeOptions, target} from './native-test-target.mjs';
import {registerCompilerFor} from './compiler-for-runner.mjs';

registerCompilerFor({
    name: 'FOR native',
    createSession: () => createNativeSession(nativeOptions()),
    nativeBinary64: ['linux-arm64', 'linux-armv7'].includes(target.name)
});
