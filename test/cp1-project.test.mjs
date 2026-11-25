import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createCp1Project, validateCp1Project, serializeCp1Project, deserializeCp1Project,
    cp1ProjectBytes, cp1RomReference, validateCp1Workspace} from '../overlay/scratch-gui/src/lib/cp1-project.js';

const source = 'ORG 0\nAKO 42\nANZ\nHLT\n';
const project = () => createCp1Project({source});
const invalid = input => {
    const result = validateCp1Project(input);
    assert.equal(result.ok, false);
    assert.equal(result.project, null);
    assert.ok(result.errors.length);
    return result.errors;
};

test('CP1 project saves source, explicit configuration and opcode-first cells with a stable version', () => {
    const original = project();
    assert.equal(original.format, 'brickwright.cp1-project');
    assert.equal(original.version, 1);
    assert.equal(original.target, 'kosmos-cp1');
    assert.deepEqual(original.configuration, {expansion: false, clockHz: 6000000});
    assert.equal(original.rom, null);
    assert.deepEqual(original.words, [{address: 0, opcode: 4, operand: 42}, {address: 1, opcode: 2, operand: 0}, {address: 2, opcode: 1, operand: 0}]);
    const restored = deserializeCp1Project(serializeCp1Project(original));
    assert.deepEqual(restored, original);
    const bytes = cp1ProjectBytes(restored);
    assert.equal(bytes.length, 256);
    assert.deepEqual([...bytes.slice(0, 6)], [4, 42, 2, 0, 1, 0]);
});

test('source and cell disagreement fails closed instead of selecting a hidden authority', () => {
    const original = project();
    original.words[0].operand = 41;
    assert.ok(invalid(original).some(error => error.path === 'words'));
    assert.throws(() => serializeCp1Project(original), /do not match/);
    const badSource = project();
    badSource.source = 'AKO unfinished +';
    assert.ok(invalid(badSource).some(error => error.path.startsWith('source:')));
});

test('manual cell images may preserve any byte but stay within the configured machine', () => {
    const manual = createCp1Project({source: '', configuration: {expansion: true},
        words: [{address: 255, opcode: 255, operand: 254}, {address: 0, opcode: 0, operand: 1}]});
    assert.deepEqual(manual.words.map(word => word.address), [0, 255]);
    assert.equal(cp1ProjectBytes(manual).length, 512);
    assert.deepEqual([...cp1ProjectBytes(manual).slice(510)], [255, 254]);
    invalid({...manual, configuration: {expansion: false, clockHz: 6000000}});
    for (const field of ['address', 'opcode', 'operand']) {
        invalid({...manual, words: [{address: 0, opcode: 0, operand: 0, [field]: -1}]});
        invalid({...manual, words: [{address: 0, opcode: 0, operand: 0, [field]: 256}]});
        invalid({...manual, words: [{address: 0, opcode: 0, operand: 0, [field]: 1.5}]});
    }
    invalid({...manual, words: [{address: 0, opcode: 0, operand: 1}, {address: 0, opcode: 0, operand: 2}]});
});

test('normal projects reject held keys, resume state, embedded ROMs and unexpected fields', () => {
    for (const [field, value] of [['heldKeys', ['RUN']], ['cpu', {pc: 30}], ['snapshot', {}], ['romBytes', [1, 2]], ['constructor', {}]]) {
        invalid({...project(), [field]: value});
    }
    invalid({...project(), words: [{address: 0, opcode: 4, operand: 42, pressed: true}]});
    invalid({...project(), rom: {sha256: 'a'.repeat(64), byteLength: 2048, bytes: [1]}});
    invalid({...project(), rom: {sha256: 'a'.repeat(64), byteLength: 2048, url: 'https://example.invalid/rom.bin'}});
    invalid(JSON.parse('{"__proto__":{"polluted":true}}'));
    assert.equal({}.polluted, undefined);
    const clean = createCp1Project({...project(), heldKeys: ['RUN'], snapshot: {cpu: {pc: 7}}});
    assert.deepEqual(Object.keys(clean).sort(), ['configuration', 'format', 'rom', 'source', 'target', 'version', 'words']);
});

test('ROM reference is a detached digest of an explicit local import, never ROM content', async () => {
    const bytes = new Uint8Array(2048);
    bytes[0] = 4;
    const reference = await cp1RomReference(bytes, 'my-monitor.bin', webcrypto);
    assert.match(reference.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(reference).sort(), ['byteLength', 'name', 'sha256']);
    const saved = createCp1Project({source, rom: reference});
    reference.name = 'changed.bin';
    bytes[0] = 255;
    assert.equal(saved.rom.name, 'my-monitor.bin');
    assert.equal(saved.rom.byteLength, 2048);
    assert.notEqual((await cp1RomReference(bytes, '', webcrypto)).sha256, saved.rom.sha256);
    await assert.rejects(() => cp1RomReference(new Uint8Array(2047), '', webcrypto), /2048/);
    await assert.rejects(() => cp1RomReference(new Uint8Array(2048), 'bad\nname', webcrypto), /printable/);
    invalid({...saved, rom: {...saved.rom, sha256: 'not-a-digest'}});
});

test('configuration, source and JSON sizes are bounded and future versions are rejected', () => {
    for (const clockHz of [0, 99999, 12000001, NaN, Infinity, '6000000']) {
        invalid({...project(), configuration: {expansion: false, clockHz}});
    }
    invalid({...project(), configuration: {expansion: 'false', clockHz: 6000000}});
    invalid({...project(), configuration: {expansion: false, clockHz: 6000000, heldKeys: []}});
    invalid({...project(), source: 'x'.repeat(256 * 1024 + 1)});
    invalid({...project(), version: 2});
    assert.throws(() => deserializeCp1Project(' '.repeat(512 * 1024 + 1)), /at most/);
    assert.throws(() => deserializeCp1Project('{'), SyntaxError);
});

const workspace = () => ({format: 'brickwright.cp1-workspace', version: 1,
    configuration: {expansion: false, clockHz: 6000000}, rom: null, source: 'again: AKO unfinished +\n'});

test('normal workspace persistence preserves incomplete source without creating runnable cells', () => {
    const input = workspace();
    const result = validateCp1Workspace(input);
    assert.equal(result.ok, true);
    assert.deepEqual(result.project, input);
    input.configuration.expansion = true;
    assert.equal(result.project.configuration.expansion, false, 'validation returns detached configuration');
    assert.equal(Object.hasOwn(result.project, 'words'), false);
    assert.equal(result.project.source, 'again: AKO unfinished +\n');
});

test('workspace persistence rejects all execution and prototype fields despite accepting incomplete syntax', () => {
    for (const [field, value] of [['words', []], ['bytes', []], ['heldKeys', []], ['cpu', {}], ['romBytes', []], ['target', 'other']]) {
        const result = validateCp1Workspace({...workspace(), [field]: value});
        assert.equal(result.ok, false, field);
        assert.equal(result.project, null);
    }
    const polluted = JSON.parse(JSON.stringify(workspace()).slice(0, -1) + ',"__proto__":{"x":1}}');
    assert.equal(validateCp1Workspace(polluted).ok, false);
    assert.equal(validateCp1Workspace({...workspace(), source: 'x'.repeat(256 * 1024 + 1)}).ok, false);
    assert.equal(validateCp1Workspace({...workspace(), version: 99}).ok, false);
    assert.equal(validateCp1Workspace({...workspace(), rom: {bytes: []}}).ok, false);
});
