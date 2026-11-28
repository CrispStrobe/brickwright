import {createWasmSession} from '../index.mjs';
import {registerCompilerParity} from './compiler-parity-runner.mjs';
registerCompilerParity({
    name: 'binary64',
    numericProfile: 'binary64',
    createSession: () => createWasmSession()
});
