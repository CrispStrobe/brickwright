import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import {hostNativeTarget, nativeTarget} from '../scripts/native-targets.mjs';

// Only the test harness reads these variables; application launch configuration
// stays explicit through session options and CLI flags.
export const executable = process.env.CRISP_BASIC_TEST_NATIVE_EXECUTABLE ?
    resolve(process.env.CRISP_BASIC_TEST_NATIVE_EXECUTABLE) :
    fileURLToPath(new URL('../.build/crispbasic-native', import.meta.url));
export const target = nativeTarget(process.env.CRISP_BASIC_TEST_NATIVE_TARGET || hostNativeTarget());
export const receiptPath = join(dirname(executable), 'native-build.json');
export const runner = process.env.CRISP_BASIC_TEST_NATIVE_RUNNER ?
    JSON.parse(process.env.CRISP_BASIC_TEST_NATIVE_RUNNER) : undefined;

export function nativeOptions(options = {}) {
    // Protocol-error fixtures are local scripts, not ARM executables.
    return {executable, ...(runner && !options.executable ? {runner} : {}), ...options};
}

export function nativeCliArgs(args) {
    return ['--native-executable', executable,
        ...(runner ? ['--native-runner', runner.executable,
            ...(runner.args || []).map(argument => `--native-runner-arg=${argument}`)] : []), ...args];
}
