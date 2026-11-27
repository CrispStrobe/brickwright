import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const workflow = readFileSync(new URL('../.github/workflows/mobile.yml', import.meta.url), 'utf8');
const repositoryId = '1291854269';
test('ad-hoc diagnostics print only device count and preserve the actual assertion', () => {
    assert.match(workflow, /DEVICE_COUNT=\$\(plutil -extract ProvisionedDevices xml1 -o - "\$WORK\/embedded.plist" \| grep -c '<string>'\)/);
    assert.match(workflow, /\[ "\$DEVICE_COUNT" -gt 0 \]/);
    assert.match(workflow, /plutil -extract ProvisionedDevices xml1 -o - \"\$WORK\/embedded.plist\" >\/dev\/null/);
    assert.doesNotMatch(workflow, /^\s*plutil -extract ProvisionedDevices[^\n]+\| grep '<string>'/m);
    assert.equal((workflow.match(/^\s*node scripts\/prepare-ios-device-build\.mjs$/gm) || []).length, 3);
});
function assertNoAuditEntry(body) {
    const start = body.indexOf('def main():');
    assert.ok(start >= 0, 'the actual entry point must exist');
    assert.doesNotMatch(body.slice(start), /SIMCTL_CHILD_|BW_EMBEDDED_ASSET_AUDIT_PATH|prepared_launch|owned_simulator_transaction|prepare_installed_observation|release_installed_observation|bounded_simulator_command|darwin_owned_command_cleanup|DarwinProcessSampler|DarwinAuditIdentity|simulator_code_directory|SimulatorDeviceSetDirectory/);
}

test('asset source preparation adds no runtime download or delivery event', () => {
    assert.doesNotMatch(workflow, /simctl.*download|downloadPlatform/);
    assertNoAuditEntry(retention);
    for (const injected of ['SIMCTL_CHILD_BW_EMBEDDED_ASSET_AUDIT_PATH = "injected"', 'bounded_simulator_command("injected")', 'DarwinProcessSampler("injected")']) {
        assert.throws(() => assertNoAuditEntry(retention.replace('def main():', `def main():\n    ${injected}`)));
    }
    assert.match(workflow, /if: startsWith\(github.ref, 'refs\/tags\/'\)/);
});
test('actual device-count shell keeps assertions and does not print authored identifiers', () => {
    const start = workflow.indexOf('          plutil -extract ProvisionedDevices xml1 -o - "$WORK/embedded.plist" >/dev/null');
    assert.ok(start > 0);
    const end = workflow.indexOf('          [ -f "$APP/PrivacyInfo.xcprivacy" ]', start);
    assert.ok(end > start);
    const script = workflow.slice(start, end).replace(/^          /gm, '');
    const dir = mkdtempSync(join(tmpdir(), 'bw-profile-count-'));
    try {
        writeFileSync(join(dir, 'plutil'), '#!/bin/sh\nprintf "%s\\n" "$PROFILE_XML"\nexit "${PROFILE_RC:-0}"\n', {mode: 0o755});
        const run = (text, xml, code = '0') => spawnSync('/bin/bash', ['-c', `set -euo pipefail\n${text}`], {
            encoding: 'utf8', env: {...process.env, PATH: `${dir}:${process.env.PATH}`, WORK: dir,
                PROFILE_XML: xml, PROFILE_RC: code}
        });
        const xml = '<array>\n<string>AUTHORED-DEVICE-A</string>\n<string>AUTHORED-DEVICE-B</string>\n</array>';
        const positive = run(script, xml);
        assert.equal(positive.status, 0, positive.stderr);
        assert.match(positive.stdout, /provisioned device count=2/);
        assert.doesNotMatch(positive.stdout + positive.stderr, /AUTHORED-DEVICE/);
        assert.notEqual(run(script, '<array/>').status, 0);
        assert.notEqual(run(script, '', '37').status, 0);
        const originalLeak = run(script.replace(' >/dev/null', ''), xml);
        assert.equal(originalLeak.status, 0);
        assert.match(originalLeak.stdout, /AUTHORED-DEVICE/, 'privacy control detects the original stdout leak');
    } finally {
        rmSync(dir, {recursive: true, force: true});
    }
});

const retentionBlock = workflow.match(/# BEGIN IOS INPUT RETENTION\n          cat > "\$RUNNER_TEMP\/bw-ios-audit-capture.py" <<'PY'\n([\s\S]*?)          PY\n          # END IOS INPUT RETENTION/);
assert.ok(retentionBlock, 'exact embedded retention producer');
const retention = retentionBlock[1].replace(/^          /gm, '');
const enabled = "github.event_name == 'workflow_dispatch' && inputs.retain_ios_audit_inputs && !inputs.sign_ios && !inputs.device_ipa && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/lane/ios-active-asset-source-20261018')";

function authoredRetention(source = retention) {
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-retention-'));
    const root = join(dir, 'checkout');
    const temp = join(dir, 'scratch');
    const bin = join(dir, 'bin');
    for (const path of [root, temp, bin]) mkdirSync(path);
    const put = (path, raw) => {
        const file = join(root, path);
        mkdirSync(join(file, '..'), {recursive: true});
        writeFileSync(file, raw);
    };
    const originals = {'apps/tauri/src-tauri/Cargo.lock': 'authored-lock', 'apps/tauri/src-tauri/src/lib.rs': 'authored-source'};
    for (const [path, raw] of Object.entries(originals)) put(path, raw);
    put('packages/scratch-gui/build/index.html', '<html>authored</html>');
    const app = 'apps/tauri/src-tauri/gen/apple/build/Authored.app';
    const plist = '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>authored</string><key>CFBundleSupportedPlatforms</key><array><string>iPhoneSimulator</string></array></dict></plist>';
    put(`${app}/Info.plist`, plist);
    put(`${app}/authored`, 'AUTHORED-NOT-A-REAL-EXECUTABLE');
    const codegen = 'target/aarch64-apple-ios-sim/release/build/brickwright-tauri-authored/out/tauri-codegen-assets';
    put(`${codegen}/authored.html`, 'AUTHORED-COMPRESSED-BYTES-NOT-ACTUAL-CODEGEN');
    for (const name of ['rustc', 'cargo', 'clang', 'xcodebuild']) put(`authored-tools/${name}`, `AUTHORED-${name}`);
    put('authored-sdk/SDKSettings.json', '{"Version":"18.0"}');
    const shim = `#!/usr/bin/python3
import json,os,pathlib,sys
name=pathlib.Path(sys.argv[0]).name
args=sys.argv[1:]
with open(os.environ['AUTHORED_COMMAND_LOG'],'a') as stream: stream.write(name+' '+str(args)+'\\n')
if os.environ.get('AUTHORED_FAIL') == name:
 print('PRIVATE-ERROR-MUST-NOT-LEAK',file=sys.stderr);sys.exit(37)
originals=json.loads(${JSON.stringify(JSON.stringify(originals))})
if name=='git':
 if args[0]=='ls-files': sys.stdout.buffer.write(('\\0'.join(sorted(originals))+'\\0').encode())
 elif args[0]=='show': sys.stdout.write(originals[args[1][5:]])
 elif args==['rev-parse','HEAD']: print('a'*40)
 elif args==['rev-parse','HEAD^{tree}']: print('b'*40)
 else: sys.exit(38)
elif name=='cargo' and args[0]=='metadata': print(json.dumps({'target_directory':str(pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'target')}))
elif name=='rustup': print(str(pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'authored-tools'/args[1]))
elif name=='xcrun' and args==['simctl','list','runtimes','--json']:
 import time
 time.sleep(float(os.environ.get('AUTHORED_INVENTORY_DELAY','0')))
 sys.stdout.write('x'*(2*1024*1024) if os.environ.get('AUTHORED_INVENTORY_OVERSIZED') else os.environ.get('AUTHORED_RUNTIME_JSON','{}'))
elif name=='xcrun' and '--find' in args: print(str(pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'authored-tools'/args[-1]))
elif name=='xcrun' and '--show-sdk-path' in args: print(str(pathlib.Path(os.environ['GITHUB_WORKSPACE'])/'authored-sdk'))
elif name=='rustc': print('rustc authored\\nhost: authored-target')
elif name=='cargo': print('cargo authored')
elif name=='xcodebuild': print('Xcode authored\\nBuild version authored')
elif name=='xcrun': print('18.0')
else: sys.exit(39)
`;
    for (const name of ['git', 'cargo', 'rustc', 'rustup', 'xcodebuild', 'xcrun']) {
        writeFileSync(join(bin, name), shim, {mode: 0o755});
    }
    const script = join(dir, 'capture.py'); writeFileSync(script, source);
    const commandLog = join(dir, 'commands.log');
    const env = {...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_WORKSPACE: root, RUNNER_TEMP: temp,
        GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'CrispStrobe/brickwright', GITHUB_REPOSITORY_ID: repositoryId,
        GITHUB_REF: 'refs/heads/lane/ios-active-asset-source-20261018', GITHUB_SHA: 'a'.repeat(40),
        GITHUB_RUN_ID: '100', GITHUB_RUN_ATTEMPT: '2', GITHUB_JOB: 'ios', BW_RETAIN_IOS_INPUTS: 'true',
        BW_SIGN_IOS: 'false', BW_DEVICE_IPA: 'false', AUTHORED_COMMAND_LOG: commandLog};
    const run = (phase, overrides = {}) => spawnSync('/usr/bin/python3', [script, phase], {
        env: {...env, ...overrides}, encoding: 'utf8', timeout: 15000
    });
    return {dir, root, temp, app, codegen, put, run, commandLog, script,
        output: join(temp, 'bw-ios-audit-inputs'), clean: () => rmSync(dir, {recursive: true, force: true})};
}

function withRetention(body, source) {
    const fixture = authoredRetention(source);
    try { return body(fixture); } finally { fixture.clean(); }
}

function succeeded(result) {
    assert.equal(result.status, 0, result.stderr + result.stdout);
}
function refused(result) {
    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /input retention refused/);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE-ERROR-MUST-NOT-LEAK/);
}

test('retention input defaults off and every optional step has the unsigned exact-branch guard', () => {
    assert.match(workflow, /retain_ios_audit_inputs:\n[\s\S]*?type: boolean\n        default: false/);
    assert.equal(workflow.split(`if: ${enabled}`).length - 1, 2);
    assert.equal(workflow.split(`if: always() && (${enabled})`).length - 1, 2);
    const ios = workflow.slice(workflow.indexOf('\n  ios:\n'), workflow.indexOf('\n  ios-signed:\n'));
    assert.ok(ios.indexOf('Retain unsigned iOS inputs before build') < ios.indexOf('npx tauri ios init --ci'));
    assert.match(ios, /name: brickwright-ios-toolchain-inputs/);
    assert.ok(ios.indexOf('name: brickwright-ios-sim') < ios.indexOf('Retain unsigned iOS products after build'));
    assert.match(ios, /name: brickwright-ios-audit-inputs[\s\S]*?include-hidden-files: true[\s\S]*?if-no-files-found: error/);
    assert.doesNotMatch(retention, /devicectl|downloadPlatform/);
    assertNoAuditEntry(retention);
    assert.match(retention, /\['xcrun', 'simctl', 'list', 'runtimes', '--json'\]/);
});

test('actual embedded producer retains authored inputs and products with limited claims', () => withRetention(f => {
    succeeded(f.run('before')); succeeded(f.run('after'));
    const manifest = JSON.parse(readFileSync(join(f.output, 'completed.json')));
    assert.equal(manifest.status, 'retained-candidates-only');
    assert.equal(manifest.rawCodegenCandidates, 1);
    assert.equal(manifest.rawCodegenFiles, 1);
    assert.equal(manifest.commit, 'a'.repeat(40));
    for (const field of ['completeBuildInputGraphQualified', 'effectiveConfigurationJoined', 'compilerUsedInputsProved',
        'activeCodegenReferencesJoined', 'actualAppObserved', 'signedTargetJoined', 'resourceLifetimeQualified']) {
        assert.equal(manifest[field], false, field);
    }
    assert.ok(manifest.entries.some(row => row.path === 'native/executable'));
    assert.equal(readFileSync(join(f.output, 'web/index.html'), 'utf8'), '<html>authored</html>');
    assert.doesNotMatch(JSON.stringify(manifest), new RegExp(f.dir));
}));

test('disabled, signing, device, wrong-repository and tag requests refuse before reading inputs', () => {
    for (const overrides of [{BW_RETAIN_IOS_INPUTS: 'false'}, {BW_SIGN_IOS: 'true'}, {BW_DEVICE_IPA: 'true'},
        {GITHUB_EVENT_NAME: 'push'}, {GITHUB_REPOSITORY_ID: '0'}, {GITHUB_REPOSITORY_ID: ''}, {GITHUB_REF: 'refs/tags/v0.0.0'},
        {GITHUB_REF: 'refs/heads/unreviewed'}]) {
        withRetention(f => {
            refused(f.run('before', overrides));
            assert.throws(() => readFileSync(f.commandLog));
        });
    }
});

test('retention admission follows the reviewed repository ID across a repository rename', () => withRetention(f => {
    succeeded(f.run('before', {GITHUB_REPOSITORY: 'CrispStrobe/brickwright-lite'}));
}));

test('retention refuses overwrite, command failure and changed or extra build inputs', () => {
    withRetention(f => { succeeded(f.run('before')); refused(f.run('before')); });
    withRetention(f => { refused(f.run('before', {AUTHORED_FAIL: 'rustc'})); });
    for (const [path, raw] of [['packages/scratch-gui/build/index.html', 'changed'],
        ['packages/scratch-gui/build/extra.js', 'new'], ['apps/tauri/src-tauri/src/lib.rs', 'changed']]) {
        withRetention(f => { succeeded(f.run('before')); f.put(path, raw); refused(f.run('after')); });
    }
});

test('missing, linked, ambiguous and non-simulator outputs refuse', () => {
    for (const edit of ['missing', 'symlink', 'directory-link', 'two-apps', 'device']) {
        withRetention(f => {
            succeeded(f.run('before'));
            if (edit === 'missing') rmSync(join(f.root, 'target'), {recursive: true});
            if (edit === 'symlink') symlinkSync(join(f.root, f.app, 'authored'), join(f.root, f.codegen, 'linked'));
            if (edit === 'directory-link') symlinkSync(join(f.root, f.codegen), join(f.root, f.codegen, 'linked-directory'));
            if (edit === 'two-apps') f.put('apps/tauri/src-tauri/gen/apple/build/Other.app/unused', 'x');
            if (edit === 'device') f.put(`${f.app}/Info.plist`, readFileSync(join(f.root, f.app, 'Info.plist'), 'utf8').replace('iPhoneSimulator', 'iPhoneOS'));
            refused(f.run('after'));
        });
    }
});

test('changed manifests, hidden private inputs and authored byte caps refuse', () => {
    withRetention(f => {
        succeeded(f.run('before'));
        const file = join(f.output, 'manifest.json');
        const manifest = JSON.parse(readFileSync(file)); manifest.actualAppObserved = true;
        writeFileSync(file, JSON.stringify(manifest)); refused(f.run('after'));
    });
    withRetention(f => { f.put('packages/scratch-gui/build/.env', 'AUTHORED-PRIVATE'); refused(f.run('before')); });
    withRetention(f => { refused(f.run('before')); }, retention.replace('TOTAL = 512 * 1024 * 1024', 'TOTAL = 8'));
});

test('post-build retention refuses changed launched producer bytes', () => withRetention(f => {
    succeeded(f.run('before'));
    writeFileSync(f.script, readFileSync(f.script, 'utf8') + '\n# authored changed controller\n');
    refused(f.run('after'));
}));

test('toolchain observations retain hashes only and bind stable before/after identities', () => withRetention(f => {
    succeeded(f.run('before')); succeeded(f.run('after'));
    const directory = join(f.temp, 'bw-ios-toolchain-inputs');
    const raw = readFileSync(join(directory, 'before.json'));
    const before = JSON.parse(raw);
    const after = JSON.parse(readFileSync(join(directory, 'after.json')));
    assert.equal(after.beforeSHA256, createHash('sha256').update(raw).digest('hex'));
    assert.equal(after.phase, 'after'); assert.equal(before.phase, 'before');
    assert.deepEqual(Object.keys(before.tools).sort(), ['appleClang', 'cargo', 'rustc', 'simulatorSDKSettings', 'xcodeBuild']);
    for (const [role, file] of [['rustc', 'authored-tools/rustc'], ['cargo', 'authored-tools/cargo'],
        ['appleClang', 'authored-tools/clang'], ['xcodeBuild', 'authored-tools/xcodebuild'],
        ['simulatorSDKSettings', 'authored-sdk/SDKSettings.json']]) {
        const bytes = readFileSync(join(f.root, file));
        assert.deepEqual(before.tools[role], {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')});
    }
    assert.deepEqual(before.tools, after.tools);
    for (const flag of ['compilerUsedInputsProved', 'completeToolchainClosureQualified', 'sdkContentsQualified',
        'effectiveConfigurationJoined', 'actualAppObserved', 'resourceLifetimeQualified']) {
        assert.equal(before[flag], false); assert.equal(after[flag], false);
    }
    const manifest = JSON.parse(readFileSync(join(f.output, 'completed.json')));
    assert.equal(before.producerSHA256, manifest.entries.find(r => r.path === 'producer/capture.py').sha256);
    assert.doesNotMatch(raw.toString(), new RegExp(f.dir));
}));

test('changed tools, SDK settings, before identities and failed resolution refuse', () => {
    for (const path of ['authored-tools/rustc', 'authored-tools/clang', 'authored-sdk/SDKSettings.json']) {
        withRetention(f => { succeeded(f.run('before')); f.put(path, 'changed'); refused(f.run('after')); });
    }
    withRetention(f => {
        succeeded(f.run('before'));
        const file = join(f.temp, 'bw-ios-toolchain-inputs/before.json');
        const value = JSON.parse(readFileSync(file)); value.compilerUsedInputsProved = true;
        writeFileSync(file, JSON.stringify(value)); refused(f.run('after'));
    });
    withRetention(f => { refused(f.run('before', {AUTHORED_FAIL: 'rustup'})); });
});

test('runtime mutations expose changed-web and signing guard defects', () => {
    const old = 'need(read_file(local) == original)'; assert.ok(retention.includes(old));
    withRetention(f => {
        succeeded(f.run('before')); f.put('packages/scratch-gui/build/index.html', 'changed');
        succeeded(f.run('after'));
    }, retention.replace(old, 'need(True)'));
    const guard = "os.environ.get('BW_SIGN_IOS') == 'false'"; assert.ok(retention.includes(guard));
    withRetention(f => { succeeded(f.run('before', {BW_SIGN_IOS: 'true'})); }, retention.replace(guard, 'True'));
});

const runtimeID = 'com.apple.CoreSimulator.SimRuntime.iOS-18-0';
const runtimeRecord = {identifier: runtimeID, version: '18.0', buildversion: '22A3354', isAvailable: true,
    bundlePath: 'AUTHORED-PRIVATE-RUNTIME-PATH'};
function macho({cpu = 0x0100000c, platform = 7, minimum = 0x120000, commandSize = 24, count = 1} = {}) {
    const bytes = Buffer.alloc(56);
    [0xfeedfacf, cpu, 0, 2, count, 24, 0, 0, 0x32, commandSize, platform, minimum, 0x120000, 0]
        .forEach((n, index) => bytes.writeUInt32LE(n, index * 4));
    return bytes;
}
function withRuntime(body, source = retention, executable = macho()) {
    withRetention(f => {
        writeFileSync(join(f.dir, 'platform.py'), 'def system(): return "Darwin"\ndef machine(): return "arm64"\n');
        f.put(`${f.app}/authored`, executable);
        f.put(`${f.app}/Info.plist`, readFileSync(join(f.root, f.app, 'Info.plist'), 'utf8')
            .replace('</dict>', '<key>MinimumOSVersion</key><string>18.0</string></dict>'));
        succeeded(f.run('before')); succeeded(f.run('after'));
        const runtime = (overrides = {}) => f.run('runtime', {BW_IOS_AUDIT_RUNTIME: runtimeID,
            BW_IOS_AUDIT_RUNTIME_BUILD: '22A3354', AUTHORED_RUNTIME_JSON: JSON.stringify({runtimes: [runtimeRecord]}), ...overrides});
        const candidate = () => JSON.parse(readFileSync(join(f.temp, 'bw-ios-runtime-admission/candidate.json')));
        body({...f, runtime, candidate});
    }, source);
}

test('runtime admission is an optional guarded inventory step after retained products', () => {
    assert.match(workflow, /ios_audit_runtime:\n[\s\S]*?type: string\n        default: ''/);
    assert.match(workflow, /if: \(github.event_name[^\n]+inputs.ios_audit_runtime != ''/);
    assert.match(workflow, /if: always\(\) && inputs.ios_audit_runtime != '' && \(github.event_name/);
    assert.ok(workflow.indexOf('Retain unsigned iOS products after build') < workflow.indexOf('Admit installed unsigned iOS runtime candidate'));
    assert.match(workflow, /name: brickwright-ios-runtime-admission/);
    const runtimeBody = retention.slice(retention.indexOf('def runtime_admission()'), retention.indexOf('def owned_simulator_transaction('));
    assert.doesNotMatch(runtimeBody, /owned_simulator_transaction|(?:create|boot|install|launch|shutdown|delete)\(/);
    assert.equal((retention.match(/owned_simulator_transaction\(/g) || []).length, 1, 'definition only; no workflow caller');
});

test('actual runtime admission binds authored simulator header and retained inputs without launching', () => withRuntime(f => {
    succeeded(f.runtime());
    const value = f.candidate();
    assert.equal(value.status, 'runtime-candidate-only-launch-refused');
    assert.equal(value.runtimeIdentifier, runtimeID);
    assert.equal(value.runtimeBuild, '22A3354');
    assert.equal(value.executableSHA256, createHash('sha256').update(macho()).digest('hex'));
    assert.deepEqual(value.executableMinimumOS, [18, 0, 0]);
    for (const key of ['launchAllowed', 'actualAppObserved', 'deviceAdmitted', 'runtimeArchitectureQualified',
        'resourceLifetimeQualified', 'executableLoadabilityQualified', 'officialArtifactAuthenticated']) assert.equal(value[key], false);
    assert.doesNotMatch(JSON.stringify(value), /AUTHORED-PRIVATE|bundlePath/);
    const commands = readFileSync(f.commandLog, 'utf8');
    assert.equal(commands.split("['simctl', 'list', 'runtimes', '--json']").length - 1, 1);
    assert.doesNotMatch(commands, /'launch'|'install'|'boot'|'create'|'delete'|'shutdown'/);
    refused(f.runtime()); // Existing admission originals are never overwritten.
}));

test('runtime admission rejects missing, duplicate, unavailable, changed-build and too-old runtimes', () => {
    for (const runtimes of [[], [runtimeRecord, runtimeRecord], [{...runtimeRecord, isAvailable: false}],
        [{...runtimeRecord, isAvailable: 1}], [{...runtimeRecord, availabilityError: 'AUTHORED-PRIVATE-ERROR'}],
        [{...runtimeRecord, buildversion: '22A9999'}], [{...runtimeRecord, version: '17.0'}], [{...runtimeRecord, version: '19.0'}]]) {
        withRuntime(f => { refused(f.runtime({AUTHORED_RUNTIME_JSON: JSON.stringify({runtimes})})); assert.equal(f.candidate().status, 'partial'); });
    }
    withRuntime(f => refused(f.runtime({AUTHORED_RUNTIME_JSON: '{"runtimes":[],"runtimes":[]}'})));
    withRuntime(f => refused(f.runtime({AUTHORED_RUNTIME_JSON: 'not-json'})));
});

test('runtime admission rejects malformed requests and incompatible or malformed executable metadata', () => {
    for (const overrides of [{BW_IOS_AUDIT_RUNTIME: ''}, {BW_IOS_AUDIT_RUNTIME: '../unreviewed'},
        {BW_IOS_AUDIT_RUNTIME_BUILD: ''}, {BW_IOS_AUDIT_RUNTIME_BUILD: 'AUTHORED-PRIVATE'}]) {
        withRuntime(f => { refused(f.runtime(overrides)); assert.doesNotMatch(readFileSync(f.commandLog, 'utf8'), /'simctl'/); });
    }
    for (const binary of [Buffer.from('not-a-Mach-O'), macho({cpu: 0x01000007}), macho({platform: 2}),
        macho({commandSize: 8}), macho({count: 2}), macho({minimum: 0x110000})]) {
        withRuntime(f => { refused(f.runtime()); assert.doesNotMatch(readFileSync(f.commandLog, 'utf8'), /'simctl'/); }, retention, binary);
    }
});

test('runtime admission refuses changed originals, manifest identity, host architecture and failed inventory', () => {
    for (const name of ['native/executable', 'native/Info.plist', 'producer/capture.py']) {
        withRuntime(f => { writeFileSync(join(f.output, name), 'changed'); refused(f.runtime()); });
    }
    withRuntime(f => {
        const file = join(f.output, 'completed.json');const value = JSON.parse(readFileSync(file));
        value.job = 'other';writeFileSync(file, JSON.stringify(value));refused(f.runtime());
    });
    withRuntime(f => {
        writeFileSync(join(f.dir, 'platform.py'), 'def system(): return "Darwin"\ndef machine(): return "x86_64"\n');
        refused(f.runtime());
    });
    withRuntime(f => {
        const result = f.runtime({AUTHORED_FAIL: 'xcrun'});refused(result);
        assert.doesNotMatch(result.stdout + result.stderr + JSON.stringify(f.candidate()), /PRIVATE-ERROR-MUST-NOT-LEAK/);
    });
});

test('bounded runtime inventory refuses oversized command output', () => {
    withRuntime(f => refused(f.runtime({AUTHORED_INVENTORY_OVERSIZED: 'true'})));
    withRuntime(f => refused(f.runtime({AUTHORED_INVENTORY_DELAY: '0.5'})),
        retention.replace('deadline = time.monotonic() + 15', 'deadline = time.monotonic() + 0.05'));
});

test('runtime mutations demonstrate build and simulator-platform guards are live', () => {
    const buildGuard = "runtime['buildversion'] == build and ";assert.ok(retention.includes(buildGuard));
    withRuntime(f => { succeeded(f.runtime({BW_IOS_AUDIT_RUNTIME_BUILD: '22A9999'})); }, retention.replace(buildGuard, ''));
    const platformGuard = 'platform_id == 7 and ';assert.ok(retention.includes(platformGuard));
    withRuntime(f => { succeeded(f.runtime()); }, retention.replace(platformGuard, ''), macho({platform: 2}));
});

const lifecycleControls = String.raw`
import copy
import unittest
import math
NEW = '11111111-1111-1111-1111-111111111111'
OLD = '22222222-2222-2222-2222-222222222222'
RUNTIME = 'com.apple.CoreSimulator.SimRuntime.iOS-18-0'
TYPE = 'com.apple.CoreSimulator.SimDeviceType.iPhone-16'
PLAN = {'schema':'brickwright.ios-owned-simulator-plan.v1','runtimeIdentifier':RUNTIME,
        'deviceTypeIdentifier':TYPE,'name':'bw-asset-audit-'+'a'*32,'bundleIdentifier':'com.example.authored',
        'appPath':'AUTHORED-PRIVATE-APP-PATH','sourceSHA256':'b'*64,'executableSHA256':'c'*64,
        'runtimeArchitectureAdmitted':True,'deviceModelAdmitted':True,'processEnvelopeAdmitted':True}
RAW = b'{"authoredOnly":true,"notAnAppObservation":true}'
class World:
    def __init__(self):
        self.time=0.;self.commands=[];self.fail=set();self.after_fail=set();self.created=NEW
        self.devices={OLD:{'udid':OLD,'name':'AUTHORED-OTHER-DEVICE','deviceTypeIdentifier':TYPE,'state':'Booted','isAvailable':True}}
        self.observer=lambda:RAW;self.bad_create=None;self.huge=False
        self.context=object();self.preparations=[];self.releases=[];self.preparer=lambda:self.context;self.releaser=lambda:None
    def now(self):return self.time
    def invoke(self,args,*,deadline,output_limit):
        assert self.time < deadline and output_limit==1024*1024
        self.time+=0.001;self.commands.append(args);op=args[0]
        if op in self.fail:raise RuntimeError('AUTHORED-PRIVATE-ERROR')
        value=b''
        if op=='list':
            value=json.dumps({'devices':{RUNTIME:list(self.devices.values())}}).encode()
            if self.huge:value=b'x'*(1024*1024+1)
        elif op=='create':
            self.devices[self.created]={'udid':self.created,'name':args[1],'deviceTypeIdentifier':args[2],'state':'Shutdown','isAvailable':True}
            value=(self.bad_create or self.created).encode()
        else:
            assert args[1] in self.devices and args[1] not in ('all','booted','unavailable')
            if op=='boot':self.devices[args[1]]['state']='Booted'
            elif op=='shutdown':self.devices[args[1]]['state']='Shutdown'
            elif op=='delete':del self.devices[args[1]]
            elif op=='launch':value=b'com.example.authored: 1234\n'
            else:assert op in ('bootstatus','install','terminate')
        if op in self.after_fail:raise RuntimeError('AUTHORED-PRIVATE-ERROR-AFTER-EFFECT')
        return value
    def prepare(self,device,*,deadline,output_limit):
        assert device==NEW and self.time<deadline and output_limit==8*1024*1024
        assert 'install' in self.ops() and 'launch' not in self.ops()
        self.preparations.append(device);return self.preparer()
    def release(self,prepared):
        assert 'delete' in self.ops() or self.after_fail or self.fail or self.time<0 or not math.isfinite(self.time) or self.devices[NEW]['name']!=PLAN['name']
        self.releases.append(prepared);return self.releaser()
    def observe(self,device,pid,*,prepared,deadline,output_limit):
        assert device==NEW and pid==1234 and self.time<deadline and output_limit==8*1024*1024
        assert prepared is self.context
        return self.observer()
    def run(self,fn=owned_simulator_transaction,plan=None,*,stopped=None,cleanup_invoke=None):
        return fn(copy.deepcopy(PLAN) if plan is None else plan,self.invoke,self.observe,self.now,prepare=self.prepare,release=self.release,stopped=stopped,cleanup_invoke=cleanup_invoke)
    def ops(self):return [a[0] for a in self.commands]
class LifecycleControls(unittest.TestCase):
    def test_cleanup_adapter_stays_live_after_stop_while_active_adapter_refuses(self):
        w=World();flag=[False];active=[];cleanup=[];invoke=w.invoke
        def active_invoke(args,**kwargs):
            if flag[0]:raise ValueError('authored-stopped-active')
            active.append(args);return invoke(args,**kwargs)
        def cleanup_invoke(args,**kwargs):
            cleanup.append(args);return invoke(args,**kwargs)
        def observed():flag[0]=True;return RAW
        w.invoke=active_invoke;w.observer=observed
        r,raw=w.run(stopped=lambda:flag[0],cleanup_invoke=cleanup_invoke)
        self.assertEqual(raw,RAW);self.assertEqual(r['status'],'partial');self.assertTrue(r['cancellationObserved'])
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(r['cleanupFailures'],[])
        self.assertEqual([args[0] for args in cleanup],['list','terminate','list','shutdown','list','delete','list'])
        self.assertFalse(any(args[0] in ('terminate','shutdown','delete') for args in active))
        self.assertEqual(w.releases,[w.context]);self.assertEqual(w.devices[OLD]['name'],'AUTHORED-OTHER-DEVICE')
        cut='callback = cleanup_invoke if cleanup and cleanup_invoke is not None else invoke'
        self.assertEqual(SOURCE_PREFIX.count(cut),1);namespace={}
        exec(compile(SOURCE_PREFIX.replace(cut,'callback = invoke'),'authored-lost-cleanup-adapter','exec'),namespace)
        w=World();flag=[False];invoke=w.invoke
        w.invoke=active_invoke;w.observer=observed
        # Release still runs even when the intentionally broken route cannot delete.
        w.release=lambda context:w.releases.append(context)
        r,raw=w.run(namespace['owned_simulator_transaction'],stopped=lambda:flag[0],cleanup_invoke=cleanup_invoke)
        self.assertFalse(r['cleanupAbsenceObserved']);self.assertIn('delete',r['cleanupFailures'])
    def test_interrupt_during_cleanup_continues_and_preserves_observation(self):
        for operation in ('terminate','shutdown','delete'):
            w=World();invoke=w.invoke
            def interrupted(args,**kwargs):
                if args[0]==operation:
                    w.commands.append(args);raise KeyboardInterrupt('authored-cleanup')
                return invoke(args,**kwargs)
            w.invoke=interrupted
            with self.subTest(operation=operation),self.assertRaises(KeyboardInterrupt) as caught:w.run()
            r=json.loads(caught.exception.simulator_transaction_result)
            self.assertIn(operation,r['cleanupFailures']);self.assertEqual(r['status'],'partial')
            self.assertIn('delete',w.ops());self.assertEqual(r['cleanupAbsenceObserved'],operation!='delete')
            self.assertEqual(caught.exception.simulator_transaction_observation,RAW)
            self.assertEqual(w.releases,[w.context]);self.assertIn(OLD,w.devices)
    def test_primary_interrupt_is_not_replaced_by_cleanup_interrupt(self):
        w=World();first=KeyboardInterrupt('authored-first');second=SystemExit('authored-second');invoke=w.invoke
        def observer():raise first
        def cleanup(args,**kwargs):
            if args[0]=='terminate':w.commands.append(args);raise second
            return invoke(args,**kwargs)
        w.observer=observer;w.invoke=cleanup
        with self.assertRaises(KeyboardInterrupt) as caught:w.run()
        self.assertIs(caught.exception,first);self.assertEqual(caught.exception.simulator_transaction_secondary_interrupts,(second,))
        self.assertIsNone(caught.exception.simulator_transaction_observation)
        r=json.loads(caught.exception.simulator_transaction_result)
        self.assertEqual(r['primaryFailure'],'observe');self.assertIn('terminate',r['cleanupFailures'])
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(w.releases,[w.context])
    def test_cleanup_interrupt_continuation_mutant_is_detected(self):
        cut="except BaseException as error:\n                            remember_interrupt(error)\n                            result['cleanupFailures'].append(command)"
        self.assertEqual(SOURCE_PREFIX.count(cut),1)
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,cut.replace('BaseException','Exception')),'authored-interrupt-cleanup-mutant','exec'),namespace)
        w=World();invoke=w.invoke
        def interrupted(args,**kwargs):
            if args[0]=='terminate':w.commands.append(args);raise KeyboardInterrupt('authored')
            return invoke(args,**kwargs)
        w.invoke=interrupted
        w.release=lambda context:w.releases.append(context)
        with self.assertRaises(KeyboardInterrupt):w.run(namespace['owned_simulator_transaction'])
        self.assertNotIn('delete',w.ops());self.assertEqual(w.releases,[w.context])
    def test_invalid_cleanup_adapter_refuses_before_any_effect(self):
        for invalid in (True,{},1):
            w=World()
            with self.assertRaises(ValueError):w.run(cleanup_invoke=invalid)
            self.assertEqual(w.commands,[])
    def test_initial_stop_or_invalid_flag_performs_no_command(self):
        for flag in (True,None,1):
            w=World();r,raw=w.run(stopped=lambda:flag)
            self.assertEqual(w.commands,[]);self.assertEqual(r['status'],'partial');self.assertIsNone(raw)
    def test_stop_after_create_still_resolves_and_cleans_exact_owned_device(self):
        w=World();r,raw=w.run(stopped=lambda:'create' in w.ops())
        self.assertTrue(r['ownershipEstablished']);self.assertTrue(r['cancellationObserved'])
        self.assertNotIn('boot',w.ops());self.assertNotIn(NEW,w.devices);self.assertIn(OLD,w.devices)
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(r['status'],'partial')
    def test_stop_during_readback_cannot_dispatch_next_effect(self):
        w=World();flag=[False];original=w.invoke
        def invoke(args,**kwargs):
            value=original(args,**kwargs)
            if args[0]=='list' and 'boot' in w.ops():flag[0]=True
            return value
        w.invoke=invoke;r,raw=w.run(stopped=lambda:flag[0])
        self.assertNotIn('bootstatus',w.ops());self.assertNotIn('install',w.ops())
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(r['status'],'partial')
    def test_stop_in_preparation_releases_once_without_launch(self):
        w=World();flag=[False]
        def prepare():flag[0]=True;return w.context
        w.preparer=prepare;r,raw=w.run(stopped=lambda:flag[0])
        self.assertNotIn('launch',w.ops());self.assertEqual(w.releases,[w.context])
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(r['status'],'partial')
    def test_stop_during_observation_preserves_original_but_refuses_success(self):
        w=World();flag=[False]
        def observe():flag[0]=True;return RAW
        w.observer=observe;r,raw=w.run(stopped=lambda:flag[0])
        self.assertEqual(raw,RAW);self.assertTrue(r['observationRetained']);self.assertEqual(r['status'],'partial')
        self.assertEqual(w.releases,[w.context]);self.assertTrue(r['cleanupAbsenceObserved'])
    def test_stop_during_release_fences_publication_and_mutant_exposes_it(self):
        def run(fn):
            w=World();flag=[False]
            def release():flag[0]=True
            w.releaser=release;r,raw=w.run(fn,stopped=lambda:flag[0]);return r,raw,w
        r,raw,w=run(owned_simulator_transaction)
        self.assertEqual(r['primaryFailure'],'publication');self.assertEqual(r['status'],'partial')
        self.assertEqual(raw,RAW);self.assertTrue(r['preparationReleased']);self.assertEqual(w.releases,[w.context])
        namespace={};cut='check_stop(active=False)';self.assertEqual(SOURCE_PREFIX.count(cut),1)
        exec(compile(SOURCE_PREFIX.replace(cut,'pass'),'authored-no-publication-stop','exec'),namespace)
        changed,_,_=run(namespace['owned_simulator_transaction']);self.assertEqual(changed['status'],'observed-transaction-only')
    def test_normal_transaction_keeps_other_device_and_limited_claims(self):
        w=World();old=copy.deepcopy(w.devices[OLD]);r,raw=w.run()
        self.assertEqual(r['status'],'observed-transaction-only');self.assertEqual(raw,RAW)
        self.assertEqual(w.preparations,[NEW]);self.assertEqual(w.releases,[w.context])
        self.assertTrue(r['preparationReturned']);self.assertTrue(r['preparationReleased'])
        self.assertEqual(r['observationSHA256'],hashlib.sha256(RAW).hexdigest())
        self.assertEqual(w.devices,{OLD:old});self.assertTrue(r['cleanupAbsenceObserved'])
        self.assertLessEqual(r['activeCommands'],32);self.assertEqual(r['cleanupCommands'],7)
        for key in ('suppliedAdmissionAuthenticated','callbackBoundsQualified','resourceLifetimeQualified','actualAppQualified'):self.assertIs(r[key],False)
        self.assertEqual([op for op in w.ops() if op!='list'],['create','boot','bootstatus','install','launch','terminate','shutdown','delete'])
        self.assertNotIn('AUTHORED-PRIVATE',json.dumps(r));self.assertNotIn(NEW,json.dumps(r))
    def test_unadmitted_or_malformed_plan_never_calls_an_adapter(self):
        for field in ('runtimeArchitectureAdmitted','deviceModelAdmitted','processEnvelopeAdmitted'):
            for value in (False,1,None,'true'):
                w=World();p=copy.deepcopy(PLAN);p[field]=value
                with self.assertRaises(ValueError):w.run(plan=p)
                self.assertEqual(w.commands,[])
        for field,value in (('sourceSHA256','x'),('name','all'),('bundleIdentifier','../bad'),('appPath','bad\npath')):
            w=World();p=copy.deepcopy(PLAN);p[field]=value
            with self.assertRaises(ValueError):w.run(plan=p)
            self.assertEqual(w.commands,[])
    def test_unknown_or_reused_created_identity_never_becomes_a_cleanup_target(self):
        for identifier in ('all','booted','unavailable','invalid'):
            w=World();w.bad_create=identifier;r,_=w.run()
            self.assertTrue(r['creationUncertain']);self.assertNotIn('delete',w.ops());self.assertFalse(r['ownershipEstablished'])
        w=World();w.created=OLD;r,_=w.run()
        self.assertEqual(r['primaryFailure'],'create');self.assertNotIn('boot',w.ops());self.assertNotIn('delete',w.ops())
    def test_name_collision_refuses_before_create(self):
        w=World();w.devices[OLD]['name']=PLAN['name'];r,_=w.run()
        self.assertFalse(r['creationAttempted']);self.assertEqual(w.ops(),['list'])
    def test_failed_create_acknowledgement_retains_ownership_uncertainty(self):
        w=World();w.after_fail={'create'};r,_=w.run()
        self.assertEqual(r['primaryFailure'],'create');self.assertIn(NEW,w.devices)
        self.assertTrue(r['creationUncertain']);self.assertNotIn('delete',w.ops())
    def test_primary_failures_still_attempt_owned_cleanup(self):
        for op in ('boot','bootstatus','install','launch'):
            w=World();w.after_fail={op};r,raw=w.run()
            self.assertEqual(r['primaryFailure'],{'bootstatus':'boot-ready'}.get(op,op))
            self.assertIsNone(raw);self.assertTrue(r['cleanupAbsenceObserved']);self.assertNotIn(NEW,w.devices)
            self.assertEqual(w.devices[OLD]['name'],'AUTHORED-OTHER-DEVICE')
            if op=='launch':self.assertIn('terminate',w.ops())
    def test_cleanup_failures_do_not_skip_later_cleanup_or_erase_observation(self):
        for op in ('terminate','shutdown','delete'):
            w=World();w.fail={op};r,raw=w.run()
            self.assertEqual(r['status'],'partial');self.assertIn(op,r['cleanupFailures']);self.assertIsNone(r['primaryFailure'])
            self.assertEqual(raw,RAW);self.assertIn('delete',w.ops())
            self.assertEqual(r['cleanupAbsenceObserved'],op!='delete')
    def test_primary_and_cleanup_failures_are_both_preserved(self):
        w=World();w.fail={'terminate'}
        def fail():raise RuntimeError('AUTHORED-PRIVATE-OBSERVE-ERROR')
        w.observer=fail;r,raw=w.run();self.assertEqual(r['primaryFailure'],'observe')
        self.assertIn('terminate',r['cleanupFailures']);self.assertIsNone(raw);self.assertIn('delete',w.ops())
    def test_changed_identity_refuses_each_destructive_cleanup_operation(self):
        w=World()
        def replace():w.devices[NEW]['name']='AUTHORED-OTHER-OWNER';return RAW
        w.observer=replace;r,raw=w.run()
        self.assertEqual(raw,RAW);self.assertFalse(r['cleanupAbsenceObserved'])
        self.assertEqual([op for op in w.ops() if op in ('terminate','shutdown','delete')],[])
        self.assertEqual(r['cleanupFailures'],['terminate','shutdown','delete','absence-readback'])
    def test_late_observation_is_retained_as_partial_and_cleanup_has_its_own_budget(self):
        w=World()
        def late():w.time=91.;return RAW
        w.observer=late;r,raw=w.run();self.assertEqual(raw,RAW);self.assertEqual(r['primaryFailure'],'observe')
        self.assertTrue(r['cleanupAbsenceObserved']);self.assertEqual(r['status'],'partial')
    def test_backward_and_nonfinite_clocks_refuse_further_mutation(self):
        for tick in (-1.,float('nan'),float('inf')):
            w=World()
            def broken():w.time=tick;return RAW
            w.observer=broken;r,raw=w.run();self.assertEqual(r['primaryFailure'],'observe')
            self.assertIn('cleanup-clock',r['cleanupFailures']);self.assertNotIn('delete',w.ops())
            self.assertFalse(r['cleanupAbsenceObserved']);self.assertEqual(raw,RAW)
    def test_caller_mutation_cannot_retarget_cleanup(self):
        w=World();p=copy.deepcopy(PLAN)
        def mutate():p['name']='OTHER';p['bundleIdentifier']='other.app';return RAW
        w.observer=mutate;r,_=w.run(plan=p);self.assertTrue(r['cleanupAbsenceObserved'])
        self.assertIn(('terminate',NEW,'com.example.authored'),w.commands)
    def test_oversized_catalog_or_observation_remains_partial(self):
        w=World();w.huge=True;r,_=w.run();self.assertFalse(r['creationAttempted'])
        w=World();w.observer=lambda:b'x'*(8*1024*1024+1);r,raw=w.run()
        self.assertEqual(r['primaryFailure'],'observe');self.assertIsNone(raw);self.assertTrue(r['cleanupAbsenceObserved'])
    def test_adapter_deadlines_are_checked_on_return(self):
        w=World();original=w.invoke
        def late(args,**kwargs):
            raw=original(args,**kwargs);w.time=16.;return raw
        w.invoke=late;r,_=w.run();self.assertEqual(r['primaryFailure'],'initial-catalog')
        self.assertFalse(r['creationAttempted'])
        w=World()
        def late_observation():w.time=31.;return RAW
        w.observer=late_observation;r,raw=w.run();self.assertEqual(raw,RAW)
        self.assertEqual(r['primaryFailure'],'observe');self.assertTrue(r['cleanupAbsenceObserved'])
    def test_keyboard_interrupt_propagates_after_owned_cleanup(self):
        w=World()
        def interrupt():raise KeyboardInterrupt()
        w.observer=interrupt
        with self.assertRaises(KeyboardInterrupt):w.run()
        self.assertNotIn(NEW,w.devices);self.assertIn(OLD,w.devices)
    def test_preparation_refuses_launch_on_failure_none_or_late_return(self):
        for mode in ('raise','none','late'):
            w=World()
            def prepare():
                if mode=='raise':raise ValueError('AUTHORED-PRIVATE-PREPARE')
                if mode=='none':return None
                w.time=16.;return w.context
            w.preparer=prepare;r,raw=w.run()
            self.assertEqual(r['primaryFailure'],'prepare-observation');self.assertIsNone(raw)
            self.assertNotIn('launch',w.ops());self.assertTrue(r['cleanupAbsenceObserved'])
            self.assertEqual(w.releases,[] if mode=='raise' else [None if mode=='none' else w.context])
    def test_preparation_interrupt_cleanup_and_returned_context_release(self):
        w=World()
        def interrupt():raise KeyboardInterrupt()
        w.preparer=interrupt
        with self.assertRaises(KeyboardInterrupt):w.run()
        self.assertNotIn(NEW,w.devices);self.assertEqual(w.releases,[])
        w=World();w.observer=interrupt
        with self.assertRaises(KeyboardInterrupt):w.run()
        self.assertNotIn(NEW,w.devices);self.assertEqual(w.releases,[w.context])
        w=World();w.releaser=interrupt
        with self.assertRaises(KeyboardInterrupt):w.run()
        self.assertNotIn(NEW,w.devices);self.assertEqual(w.releases,[w.context])
        w=World();original=w.invoke
        def cleanup_interrupt(args,**kwargs):
            raw=original(args,**kwargs)
            if args[0]=='delete':raise KeyboardInterrupt()
            return raw
        w.invoke=cleanup_interrupt
        with self.assertRaises(KeyboardInterrupt):w.run()
        self.assertNotIn(NEW,w.devices);self.assertEqual(w.releases,[w.context])
    def test_release_failure_lateness_and_bad_clock_preserve_context_and_primary(self):
        for mode in ('raise','late','return'):
            w=World()
            def release():
                if mode=='raise':raise RuntimeError('AUTHORED-PRIVATE-RELEASE')
                if mode=='late':w.time+=6
                return 1 if mode=='return' else None
            w.releaser=release;r,raw=w.run()
            self.assertEqual(r['status'],'partial');self.assertEqual(raw,RAW)
            self.assertEqual(r['cleanupFailures'],['preparation-release']);self.assertEqual(w.releases,[w.context])
            self.assertTrue(r['cleanupAbsenceObserved'])
        w=World()
        def broken():w.time=float('nan');raise ValueError('AUTHORED-PRIVATE-OBSERVE')
        w.observer=broken;r,raw=w.run()
        self.assertEqual(r['primaryFailure'],'observe');self.assertIsNone(raw)
        self.assertEqual(w.releases,[w.context]);self.assertIn('preparation-release',r['cleanupFailures'])
    def test_preparation_and_release_callbacks_are_required_before_mutation(self):
        w=World()
        for key in ('prepare','release'):
            callbacks={'prepare':w.prepare,'release':w.release};callbacks[key]=None
            with self.assertRaises(ValueError):owned_simulator_transaction(copy.deepcopy(PLAN),w.invoke,w.observe,w.now,**callbacks)
        self.assertEqual(w.commands,[])
    def test_preparation_cannot_retarget_the_frozen_plan(self):
        w=World();plan=copy.deepcopy(PLAN)
        def prepare():plan['bundleIdentifier']='other.app';plan['name']='OTHER';return w.context
        w.preparer=prepare;r,raw=w.run(plan=plan)
        self.assertEqual(r['status'],'observed-transaction-only')
        self.assertIn(('launch',NEW,PLAN['bundleIdentifier']),w.commands)
        self.assertIn(('terminate',NEW,PLAN['bundleIdentifier']),w.commands)
    def test_runtime_mutants_expose_missing_preparation_and_release(self):
        source=SOURCE_PREFIX
        cut="prepared = prepare(owned, deadline=preparation_deadline,\n                           output_limit=limits['receiptBytes'])"
        self.assertIn(cut,source)
        namespace={};exec(compile(source.replace(cut,'prepared = object()'),'authored-no-prepare','exec'),namespace)
        w=World();w.observe=lambda *a,**k:RAW;r,raw=w.run(namespace['owned_simulator_transaction'])
        self.assertEqual(w.preparations,[]);self.assertEqual(r['status'],'observed-transaction-only')
        cut='need(prepared is not None and tick() < preparation_deadline)';self.assertIn(cut,source)
        namespace={};exec(compile(source.replace(cut,'need(prepared is not None)'),'authored-late-prepare','exec'),namespace)
        w=World()
        def late():w.time=16.;return w.context
        w.preparer=late;r,raw=w.run(namespace['owned_simulator_transaction'])
        self.assertIn('launch',w.ops());self.assertIsNone(r['primaryFailure'])
        cut='value = release(prepared)';self.assertIn(cut,source)
        namespace={};exec(compile(source.replace(cut,'value = None'),'authored-no-release','exec'),namespace)
        w=World();r,raw=w.run(namespace['owned_simulator_transaction'])
        self.assertEqual(w.releases,[]);self.assertTrue(r['preparationReleased'])
    def test_runtime_mutants_expose_identity_guard_and_cleanup_continuation(self):
        source=SOURCE_PREFIX
        cut='need(identifier not in before)';self.assertIn(cut,source)
        namespace={};exec(compile(source.replace(cut,'need(True)'),'authored-mutant','exec'),namespace)
        w=World();w.created=OLD
        # The intentionally bad create callback already changed its row; the core
        # must still refuse to boot/delete a UUID that existed before this attempt.
        w.observe=lambda *a,**k:RAW
        r,_=w.run(namespace['owned_simulator_transaction']);self.assertNotIn(OLD,w.devices)
        self.assertTrue(r['ownershipEstablished'])
        cut="except BaseException as error:\n                            remember_interrupt(error)\n                            result['cleanupFailures'].append(command)";self.assertTrue(cut in source,'cleanup continuation mutation anchor')
        namespace={};exec(compile(source.replace(cut,cut+'\n                            break'),'authored-mutant','exec'),namespace)
        w=World();w.fail={'terminate'};r,raw=w.run(namespace['owned_simulator_transaction'])
        self.assertNotIn('delete',w.ops());self.assertFalse(r['cleanupAbsenceObserved']);self.assertEqual(raw,RAW)
unittest.main(argv=['authored-lifecycle-controls'],verbosity=2)
`;

test('unwired owned simulator transaction core preserves identity, failures and cleanup', () => {
    const end = retention.lastIndexOf('\ntry:\n');
    assert.ok(end > 0, 'exclude the actual workflow entry point');
    const prefix = retention.slice(0, end);
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-owned-core-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${lifecycleControls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 33 tests/);
        assert.match(result.stderr, /OK/);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const adapterControls = String.raw`
import functools
import tempfile
import unittest
from unittest import mock
import shutil
import signal
ACTOR = r'''#!/usr/bin/python3
import json,os,sys,time
from pathlib import Path
ROOT=Path(__file__).parent
MODE=__MODE__
(ROOT/'pid.json').write_text(json.dumps({'leader':os.getpid()}))
if MODE in ('hang','orphan-pipes','orphan-closed'):
 if MODE!='hang':
  child=os.fork()
  if child:
   (ROOT/'pid.json').write_text(json.dumps({'leader':os.getpid(),'child':child}));os._exit(0)
  if MODE=='orphan-closed':
   os.close(1);os.close(2)
 time.sleep(30)
elif MODE=='exit':
 sys.stderr.write('AUTHORED-PRIVATE-STDERR');sys.exit(37)
elif MODE=='output':
 sys.stdout.write('a'*40);sys.stdout.flush();sys.stderr.write('b'*40)
elif MODE=='stdin':
 assert sys.stdin.buffer.read()==b'';print('stdin-closed')
elif MODE=='fd':
 try:
  info=os.fstat(__FD__);absent=(info.st_dev,info.st_ino)!=__IDENTITY__
 except OSError:absent=True
 print(json.dumps({'inheritedFileAbsent':absent}))
elif MODE=='replace-set':
 directory=Path(sys.argv[3]);directory.rename(directory.with_suffix('.old'));directory.mkdir();print('replaced')
elif MODE=='lifecycle':
 runtime='com.apple.CoreSimulator.SimRuntime.iOS-18-0';uid='11111111-1111-1111-1111-111111111111'
 statefile=ROOT/'state.json';state=json.loads(statefile.read_text()) if statefile.exists() else {}
 args=sys.argv[4:];command=args[0];out=''
 if command=='list':out=json.dumps({'devices':{runtime:list(state.values())}})
 elif command=='create':
  state[uid]={'udid':uid,'name':args[1],'deviceTypeIdentifier':args[2],'state':'Shutdown','isAvailable':True};out=uid
 elif command=='boot':state[uid]['state']='Booted'
 elif command=='launch':out='com.example.authored: 1234'
 elif command=='shutdown':state[uid]['state']='Shutdown'
 elif command=='delete':del state[uid]
 else:assert command in ('bootstatus','install','terminate')
 statefile.write_text(json.dumps(state));sys.stdout.write(out)
else:
 print(json.dumps({'args':sys.argv[1:],'clean':all(x not in os.environ for x in ('SIMCTL_CHILD_AUTHORED_SECRET','BW_AUTHORED_SECRET'))}))
'''
ARGS=('list','devices','--json')
class AdapterControls(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='bw-ios-command-'))
        self.directory=self.root/('bw-ios-assets-'+'a'*32+'.deviceset');self.directory.mkdir()
        self.actor=self.root/'xcrun';self.write_actor('normal')
        self.environment=mock.patch.dict(os.environ,{'PATH':str(self.root)+os.pathsep+os.environ['PATH'],
            'SIMCTL_CHILD_AUTHORED_SECRET':'AUTHORED-SECRET','BW_AUTHORED_SECRET':'AUTHORED-SECRET'})
        self.environment.start()
        self.launchers=[];self.real_popen=subprocess.Popen
        def authored_launcher(arguments,**options):
            self.launchers.append(arguments[0])
            # Explicit unit boundary only: exercise the adapter with real authored
            # subprocesses while retaining the production launcher argument.
            if arguments[0]=='/usr/bin/xcrun':arguments=[str(self.actor),*arguments[1:]]
            return self.real_popen(arguments,**options)
        self.enterContext(mock.patch.object(subprocess,'Popen',side_effect=authored_launcher))
    def tearDown(self):
        self.environment.stop();shutil.rmtree(self.root)
    def write_actor(self,mode):
        self.actor.write_text(ACTOR.replace('__MODE__',repr(mode)).replace('__FD__',str(getattr(self,'inherited_fd',-1))).replace('__IDENTITY__',repr(getattr(self,'inherited_identity',(-1,-1)))));self.actor.chmod(0o755)
    def run_command(self,args=ARGS,**kwargs):
        options=dict(device_set=self.directory,deadline=time.monotonic()+2,output_limit=1024)
        options.update(kwargs);return bounded_simulator_command(args,**options)
    def inactive(self,pid):
        # Linux test-host observation only: a zombie has stopped executing. Only
        # the direct leader is ours to reap; this is not a whole-descendant census.
        file=Path('/proc')/str(pid)/'stat'
        try:return file.read_text().split(') ',1)[1][0]=='Z'
        except (FileNotFoundError,ProcessLookupError):pass
        # The process may exit during the read. Hosts without /proc still need
        # the live-process probe; a missing proc entry alone cannot prove exit.
        try:os.kill(pid,0)
        except ProcessLookupError:return True
        return False
    def test_process_observer_handles_proc_exit_races_without_hiding_other_errors(self):
        pid=123456
        # Force the old exists/read interleaving too: the original observer
        # raises before reaching the live-process probe in both missing cases.
        with mock.patch.object(Path,'exists',return_value=True):
            for error in (FileNotFoundError(2,'authored missing proc entry'),
                          ProcessLookupError(3,'authored process departed')):
                with mock.patch.object(Path,'read_text',side_effect=error):
                    with mock.patch.object(os,'kill',side_effect=ProcessLookupError) as probe:
                        self.assertTrue(self.inactive(pid));probe.assert_called_once_with(pid,0)
                    with mock.patch.object(os,'kill',return_value=None) as probe:
                        self.assertFalse(self.inactive(pid));probe.assert_called_once_with(pid,0)
            for state,expected in (('Z',True),('S',False)):
                with mock.patch.object(Path,'read_text',return_value='123456 (authored) '+state+' 0'),mock.patch.object(os,'kill') as probe:
                    self.assertEqual(self.inactive(pid),expected);probe.assert_not_called()
            for error in (PermissionError(13,'authored denied read'),OSError(5,'authored I/O failure')):
                with mock.patch.object(Path,'read_text',side_effect=error),mock.patch.object(os,'kill') as probe:
                    with self.assertRaises(type(error)) as caught:self.inactive(pid)
                    self.assertIs(caught.exception,error);probe.assert_not_called()
    def assert_child_stopped(self):
        pid=json.loads((self.root/'pid.json').read_text())['child']
        until=time.monotonic()+2
        while time.monotonic()<until and not self.inactive(pid):time.sleep(0.01)
        self.assertTrue(self.inactive(pid),'owned test-group child stopped')
    def test_exclusive_directory_context_refuses_cross_command_replacement_before_spawn(self):
        with mock.patch('uuid.uuid4',return_value=mock.Mock(hex='b'*32)):
            owner=SimulatorDeviceSetDirectory(self.root,deadline=time.monotonic()+2)
        try:
            value=json.loads(self.run_command(device_set=owner.path,device_set_owner=owner))
            self.assertEqual(value['args'],['simctl','--set',str(owner.path),*ARGS])
            retained=owner.path.with_suffix('.retained');owner.path.rename(retained);owner.path.mkdir(mode=0o700)
            # Legacy path-only admission accepts the replacement; the held context must refuse.
            self.assertEqual(json.loads(self.run_command(device_set=owner.path))['args'],['simctl','--set',str(owner.path),*ARGS])
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(device_set=owner.path,device_set_owner=owner)
                self.assertEqual(caught.exception.reason,'device-set');spawn.assert_not_called()
            self.assertTrue(retained.is_dir());self.assertTrue(owner.path.is_dir())
        finally:owner.close()
    def test_launcher_is_absolute_and_path_lookup_cut_is_observable(self):
        self.run_command();self.assertEqual(self.launchers[-1],'/usr/bin/xcrun')
        cut="subprocess.Popen(['/usr/bin/xcrun', 'simctl', '--set'"
        self.assertEqual(SOURCE_PREFIX.count(cut),1);namespace={}
        exec(compile(SOURCE_PREFIX.replace(cut,"subprocess.Popen(['xcrun', 'simctl', '--set'"),'authored-path-launcher-mutant','exec'),namespace)
        namespace['bounded_simulator_command'](ARGS,device_set=self.directory,deadline=time.monotonic()+2,output_limit=1024)
        self.assertEqual(self.launchers[-1],'xcrun')
    def test_exact_namespace_argv_and_environment_filter(self):
        raw=self.run_command();value=json.loads(raw)
        self.assertEqual(value['args'],['simctl','--set',str(self.directory),*ARGS]);self.assertTrue(value['clean'])
    def test_stdin_is_closed_and_fd_count_is_stable(self):
        self.write_actor('stdin');before=len(os.listdir('/dev/fd'))
        for _ in range(5):self.assertEqual(self.run_command(),b'stdin-closed\n')
        self.assertEqual(len(os.listdir('/dev/fd')),before)
        fd=os.open(self.root/'private-input',os.O_CREAT|os.O_RDWR,0o600)
        try:
            os.set_inheritable(fd,True);info=os.fstat(fd);self.inherited_fd=fd;self.inherited_identity=(info.st_dev,info.st_ino)
            self.write_actor('fd');self.assertTrue(json.loads(self.run_command())['inheritedFileAbsent'])
            namespace={};cut='close_fds=True, env=environment';self.assertTrue(cut in SOURCE_PREFIX)
            exec(compile(SOURCE_PREFIX.replace(cut,'close_fds=False, env=environment'),'authored-fd-mutant','exec'),namespace)
            raw=namespace['bounded_simulator_command'](ARGS,device_set=self.directory,deadline=time.monotonic()+2,output_limit=1024)
            self.assertFalse(json.loads(raw)['inheritedFileAbsent'])
        finally:os.close(fd)
    def test_stdout_and_stderr_share_the_output_budget(self):
        self.write_actor('output')
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(output_limit=64)
        self.assertEqual(caught.exception.reason,'output')
    def test_exit_refusal_does_not_expose_stderr(self):
        self.write_actor('exit')
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command()
        self.assertEqual(caught.exception.reason,'exit');self.assertNotIn('AUTHORED-PRIVATE',str(caught.exception))
    def test_absolute_deadline_kills_and_reaps_the_owned_leader(self):
        self.write_actor('hang');children=[];original_popen=subprocess.Popen
        def spawn(*args,**kwargs):
            child=original_popen(*args,**kwargs);children.append(child);return child
        # A timed-out child may never reach its first Python file write. Observe
        # the actual parent-owned handle without replacing the launched process.
        with mock.patch.object(subprocess,'Popen',side_effect=spawn):
            with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(deadline=time.monotonic()+0.3)
        self.assertEqual(caught.exception.reason,'deadline');self.assertEqual(len(children),1)
        pid=children[0].pid;self.assertIsNotNone(children[0].returncode)
        with self.assertRaises(ChildProcessError):os.waitpid(pid,os.WNOHANG)
        self.assertTrue(self.inactive(pid))
    def test_exited_leader_with_inherited_pipes_still_times_out_and_cleans_group(self):
        self.write_actor('orphan-pipes')
        with self.assertRaises(SimulatorCommandRefused):self.run_command(deadline=time.monotonic()+0.4)
        self.assert_child_stopped()
    def test_same_group_child_is_signaled_even_after_both_pipes_close(self):
        self.write_actor('orphan-closed');self.run_command();self.assert_child_stopped()
    def test_group_signal_precedes_any_leader_reap(self):
        original_popen=subprocess.Popen;original_killpg=os.killpg;children=[]
        def spawn(*a,**k):
            child=original_popen(*a,**k);children.append(child);return child
        def signal_group(pid,sig):
            self.assertIsNone(children[0].returncode)
            os.waitid(os.P_PID,pid,os.WEXITED|os.WNOHANG|os.WNOWAIT)
            return original_killpg(pid,sig)
        with mock.patch.object(subprocess,'Popen',side_effect=spawn),mock.patch.object(os,'killpg',side_effect=signal_group):
            self.run_command()
        self.assertEqual(children[0].returncode,0)
        children.clear()
        with mock.patch.object(subprocess,'Popen',side_effect=spawn),mock.patch.object(os,'killpg',side_effect=signal_group):
            bounded_inventory()
        self.assertEqual(children[0].returncode,0)
    def test_stop_and_keyboard_interrupt_still_release_owned_resources(self):
        self.write_actor('hang');calls=[]
        def stop():calls.append(True);return len(calls)>2
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(stopped=stop)
        self.assertEqual(caught.exception.reason,'stop')
        original=selectors.DefaultSelector
        class InterruptingSelector(original):
            def select(self,*args,**kwargs):raise KeyboardInterrupt()
        children=[];popen=subprocess.Popen
        def spawn(*args,**kwargs):
            child=popen(*args,**kwargs);children.append(child);return child
        with mock.patch.object(selectors,'DefaultSelector',InterruptingSelector),mock.patch.object(subprocess,'Popen',side_effect=spawn):
            with self.assertRaises(KeyboardInterrupt):self.run_command()
        self.assertIsNotNone(children[0].returncode);self.assertTrue(children[0].stdout.closed)
    def test_argument_capability_and_namespace_failures_happen_before_spawn(self):
        for args in (('delete','all'),('boot','booted'),('erase','11111111-1111-1111-1111-111111111111'),('list','devices'),('launch','bad','com.example.authored')):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.run_command(args)
                spawn.assert_not_called()
        for change in ({'output_limit':True},{'output_limit':1024*1024+1},{'deadline':float('nan')},
                       {'deadline':time.monotonic()-1},{'deadline':time.monotonic()+100}):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.run_command(**change)
                spawn.assert_not_called()
        link=self.root/('bw-ios-assets-'+'b'*32+'.deviceset');link.symlink_to(self.directory,target_is_directory=True)
        with self.assertRaises(SimulatorCommandRefused):self.run_command(device_set=link)
        with mock.patch.object(os,'waitid',None),mock.patch.object(subprocess,'Popen') as spawn:
            with self.assertRaises(SimulatorCommandRefused):self.run_command()
            spawn.assert_not_called()
        with mock.patch.object(os,'waitid',create=True) as waitid:
            with mock.patch.object(signal,'getsignal',return_value=signal.SIG_IGN),mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.run_command()
                spawn.assert_not_called()
        self.write_actor('replace-set')
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command()
        self.assertEqual(caught.exception.reason,'device-set')
    def test_primary_failure_survives_cleanup_failure(self):
        self.write_actor('exit')
        with mock.patch.object(os,'killpg',side_effect=PermissionError('AUTHORED-PRIVATE')):
            with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command()
        self.assertEqual(caught.exception.reason,'exit');self.assertIn('group-signal',caught.exception.cleanup_failures)
        original=os.waitid
        def interrupt_after_exit(*args):
            info=original(*args)
            if info is not None:raise KeyboardInterrupt()
            return info
        with mock.patch.object(os,'waitid',side_effect=interrupt_after_exit),mock.patch.object(os,'killpg',side_effect=PermissionError('AUTHORED-PRIVATE')):
            with self.assertRaises(KeyboardInterrupt) as caught:self.run_command()
        self.assertIn('group-signal',caught.exception.__notes__[0])
    def test_lifecycle_core_uses_real_subprocess_adapter_with_authored_commands_only(self):
        self.write_actor('lifecycle')
        plan={'schema':'brickwright.ios-owned-simulator-plan.v1','runtimeIdentifier':'com.apple.CoreSimulator.SimRuntime.iOS-18-0',
            'deviceTypeIdentifier':'com.apple.CoreSimulator.SimDeviceType.iPhone-16','name':'bw-asset-audit-'+'c'*32,
            'bundleIdentifier':'com.example.authored','appPath':str(self.root/'Authored.app'),'sourceSHA256':'d'*64,
            'executableSHA256':'e'*64,'runtimeArchitectureAdmitted':True,'deviceModelAdmitted':True,'processEnvelopeAdmitted':True}
        result,raw=owned_simulator_transaction(plan,functools.partial(bounded_simulator_command,device_set=self.directory),
            lambda *a,**k:b'{"authoredOnly":true}',prepare=lambda *a,**k:object(),release=lambda context:None)
        self.assertEqual(result['status'],'observed-transaction-only');self.assertEqual(raw,b'{"authoredOnly":true}')
        self.assertTrue(result['cleanupAbsenceObserved']);self.assertIs(result['actualAppQualified'],False)
        self.assertEqual(json.loads((self.root/'state.json').read_text()),{})
    def test_darwin_cleanup_adapter_retains_originals_and_continues_after_interrupt(self):
        original_popen=subprocess.Popen;children=[]
        def spawn(*args,**kwargs):
            child=original_popen(*args,**kwargs);children.append(child);return child
        records=[b'{"authoredCleanupOnly":true}']
        def cleanup(child,**kwargs):
            self.assertIsNone(child.returncode)
            os.killpg(child.pid,signal.SIGKILL)
            return tuple(records)
        with mock.patch.object(sys,'platform','darwin'),mock.patch.dict(bounded_simulator_command.__globals__,{'darwin_owned_command_cleanup':cleanup}),mock.patch.object(subprocess,'Popen',side_effect=spawn):
            retained=[];self.run_command(cleanup_originals=retained)
        self.assertEqual(retained,records);self.assertIsNotNone(children[-1].returncode)
        self.assertTrue(children[-1].stdout.closed and children[-1].stderr.closed)
        def interrupt(child,**kwargs):
            cleanup(child,**kwargs)
            error=KeyboardInterrupt('authored');error.command_cleanup_originals=tuple(records);raise error
        self.write_actor('exit');before=len(os.listdir('/dev/fd'))
        with mock.patch.object(sys,'platform','darwin'),mock.patch.dict(bounded_simulator_command.__globals__,{'darwin_owned_command_cleanup':interrupt}),mock.patch.object(subprocess,'Popen',side_effect=spawn):
            retained=[]
            with self.assertRaises(KeyboardInterrupt) as caught:self.run_command(cleanup_originals=retained)
        self.assertEqual(retained,records);self.assertIsInstance(caught.exception.command_primary_error,Exception)
        self.assertIn('group-signal',caught.exception.__notes__[0]);self.assertIsNotNone(children[-1].returncode)
        self.assertTrue(children[-1].stdout.closed and children[-1].stderr.closed)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
        for invalid in ((),[b'reused'],True):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.run_command(cleanup_originals=invalid)
                spawn.assert_not_called()
    def test_original_journal_retains_streams_exit_and_refusal_prefix_privately(self):
        retained=[];self.write_actor('output')
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(output_limit=64,command_originals=retained)
        self.assertEqual(caught.exception.reason,'output')
        rows=[json.loads(row) for row in retained]
        stdout=b''.join(bytes.fromhex(row['rawHex']) for row in rows if row['kind']=='stdout')
        stderr=b''.join(bytes.fromhex(row['rawHex']) for row in rows if row['kind']=='stderr')
        self.assertEqual(stdout,b'a'*40);self.assertEqual(stderr,b'b'*40)
        self.assertEqual(rows[-1]['kind'],'leader-reaped')
        self.assertLessEqual(sum(map(len,retained)),2*(64+65536)+131072)
        retained=[];self.write_actor('exit')
        with self.assertRaises(SimulatorCommandRefused) as caught:self.run_command(command_originals=retained)
        self.assertEqual(caught.exception.reason,'exit');self.assertNotIn('AUTHORED-PRIVATE',str(caught.exception))
        rows=[json.loads(row) for row in retained]
        self.assertIn('wait-terminal',[row['kind'] for row in rows])
        self.assertEqual(b''.join(bytes.fromhex(row['rawHex']) for row in rows if row['kind']=='stderr'),b'AUTHORED-PRIVATE-STDERR')
        for invalid in ((),[b'reused'],True):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.run_command(command_originals=invalid)
                spawn.assert_not_called()
        alias=[]
        with mock.patch.object(subprocess,'Popen') as spawn:
            with self.assertRaises(SimulatorCommandRefused):self.run_command(command_originals=alias,cleanup_originals=alias)
            spawn.assert_not_called()
    def test_runtime_output_budget_mutant_is_detected(self):
        namespace={};cut='need(used <= output_limit)';self.assertIn(cut,SOURCE_PREFIX)
        exec(compile(SOURCE_PREFIX.replace(cut,'need(True)'),'authored-output-mutant','exec'),namespace)
        self.write_actor('output')
        raw=namespace['bounded_simulator_command'](ARGS,device_set=self.directory,deadline=time.monotonic()+2,output_limit=64)
        self.assertEqual(len(raw),40) # Original rejects the 80 combined output bytes.
unittest.main(argv=['authored-command-adapter-controls'],verbosity=2)
`;

test('unwired bounded simctl adapter controls execute real owned subprocesses', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-adapter-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nimport selectors\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${adapterControls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 20000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 18 tests/);
        assert.match(result.stderr, /OK/);
        assert.equal((retention.match(/bounded_simulator_command\(/g) || []).length, 1, 'adapter definition only');
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const receiverControls = String.raw`
import tempfile
import shutil
import unittest
import copy
from unittest import mock
PROFILE='tauri-2.11.5-utils-2.9.3-codegen-2.6.3-asset-config.v1'
def envelope():
    return {'schema':'brickwright.installed-asset-envelope.v2',
        'observation':{'schema':'brickwright.installed-asset-observation.v1','status':'complete-observation-only','refusal':None},
        'asset_config_projection':{'schema':'brickwright.asset-config-projection.v1','status':'complete-projection-only','refusal':None,
            'profile':PROFILE,'runtime_config_sha256':'c'*64,'values':{'dev_url_absent':True,'csp_absent':True,'dev_csp_absent':True,
            'pattern':'brownfield','freeze_prototype':False,'disable_asset_csp_modification':False,'asset_protocol_enabled':False},
            'full_configuration_joined':False,'raw_configuration_exposed':False,'compiler_inputs_proved':False},
        'source_label':'a'*40,'source_label_is_build_proof':False,'effective_config_sha256':'c'*64,'base_config_sha256':'b'*64,
        'executable_and_artifact_join':'required-external-independent-qualification','development_filesystem_fallback':False,
        'resolver_internal_fallback_excluded':False,'signed_target_map_joined':False,'resource_and_process_lifetime_admitted':False}
class ReceiverControls(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='bw-ios-receiver-'));self.app=self.root/'Authored.app';self.app.mkdir()
        self.parent=self.root/'Documents';self.parent.mkdir();self.target=self.parent/'bw-embedded-asset-observation.json'
        self.exe=b'AUTHORED-NOT-AN-APPLE-EXECUTABLE';(self.app/'authored').write_bytes(self.exe)
        self.plist=plistlib.dumps({'CFBundleExecutable':'authored','CFBundleIdentifier':'com.example.authored','CFBundleSupportedPlatforms':['iPhoneSimulator']})
        (self.app/'Info.plist').write_bytes(self.plist);self.time=0.;self.samples=0;self.action=lambda:None
        self.spec={'schema':'brickwright.ios-installed-observation-plan.v1','appDirectory':str(self.app),'bundleIdentifier':'com.example.authored',
            'executableSHA256':hashlib.sha256(self.exe).hexdigest(),'plistSHA256':hashlib.sha256(self.plist).hexdigest(),
            'receiptPath':str(self.target),'sourceCommit':'a'*40,'baseConfigSHA256':'b'*64}
    def tearDown(self):shutil.rmtree(self.root)
    def prepare(self,cls=PreparedInstalledObservation):return cls(self.spec,deadline=self.time+10,now=lambda:self.time)
    def write(self,value=None):
        raw=json.dumps(envelope() if value is None else value,separators=(',',':')).encode();self.target.write_bytes(raw);return raw
    def sample(self,pid):
        self.samples+=1;self.action();return {'pid':pid,'identitySHA256':'e'*64,'rssBytes':4096}
    def pause(self,seconds):self.time+=seconds
    def capture(self,receiver,**kwargs):
        args=dict(deadline=self.time+1,output_limit=8*1024*1024,pause=self.pause);args.update(kwargs)
        return receiver.capture(55,'e'*64,self.sample,**args)
    def test_ready_header_is_retained_without_content_or_app_qualification(self):
        before=len(os.listdir('/dev/fd'));receiver=self.prepare();raw=self.write();meta,got=self.capture(receiver)
        self.assertEqual(got,raw);self.assertEqual(meta['status'],'captured-header-only');self.assertTrue(meta['installedFilesStable'])
        self.assertEqual(meta['rawSHA256'],hashlib.sha256(raw).hexdigest());self.assertEqual(meta['sampledPeakRSSBytes'],4096)
        for key in ('samplerAuthenticated','hardMemoryLimitQualified','runningExecutableJoined','assetContentsJoined','actualAppQualified'):self.assertIs(meta[key],False)
        self.assertTrue(meta['receiverClosed']);self.assertEqual(len(os.listdir('/dev/fd')),before)
        self.assertNotIn('AUTHORED',json.dumps(meta));self.assertNotIn(str(self.root),json.dumps(meta))
    def test_absent_and_partial_original_can_grow_to_complete(self):
        receiver=self.prepare();calls=[]
        def grow(seconds):
            self.pause(seconds);calls.append(True)
            if len(calls)==1:self.target.write_bytes(b'{')
            elif len(calls)==2:self.write()
        meta,raw=self.capture(receiver,pause=grow);self.assertEqual(meta['status'],'captured-header-only');self.assertEqual(meta['polls'],2)
    def test_timeout_and_stop_preserve_partial_raw_and_close_descriptors(self):
        receiver=self.prepare();self.target.write_bytes(b'{');meta,raw=self.capture(receiver)
        self.assertEqual(meta['status'],'partial');self.assertEqual(meta['refusal'],'deadline');self.assertEqual(raw,b'{');self.assertTrue(meta['receiverClosed'])
        self.target.unlink();receiver=self.prepare();meta,raw=self.capture(receiver,stopped=lambda:True)
        self.assertEqual(meta['refusal'],'stop');self.assertIsNone(raw);self.assertTrue(meta['receiverClosed'])
    def test_prepare_refuses_existing_output_and_changed_installed_inputs(self):
        self.target.write_bytes(b'old')
        with self.assertRaises(ValueError):self.prepare()
        self.target.unlink();(self.app/'authored').write_bytes(b'changed');before=len(os.listdir('/dev/fd'))
        with self.assertRaises(ValueError):self.prepare()
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_symlink_fifo_and_hardlink_outputs_are_refused_without_blocking(self):
        for kind in ('symlink','fifo','hardlink'):
            receiver=self.prepare();other=self.root/'other';other.write_bytes(json.dumps(envelope()).encode())
            if kind=='symlink':self.target.symlink_to(other)
            elif kind=='fifo':os.mkfifo(self.target)
            else:os.link(other,self.target)
            meta,raw=self.capture(receiver);self.assertEqual(meta['refusal'],'receipt-read');self.assertIsNone(raw);self.assertTrue(meta['receiverClosed'])
            self.target.unlink();other.unlink()
    def test_replaced_original_inode_or_parent_is_not_a_new_receipt(self):
        receiver=self.prepare();self.target.write_bytes(b'{')
        def replace(seconds):self.pause(seconds);self.target.unlink();self.write()
        meta,raw=self.capture(receiver,pause=replace);self.assertEqual(meta['refusal'],'receipt-read');self.assertEqual(raw,b'{')
        self.target.unlink();receiver=self.prepare();self.parent.rename(self.root/'old-documents');self.parent.mkdir();self.write()
        meta,raw=self.capture(receiver);self.assertEqual(meta['refusal'],'receipt-read');self.assertIsNone(raw)
    def test_pid_identity_and_sampled_rss_threshold_refuse(self):
        for snapshot in ({'pid':56,'identitySHA256':'e'*64,'rssBytes':1},{'pid':55,'identitySHA256':'f'*64,'rssBytes':1},
            {'pid':55,'identitySHA256':'e'*64,'rssBytes':True},{'pid':55,'identitySHA256':'e'*64,'rssBytes':1024*1024*1024+1}):
            receiver=self.prepare();self.write();meta,raw=receiver.capture(55,'e'*64,lambda _:snapshot,deadline=self.time+1,output_limit=8192,pause=self.pause)
            self.assertEqual(meta['refusal'],'process-sample');self.assertIsNone(raw);self.target.unlink()
    def test_changed_installed_file_or_late_sample_remains_partial(self):
        receiver=self.prepare();raw=self.write()
        def change():
            if self.samples==2:(self.app/'authored').write_bytes(b'changed')
        self.action=change;meta,got=self.capture(receiver);self.assertEqual(meta['refusal'],'installed-files');self.assertEqual(got,raw)
        (self.app/'authored').write_bytes(self.exe);self.target.unlink();self.samples=0;receiver=self.prepare();raw=self.write()
        def late():
            if self.samples==2:self.time+=2
        self.action=late;meta,got=self.capture(receiver);self.assertEqual(meta['refusal'],'process-sample');self.assertEqual(got,raw)
    def test_complete_partial_or_wrong_header_and_typed_profile_refuse(self):
        edits=[lambda v:v.update(source_label='f'*40),lambda v:v.update(extra=False),lambda v:v.update(base_config_sha256='f'*64),
            lambda v:v.update(source_label_is_build_proof=True),lambda v:v['observation'].update(status='partial'),
            lambda v:v['asset_config_projection'].update(status='partial',values=None),
            lambda v:v['asset_config_projection']['values'].update(csp_absent=1),lambda v:v['asset_config_projection'].update(runtime_config_sha256='f'*64)]
        for edit in edits:
            receiver=self.prepare();value=envelope();edit(value);raw=self.write(value);meta,got=self.capture(receiver)
            self.assertEqual(meta['refusal'],'receipt-header');self.assertEqual(got,raw);self.target.unlink()
    def test_nonfinite_duplicate_and_output_budget_refuse(self):
        for raw in (b'{"schema":1,"schema":2}',b'{"value":NaN}',b'{"value":1.5}'):
            receiver=self.prepare();self.target.write_bytes(raw);meta,_=self.capture(receiver);self.assertEqual(meta['refusal'],'receipt-header');self.target.unlink()
        receiver=self.prepare();self.write();meta,raw=self.capture(receiver,output_limit=8)
        self.assertEqual(meta['refusal'],'receipt-read');self.assertIsNone(raw)
    def test_closed_receiver_and_double_close_cannot_close_a_reused_fd(self):
        receiver=self.prepare();self.write();self.capture(receiver)
        fd=os.open(self.root/'other',os.O_CREAT|os.O_RDWR,0o600)
        try:receiver.close();os.fstat(fd)
        finally:os.close(fd)
        self.target.unlink();receiver=self.prepare()
        def close():receiver.close()
        self.action=close;meta,_=self.capture(receiver);self.assertEqual(meta['refusal'],'process-sample');self.assertTrue(meta['receiverClosed'])
    def test_keyboard_interrupt_closes_owned_descriptors(self):
        receiver=self.prepare();before=len(os.listdir('/dev/fd'))
        def interrupt(_):raise KeyboardInterrupt()
        with self.assertRaises(KeyboardInterrupt):receiver.capture(55,'e'*64,interrupt,deadline=1,output_limit=8192,pause=self.pause)
        self.assertTrue(receiver._closed);self.assertEqual(len(os.listdir('/dev/fd')),before-1)
    def test_plan_copy_and_end_of_read_fingerprint_are_live(self):
        receiver=self.prepare();self.spec['sourceCommit']='f'*40;raw=self.write();meta,got=self.capture(receiver)
        self.assertEqual(meta['status'],'captured-header-only');self.assertEqual(got,raw)
        self.target.unlink();self.spec['sourceCommit']='a'*40;self.samples=0;receiver=self.prepare();raw=self.write()
        def replace_contents():
            if self.samples==2:self.target.write_bytes(b'{"changed":true}')
        self.action=replace_contents;meta,got=self.capture(receiver);self.assertEqual(meta['refusal'],'receipt-readback');self.assertEqual(got,raw)
    def test_capture_is_one_shot_and_reentrant_calls_cannot_take_descriptors(self):
        receiver=self.prepare();raw=self.write()
        def nested():
            with self.assertRaises(ValueError):self.capture(receiver)
        self.action=nested;meta,got=self.capture(receiver);self.assertEqual(got,raw)
        self.assertEqual(meta['status'],'captured-header-only')
        with self.assertRaises(ValueError):self.capture(receiver)
    def test_cleanup_uncertainty_keeps_original_bytes_and_partial_status(self):
        receiver=self.prepare();raw=self.write();held=[];original=os.close
        def remember():
            if self.samples==2:held.append(receiver._receipt)
        self.action=remember
        def close(fd):
            original(fd)
            if held and fd==held[0]:raise OSError('AUTHORED-PRIVATE-CLOSE-ERROR')
        with mock.patch.object(os,'close',side_effect=close):meta,got=self.capture(receiver)
        self.assertEqual(got,raw);self.assertEqual(meta['status'],'partial');self.assertEqual(meta['refusal'],'receiver-cleanup')
        self.assertIn('_receipt-close',meta['cleanupFailures']);self.assertFalse(meta['receiverClosed'])
    def test_stop_during_final_sample_or_installed_readback_stays_partial(self):
        for boundary in ('sample','readback'):
            receiver=self.prepare();raw=self.write();stop=[False];self.samples=0
            if boundary=='sample':
                def request_stop():
                    if self.samples==2:stop[0]=True
                self.action=request_stop
            else:
                self.action=lambda:None;original=receiver._file
                def request_stop(path,*args,**kwargs):
                    value=original(path,*args,**kwargs)
                    if path==receiver._executable:stop[0]=True
                    return value
                receiver._file=request_stop
            meta,got=self.capture(receiver,stopped=lambda:stop[0]);self.assertEqual(meta['refusal'],'stop')
            self.assertEqual(meta['status'],'partial');self.assertEqual(got,raw);self.assertTrue(meta['receiverClosed']);self.target.unlink()
    def test_capture_interrupt_preserves_first_cancellation_partial_bytes_and_close_interrupt(self):
        before=len(os.listdir('/dev/fd'));receiver=self.prepare();raw=self.write();self.samples=0
        first=KeyboardInterrupt('AUTHORED-FIRST');second=SystemExit('AUTHORED-SECOND');original=os.close;closed=[]
        def sample(pid):
            self.samples+=1
            if self.samples==2:raise first
            return {'pid':pid,'identitySHA256':'e'*64,'rssBytes':4096}
        def close(fd):
            original(fd);closed.append(fd)
            if len(closed)==1:raise second
        with mock.patch.object(os,'close',side_effect=close),self.assertRaises(KeyboardInterrupt) as caught:
            receiver.capture(55,'e'*64,sample,deadline=1,output_limit=8192,pause=self.pause)
        self.assertIs(caught.exception,first);self.assertEqual(len(closed),2)
        self.assertEqual(caught.exception.installed_capture_secondary_interrupts,(second,))
        self.assertEqual(caught.exception.installed_capture_observation,raw)
        meta=json.loads(caught.exception.installed_capture_result)
        self.assertEqual(meta['status'],'partial');self.assertEqual(meta['refusal'],'process-sample')
        self.assertEqual(meta['cleanupFailures'],['_receipt-close']);self.assertFalse(meta['receiverClosed'])
        self.assertEqual(meta['rawSHA256'],hashlib.sha256(raw).hexdigest());self.assertFalse(meta['actualAppQualified'])
        self.assertEqual(len(os.listdir('/dev/fd')),before)
        self.assertNotIn('AUTHORED',json.dumps(meta));self.assertNotIn(str(self.root),json.dumps(meta))
    def test_close_interrupt_after_capture_preserves_raw_and_refuses_completed_status(self):
        before=len(os.listdir('/dev/fd'));receiver=self.prepare();raw=self.write();original=os.close;closed=[];first=KeyboardInterrupt()
        held=[receiver._parent]
        def snapshot():
            if self.samples==2:held.append(receiver._receipt)
        self.action=snapshot
        def close(fd):
            original(fd)
            if fd in held:
                closed.append(fd)
                if fd==held[-1] and len(held)==2:raise first
        with mock.patch.object(os,'close',side_effect=close),self.assertRaises(KeyboardInterrupt) as caught:self.capture(receiver)
        self.assertIs(caught.exception,first);meta=json.loads(caught.exception.installed_capture_result)
        self.assertEqual(meta['status'],'partial');self.assertEqual(meta['refusal'],'receiver-cleanup')
        self.assertEqual(caught.exception.installed_capture_observation,raw)
        self.assertEqual(caught.exception.installed_capture_secondary_interrupts,())
        self.assertEqual(meta['cleanupFailures'],['_receipt-close']);self.assertEqual(len(closed),2)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_runtime_header_and_fingerprint_mutations_are_detected(self):
        cuts=[("value['source_label'] == self._spec['sourceCommit'] and",'True and'),
              ('need(self._identity(os.fstat(self._receipt)) == self._last_receipt_identity)','need(True)')]
        for index,(cut,replacement) in enumerate(cuts):
            self.assertTrue(cut in SOURCE_PREFIX);namespace={};exec(compile(SOURCE_PREFIX.replace(cut,replacement),'authored-receiver-mutant','exec'),namespace)
            receiver=self.prepare(namespace['PreparedInstalledObservation']);value=envelope()
            if index==0:value['source_label']='f'*40
            self.write(value);self.samples=0
            def alter():
                if index==1 and self.samples==2:self.target.write_bytes(b'{"changed":true}')
            self.action=alter;meta,_=self.capture(receiver);self.assertEqual(meta['status'],'captured-header-only');self.target.unlink()
        import re
        mutant,count=re.subn(r'(?m)^(\s*)self\._check\(deadline\)\n\1check_stop\(\)$',r'\1self._check(deadline)\n\1pass',SOURCE_PREFIX)
        self.assertEqual(count,2);namespace={};exec(compile(mutant,'authored-stop-fence-mutant','exec'),namespace)
        receiver=self.prepare(namespace['PreparedInstalledObservation']);self.write();self.samples=0;stop=[False]
        def request_stop():
            if self.samples==2:stop[0]=True
        self.action=request_stop;meta,_=self.capture(receiver,stopped=lambda:stop[0])
        self.assertTrue(stop[0]);self.assertEqual(meta['status'],'captured-header-only')
unittest.main(argv=['authored-installed-receiver-controls'],verbosity=2)
`;

test('unwired installed observation receiver binds real file descriptors and supplied samples', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-receiver-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${receiverControls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 19 tests/);
        assert.match(result.stderr, /OK/);
        assert.equal((retention.match(/PreparedInstalledObservation\(/g) || []).length, 1, 'constructor only inside unwired preparation adapter');
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const prelaunchJoinControls = String.raw`
class PrelaunchJoinControls(unittest.TestCase):
    def test_real_receiver_is_prepared_before_authored_launch_and_released(self):
        fixture=ReceiverControls();fixture.setUp();before=len(os.listdir('/dev/fd'))
        try:
            w=World();events=[];original=w.invoke;captured={}
            def prepare(device,*,deadline,output_limit):
                self.assertEqual(device,NEW);self.assertFalse(fixture.target.exists())
                self.assertIn('install',w.ops());self.assertNotIn('launch',w.ops())
                events.append('prepare')
                return PreparedInstalledObservation(fixture.spec,deadline=deadline,now=w.now)
            def invoke(args,**kwargs):
                raw=original(args,**kwargs)
                if args[0]=='launch':events.append('launch');fixture.write()
                return raw
            def observe(device,pid,*,prepared,deadline,output_limit):
                self.assertEqual(events,['prepare','launch'])
                meta,raw=prepared.capture(pid,'e'*64,fixture.sample,deadline=deadline,output_limit=output_limit,
                    pause=lambda seconds:setattr(w,'time',w.time+seconds))
                captured.update(meta);return raw
            released=[]
            def release(prepared):
                self.assertNotIn(NEW,w.devices);released.append(prepared)
                self.assertEqual(prepared.close(),())
            result,raw=owned_simulator_transaction(copy.deepcopy(PLAN),invoke,observe,w.now,prepare=prepare,release=release)
            self.assertEqual(result['status'],'observed-transaction-only');self.assertEqual(len(released),1)
            self.assertEqual(captured['status'],'captured-header-only');self.assertEqual(raw,fixture.target.read_bytes())
            self.assertIs(captured['actualAppQualified'],False);self.assertIs(result['actualAppQualified'],False)
            self.assertEqual(len(os.listdir('/dev/fd')),before)
        finally:fixture.tearDown()
    def test_preexisting_output_refuses_before_launch_with_actual_receiver(self):
        fixture=ReceiverControls();fixture.setUp();before=len(os.listdir('/dev/fd'))
        try:
            fixture.target.write_bytes(b'AUTHORED-OLD-OUTPUT');w=World();released=[]
            def prepare(device,*,deadline,output_limit):
                return PreparedInstalledObservation(fixture.spec,deadline=deadline,now=w.now)
            result,raw=owned_simulator_transaction(copy.deepcopy(PLAN),w.invoke,w.observe,w.now,
                prepare=prepare,release=lambda context:released.append(context))
            self.assertEqual(result['primaryFailure'],'prepare-observation');self.assertNotIn('launch',w.ops())
            self.assertEqual(released,[]);self.assertIsNone(raw);self.assertTrue(result['cleanupAbsenceObserved'])
            self.assertEqual(fixture.target.read_bytes(),b'AUTHORED-OLD-OUTPUT')
            self.assertEqual(len(os.listdir('/dev/fd')),before)
        finally:fixture.tearDown()
unittest.main(argv=['PrelaunchJoinControls'],defaultTest='PrelaunchJoinControls',verbosity=2)
`;

test('unwired pre-launch hook joins the real receipt receiver before authored launch', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const controls = lifecycleControls.replace(/^unittest.main.*$/m, '') + receiverControls.replace(/^unittest.main.*$/m, '') + prelaunchJoinControls;
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-prelaunch-join-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${controls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 2 tests/);
        assert.match(result.stderr, /OK/);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const containerControls = String.raw`
import functools
NEW='11111111-1111-1111-1111-111111111111'
OTHER='22222222-2222-2222-2222-222222222222'
class ContainerControls(unittest.TestCase):
    def setUp(self):
        self.f=ReceiverControls();self.f.setUp();self.time=0.;self.calls=[];self.change=lambda:None
        self.directory=self.f.root/('bw-ios-assets-'+'a'*32+'.deviceset')
        self.device_data=self.directory/NEW/'data';self.device_data.mkdir(parents=True)
        self.app=self.device_data/'Bundle'/'Installed.app';self.app.parent.mkdir()
        self.f.app.rename(self.app);self.f.app=self.app
        self.data=self.device_data/'Data'/'Container';self.data.mkdir(parents=True)
        self.f.parent.rename(self.data/'Documents');self.f.parent=self.data/'Documents';self.f.target=self.f.parent/'bw-embedded-asset-observation.json'
        self.spec={k:v for k,v in self.f.spec.items() if k not in ('appDirectory','receiptPath')}
        self.spec.update(schema='brickwright.ios-installed-container-plan.v1',deviceSet=str(self.directory))
        self.paths={'app':self.app,'data':self.data}
    def tearDown(self):self.f.tearDown()
    def query(self,args,*,deadline,output_limit):
        self.assertLess(self.time,deadline);self.assertEqual(output_limit,4097)
        self.assertEqual(args[:3],('get_app_container',NEW,'com.example.authored'));self.assertIn(args[3],('app','data'))
        self.calls.append(args);self.change()
        return (str(self.paths[args[3]])+'\n').encode()
    def prepare(self,fn=prepare_installed_observation,**kwargs):
        options=dict(deadline=self.time+10,now=lambda:self.time);options.update(kwargs)
        return fn(self.spec,NEW,self.query,**options)
    def test_normal_discovery_rechecks_both_paths_and_never_launches(self):
        before=len(os.listdir('/dev/fd'));receiver=self.prepare()
        self.assertEqual([a[3] for a in self.calls],['app','data','app','data'])
        self.assertFalse(self.f.target.exists());self.assertEqual(len(os.listdir('/dev/fd')),before+1)
        self.f.write();meta,raw=self.f.capture(receiver)
        self.assertEqual(meta['status'],'captured-header-only');self.assertIs(meta['actualAppQualified'],False)
        release_installed_observation(receiver);release_installed_observation(receiver)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_malformed_plan_and_device_refuse_before_query(self):
        before=len(os.listdir('/dev/fd'))
        for key,value in (('sourceCommit','bad'),('executableSHA256',True),('bundleIdentifier','../bad'),('deviceSet','relative')):
            saved=self.spec[key];self.spec[key]=value
            with self.assertRaises(InstalledPreparationRefused):self.prepare()
            self.spec[key]=saved
        for device in ('booted','all',OTHER.lower()+'x'):
            with self.assertRaises(InstalledPreparationRefused):prepare_installed_observation(self.spec,device,self.query,deadline=10,now=lambda:0)
        self.assertEqual(self.calls,[]);self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_outside_or_other_device_container_is_refused(self):
        for role in ('app','data'):
            original=self.paths[role]
            for path in (self.f.root, self.directory/OTHER/'data'):
                path.mkdir(parents=True,exist_ok=True);self.paths[role]=path
                with self.assertRaises(InstalledPreparationRefused):self.prepare()
            self.paths[role]=original
    def test_symlinked_container_or_namespace_is_refused(self):
        alias=self.device_data/'Alias.app';alias.symlink_to(self.app,target_is_directory=True);self.paths['app']=alias
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
        self.paths['app']=self.app;alias.unlink()
        root_alias=self.f.root/'set-link';root_alias.symlink_to(self.directory,target_is_directory=True);self.spec['deviceSet']=str(root_alias)
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
    def test_overlapping_paths_existing_output_and_wrong_pins_refuse(self):
        self.paths['data']=self.app
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
        self.paths['data']=self.data;self.f.target.write_bytes(b'OLD')
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
        self.assertEqual(self.f.target.read_bytes(),b'OLD');self.f.target.unlink()
        self.spec['executableSHA256']='0'*64
        with self.assertRaises(InstalledPreparationRefused) as caught:self.prepare()
        self.assertEqual(caught.exception.reason,'receiver-prepare');self.assertNotIn(str(self.f.root),str(caught.exception))
    def test_non_path_multiline_invalid_or_oversized_outputs_refuse(self):
        before=len(os.listdir('/dev/fd'))
        for raw in (None,'path',b'',b'/bad\x00path',b'/bad\nextra\n',b'\xff',b'x'*4098,b' relative ',b'../relative'):
            with self.assertRaises(InstalledPreparationRefused):prepare_installed_observation(self.spec,NEW,lambda *a,**k:raw,deadline=10,now=lambda:0)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_changed_directory_or_readback_path_refuses_and_closes(self):
        before=len(os.listdir('/dev/fd'));alternate=self.device_data/'Other';alternate.mkdir()
        def change_path():
            if len(self.calls)==4:self.paths['data']=alternate
        self.change=change_path
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
        self.paths['data']=self.data;self.calls=[]
        def replace():
            if len(self.calls)==3:self.data.rename(self.device_data/'OldData');self.data.mkdir()
        self.change=replace
        with self.assertRaises(InstalledPreparationRefused):self.prepare()
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_deadline_stop_and_interrupt_do_not_leak_prepared_receiver(self):
        before=len(os.listdir('/dev/fd'))
        def late():self.time=11.
        self.change=late
        with self.assertRaises(InstalledPreparationRefused) as caught:self.prepare()
        self.assertEqual(caught.exception.reason,'deadline');self.time=0.;self.change=lambda:None;self.calls=[]
        with self.assertRaises(InstalledPreparationRefused) as caught:self.prepare(stopped=lambda:len(self.calls)>=3)
        self.assertEqual(caught.exception.reason,'stop');self.calls=[]
        def interrupt():
            if len(self.calls)==3:raise KeyboardInterrupt()
        self.change=interrupt
        with self.assertRaises(KeyboardInterrupt):self.prepare()
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_deadline_or_stop_during_directory_close_refuses_publication(self):
        original=os.close;before=len(os.listdir('/dev/fd'))
        for mode in ('deadline','stop'):
            changed=[];flag=[False];self.time=0.;self.calls=[]
            def close(fd):
                info=os.fstat(fd);original(fd)
                if stat.S_ISDIR(info.st_mode) and not changed:
                    changed.append(True)
                    if mode=='deadline':self.time=11.
                    else:flag[0]=True
            with mock.patch.object(os,'close',side_effect=close):
                with self.assertRaises(InstalledPreparationRefused) as caught:self.prepare(stopped=lambda:flag[0])
            self.assertEqual(caught.exception.reason,mode);self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_caller_mutation_cannot_retarget_query_or_expected_pins(self):
        def mutate():self.spec['bundleIdentifier']='other.app';self.spec['sourceCommit']='0'*40
        self.change=mutate;receiver=self.prepare()
        self.assertEqual(receiver._spec['bundleIdentifier'],'com.example.authored');self.assertEqual(receiver._spec['sourceCommit'],'a'*40)
        release_installed_observation(receiver)
    def test_directory_close_error_and_interrupt_continue_other_cleanup(self):
        before=len(os.listdir('/dev/fd'));original=os.close
        for exception in (OSError,KeyboardInterrupt):
            called=[];failed=[]
            def close(fd):
                info=os.fstat(fd);original(fd);called.append(fd)
                if stat.S_ISDIR(info.st_mode) and not failed:
                    failed.append(fd);raise exception('AUTHORED-PRIVATE-CLOSE')
            with mock.patch.object(os,'close',side_effect=close):
                with self.assertRaises(InstalledPreparationRefused if exception is OSError else KeyboardInterrupt) as caught:self.prepare()
            self.assertGreaterEqual(len(called),6);self.assertEqual(len(os.listdir('/dev/fd')),before)
            if exception is OSError:self.assertIn('directory-close',caught.exception.cleanup_failures)
    def test_receiver_close_interrupt_closes_remaining_fd_and_never_retries(self):
        before=len(os.listdir('/dev/fd'));receiver=self.prepare();self.f.write();receiver._read_receipt(10,8*1024*1024)
        original=os.close;called=[]
        def close(fd):
            original(fd);called.append(fd)
            if len(called)==1:raise KeyboardInterrupt()
        with mock.patch.object(os,'close',side_effect=close):
            with self.assertRaises(KeyboardInterrupt):release_installed_observation(receiver)
        self.assertEqual(len(called),2);self.assertTrue(receiver._closed)
        with self.assertRaises(InstalledPreparationRefused) as caught:release_installed_observation(receiver)
        self.assertEqual(caught.exception.cleanup_failures,('_receipt-close',));self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_real_bounded_command_adapter_queries_authored_containers_only(self):
        actor=self.f.root/'xcrun';actor.write_text('#!/usr/bin/python3\nimport sys\nfrom pathlib import Path\nassert sys.argv[4:7]==["get_app_container",'+repr(NEW)+',"com.example.authored"]\nassert sys.argv[7] in ("app","data")\nprint((Path(__file__).parent/(sys.argv[7]+"-path")).read_text())\n');actor.chmod(0o755)
        for role in ('app','data'):(self.f.root/(role+'-path')).write_text(str(self.paths[role]))
        real_popen=subprocess.Popen
        def authored_launcher(arguments,**options):
            self.assertEqual(arguments[0],'/usr/bin/xcrun')
            return real_popen([str(actor),*arguments[1:]],**options)
        with mock.patch.dict(os.environ,{'PATH':str(self.f.root)+os.pathsep+os.environ['PATH']}),mock.patch.object(subprocess,'Popen',side_effect=authored_launcher):
            invoke=functools.partial(bounded_simulator_command,device_set=self.directory)
            receiver=prepare_installed_observation(self.spec,NEW,invoke,deadline=time.monotonic()+10)
        release_installed_observation(receiver)
        for args in (('get_app_container','booted','com.example.authored','data'),('get_app_container',NEW,'com.example.authored','groups'),('get_app_container',NEW,'../bad','app')):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):invoke(args,deadline=time.monotonic()+1,output_limit=4097)
                spawn.assert_not_called()
    def test_runtime_mutants_expose_containment_readback_and_close_uncertainty(self):
        cut='path != device_data and device_data in path.parents';self.assertIn(cut,SOURCE_PREFIX)
        outside=self.f.root/'Outside.app';self.app.rename(outside);self.paths['app']=outside
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,'True'),'authored-containment-mutant','exec'),namespace)
        receiver=self.prepare(namespace['prepare_installed_observation']);namespace['release_installed_observation'](receiver)
        outside.rename(self.app);self.paths['app']=self.app
        cut="need(container('app') == app and container('data') == data)";self.assertIn(cut,SOURCE_PREFIX)
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,'need(True)'),'authored-readback-mutant','exec'),namespace)
        self.calls=[];receiver=self.prepare(namespace['prepare_installed_observation']);self.assertEqual(len(self.calls),2)
        namespace['release_installed_observation'](receiver)
        cut="if errors:\n        raise InstalledPreparationRefused('receiver-close', errors)";self.assertIn(cut,SOURCE_PREFIX)
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,'if False:\n        pass'),'authored-close-mutant','exec'),namespace)
        receiver=self.prepare(namespace['prepare_installed_observation']);original=os.close
        def fail_after_close(fd):original(fd);raise OSError('AUTHORED-UNCERTAIN-CLOSE')
        with mock.patch.object(os,'close',side_effect=fail_after_close):
            self.assertIsNone(namespace['release_installed_observation'](receiver))
        self.assertEqual(receiver._close_errors,('_parent-close',))
        cut="except BaseException as error:\n                        errors.append(attribute+'-close')";self.assertIn(cut,SOURCE_PREFIX)
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,cut.replace('BaseException','Exception')),'authored-interrupt-close-mutant','exec'),namespace)
        receiver=self.prepare(namespace['prepare_installed_observation']);self.f.write();receiver._read_receipt(10,8*1024*1024)
        called=[]
        def interrupt_after_close(fd):
            original(fd);called.append(fd)
            if len(called)==1:raise KeyboardInterrupt()
        try:
            with mock.patch.object(os,'close',side_effect=interrupt_after_close):
                with self.assertRaises(KeyboardInterrupt):namespace['release_installed_observation'](receiver)
            left_open=receiver._parent is not None and not receiver._closed
        finally:
            if receiver._parent is not None:original(receiver._parent);receiver._parent=None
            receiver._closed=True
        self.assertTrue(left_open);self.assertEqual(len(called),1)
        cut='check()  # Final fence after directory cleanup.';self.assertIn(cut,SOURCE_PREFIX)
        namespace={};exec(compile(SOURCE_PREFIX.replace(cut,'pass  # Removed final cleanup fence.'),'authored-late-close-mutant','exec'),namespace)
        self.f.target.unlink();self.time=0.;changed=[];flag=[False]
        def stop_after_close(fd):
            info=os.fstat(fd);original(fd)
            if stat.S_ISDIR(info.st_mode) and not changed:changed.append(True);flag[0]=True
        with mock.patch.object(os,'close',side_effect=stop_after_close):
            receiver=self.prepare(namespace['prepare_installed_observation'],stopped=lambda:flag[0])
        self.assertTrue(flag[0]);namespace['release_installed_observation'](receiver)

unittest.main(argv=['authored-container-controls'],defaultTest='ContainerControls',verbosity=2)
`;

test('unwired container preparation binds selected directories and installed receiver', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const controls = receiverControls.replace(/^unittest.main.*$/m, '') + containerControls;
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-container-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${controls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 14 tests/);
        assert.match(result.stderr, /OK/);
        assert.equal((retention.match(/prepare_installed_observation\(/g) || []).length, 1, 'adapter definition only');
        assert.equal((retention.match(/release_installed_observation\(/g) || []).length, 1, 'release definition only');
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const launchControls = String.raw`
class LaunchControls(unittest.TestCase):
    def setUp(self):
        self.f=ContainerControls();self.f.setUp();self.receivers=[];self.count=0
        self.actor=self.f.f.root/'xcrun';self.mode='env';self.write_actor()
        self.environment=mock.patch.dict(os.environ,{'PATH':str(self.f.f.root)+os.pathsep+os.environ['PATH'],
            'SIMCTL_CHILD_BW_EMBEDDED_ASSET_AUDIT_PATH':'AUTHORED-WRONG-PATH','SIMCTL_CHILD_AUTHORED_SECRET':'AUTHORED-SECRET',
            'BW_EMBEDDED_ASSET_AUDIT_PATH':'AUTHORED-WRONG-UNPREFIXED','BW_AUTHORED_SECRET':'AUTHORED-SECRET'})
        self.environment.start()
        real_popen=subprocess.Popen
        def authored_launcher(arguments,**options):
            self.assertEqual(arguments[0],'/usr/bin/xcrun')
            return real_popen([str(self.actor),*arguments[1:]],**options)
        self.enterContext(mock.patch.object(subprocess,'Popen',side_effect=authored_launcher))
    def tearDown(self):
        self.environment.stop()
        for receiver,release in self.receivers:release(receiver)
        self.f.tearDown()
    def write_actor(self):
        script='''#!/usr/bin/python3
import os,sys,json
from pathlib import Path
ROOT=Path(__file__).parent
MODE=__MODE__
(ROOT/'attempts').open('ab').write(b'x')
if MODE=='exit':sys.exit(37)
if MODE=='pins':(Path((ROOT/'app-path').read_text())/'authored').write_bytes(b'AUTHORED-CHANGED')
if MODE=='parent':
 p=Path((ROOT/'receipt-path').read_text()).parent;p.rename(p.with_name('OldDocuments'));p.mkdir()
if MODE=='ready':Path(os.environ['SIMCTL_CHILD_BW_EMBEDDED_ASSET_AUDIT_PATH']).write_bytes((ROOT/'envelope').read_bytes())
print(json.dumps({'args':sys.argv[1:],'environment':{k:v for k,v in os.environ.items() if k.startswith('SIMCTL_CHILD_') or k.startswith('BW_')}}))
'''.replace('__MODE__',repr(self.mode))
        self.actor.write_text(script);self.actor.chmod(0o755)
        (self.f.f.root/'app-path').write_text(str(self.f.app));(self.f.f.root/'receipt-path').write_text(str(self.f.f.target))
        (self.f.f.root/'envelope').write_bytes(json.dumps(envelope()).encode())
    def prepare(self,namespace=None):
        fn=prepare_installed_observation if namespace is None else namespace['prepare_installed_observation']
        release=release_installed_observation if namespace is None else namespace['release_installed_observation']
        receiver=self.f.prepare(fn);self.receivers.append((receiver,release));return receiver
    def command(self,receiver=None,*,namespace=None,args=None,directory=None,**kwargs):
        fn=bounded_simulator_command if namespace is None else namespace['bounded_simulator_command']
        options=dict(device_set=self.f.directory if directory is None else directory,deadline=time.monotonic()+3,output_limit=4096,prepared_launch=receiver)
        options.update(kwargs);return fn(('launch',NEW,'com.example.authored') if args is None else args,**options)
    def attempts(self):
        file=self.f.f.root/'attempts';return len(file.read_bytes()) if file.exists() else 0
    def test_bound_launch_receives_only_derived_audit_path(self):
        receiver=self.prepare();raw=self.command(receiver);value=json.loads(raw)
        self.assertEqual(value['environment'],{'SIMCTL_CHILD_BW_EMBEDDED_ASSET_AUDIT_PATH':str(self.f.f.target)})
        self.assertEqual(value['args'],['simctl','--set',str(self.f.directory),'launch',NEW,'com.example.authored'])
        self.assertTrue(receiver._launch_attempted);self.assertEqual(self.attempts(),1)
    def test_default_launch_filters_all_audit_and_arbitrary_child_environment(self):
        self.assertEqual(json.loads(self.command())['environment'],{});self.assertEqual(self.attempts(),1)
    def test_wrong_operation_dict_and_ordinary_unbound_receiver_never_spawn(self):
        receiver=self.prepare()
        for value,args in (({},None),(str(self.f.f.target),None),(receiver,('list','devices','--json'))):
            with mock.patch.object(subprocess,'Popen') as spawn:
                with self.assertRaises(SimulatorCommandRefused):self.command(value,args=args)
                spawn.assert_not_called()
        spec=dict(self.f.f.spec,appDirectory=str(self.f.app),receiptPath=str(self.f.f.target))
        ordinary=PreparedInstalledObservation(spec,deadline=10,now=lambda:0)
        try:
            with self.assertRaises(SimulatorCommandRefused):self.command(ordinary)
        finally:release_installed_observation(ordinary)
        self.assertEqual(self.attempts(),0)
    def test_wrong_device_bundle_or_device_set_never_spawn(self):
        other=self.f.f.root/('bw-ios-assets-'+'b'*32+'.deviceset');other.mkdir()
        for args,directory in ((('launch',OTHER,'com.example.authored'),None),(('launch',NEW,'com.example.other'),None),(None,other)):
            with self.assertRaises(SimulatorCommandRefused):self.command(self.prepare(),args=args,directory=directory)
        self.assertEqual(self.attempts(),0)
    def test_closed_reused_and_failed_spawn_contexts_are_refused(self):
        receiver=self.prepare();release_installed_observation(receiver)
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        receiver=self.prepare();self.command(receiver)
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        self.assertEqual(self.attempts(),1)
        receiver=self.prepare()
        with mock.patch.object(subprocess,'Popen',side_effect=OSError('AUTHORED-SPAWN-ERROR')):
            with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        self.assertEqual(self.attempts(),1)
    def test_old_output_changed_files_and_replaced_parent_refuse(self):
        receiver=self.prepare();self.f.f.target.write_bytes(b'OLD')
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        self.assertEqual(self.attempts(),0);self.assertEqual(self.f.f.target.read_bytes(),b'OLD');self.f.f.target.unlink()
        receiver=self.prepare();self.mode='pins';self.write_actor()
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        self.assertEqual(self.attempts(),1)
        # Restore fixture bytes; a fresh helper must independently admit the file.
        (self.f.app/'authored').write_bytes(self.f.f.exe);receiver=self.prepare();self.mode='parent';self.write_actor()
        with self.assertRaises(SimulatorCommandRefused):self.command(receiver)
        self.assertEqual(self.attempts(),2)
    def test_stop_or_deadline_during_command_cleanup_never_publishes_reply(self):
        original=os.close
        for mode in ('stop','deadline'):
            receiver=self.prepare();flag=[False];clock=[0.]
            def close(fd):
                info=os.fstat(fd);original(fd)
                if stat.S_ISDIR(info.st_mode):
                    flag[0]=True
                    if mode=='deadline':clock[0]=11.
            with mock.patch.object(os,'close',side_effect=close),mock.patch.object(time,'monotonic',side_effect=lambda:clock[0]):
                with self.assertRaises(SimulatorCommandRefused) as caught:self.command(receiver,deadline=10,stopped=lambda:flag[0] if mode=='stop' else False)
            self.assertEqual(caught.exception.reason,mode)
        self.assertEqual(self.attempts(),2)
    def test_reentrant_clock_cannot_start_a_second_command(self):
        receiver=self.prepare();triggered=[];refused=[]
        def clock():
            if not triggered:
                triggered.append(True)
                try:self.command(receiver)
                except SimulatorCommandRefused:refused.append(True)
            return 0.
        receiver._now=clock;self.command(receiver)
        self.assertEqual(refused,[True]);self.assertEqual(self.attempts(),1)
    def test_authored_ready_bytes_can_be_captured_without_app_qualification(self):
        receiver=self.prepare();self.mode='ready';self.write_actor();self.command(receiver)
        meta,raw=self.f.f.capture(receiver);self.assertEqual(meta['status'],'captured-header-only')
        self.assertEqual(raw,self.f.f.target.read_bytes());self.assertIs(meta['actualAppQualified'],False)
    def test_runtime_mutants_expose_target_reuse_output_environment_and_cleanup_fences(self):
        def mutated(cut,replacement):
            self.assertIn(cut,SOURCE_PREFIX);namespace={};exec(compile(SOURCE_PREFIX.replace(cut,replacement),'authored-launch-mutant','exec'),namespace);return namespace
        cut="need(self._launch_binding[:3] == (str(device_set), device, bundle))"
        ns=mutated(cut,'need(True)');r=self.prepare(ns);self.command(r,namespace=ns,args=('launch',NEW,'com.example.other'))
        ns=mutated('need(not self._launch_attempted)','need(True)');r=self.prepare(ns)
        self.command(r,namespace=ns);self.command(r,namespace=ns)
        ns=mutated("raise ValueError('receipt exists before launch')",'pass');r=self.prepare(ns);self.f.f.target.write_bytes(b'OLD')
        self.command(r,namespace=ns);self.f.f.target.unlink()
        ns=mutated("environment['SIMCTL_CHILD_BW_EMBEDDED_ASSET_AUDIT_PATH'] = audit_path",'pass');r=self.prepare(ns)
        self.assertEqual(json.loads(self.command(r,namespace=ns))['environment'],{})
        cut='check()  # Recheck after readback and command cleanup, before returning.'
        ns=mutated(cut,'pass');r=self.prepare(ns);original=os.close;flag=[False]
        def close(fd):
            info=os.fstat(fd);original(fd)
            if stat.S_ISDIR(info.st_mode):flag[0]=True
        with mock.patch.object(os,'close',side_effect=close):raw=self.command(r,namespace=ns,stopped=lambda:flag[0])
        self.assertTrue(flag[0]);self.assertIn('environment',json.loads(raw))
unittest.main(argv=['authored-launch-controls'],defaultTest='LaunchControls',verbosity=2)
`;

test('unwired launch environment binds one prepared receiver to one explicit launch', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const controls = receiverControls.replace(/^unittest.main.*$/m, '') + containerControls.replace(/^unittest.main.*$/m, '') + launchControls;
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-launch-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${controls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 20000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 10 tests/);
        assert.match(result.stderr, /OK/);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const darwinSamplerControls = String.raw`
import ctypes, platform, struct, unittest
from unittest import mock
class KernelFunction:
    def __init__(self,call):self.call=call
    def __call__(self,*args):return self.call(*args)
class DarwinSamplerControls(unittest.TestCase):
    def setUp(self):
        self.tick=0;self.stop=False;self.path=b'/authored/Installed.app/Executable';self.birth=12;self.uuid=b'U'*16
        self.user=1;self.system=2;self.rss=100;self.exit=0;self.numer=125;self.denom=3
        self.resource_status=0;self.path_status=None;self.timebase_status=0;self.calls=[];self.hook=None
        self.lib=type('AuthoredLib',(),{})();self.system_lib=type('AuthoredSystem',(),{})()
        self.lib.proc_pid_rusage=KernelFunction(self.resource)
        self.lib.proc_pidpath=KernelFunction(self.pidpath)
        self.system_lib.mach_timebase_info=KernelFunction(self.timebase)
    def resource(self,pid,flavor,target):
        self.calls.append(('resource',pid,flavor));self.assertEqual((pid,flavor),(37,0))
        ctypes.memmove(target,struct.pack('<16s10Q',self.uuid,self.user,self.system,0,0,0,0,self.rss,0,self.birth,self.exit),96)
        ctypes.set_errno(7 if self.resource_status else 0)
        if self.hook:self.hook('resource')
        return self.resource_status
    def pidpath(self,pid,target,size):
        self.calls.append(('path',pid,size));self.assertEqual((pid,size),(37,4096))
        ctypes.memmove(target,self.path+b'\0',len(self.path)+1)
        if self.hook:self.hook('path')
        return len(self.path) if self.path_status is None else self.path_status
    def timebase(self,target):
        ctypes.memmove(target,struct.pack('<II',self.numer,self.denom),8)
        return self.timebase_status
    def make(self):
        def load(path,**kw):
            self.assertEqual(kw,{'use_errno':True})
            return {'/usr/lib/libproc.dylib':self.lib,'/usr/lib/libSystem.B.dylib':self.system_lib}[path]
        with mock.patch.object(sys,'platform','darwin'),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.object(ctypes,'CDLL',side_effect=load):
            return DarwinProcessSampler(37,'/authored/Installed.app/Executable',deadline=30,now=lambda:self.tick,stopped=lambda:self.stop)
    def refused(self,s):
        with self.assertRaises(ValueError):s(37)
        with self.assertRaises(ValueError):s(37)
    def test_baseline_and_abi(self):
        s=self.make();first=s(37);second=s(37)
        self.assertEqual(first,second);self.assertEqual(set(first),{'pid','identitySHA256','rssBytes'})
        self.assertEqual(first['rssBytes'],100);self.assertEqual(len(first['identitySHA256']),64)
        self.assertEqual([row['kind'] for row in s.originals()],['timebase']+['rusage-v0','pidpath','rusage-v0']*2)
        self.assertEqual(self.lib.proc_pid_rusage.argtypes,[ctypes.c_int,ctypes.c_int,ctypes.c_void_p])
        self.assertEqual(self.lib.proc_pidpath.argtypes,[ctypes.c_int,ctypes.c_void_p,ctypes.c_uint32])
        self.assertEqual(s._usage.resident.offset,64);self.assertEqual(ctypes.sizeof(s._usage),96)
        originals=s.originals();originals[0]['rawHex']='mutated';self.assertNotEqual(s.originals()[0]['rawHex'],'mutated')
    def test_unsupported_platform_before_library_load(self):
        with mock.patch.object(sys,'platform','linux'),mock.patch.object(ctypes,'CDLL') as load:
            with self.assertRaises(ValueError):DarwinProcessSampler(37,'/authored/exe',deadline=1)
            load.assert_not_called()
    def test_cpu_conversion_and_lifetime_budget(self):
        for user,system in [(120000001,0),(0,120000001),(60000001,60000001)]:
            with self.subTest(user=user,system=system):
                self.user,self.system=user,system;s=self.make();self.refused(s)
        self.user,self.system=120000000,0;s=self.make();self.assertEqual(s(37)['pid'],37)
        self.numer,self.denom=1,1;self.user=5000000001;s=self.make();self.refused(s)
    def test_timebase_refusal(self):
        for status,numer,denom in [(1,1,1),(0,0,1),(0,1,0)]:
            self.timebase_status,self.numer,self.denom=status,numer,denom
            with self.subTest(status=status,numer=numer,denom=denom):
                with self.assertRaises(ValueError):self.make()
    def test_rss_threshold(self):
        s=self.make();self.rss=1024*1024*1024;self.assertEqual(s(37)['rssBytes'],self.rss)
        self.rss+=1;self.refused(s);self.assertEqual(s.originals()[-1]['kind'],'rusage-v0')
    def test_kernel_failure_keeps_original(self):
        s=self.make();self.resource_status=-1;self.refused(s)
        row=s.originals()[-1];self.assertEqual((row['status'],row['errno']),(-1,7));self.assertEqual(len(bytes.fromhex(row['rawHex'])),96)
    def test_path_refusals(self):
        for path,status in [(b'/authored/other',None),(self.path,0),(self.path,4096),(self.path,3),(b'/authored\0/hidden',None)]:
            with self.subTest(path=path,status=status):
                s=self.make();self.path,self.path_status=path,status;self.refused(s)
                self.assertEqual(len(bytes.fromhex(s.originals()[-1]['rawHex'])),4096)
                self.path=b'/authored/Installed.app/Executable';self.path_status=None
    def test_birth_uuid_exit_and_counter_drift(self):
        for field,value in [('birth',13),('uuid',b'V'*16),('exit',1),('birth',0),('uuid',b'\0'*16),('user',0),('system',1)]:
            with self.subTest(field=field):
                self.setUp();s=self.make();s(37);setattr(self,field,value);self.refused(s)
    def test_bracket_catches_reuse(self):
        s=self.make()
        def hook(stage):
            if stage=='path':self.birth+=1
        self.hook=hook;self.refused(s)
        self.assertEqual([r['kind'] for r in s.originals()],['timebase','rusage-v0','pidpath','rusage-v0'])
    def test_late_stop_and_deadline_keep_originals(self):
        for stage,late in [('resource','stop'),('path','stop'),('resource','time'),('path','time')]:
            with self.subTest(stage=stage,late=late):
                self.setUp();s=self.make()
                def hook(current):
                    if current==stage:
                        if late=='stop':self.stop=True
                        else:self.tick=31
                self.hook=hook;self.refused(s)
                self.assertEqual(s.originals()[-1]['kind'],'pidpath' if stage=='path' else 'rusage-v0')
        self.setUp();s=self.make();self.tick=-1;self.refused(s)
    def test_reentry_seals_outer_call(self):
        s=self.make()
        def hook(stage):
            if stage=='path':
                with self.assertRaises(ValueError):s(37)
        self.hook=hook;self.refused(s)
    def test_finite_polls_and_bytes(self):
        s=self.make()
        for _ in range(100):s(37)
        self.assertLess(s._bytes,1024*1024);self.assertEqual(len(s.originals()),301)
        self.refused(s);self.assertEqual(len(s.originals()),301)
        s=self.make();s._bytes=1024*1024;before=len(self.calls);self.refused(s);self.assertEqual(len(self.calls),before)
    def test_wrong_pid_and_expired_entry(self):
        s=self.make()
        with self.assertRaises(ValueError):s(38)
        self.refused(s)
        self.tick=31
        with self.assertRaises(ValueError):self.make()
        self.tick=float('inf')
        with self.assertRaises(ValueError):self.make()
unittest.main(argv=['authored-darwin-kernel-controls'],defaultTest='DarwinSamplerControls',verbosity=2)
`;

test('unwired Darwin sampler brackets kernel identity and enforces converted CPU, RSS and retention bounds', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-darwin-controls-'));
    const run = (source, name) => {
        const file = join(dir, `${name}.py`);
        writeFileSync(file, `${source}\n${darwinSamplerControls}`);
        return spawnSync('/usr/bin/python3', [file], {env: {...process.env,
            GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000});
    };
    try {
        const baseline = run(prefix, 'baseline');
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        assert.match(baseline.stderr, /Ran 13 tests/);
        const cuts = [
            ['cpu <= 5_000_000_000', 'True'],
            ['value.resident <= 1024*1024*1024', 'True'],
            ["identity = (int(value.birth), bytes(value.uuid))", "identity = (1, b'fixed')"],
            ['buffer.raw[:status] == self._executable', 'True'],
            ['self._polls < 100', 'True']
        ];
        for (const [index, [before, after]] of cuts.entries()) {
            assert.equal(prefix.split(before).length, 2, `unique cut: ${before}`);
            const result = run(prefix.replace(before, after), `cut-${index}`);
            assert.notEqual(result.status, 0, `undetected mutation: ${before}`);
            assert.match(result.stderr, /FAIL:/, result.stdout + result.stderr);
            assert.doesNotMatch(result.stderr, /SyntaxError|ImportError/);
        }
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const sdkReportControls = String.raw`
import unittest
from unittest import mock
class SDKReportControls(unittest.TestCase):
    def setUp(self):
        self.value={'usageSize':96,'userOffset':16,'systemOffset':24,'residentOffset':64,'birthOffset':80,
            'exitOffset':88,'timebaseSize':8,'numer':125,'denom':3,'pid':37,'uuid':'ab'*16,'birth':12,
            'userTicks':100,'systemTicks':200,'rssBytes':100,'pathMatches':True,
            'auditTokenSize':32,'auditTokenCount':8,'auditTokenFlavor':15,'csStatusOperation':0,
            'csCDHashOperation':5,'cdhashBytes':20,'codeStatus':1,'auditTokenHex':'ab'*32,'cdhash':'cd'*20}
    def test_positive_and_exact_boundary(self):
        validate_sdk_report(self.value,37)
        self.value['userTicks']=120000000;self.value['systemTicks']=0;self.value['rssBytes']=1024**3
        validate_sdk_report(self.value,37)
    def test_every_layout_field_is_checked(self):
        for key in ['usageSize','userOffset','systemOffset','residentOffset','birthOffset','exitOffset','timebaseSize','auditTokenSize','auditTokenCount','auditTokenFlavor','csStatusOperation','csCDHashOperation','cdhashBytes']:
            with self.subTest(key=key):
                v=dict(self.value);v[key]+=1
                with self.assertRaises(ValueError):validate_sdk_report(v,37)
    def test_closed_schema_and_types(self):
        for v in [[],None,{**self.value,'extra':1},{k:v for k,v in self.value.items() if k!='uuid'}]:
            with self.assertRaises(ValueError):validate_sdk_report(v,37)
        for key in ['usageSize','pid','numer','denom','birth','userTicks','systemTicks','rssBytes']:
            v=dict(self.value);v[key]=True
            with self.subTest(key=key):
                with self.assertRaises(ValueError):validate_sdk_report(v,37)
    def test_identity_refusals(self):
        for key,value in [('pid',38),('uuid','0'*32),('uuid','not-hex'),('birth',0),('pathMatches',False),('codeStatus',0),('auditTokenHex','invalid'),('cdhash','0'*40)]:
            v=dict(self.value);v[key]=value
            with self.subTest(key=key):
                with self.assertRaises(ValueError):validate_sdk_report(v,37)
    def test_resource_and_timebase_refusals(self):
        for key,value in [('numer',0),('denom',0),('numer',2**32),('denom',2**32),('rssBytes',1024**3+1),
                          ('userTicks',120000001),('systemTicks',120000001),('birth',2**64),('userTicks',-1)]:
            v=dict(self.value);v[key]=value
            with self.subTest(key=key,value=value):
                with self.assertRaises(ValueError):validate_sdk_report(v,37)
    def test_required_exports_are_checked_without_fallback(self):
        names=('task_name_for_pid','task_info','mach_port_deallocate','csops_audittoken')
        library=type('Library',(),{name:object() for name in names})()
        with mock.patch.object(ctypes,'CDLL',return_value=library) as load:
            self.assertEqual(validate_api_exports(),dict.fromkeys(names,True))
            load.assert_called_once_with('/usr/lib/libSystem.B.dylib',use_errno=True)
        for missing in names:
            partial=type('Library',(),{name:object() for name in names if name!=missing})()
            with self.subTest(missing=missing),mock.patch.object(ctypes,'CDLL',return_value=partial):
                with self.assertRaises(ValueError):validate_api_exports()
        with mock.patch.object(ctypes,'CDLL',side_effect=OSError('missing library')):
            with self.assertRaises(OSError):validate_api_exports()
    def cleanup_fixture(self):
        from types import SimpleNamespace
        process=SimpleNamespace(pid=37,returncode=None,wait=mock.Mock(return_value=0))
        info=SimpleNamespace(si_pid=37,si_uid=0,si_signo=int(signal.SIGCHLD),si_status=0,si_code=os.CLD_EXITED)
        report={}
        self.ownership_token=b''.join(n.to_bytes(4,'little') for n in (501,501,20,501,20,37,123,9))
        self.enterContext(mock.patch.object(os,'geteuid',return_value=501))
        self.enterContext(mock.patch.object(os,'waitid',return_value=info))
        self.enterContext(mock.patch.object(os,'waitpid',side_effect=ChildProcessError()))
        census=self.enterContext(mock.patch.dict(globals(),{'preflight_group_original':mock.Mock()}))
        signal_call=self.enterContext(mock.patch.object(os,'killpg'))
        return process,info,report,signal_call
    def test_command_cleanup_probe_preserves_primary_originals_and_always_tears_down(self):
        process,info,report,signal_call=self.cleanup_fixture()
        row=b'{"kind":"authored-only","rawHex":""}'
        run=mock.Mock(return_value=(row,))
        with mock.patch.dict(globals(),{'finish_preflight_helper':mock.Mock()}) as ignored:
            check_command_cleanup({'darwin_owned_command_cleanup':run},process,info,report,ownership_token=self.ownership_token)
            finish_preflight_helper.assert_called_once()
        self.assertEqual(report['commandCleanupOriginals'],[json.loads(row)])
        self.assertTrue(report['commandCleanupProbeChecked'])
        for error in (RuntimeError('authored'),KeyboardInterrupt('authored')):
            error.command_cleanup_originals=(row,);report={};run.side_effect=error
            with mock.patch.dict(globals(),{'finish_preflight_helper':mock.Mock(side_effect=ValueError('teardown'))}):
                with self.assertRaises(type(error)) as caught:
                    check_command_cleanup({'darwin_owned_command_cleanup':run},process,info,report,ownership_token=self.ownership_token)
                self.assertIs(caught.exception,error);finish_preflight_helper.assert_called_once()
            self.assertEqual(report['commandCleanupOriginals'],[json.loads(row)])
            self.assertNotIn('commandCleanupProbeChecked',report)
            self.assertEqual(report['commandCleanupTeardownFailure'],'ValueError')
    def test_fixed_helper_success_reaps_and_preserves_wait_original(self):
        process,info,report,signal_call=self.cleanup_fixture()
        finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
        self.assertTrue(report['fixedProbeGroupChecked']);self.assertTrue(report['leaderReaped'])
        self.assertEqual(report['probeExitOriginal']['si_pid'],37)
        process.wait.assert_called_once_with(timeout=2);signal_call.assert_called_once_with(37,signal.SIGKILL)
    def test_fixed_helper_eperm_needs_both_censuses_and_same_owned_exit(self):
        import errno
        process,info,report,signal_call=self.cleanup_fixture();signal_call.side_effect=PermissionError(errno.EPERM,'authored')
        finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
        self.assertTrue(report['zombieOnlyGroupNegativeObserved']);self.assertEqual(preflight_group_original.call_count,2)
        self.assertEqual(report['probeGroupSignal'],{'status':-1,'errno':errno.EPERM})
        self.assertTrue(report['leaderReaped'])
    def test_fixed_helper_signal_error_never_skips_reap_or_becomes_success(self):
        import errno
        process,info,report,signal_call=self.cleanup_fixture();signal_call.side_effect=OSError(errno.EIO,'authored')
        with self.assertRaises(ValueError):finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
        self.assertNotIn('fixedProbeGroupChecked',report);process.wait.assert_called_once_with(timeout=2)
        self.assertTrue(report['leaderReaped'])
    def test_bad_exit_or_group_or_second_wait_refuses_but_reaps(self):
        from types import SimpleNamespace
        for mode in ('pid','status','code','group','second-wait','ownership-uid','ownership-pid'):
            with self.subTest(mode=mode):
                process,info,report,signal_call=self.cleanup_fixture()
                if mode in ('pid','status','code'):setattr(info,'si_'+mode,getattr(info,'si_'+mode)+1)
                elif mode.startswith('ownership-'):
                    offset=4 if mode=='ownership-uid' else 20
                    self.ownership_token=self.ownership_token[:offset]+(999).to_bytes(4,'little')+self.ownership_token[offset+4:]
                elif mode=='group':preflight_group_original.side_effect=ValueError('authored foreign group')
                else:os.waitid.return_value=None
                with self.assertRaises(ValueError):finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
                process.wait.assert_called_once_with(timeout=2)
                self.assertNotIn('fixedProbeGroupChecked',report)
    def test_wait_uid_is_retained_without_becoming_ownership_authority(self):
        for value in (0,501,999):
            process,info,report,signal_call=self.cleanup_fixture();info.si_uid=value
            finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
            self.assertEqual(report['probeExitOriginal']['si_uid'],value)
            self.assertIs(report['waitUIDUsedForOwnership'],False)
            self.assertEqual(report['probeExitOwnershipTokenHex'],self.ownership_token.hex())
    def test_cleanup_primary_survives_reap_error(self):
        process,info,report,signal_call=self.cleanup_fixture()
        primary=ValueError('authored primary');preflight_group_original.side_effect=primary
        process.wait.side_effect=TimeoutError('authored reap error')
        with self.assertRaises(ValueError) as caught:finish_preflight_helper(process,info,report,ownership_token=self.ownership_token)
        self.assertIs(caught.exception,primary);self.assertEqual(report['helperReapFailure'],'TimeoutError')
    def test_actual_group_binding_and_closed_singleton_buffer(self):
        original_function=globals()['preflight_group_original']
        class Query:
            def __init__(self,count=1,pid=37,error=0):self.count,self.pid,self.error=count,pid,error
            def __call__(self,pid,raw,size):
                if pid!=37 or size!=8:raise AssertionError('wrong group API arguments')
                ctypes.cast(raw,ctypes.POINTER(ctypes.c_int32))[0]=self.pid
                ctypes.set_errno(self.error);return self.count
        for count,pid,error in ((1,37,0),(0,37,0),(2,37,0),(-1,37,0),(1,38,0),(1,37,1)):
            query=Query(count,pid,error);library=type('Library',(),{'proc_listpgrppids':query})()
            report={}
            with self.subTest(count=count,pid=pid,error=error),mock.patch.object(ctypes,'CDLL',return_value=library) as load:
                if (count,pid,error)==(1,37,0):original_function(37,report)
                else:
                    with self.assertRaises(ValueError):original_function(37,report)
                self.assertEqual(report['probeGroupOriginals'][0]['count'],count)
                self.assertEqual(len(bytes.fromhex(report['probeGroupOriginals'][0]['rawHex'])),8)
                load.assert_called_once_with('/usr/lib/libproc.dylib',use_errno=True)
    def test_unsupported_host_refuses_before_compiler(self):
        import tempfile
        with tempfile.TemporaryDirectory() as directory,mock.patch.dict(os.environ,{'RUNNER_TEMP':directory,
            'GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-preflight'}),mock.patch.object(sys,'platform','linux'),mock.patch.object(subprocess,'run') as run:
            with self.assertRaises(ValueError):main()
            run.assert_not_called()
            report=json.loads((Path(directory)/'bw-ios-darwin-preflight/report.json').read_text())
            self.assertEqual(report['failure'],{'type':'ValueError','stage':'platform-admission'})
            self.assertEqual(report['host']['platform'],'linux');self.assertEqual(report['cleanupErrors'],[])
unittest.main(argv=['authored-sdk-controls'],defaultTest='SDKReportControls',verbosity=2)
`;

const preflightBlock = workflow.match(/# BEGIN IOS DARWIN PREFLIGHT\n          "\$BW_PREFLIGHT_PYTHON" - <<'PY'\n([\s\S]*?)          PY\n          # END IOS DARWIN PREFLIGHT/);
assert.ok(preflightBlock, 'exact embedded Darwin preflight');
const preflight = preflightBlock[1].replace(/^          /gm, '');

test('Darwin preflight-only dispatch is closed, unsigned and excludes existing app build jobs', () => {
    assert.match(workflow, /ios_audit_preflight_only:\n[^\n]+\n        type: boolean\n        default: false/);
    const guard = "github.event_name == 'workflow_dispatch' && inputs.ios_audit_preflight_only && !inputs.ios_audit_directory_only && !inputs.ios_audit_interface_only && !inputs.ios_audit_interface_diagnostic && !inputs.ios_audit_interface_manual_only && !inputs.ios_audit_interface_inventory_only && inputs.retain_ios_audit_inputs && !inputs.sign_ios && !inputs.device_ipa && github.ref == 'refs/heads/lane/ios-active-asset-source-20261018'";
    assert.ok(workflow.includes(`  ios-audit-preflight:\n    if: ${guard}\n`));
    assert.ok(workflow.includes("  build-web:\n    if: github.event_name != 'workflow_dispatch' || (inputs.ios_audit_preflight_only != true && inputs.ios_audit_interface_only != true && inputs.ios_audit_interface_diagnostic != true && inputs.ios_audit_interface_manual_only != true && inputs.ios_audit_interface_inventory_only != true && inputs.ios_audit_directory_only != true)\n"));
    const job = workflow.slice(workflow.indexOf('  ios-audit-preflight:\n'), workflow.indexOf('  ios-audit-interface:\n'));
    assert.match(job, /permissions:\n      contents: read/);
    assert.match(job, /timeout-minutes: 8/);
    assert.doesNotMatch(job, /tauri ios|simctl|downloadPlatform|secrets\.|devicectl|sign_ios: true/);
    assert.match(job, /name: brickwright-ios-darwin-preflight/);
    assert.match(job, /path: \$\{\{ runner.temp \}\}\/bw-ios-darwin-preflight\/report.json/);
    assert.match(preflight, /sys.version_info >= \(3,13\)/);
    assert.doesNotMatch(preflight, /#include <sys\/codesign\.h>/);
    assert.match(preflight, /extern int csops_audittoken\(pid_t, unsigned int, void \*, size_t, audit_token_t \*\);/);
    assert.ok(preflight.indexOf("report['apiExports']=validate_api_exports()") < preflight.indexOf("report['stage']='probe-compile'"));
    assert.match(preflight, /os\.WEXITED\|os\.WNOHANG\|os\.WNOWAIT/);
    assert.ok(preflight.indexOf('os.killpg(process.pid,signal.SIGKILL)') < preflight.indexOf('process.wait(timeout=2)'));
    assert.match(preflight, /'actualAppQualified':False,'processFamilyQualified':False/);
});

test('Darwin SDK report controls reject layout, identity, CPU-unit and resource mismatches', () => {
    const definitions = preflight.slice(0, preflight.indexOf("\nif __name__=='__main__':"));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-sdk-controls-'));
    const run = (source, name) => {
        const file = join(dir, `${name}.py`);
        writeFileSync(file, `${source}\n${sdkReportControls}`);
        return spawnSync('/usr/bin/python3', [file], {encoding:'utf8', timeout:15000});
    };
    try {
        const baseline = run(definitions, 'baseline');
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        assert.match(baseline.stderr, /Ran 15 tests/);
        for (const [index, [before, after]] of [
            ["value[k] == v", 'True'],
            ["value['pid'] == pid", 'True'],
            ["value['rssBytes'] <= 1024**3", 'True'],
            ["(value['userTicks']+value['systemTicks'])*value['numer']//value['denom'] <= 5_000_000_000", 'True'],
            ["type(count) is int and count==1 and row['errno']==0 and buffer[0]==pid", 'True'],
            ['again is not None and {key:getattr(again,key) for key in fields}==original', 'True'],
            ['token[5]==process.pid and token[1]==os.geteuid()', 'True']
        ].entries()) {
            assert.equal(definitions.split(before).length, 2);
            const result = run(definitions.replace(before, after), `cut-${index}`);
            assert.notEqual(result.status, 0, `undetected SDK cut ${index}`);
            assert.match(result.stderr, /FAIL:/, result.stdout + result.stderr);
            assert.doesNotMatch(result.stderr, /SyntaxError|ImportError/);
        }
    } finally { rmSync(dir, {recursive:true, force:true}); }
});

const auditIdentityControls = String.raw`
import ctypes,platform,struct,unittest
from unittest import mock
class IdentityFunction:
    def __init__(self,fn):self.fn=fn
    def __call__(self,*args):return self.fn(*args)
class AuditIdentityControls(unittest.TestCase):
    def setUp(self):
        self.tick=0;self.stop=False;self.port=91;self.acquire_status=0;self.info_status=0;self.count=8
        self.token=[501,os.geteuid(),0,0,0,37,123,9];self.flags=1;self.hash=b'H'*20
        self.cs_status=0;self.close_status=0;self.closed=[];self.operations=[];self.hook=None
        self.lib=type('AuthoredSystem',(),{})()
        for key,fn in [('task_name_for_pid',self.acquire),('task_info',self.info),('csops_audittoken',self.csops),('mach_port_deallocate',self.deallocate)]:setattr(self.lib,key,IdentityFunction(fn))
    def acquire(self,actor,pid,target):
        self.assertEqual((actor,pid),(7,37));ctypes.memmove(target,struct.pack('<I',self.port),4)
        return self.acquire_status
    def info(self,port,flavor,token,count):
        self.assertEqual((port,flavor),(91,15));ctypes.memmove(token,struct.pack('<8I',*self.token),32)
        ctypes.memmove(count,struct.pack('<I',self.count),4)
        if self.hook:self.hook('info')
        return self.info_status
    def csops(self,pid,operation,value,size,token):
        self.operations.append(operation);self.assertEqual(pid,37)
        self.assertEqual(bytes(token),struct.pack('<8I',*self.token))
        self.assertEqual(size,4 if operation==0 else 20)
        ctypes.memmove(value,struct.pack('<I',self.flags) if operation==0 else self.hash,size)
        ctypes.set_errno(13 if self.cs_status else 0)
        if self.hook:self.hook('csops')
        return self.cs_status
    def deallocate(self,actor,port):
        self.closed.append((actor,port));return self.close_status
    def make(self):
        with mock.patch.object(sys,'platform','darwin'),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.object(ctypes,'CDLL',return_value=self.lib),mock.patch.object(ctypes.c_uint32,'in_dll',return_value=ctypes.c_uint32(7)):
            return DarwinAuditIdentity(37,(b'H'*20).hex(),deadline=30,now=lambda:self.tick,stopped=lambda:self.stop)
    def refused(self,identity):
        with self.assertRaises(ValueError):identity.sample()
        with self.assertRaises(ValueError):identity.sample()
    def test_baseline_kernel_token_and_readonly_operations(self):
        obj=self.make();first=obj.sample();self.assertEqual(first,obj.sample());self.assertEqual(len(first),64)
        self.assertEqual(self.operations,[0,5,0,5]);self.assertEqual(obj._token,struct.pack('<8I',*self.token))
        rows=obj.originals();rows[0]['rawHex']='changed';self.assertNotEqual(rows,obj.originals())
        obj.close();obj.close();self.assertEqual(self.closed,[(7,91)])
        with self.assertRaises(ValueError):obj.sample()
    def test_kernel_token_fields_and_exec_generation(self):
        for field,value in [(1,os.geteuid()+1),(5,38),(7,10)]:
            self.setUp();obj=self.make();obj.sample();self.token[field]=value
            self.refused(obj);obj.close()
    def test_short_token_and_kernel_errors(self):
        for field,value in [('count',7),('info_status',5),('cs_status',-1),('flags',0),('hash',b'X'*20)]:
            self.setUp();obj=self.make();setattr(self,field,value)
            self.refused(obj);self.assertGreater(len(obj.originals()),1);obj.close()
    def test_acquire_failure_does_not_release_undefined_port(self):
        self.acquire_status=5
        with self.assertRaises(ValueError) as caught:self.make()
        self.assertEqual(self.closed,[]);self.assertEqual(caught.exception.identity_originals[0]['status'],5)
    def test_close_once_even_after_failure(self):
        obj=self.make();self.close_status=5
        with self.assertRaises(ValueError):obj.close()
        obj.close();self.assertEqual(self.closed,[(7,91)])
        self.assertEqual(obj.originals()[-1]['status'],5)
    def test_final_clock_and_stop_fences(self):
        for setting,value in [('tick',31),('tick',-1),('stop',True)]:
            self.setUp();obj=self.make()
            self.hook=lambda stage:setattr(self,setting,value)
            self.refused(obj);obj.close()
    def test_reentry_seals_and_does_not_reuse_port(self):
        obj=self.make()
        def hook(stage):
            if stage=='csops':
                with self.assertRaises(ValueError):obj.sample()
        self.hook=hook;self.refused(obj);obj.close();self.assertEqual(self.closed,[(7,91)])
    def test_poll_and_record_capacity_refuse_before_kernel(self):
        obj=self.make()
        for _ in range(200):obj.sample()
        count=len(self.operations);self.refused(obj);self.assertEqual(count,len(self.operations));obj.close()
        obj=self.make();obj._bytes=256*1024-1023;self.refused(obj);obj.close()

class CodeDirectoryControls(unittest.TestCase):
    def fixture(self):
        prefix=bytearray(4096)
        struct.pack_into('<8I',prefix,0,0xfeedfacf,0x100000c,0,2,1,16,0,0)
        struct.pack_into('<4I',prefix,32,0x1d,16,4096,160)
        directory=bytearray(128)
        struct.pack_into('>9I',directory,0,0xfade0c02,128,0x20400,2,96,88,0,1,4096)
        struct.pack_into('4B',directory,36,32,2,0,12)
        directory[88:94]=b'owned\0';directory[96:128]=hashlib.sha256(prefix).digest()
        signature=struct.pack('>5I',0xfade0cc0,148,1,0,20)+bytes(directory)+bytes(12)
        return bytes(prefix)+signature,bytes(directory)
    def parse(self,raw,**kw):return simulator_code_directory(raw,deadline=1,now=lambda:0,**kw)
    def test_primary_sha256_directory_and_all_pages(self):
        raw,directory=self.fixture();result=self.parse(raw)
        self.assertEqual(result['executableSHA256'],hashlib.sha256(raw).hexdigest())
        self.assertEqual(result['cdhash'],hashlib.sha256(directory).digest()[:20].hex())
        self.assertEqual(result['codeSlots'],1);self.assertFalse(result['signatureTrustQualified'])
    def test_executable_page_corruption_and_signature_bounds(self):
        raw,_=self.fixture()
        for offset,value in [(100,1),(4096,0),(4096+20+37,1),(4096+20+15,0),(4096+20+44,1)]:
            bad=bytearray(raw);bad[offset]=value
            with self.subTest(offset=offset):
                with self.assertRaises(ValueError):self.parse(bytes(bad))
        for bad in [raw[:-1],raw+b'\0',raw[:16],b'X'*len(raw)]:
            with self.assertRaises(ValueError):self.parse(bad)
    def test_unsupported_alternate_directory(self):
        raw,_=self.fixture();bad=bytearray(raw);struct.pack_into('>I',bad,4096+12,0x1000)
        with self.assertRaises(ValueError):self.parse(bytes(bad))
    def test_stop_and_clock_after_hashing(self):
        raw,_=self.fixture()
        with self.assertRaises(ValueError):self.parse(raw,stopped=lambda:True)
        values=iter([0,0,0,0,0,2])
        with self.assertRaises(ValueError):simulator_code_directory(raw,deadline=1,now=lambda:next(values))

unittest.main(argv=['authored-kernel-identity'],defaultTest=('AuditIdentityControls','CodeDirectoryControls'),verbosity=2)
`;

test('unwired audit identity uses kernel tokens and read-only code hashes with owned port cleanup', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-audit-identity-'));
    const run = (source, name) => {
        const file = join(dir, `${name}.py`);writeFileSync(file,`${source}\n${auditIdentityControls}`);
        return spawnSync('/usr/bin/python3',[file],{env:{...process.env,GITHUB_WORKSPACE:dir,RUNNER_TEMP:dir},encoding:'utf8',timeout:15000});
    };
    try {
        const baseline=run(prefix,'baseline');assert.equal(baseline.status,0,baseline.stdout+baseline.stderr);
        assert.match(baseline.stderr,/Ran 12 tests/);
        for (const [index,[before,after]] of [
            ['raw==self._token','True'],
            ['bytes(value)==self._expected','True'],
            ['need(value.value&1)','need(True)'],
            ['need(actual==expected)','need(True)'],
            ['self._polls<200','True']
        ].entries()) {
            assert.equal(prefix.split(before).length,2,`unique identity cut ${index}`);
            const result=run(prefix.replace(before,after),`cut-${index}`);
            assert.notEqual(result.status,0,`undetected identity cut ${index}`);
            assert.match(result.stderr,/FAIL:/,result.stdout+result.stderr);
            assert.doesNotMatch(result.stderr,/SyntaxError|ImportError/);
        }
    } finally {rmSync(dir,{recursive:true,force:true});}
});

const darwinCommandGroupControls = String.raw`
import ctypes
import errno
import platform
import signal
import struct
import unittest
from types import SimpleNamespace
from unittest import mock

class GroupQuery:
    def __init__(self):self.count=1;self.pid=37;self.error=0;self.hook=None
    def __call__(self,pid,raw,size):
        assert pid==37 and size==8
        ctypes.cast(raw,ctypes.POINTER(ctypes.c_int32))[0]=self.pid
        ctypes.set_errno(self.error)
        if self.hook:self.hook()
        return self.count

class DarwinCommandGroupControls(unittest.TestCase):
    def setUp(self):
        self.process=SimpleNamespace(pid=37,returncode=None)
        self.tick=0.;self.query=GroupQuery();self.library=SimpleNamespace(proc_listpgrppids=self.query)
        self.info=SimpleNamespace(si_pid=37,si_uid=0,si_signo=int(signal.SIGCHLD),si_status=0,si_code=os.CLD_EXITED)
        self.enterContext(mock.patch.object(sys,'platform','darwin'))
        self.enterContext(mock.patch.object(platform,'machine',return_value='arm64'))
        self.load=self.enterContext(mock.patch.object(ctypes,'CDLL',return_value=self.library))
        self.wait=self.enterContext(mock.patch.object(os,'waitid',return_value=self.info))
        self.kill=self.enterContext(mock.patch.object(os,'killpg',side_effect=PermissionError(errno.EPERM,'authored')))
    def run_cleanup(self):return darwin_owned_command_cleanup(self.process,deadline=2,now=lambda:self.tick)
    def originals(self,rows):return [json.loads(row) for row in rows]
    def test_singleton_zombie_negative_keeps_wait_and_two_group_originals(self):
        rows=self.originals(self.run_cleanup())
        self.assertEqual([r['kind'] for r in rows],['wait-terminal','group','group-signal','group','wait-terminal'])
        self.assertEqual(rows[2]['errno'],errno.EPERM)
        for row in (rows[1],rows[3]):self.assertEqual(struct.unpack('<2i',bytes.fromhex(row['rawHex'])),(37,0))
        self.kill.assert_called_once_with(37,signal.SIGKILL)
        self.load.assert_called_once_with('/usr/lib/libproc.dylib',use_errno=True)
        self.assertLessEqual(sum(len(row) for row in self.run_cleanup()),4096)
    def test_live_group_signal_success_uses_no_zombie_exception(self):
        self.wait.return_value=None;self.kill.side_effect=None
        rows=self.originals(self.run_cleanup());self.assertEqual([r['kind'] for r in rows],['wait-pending','group-signal'])
        self.load.assert_not_called();self.assertEqual(rows[-1]['status'],0)
    def test_terminal_nonzero_and_signal_exit_still_allow_owned_cleanup(self):
        for code,status in ((os.CLD_EXITED,37),(os.CLD_KILLED,9),(os.CLD_DUMPED,11)):
            self.info.si_code,self.info.si_status=code,status
            self.assertEqual(self.originals(self.run_cleanup())[0]['kind'],'wait-terminal')
    def test_live_eperm_and_unknown_signal_errors_refuse(self):
        for info,error in ((None,PermissionError(errno.EPERM,'authored')),(self.info,PermissionError(errno.EACCES,'authored')),(self.info,OSError(errno.EIO,'authored')),(self.info,ProcessLookupError(errno.ESRCH,'authored'))):
            self.wait.return_value=info;self.kill.side_effect=error
            with self.subTest(info=info,error=type(error).__name__),self.assertRaises(DarwinCommandCleanupRefused) as caught:self.run_cleanup()
            self.assertTrue(caught.exception.originals)
    def test_unknown_truncated_foreign_and_error_groups_refuse_before_signal(self):
        for count,pid,error in ((0,37,0),(2,37,0),(-1,37,0),(1,38,0),(1,37,5),(True,37,0)):
            self.query.count,self.query.pid,self.query.error=count,pid,error
            self.kill.reset_mock()
            with self.subTest(count=count,pid=pid,error=error),self.assertRaises(DarwinCommandCleanupRefused) as caught:self.run_cleanup()
            self.kill.assert_not_called();rows=self.originals(caught.exception.originals)
            self.assertEqual(rows[-1]['kind'],'group')
    def test_changed_second_wait_or_second_group_refuses(self):
        for mode in ('wait','group'):
            self.wait.side_effect=None;self.query.pid=37
            if mode=='wait':self.wait.side_effect=[self.info,SimpleNamespace(**{**vars(self.info),'si_status':1})]
            else:
                calls=[0]
                def change():
                    calls[0]+=1
                    if calls[0]==1:self.query.pid=38
                self.query.hook=change
            with self.subTest(mode=mode),self.assertRaises(DarwinCommandCleanupRefused):self.run_cleanup()
            self.query.hook=None
    def test_wrong_wait_identity_and_unreaped_requirement_refuse(self):
        for mode in ('pid','uid','code','reaped','pidtype'):
            self.process.returncode=None;self.process.pid=37;self.info.si_pid=37;self.info.si_uid=0;self.info.si_code=os.CLD_EXITED
            if mode=='pid':self.info.si_pid=38
            elif mode=='uid':self.info.si_uid=-1
            elif mode=='code':self.info.si_code=-1
            elif mode=='reaped':self.process.returncode=0
            else:self.process.pid=True
            self.kill.reset_mock()
            with self.subTest(mode=mode),self.assertRaises(DarwinCommandCleanupRefused):self.run_cleanup()
            self.kill.assert_not_called()
    def test_late_kernel_query_retains_original_but_never_signals(self):
        self.query.hook=lambda:setattr(self,'tick',3.)
        with self.assertRaises(DarwinCommandCleanupRefused) as caught:self.run_cleanup()
        self.assertEqual(self.originals(caught.exception.originals)[-1]['kind'],'group');self.kill.assert_not_called()
    def test_interrupt_preserves_prefix_and_never_reaps_in_helper(self):
        self.kill.side_effect=KeyboardInterrupt('authored')
        with self.assertRaises(KeyboardInterrupt) as caught:self.run_cleanup()
        self.assertEqual(len(caught.exception.command_cleanup_originals),2)
        self.assertIsNone(self.process.returncode)
    def test_unsupported_platform_refuses_before_kernel_queries(self):
        with mock.patch.object(sys,'platform','linux'),self.assertRaises(DarwinCommandCleanupRefused):self.run_cleanup()
        self.wait.assert_not_called();self.load.assert_not_called();self.kill.assert_not_called()

unittest.main(argv=['authored-darwin-command-group-controls'],verbosity=2)
`;

test('Darwin command cleanup retains kernel originals and refuses uncertain groups', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-command-group-'));
    const run = (source, name) => {
        const file = join(dir, `${name}.py`);
        writeFileSync(file, `${source}\n${darwinCommandGroupControls}`);
        return spawnSync('/usr/bin/python3', [file], {env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000});
    };
    try {
        const baseline = run(prefix, 'baseline');
        assert.equal(baseline.status, 0, baseline.stdout + baseline.stderr);
        assert.match(baseline.stderr, /Ran 10 tests/);
        for (const [index, [before, after]] of [
            ['type(count) is int and count==1 and ctypes.get_errno()==0 and buffer[0]==process.pid', 'True'],
            ['singleton();need(wait_original()==before)', 'singleton()'],
            ['signal_error.errno==errno.EPERM and before is not None', 'True'],
            ['tick<=deadline', 'True']
        ].entries()) {
            assert.equal(prefix.split(before).length, 2, before);
            const result = run(prefix.replace(before, after), `cut-${index}`);
            assert.notEqual(result.status, 0, `undetected cut ${before}`);
            assert.match(result.stderr, /FAIL:/, result.stdout + result.stderr);
            assert.doesNotMatch(result.stderr, /SyntaxError|ImportError/);
        }
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const interfaceBlock = workflow.match(/# BEGIN IOS INTERFACE INVENTORY\n          python - <<'PY'\n([\s\S]*?)          PY\n          # END IOS INTERFACE INVENTORY/);
assert.ok(interfaceBlock);
const interfaceSource = interfaceBlock[1].replace(/^          /gm, '');
const interfaceControls = String.raw`
import tempfile,unittest
from unittest import mock
class InterfaceControls(unittest.TestCase):
    def setUp(self):
        self.children=[];self.popen=subprocess.Popen;self.cleanup_calls=[]
        def spawn(*a,**kw):
            child=self.popen(*a,**kw);self.children.append(child);return child
        self.enterContext(mock.patch.object(subprocess,'Popen',side_effect=spawn))
    def cleanup(self,child,**kw):
        self.cleanup_calls.append(child.pid);os.killpg(child.pid,signal.SIGKILL);return ()
    def run_command(self,program,**kw):
        return retained_command(('/usr/bin/python3','-c',program),kw.get('cleanup',self.cleanup),deadline=time.monotonic()+kw.get('seconds',2),observe=kw.get('observe'),facts=kw.get('facts'))
    def released(self):
        self.assertEqual(len(self.children),1);child=self.children[0]
        self.assertIsNotNone(child.returncode);self.assertTrue(child.stdout.closed and child.stderr.closed)
        self.assertEqual(self.cleanup_calls,[child.pid])
        with self.assertRaises(ChildProcessError):os.waitpid(child.pid,os.WNOHANG)
    def test_observed_help_bytes_and_reap_originals(self):
        raw,rows,failure=self.run_command("import sys;print('authored-help');sys.stderr.write('authored-warning')")
        self.assertIsNone(failure);self.assertEqual(raw,b'authored-help\n');self.assertIn('wait',[r['kind'] for r in rows])
        self.assertEqual(b''.join(bytes.fromhex(r['rawHex']) for r in rows if r['kind']=='stderr'),b'authored-warning')
        self.assertEqual(rows[-1],{'kind':'reap','code':0});self.released()
    def test_nonzero_refuses_and_keeps_observed_prefix(self):
        raw,rows,failure=self.run_command("import sys;print('authored-partial',flush=True);sys.exit(9)")
        self.assertIsNotNone(failure);self.assertEqual(raw,b'authored-partial\n');self.assertEqual(rows[-1]['code'],9);self.released()
    def test_output_overflow_refuses_before_unbounded_retention(self):
        raw,rows,failure=self.run_command("import os;os.write(1,b'x'*200000)")
        self.assertIsNotNone(failure);self.assertLessEqual(sum(len(bytes.fromhex(r['rawHex'])) for r in rows if 'rawHex' in r),2*65536+40)
        self.released()
    def test_deadline_and_interrupt_still_release_owned_child(self):
        raw,rows,failure=self.run_command('import time;time.sleep(.6)',seconds=.2)
        self.assertIsNotNone(failure);self.released()
    def test_cleanup_error_keeps_primary_and_reaps(self):
        def cleanup(child,**kw):
            self.cleanup(child,**kw);raise KeyboardInterrupt('authored')
        raw,rows,failure=self.run_command('import sys;sys.exit(9)',cleanup=cleanup)
        self.assertEqual(failure,'ValueError');self.released()
    def test_selector_interrupt_is_retained_without_leaking_pipes(self):
        original=selectors.DefaultSelector
        class Interrupting(original):
            def select(self,*a,**kw):raise KeyboardInterrupt('authored')
        with mock.patch.object(selectors,'DefaultSelector',Interrupting):raw,rows,failure=self.run_command('import time;time.sleep(20)')
        self.assertEqual(failure,'KeyboardInterrupt');self.released()
    def test_deadline_phase_and_times_are_retained(self):
        facts={};raw,rows,failure=self.run_command('import time;time.sleep(.6)',seconds=.2,facts=facts)
        self.assertEqual(facts['failurePhase'],'deadline');self.assertIs(facts['diagnosticInvoked'],False)
        self.assertLessEqual(facts['startedMonotonic'],facts['spawnedMonotonic'])
        self.assertLessEqual(facts['spawnedMonotonic'],facts['finishedMonotonic']);self.released()
    def test_observer_gets_only_the_unreaped_owned_handle_once(self):
        real=time.monotonic;calls=[0];observations=[];facts={}
        def clock():
            calls[0]+=1;return real()+(2.1 if calls[0]>3 else 0)
        def observe(child,deadline):
            self.assertIs(child,self.children[0]);self.assertIsNone(child.returncode)
            observations.append(child.pid)
        with mock.patch.object(time,'monotonic',side_effect=clock):
            raw,rows,failure=self.run_command('import time;time.sleep(.3)',seconds=4,observe=observe,facts=facts)
        self.assertIsNone(failure);self.assertEqual(observations,[self.children[0].pid])
        self.assertIs(facts['diagnosticInvoked'],True);self.released()
    def test_observer_failure_preserves_diagnostic_phase_and_still_reaps(self):
        real=time.monotonic;calls=[0];facts={}
        def clock():
            calls[0]+=1;return real()+(2.1 if calls[0]>3 else 0)
        def observe(child,deadline):raise RuntimeError('authored')
        with mock.patch.object(time,'monotonic',side_effect=clock):
            raw,rows,failure=self.run_command('import time;time.sleep(.3)',seconds=4,observe=observe,facts=facts)
        self.assertEqual(failure,'RuntimeError');self.assertEqual(facts['failurePhase'],'diagnostic');self.released()
    def test_main_keeps_fixed_command_graph_and_false_ownership_claims(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'.github/workflows').mkdir(parents=True)
            (root/'.github/workflows/mobile.yml').write_text(WORKFLOW_TEXT)
            env={'RUNNER_TEMP':directory,'GITHUB_WORKSPACE':directory,'GITHUB_SHA':'a'*40,
                 'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-interface','BW_INTERFACE_OTHER_MODE':'false',
                 'BW_INTERFACE_MANUAL_ONLY':'false','BW_INTERFACE_INVENTORY_ONLY':'false','BW_INTERFACE_MODE':'true','BW_INTERFACE_DIAGNOSTIC':'false','BW_INTERFACE_RUNTIME':'','BW_INTERFACE_BUILD':''}
            with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform','darwin'),mock.patch.object(sys,'version_info',(3,13)),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.dict(globals(),{'retained_command':mock.Mock(return_value=(b'authored',[],None))}),mock.patch('builtins.print'):
                main();calls=[call.args[0] for call in retained_command.call_args_list]
            expected=[('/usr/bin/xcrun','--find','simctl'),('/usr/bin/xcodebuild','-version'),('/bin/launchctl','help')]
            expected += [('/usr/bin/xcrun','simctl','help',*(() if not sub else (sub,))) for sub in ('','spawn','launch','get_app_container','appinfo','list')]
            self.assertEqual(calls,expected)
            report=json.loads((root/'bw-ios-interface-inventory/report.json').read_text())
            self.assertIs(report['actualAppQualified'],False);self.assertIs(report['namespaceOwnershipQualified'],False)
            self.assertEqual(report['workflowSHA256'],hashlib.sha256(WORKFLOW_TEXT.encode()).hexdigest())
    def test_diagnostic_main_samples_only_the_held_help_handle_within_its_deadline(self):
        from types import SimpleNamespace
        for sample_failure in (None,'ValueError'):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);(root/'.github/workflows').mkdir(parents=True)
                (root/'.github/workflows/mobile.yml').write_text(WORKFLOW_TEXT)
                env={'RUNNER_TEMP':directory,'GITHUB_WORKSPACE':directory,'GITHUB_SHA':'a'*40,
                     'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-interface',
                     'BW_INTERFACE_OTHER_MODE':'false','BW_INTERFACE_MANUAL_ONLY':'false','BW_INTERFACE_INVENTORY_ONLY':'false','BW_INTERFACE_MODE':'true',
                     'BW_INTERFACE_DIAGNOSTIC':'true','BW_INTERFACE_RUNTIME':'','BW_INTERFACE_BUILD':''}
                calls=[];help_deadline=[]
                def command(argv,cleanup,**kw):
                    calls.append(argv)
                    if argv==('/usr/bin/xcrun','simctl','help'):
                        help_deadline.append(kw['deadline']);kw['observe'](SimpleNamespace(pid=37,returncode=None),kw['deadline'])
                    elif argv[0]=='/usr/bin/sample':
                        self.assertEqual(argv,('/usr/bin/sample','37','1','10','-file','/dev/stdout'))
                        self.assertLessEqual(kw['deadline'],help_deadline[0]-1)
                        return b'authored-sample',[],sample_failure
                    else:self.assertIsNone(kw.get('observe'))
                    return b'authored',[],None
                with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform','darwin'),mock.patch.object(sys,'version_info',(3,13)),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.dict(globals(),{'retained_command':mock.Mock(side_effect=command)}),mock.patch('builtins.print'):
                    if sample_failure:
                        with self.assertRaises(ValueError):main()
                    else:main()
                report=json.loads((root/'bw-ios-interface-inventory/report.json').read_text())
                self.assertEqual(len(report['diagnostics']),1);self.assertEqual(report['diagnostics'][0]['targetPID'],37)
                self.assertIs(report['commandGraphComplete'],True)
                self.assertEqual(sum(argv[:3]==('/usr/bin/xcrun','simctl','help') for argv in calls),6)
                self.assertEqual(report['diagnostics'][0]['failure'],sample_failure)
                self.assertEqual(sum(argv[0]=='/usr/bin/sample' for argv in calls),1)
    def test_inventory_mode_reads_only_fixed_metadata_and_refuses_other_profiles(self):
        for manual,diagnostic in (('false','false'),('true','false'),('false','true')):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);(root/'.github/workflows').mkdir(parents=True)
                (root/'.github/workflows/mobile.yml').write_text(WORKFLOW_TEXT)
                env={'RUNNER_TEMP':directory,'GITHUB_WORKSPACE':directory,'GITHUB_SHA':'a'*40,
                     'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-interface',
                     'BW_INTERFACE_OTHER_MODE':'false','BW_INTERFACE_MODE':'true',
                     'BW_INTERFACE_INVENTORY_ONLY':'true','BW_INTERFACE_MANUAL_ONLY':manual,
                     'BW_INTERFACE_DIAGNOSTIC':diagnostic,'BW_INTERFACE_RUNTIME':'','BW_INTERFACE_BUILD':''}
                with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform','darwin'),mock.patch.object(sys,'version_info',(3,13)),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.dict(globals(),{'retained_command':mock.Mock(return_value=(b'authored',[],None))}),mock.patch('builtins.print'):
                    if manual=='true' or diagnostic=='true':
                        with self.assertRaises(ValueError):main()
                        retained_command.assert_not_called()
                    else:
                        main();self.assertEqual([call.args[0] for call in retained_command.call_args_list],
                            [('/usr/bin/xcodebuild','-version'),('/usr/bin/xcrun','simctl','list','--json','runtimes','iOS 26.2'),('/usr/bin/xcrun','simctl','list','--json','devicetypes','iPhone-16'),('/usr/bin/xcrun','simctl','runtime','list','--json')])
                        for call in retained_command.call_args_list:self.assertIsNone(call.kwargs['observe'])
                report=json.loads((root/'bw-ios-interface-inventory/report.json').read_text());self.assertEqual(report['diagnostics'],[])
                if manual==diagnostic=='false':self.assertEqual(report['profile'],'inventory-only')
    def test_manual_mode_reads_only_fixed_docs_and_refuses_sampling(self):
        for diagnostic in ('false','true'):
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory);(root/'.github/workflows').mkdir(parents=True)
                (root/'.github/workflows/mobile.yml').write_text(WORKFLOW_TEXT)
                env={'RUNNER_TEMP':directory,'GITHUB_WORKSPACE':directory,'GITHUB_SHA':'a'*40,
                     'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-interface',
                     'BW_INTERFACE_OTHER_MODE':'false','BW_INTERFACE_INVENTORY_ONLY':'false','BW_INTERFACE_MODE':'true',
                     'BW_INTERFACE_MANUAL_ONLY':'true','BW_INTERFACE_DIAGNOSTIC':diagnostic,
                     'BW_INTERFACE_RUNTIME':'','BW_INTERFACE_BUILD':''}
                with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform','darwin'),mock.patch.object(sys,'version_info',(3,13)),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.dict(globals(),{'retained_command':mock.Mock(return_value=(b'authored',[],None))}),mock.patch('builtins.print'):
                    if diagnostic=='true':
                        with self.assertRaises(ValueError):main()
                        retained_command.assert_not_called()
                    else:
                        main();self.assertEqual([call.args[0] for call in retained_command.call_args_list],
                            [('/usr/bin/xcodebuild','-version'),('/bin/launchctl','help','print'),('/bin/launchctl','help','procinfo'),('/bin/launchctl','help','managerpid'),('/usr/bin/man','-P','/bin/cat','sample')])
                        for call in retained_command.call_args_list:self.assertIsNone(call.kwargs['observe'])
                report=json.loads((root/'bw-ios-interface-inventory/report.json').read_text())
                self.assertEqual(report['diagnostics'],[])
                if diagnostic=='false':self.assertEqual(report['profile'],'manual-only')
    def test_main_rejects_mixed_modes_and_runtime_selections_before_commands(self):
        for key,value in (('BW_INTERFACE_MODE','false'),('BW_INTERFACE_OTHER_MODE','true'),('BW_INTERFACE_RUNTIME','authored'),('BW_INTERFACE_BUILD','authored')):
            with tempfile.TemporaryDirectory() as directory:
                env={'RUNNER_TEMP':directory,'GITHUB_WORKSPACE':directory,'GITHUB_SHA':'a'*40,
                     'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-interface','BW_INTERFACE_OTHER_MODE':'false',
                     'BW_INTERFACE_MANUAL_ONLY':'false','BW_INTERFACE_INVENTORY_ONLY':'false','BW_INTERFACE_MODE':'true','BW_INTERFACE_DIAGNOSTIC':'false','BW_INTERFACE_RUNTIME':'','BW_INTERFACE_BUILD':'',key:value}
                with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform','darwin'),mock.patch.object(sys,'version_info',(3,13)),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.dict(globals(),{'retained_command':mock.Mock()}),mock.patch('builtins.print'):
                    with self.assertRaises(ValueError):main()
                    retained_command.assert_not_called()
unittest.main(argv=['authored-interface-controls'],verbosity=2)
`;

test('interface inventory is disjoint, read-only and bounded to installed tool help', () => {
    const start = workflow.indexOf('  ios-audit-interface:\n');
    const job = workflow.slice(start, workflow.indexOf('  build-web:\n', start));
    assert.match(workflow, /ios_audit_interface_only:\n[^\n]+\n        type: boolean\n        default: false/);
    assert.ok(job.includes("if: github.event_name == 'workflow_dispatch' && (inputs.ios_audit_interface_only || inputs.ios_audit_interface_diagnostic || inputs.ios_audit_interface_manual_only || inputs.ios_audit_interface_inventory_only) && !inputs.ios_audit_directory_only && inputs.retain_ios_audit_inputs && !inputs.sign_ios && !inputs.device_ipa && github.ref == 'refs/heads/lane/ios-active-asset-source-20261018'"));
    assert.match(job, /permissions:\n      contents: read/);
    assert.match(interfaceSource, /BW_INTERFACE_OTHER_MODE'\]=='false'/);
    assert.match(interfaceSource, /BW_INTERFACE_RUNTIME'\]=='' and os.environ\['BW_INTERFACE_BUILD'\]==''/);
    assert.doesNotMatch(interfaceSource, /secrets\.|downloadPlatform|terminate|kickstart|bootstatus|--console|Popen\(.*shell/);
    assert.ok(interfaceSource.includes("for subcommand in ('','spawn','launch','get_app_container','appinfo','list'):"));
    assert.ok(interfaceSource.includes("('/usr/bin/xcrun','simctl','help',*(() if not subcommand else (subcommand,)))"));
    assert.match(interfaceSource, /'actualAppQualified':False,'namespaceOwnershipQualified':False/);
    const dir = mkdtempSync(join(tmpdir(), 'bw-interface-controls-'));
    const prefix = interfaceSource.slice(0, interfaceSource.indexOf("\nif __name__=='__main__':"));
    const run = (source, name) => {
        const file = join(dir, `${name}.py`);writeFileSync(file, `${source}\nWORKFLOW_TEXT = ${JSON.stringify(workflow)}\n${interfaceControls}`);
        return spawnSync('/usr/bin/python3', [file], {env: {...process.env, TMPDIR: dir}, encoding: 'utf8', timeout: 15000});
    };
    try {
        const result=run(prefix,'baseline');assert.equal(result.status,0,result.stdout+result.stderr);
        assert.match(result.stderr,/Ran 14 tests/);
        for (const [index,[before,after]] of [
            ['used<=65536','True'],
            ['time.monotonic()<deadline and len(rows)<256','len(rows)<256'],
            ["rows.append({'kind':'reap','code':code})",'None'],
            ['elif observe is not None and not observed and time.monotonic()-started>=2:', 'elif False:'],
            ['deadline=min(deadline-1,time.monotonic()+3)', 'deadline=time.monotonic()+30'],
            ["require(all(record['failure'] is None for record in report['diagnostics']))", 'require(True)'],
            ["sample_argv=('/usr/bin/sample',str(child.pid),'1','10','-file','/dev/stdout')", "sample_argv=('/usr/bin/sample',str(child.pid),'1','10','-mayDie','-file','/dev/stdout')"]
        ].entries()) {
            assert.equal(prefix.split(before).length,2,before);
            const cut=run(prefix.replace(before,after),`cut-${index}`);
            assert.notEqual(cut.status,0,`undetected interface cut ${index}`);
            assert.match(cut.stderr,/FAIL:/,cut.stdout+cut.stderr);assert.doesNotMatch(cut.stderr,/SyntaxError|ImportError/);
        }
    } finally {rmSync(dir,{recursive:true,force:true});}
});

const deviceSetDirectoryControls = String.raw`
import tempfile
import shutil
import unittest
import uuid
from unittest import mock
class DeviceSetDirectoryControls(unittest.TestCase):
    def setUp(self):
        self.root=Path(tempfile.mkdtemp(prefix='bw-device-set-custody-'));self.parent=self.root/'private';self.parent.mkdir(mode=0o700)
        self.time=0.;self.owners=[];self.patch=mock.patch('uuid.uuid4',return_value=mock.Mock(hex='b'*32));self.patch.start()
    def tearDown(self):
        self.patch.stop()
        for owner in self.owners:owner.close()
        shutil.rmtree(self.root)
    def create(self,**changes):
        options=dict(deadline=10,now=lambda:self.time);options.update(changes)
        owner=SimulatorDeviceSetDirectory(self.parent,**options);self.owners.append(owner);return owner
    def test_normal_exclusive_custody_close_keeps_state_and_fd_count(self):
        before=len(os.listdir('/dev/fd'));owner=self.create();self.assertTrue(owner.creation_attempted)
        self.assertEqual(owner.verify(deadline=10),owner.path);self.assertEqual(owner.path.stat().st_mode&0o777,0o700)
        (owner.path/'retained-state').write_bytes(b'AUTHORED')
        self.assertEqual(len(os.listdir('/dev/fd')),before+2);self.assertEqual(owner.close(),())
        self.assertEqual(owner.close(),());self.assertEqual(len(os.listdir('/dev/fd')),before)
        self.assertEqual((owner.path/'retained-state').read_bytes(),b'AUTHORED')
        with self.assertRaises(ValueError):owner.verify(deadline=10)
    def test_collision_and_symlink_never_adopt_or_remove_existing_entry(self):
        path=self.parent/('bw-ios-assets-'+'b'*32+'.deviceset');before=len(os.listdir('/dev/fd'))
        for kind in ('directory','symlink'):
            if kind=='directory':path.mkdir();(path/'original').write_bytes(b'KEEP')
            else:path.symlink_to(self.root,target_is_directory=True)
            with self.assertRaises(SimulatorDeviceSetRefused) as caught:self.create()
            self.assertEqual(caught.exception.reason,'exclusive-create');self.assertTrue(path.exists())
            self.assertEqual(len(os.listdir('/dev/fd')),before)
            if kind=='directory':self.assertEqual((path/'original').read_bytes(),b'KEEP');shutil.rmtree(path)
            else:path.unlink()
    def test_parent_permissions_symlink_and_relative_path_refuse_before_create(self):
        before=len(os.listdir('/dev/fd'));self.parent.chmod(0o777)
        with mock.patch.object(os,'mkdir') as mkdir:
            with self.assertRaises(SimulatorDeviceSetRefused):self.create()
            mkdir.assert_not_called()
        self.parent.chmod(0o700);link=self.root/'linked';link.symlink_to(self.parent,target_is_directory=True)
        for parent in (link,Path('relative'),self.parent/'..'/'private'):
            with self.assertRaises(SimulatorDeviceSetRefused):SimulatorDeviceSetDirectory(parent,deadline=10,now=lambda:0)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_stop_before_creation_and_after_creation_closes_only_owned_fds(self):
        before=len(os.listdir('/dev/fd'))
        for flag in (True,1,None):
            with mock.patch.object(os,'mkdir') as mkdir:
                with self.assertRaises(SimulatorDeviceSetRefused):self.create(stopped=lambda:flag)
                mkdir.assert_not_called()
        with self.assertRaises(SimulatorDeviceSetRefused) as caught:self.create(stopped=lambda:bool(list(self.parent.iterdir())))
        self.assertTrue(caught.exception.creation_attempted);self.assertEqual(len(list(self.parent.iterdir())),1)
        self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_directory_replacement_and_detected_aba_remain_refused(self):
        owner=self.create();original=owner.path.with_suffix('.retained');owner.path.rename(original);owner.path.mkdir(mode=0o700)
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        owner.path.rmdir();original.rename(owner.path)
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        self.assertTrue(owner.path.is_dir())
    def test_parent_replacement_or_permission_change_refuses(self):
        owner=self.create();self.parent.chmod(0o750)
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        owner.close();self.parent.chmod(0o700);shutil.rmtree(owner.path)
        owner=self.create();old=self.root/'old';self.parent.rename(old);self.parent.mkdir(mode=0o700)
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        self.assertTrue((old/owner.path.name).exists());self.assertEqual(list(self.parent.iterdir()),[])
    def test_clocks_and_deadlines_refuse_and_failed_context_cannot_recover(self):
        for deadline in (True,float('nan'),float('inf'),0,16):
            with self.assertRaises(SimulatorDeviceSetRefused):self.create(deadline=deadline)
        owner=self.create();self.time=1;owner.verify(deadline=10);self.time=0
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        self.time=2
        with self.assertRaises(ValueError):owner.verify(deadline=10)
    def test_failure_after_mkdir_preserves_directory_and_releases_parent(self):
        before=len(os.listdir('/dev/fd'));original=os.open
        def fail(path,*args,**kwargs):
            if str(path).endswith('.deviceset'):raise OSError('AUTHORED')
            return original(path,*args,**kwargs)
        with mock.patch.object(os,'open',side_effect=fail):
            with self.assertRaises(SimulatorDeviceSetRefused) as caught:self.create()
        self.assertEqual(caught.exception.reason,'directory-open');self.assertTrue(caught.exception.creation_attempted)
        self.assertEqual(len(list(self.parent.iterdir())),1);self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_close_interrupt_attempts_later_close_and_never_retries_fd_numbers(self):
        before=len(os.listdir('/dev/fd'));owner=self.create();original=os.close;closed=[];first=KeyboardInterrupt()
        def close(fd):
            original(fd);closed.append(fd)
            if len(closed)==1:raise first
        with mock.patch.object(os,'close',side_effect=close),self.assertRaises(KeyboardInterrupt) as caught:owner.close()
        self.assertIs(caught.exception,first);self.assertEqual(len(closed),2);self.assertEqual(len(os.listdir('/dev/fd')),before)
        fd=os.open(self.root/'new-fd',os.O_CREAT|os.O_RDWR,0o600)
        try:owner.close();os.fstat(fd)
        finally:os.close(fd)
        self.assertEqual(owner._close_errors,('_directory_fd-close',))
    def test_constructor_interrupt_survives_cleanup_interrupt(self):
        before=len(os.listdir('/dev/fd'));original=os.close;first=KeyboardInterrupt();second=SystemExit();calls=[]
        def stop():raise first
        def close(fd):original(fd);calls.append(fd);raise second
        with mock.patch.object(os,'close',side_effect=close),self.assertRaises(KeyboardInterrupt) as caught:self.create(stopped=stop)
        self.assertIs(caught.exception,first);self.assertEqual(caught.exception.device_set_secondary_interrupts,(second,))
        self.assertEqual(len(calls),1);self.assertEqual(len(os.listdir('/dev/fd')),before)
    def test_reentry_fails_sticky_and_no_directory_is_deleted(self):
        owner=self.create();entered=[False]
        def now():
            if not entered[0]:
                entered[0]=True
                with self.assertRaises(ValueError):owner.verify(deadline=10)
            return 0
        owner._now=now
        with self.assertRaises(ValueError):owner.verify(deadline=10)
        self.assertTrue(owner.path.exists())
    def test_identity_cut_exposes_replacement_acceptance(self):
        cut='self._identity(held) == self._identity(named) == self._directory_identity'
        self.assertEqual(SOURCE_PREFIX.count(cut),1);namespace={}
        exec(compile(SOURCE_PREFIX.replace(cut,'self._identity(held) == self._directory_identity'),'authored-device-set-identity-mutant','exec'),namespace)
        owner=namespace['SimulatorDeviceSetDirectory'](self.parent,deadline=10,now=lambda:0);self.owners.append(owner)
        original=owner.path.with_suffix('.retained');owner.path.rename(original);owner.path.mkdir(mode=0o700)
        self.assertEqual(owner.verify(deadline=10),owner.path)
unittest.main(argv=['DeviceSetDirectoryControls'],defaultTest='DeviceSetDirectoryControls',verbosity=2)
`;
test('exclusive device-set directory retains identity across command boundaries', () => {
    const prefix = retention.slice(0, retention.lastIndexOf('\ntry:\n'));
    const dir = mkdtempSync(join(tmpdir(), 'bw-ios-device-set-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nSOURCE_PREFIX = ${JSON.stringify(prefix)}\n${deviceSetDirectoryControls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, GITHUB_WORKSPACE: dir, RUNNER_TEMP: dir, TMPDIR: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 12 tests/);
        assert.match(result.stderr, /OK/);
        assertNoAuditEntry(retention);
    } finally { rmSync(dir, {recursive: true, force: true}); }
});

const directoryBlock = workflow.match(/# BEGIN IOS DIRECTORY CUSTODY\n          python - <<'PY'\n([\s\S]*?)          PY\n          # END IOS DIRECTORY CUSTODY/);
assert.ok(directoryBlock);
const directorySource = directoryBlock[1].replace(/^          /gm, '');
const directoryProfileControls = String.raw`
import tempfile,shutil,unittest
from unittest import mock
class DirectoryProfileControls(unittest.TestCase):
    def execute(self,workflow=WORKFLOW_TEXT,changes=None,host='darwin'):
        root=Path(tempfile.mkdtemp(prefix='bw-directory-profile-'));self.addCleanup(shutil.rmtree,root)
        (root/'.github/workflows').mkdir(parents=True);(root/'.github/workflows/mobile.yml').write_text(workflow)
        env={'RUNNER_TEMP':str(root),'GITHUB_WORKSPACE':str(root),'GITHUB_EVENT_NAME':'workflow_dispatch',
            'GITHUB_REPOSITORY':'CrispStrobe/brickwright','GITHUB_REPOSITORY_ID':'${repositoryId}','GITHUB_REF':'refs/heads/lane/ios-active-asset-source-20261018',
            'GITHUB_SHA':'a'*40,'GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'ios-audit-directory',
            'BW_DIRECTORY_MODE':'true','BW_DIRECTORY_OTHER_MODE':'false','BW_DIRECTORY_RETAIN':'true',
            'BW_DIRECTORY_SIGN':'false','BW_DIRECTORY_DEVICE':'false','BW_DIRECTORY_RUNTIME':'','BW_DIRECTORY_BUILD':''}
        env.update(changes or {})
        with mock.patch.dict(os.environ,env),mock.patch.object(sys,'platform',host),mock.patch.object(platform,'machine',return_value='arm64'),mock.patch.object(sys,'version_info',(3,13)):
            code=main()
        raw=(root/'bw-ios-device-set-directory/report.json').read_bytes();return code,json.loads(raw),raw,root
    def test_positive_observes_only_filesystem_custody(self):
        code,r,raw,root=self.execute();self.assertEqual(code,0);self.assertEqual(r['status'],'filesystem-custody-controls-pass')
        self.assertEqual(r['fdBefore'],r['fdAfter'])
        # Link count can change when retained state is added; it is not directory identity.
        for key in ('device','inode','uid','gid','mode'):self.assertEqual(r['normal']['created'][key],r['normal']['afterClose'][key])
        for row in ('created','afterClose'):self.assertGreater(r['normal'][row]['links'],0)
        self.assertEqual(r['replacement']['original'],r['replacement']['retained']);self.assertNotEqual(r['replacement']['original']['inode'],r['replacement']['replacement']['inode'])
        self.assertTrue(r['replacement']['refused']);self.assertTrue(r['parentChange']['refused']);self.assertTrue(r['cancelledCreation']['refused'])
        self.assertLess(len(raw),65536);self.assertNotIn(str(root).encode(),raw);self.assertEqual(r['workflowSHA256'],hashlib.sha256(WORKFLOW_TEXT.encode()).hexdigest())
        for flag in ('actualAppQualified','namespaceOwnershipQualified','processFamilyQualified','resourceLifetimeQualified','simulatorCommandsInvoked'):self.assertIs(r[flag],False)
    def test_malformed_modes_and_platform_refuse_before_directory_factory(self):
        for key,value in [('BW_DIRECTORY_MODE','false'),('BW_DIRECTORY_OTHER_MODE','true'),('BW_DIRECTORY_RETAIN','false'),('BW_DIRECTORY_SIGN','true'),('BW_DIRECTORY_DEVICE','true'),('BW_DIRECTORY_RUNTIME','selected'),('BW_DIRECTORY_BUILD','selected'),('GITHUB_REF','refs/heads/main'),('GITHUB_REPOSITORY_ID','0'),('GITHUB_REPOSITORY_ID','')]:
            code,r,_,root=self.execute(changes={key:value});self.assertEqual(code,1);self.assertEqual(r['failure']['stage'],'admission')
            self.assertEqual(sorted(p.name for p in (root/'bw-ios-device-set-directory').iterdir()),['report.json'])
        code,r,_,_=self.execute(host='linux');self.assertEqual(code,1);self.assertEqual(r['failure']['stage'],'admission')
    def test_identity_mutant_is_refused_by_actual_platform_controller(self):
        cut='self._identity(held) == self._identity(named) == self._directory_identity';self.assertEqual(WORKFLOW_TEXT.count(cut),1)
        changed=WORKFLOW_TEXT.replace(cut,'self._identity(held) == self._directory_identity')
        code,r,_,_=self.execute(workflow=changed);self.assertEqual(code,1);self.assertEqual(r['failure']['stage'],'replacement-refusal')
        self.assertEqual(r['fdBefore'],r['fdAfter']);self.assertEqual(r['cleanupFailures'],[])
    def test_missing_or_duplicate_selected_class_refuses(self):
        for changed in (WORKFLOW_TEXT.replace('class SimulatorDeviceSetDirectory:','class MissingDirectory:'),WORKFLOW_TEXT.replace('class SimulatorDeviceSetRefused(RuntimeError):','class SimulatorDeviceSetDirectory(RuntimeError):')):
            code,r,_,_=self.execute(workflow=changed);self.assertEqual(code,1);self.assertEqual(r['failure']['stage'],'admission')
unittest.main(argv=['DirectoryProfileControls'],defaultTest='DirectoryProfileControls',verbosity=2)
`;
test('filesystem-only platform profile is closed and preserves actual directory assertions', () => {
    assert.match(workflow, /ios_audit_directory_only:\n[^\n]+\n        type: boolean\n        default: false/);
    const job = workflow.slice(workflow.indexOf('  ios-audit-directory:\n'), workflow.indexOf('  build-web:\n'));
    assert.match(job, /permissions:\n      contents: read/);
    assert.match(job, /inputs\.ios_audit_directory_only && !inputs\.ios_audit_preflight_only && !inputs\.ios_audit_interface_only/);
    assert.match(job, /inputs\.retain_ios_audit_inputs && !inputs\.sign_ios && !inputs\.device_ipa/);
    assert.doesNotMatch(job, /subprocess|Popen|tauri ios|simctl|downloadPlatform|secrets\./);
    assert.match(workflow, /inputs\.ios_audit_directory_only != true\)/);
    const prefix = directorySource.slice(0, directorySource.indexOf("\nif __name__=='__main__':"));
    const dir = mkdtempSync(join(tmpdir(), 'bw-directory-profile-controls-'));
    try {
        const controller = join(dir, 'controls.py');
        writeFileSync(controller, `${prefix}\nWORKFLOW_TEXT = ${JSON.stringify(workflow)}\n${directoryProfileControls}`);
        const result = spawnSync('/usr/bin/python3', [controller], {
            env: {...process.env, TMPDIR: dir}, encoding: 'utf8', timeout: 15000
        });
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stderr, /Ran 4 tests/);
        assert.match(result.stderr, /OK/);
    } finally {rmSync(dir,{recursive:true,force:true});}
});
