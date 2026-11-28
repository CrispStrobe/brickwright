// SPDX-License-Identifier: BSD-3-Clause
import {createWasmSession} from '../index.mjs';
import {registerCompilerFor} from './compiler-for-runner.mjs';

registerCompilerFor({name: 'FOR binary64', numericProfile: 'binary64', createSession: () => createWasmSession()});
