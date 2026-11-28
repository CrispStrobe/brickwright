// SPDX-License-Identifier: BSD-3-Clause
/**
 * Web Worker host for the offline Cowgol compiler. One request at a time;
 * the page terminates the worker to cancel or time out a compile, because a
 * running WebAssembly stage cannot be interrupted from inside.
 *
 * Message in:  {id, bundledBase, gplBase, req: {language, code, target, format}}
 * Message out: {id, response} (the hosted /compile JSON shape) or
 *              {id, error, unavailable: boolean}
 */
import {createCowgolWasmToolchain} from './runtime.js';

let toolchain = null;
let key = null;
self.onmessage = async ({data}) => {
    const {id, bundledBase, gplBase = null, req} = data || {};
    try {
        const wanted = `${bundledBase}\n${gplBase || ''}`;
        if (!toolchain || key !== wanted) {
            toolchain = createCowgolWasmToolchain({bundledBase, gplBase});
            key = wanted;
        }
        const response = await toolchain.compile(req);
        self.postMessage({id, response});
    } catch (error) {
        self.postMessage({id, error: String(error?.message || error), unavailable: error?.name === 'CowgolWasmUnavailable'});
    }
};
