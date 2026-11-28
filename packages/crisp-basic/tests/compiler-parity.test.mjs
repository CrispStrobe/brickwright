import {createNativeSession} from '../index.mjs';
import {nativeOptions} from './native-test-target.mjs';
import {registerCompilerParity} from './compiler-parity-runner.mjs';
registerCompilerParity({name: 'native', createSession: () => createNativeSession(nativeOptions())});
