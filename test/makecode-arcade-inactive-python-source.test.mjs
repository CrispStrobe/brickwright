import test from 'node:test';
import assert from 'node:assert/strict';
import {arcadeProjectSource} from '../overlay/scratch-gui/src/lib/bw-makecode/project-source.js';

const project = (preferredEditor, overrides = {}) => ({
    'main.ts':'let score=3;',
    'main.py':'score = 91',
    'pxt.json':JSON.stringify({files:['main.py','main.ts'], ...(preferredEditor === undefined ? {} : {preferredEditor})}),
    ...overrides
});

for (const editor of ['blocksprj','tsprj']) {
    test(`${editor} selects TypeScript while preserving a divergent Python attachment`, () => {
        const files = Object.freeze(project(editor)), before = JSON.stringify(files);
        const result = arcadeProjectSource(files);
        assert.deepEqual(result.entries, [{name:'main.ts',source:'let score=3;'}]);
        assert.equal(result.source, files['main.ts']);
        assert.deepEqual(result.diagnostics, []);
        assert.equal(JSON.stringify(files), before);
        assert.equal(files['main.py'], 'score = 91');
    });
}

test('switching only the editor to pyprj retains Python translation refusal, including blank Python', () => {
    for (const python of ['score = 91','']) {
        const files = project('tsprj', {'main.py':python});
        assert.deepEqual(arcadeProjectSource(files).diagnostics, []);
        const config = JSON.parse(files['pxt.json']);
        config.preferredEditor = 'pyprj';
        const result = arcadeProjectSource({...files, 'pxt.json':JSON.stringify(config)});
        assert.match(result.diagnostics.join('\n'), /main\.py.*Python translation support/);
        assert.equal(result.source, files['main.ts']);
    }
});

test('absent, unknown and nonexact editor values retain conservative Python refusal', () => {
    for (const editor of [undefined,'unknown','tsprj ',null,false])
        assert.match(arcadeProjectSource(project(editor)).diagnostics.join('\n'), /main\.py.*Python translation support/);
});

test('inactive Python admission still requires the retained declared file', () => {
    for (const editor of ['blocksprj','tsprj']) {
        const files = project(editor);
        delete files['main.py'];
        assert.match(arcadeProjectSource(files).diagnostics.join('\n'), /Missing declared project source file: "main\.py"/);
        files['main.py'] = null;
        assert.match(arcadeProjectSource(files).diagnostics.join('\n'), /Missing declared project source file: "main\.py"/);
    }
});

test('conditional Python and TypeScript files retain their dependency refusals', () => {
    for (const editor of ['blocksprj','tsprj']) {
        const files = project(editor);
        files['pxt.json'] = JSON.stringify({preferredEditor:editor, files:['main.py','main.ts'], fileDependencies:{'main.py':'radio','main.ts':'radio'}});
        const result = arcadeProjectSource(files);
        assert.equal(result.entries.length, 0);
        for (const name of ['main.py','main.ts'])
            assert.ok(result.diagnostics.some(message => message.includes(JSON.stringify(name)) && message.includes('file dependencies')));
    }
});

test('ambient declarations and assembly remain refused under explicit TypeScript editors', () => {
    for (const editor of ['blocksprj','tsprj']) {
        const files = project(editor, {'ambient.d.ts':'declare const remote:number;', 'native.asm':'nop'});
        files['pxt.json'] = JSON.stringify({preferredEditor:editor,files:['ambient.d.ts','native.asm','main.py','main.ts']});
        const result = arcadeProjectSource(files);
        assert.deepEqual(result.entries.map(entry => entry.name), ['main.ts']);
        for (const name of ['ambient.d.ts','native.asm'])
            assert.ok(result.diagnostics.some(message => message.includes(JSON.stringify(name)) && message.includes('translation support')));
        assert.equal(result.diagnostics.length, 2);
    }
});

test('retained Python testFiles are inactive without changing TypeScript file order', () => {
    const files = project('tsprj', {'helper.ts':'let first=1;', 'checks.ts':'let checked=2;', 'checks.py':'checked = 92', '_onCodeStop.ts':'let stopped=4;'});
    files['pxt.json'] = JSON.stringify({preferredEditor:'tsprj',files:['main.ts','helper.ts','main.py','_onCodeStop.ts'],testFiles:['checks.py','checks.ts']});
    const result = arcadeProjectSource(files);
    assert.deepEqual(result.entries.map(entry => entry.name), ['helper.ts','checks.ts','main.ts','_onCodeStop.ts']);
    assert.deepEqual(result.diagnostics, []);
    assert.equal(files['checks.py'], 'checked = 92');
});

test('malformed configuration and malformed source lists keep their diagnostics', () => {
    assert.match(arcadeProjectSource(project('tsprj', {'pxt.json':'{'})).diagnostics.join('\n'), /pxt\.json could not be read/);
    for (const invalid of [{files:'main.ts'}, {files:['main.ts'],testFiles:'checks.py'}, {files:['main.ts',false]}]) {
        const files = project('tsprj', {'pxt.json':JSON.stringify({preferredEditor:'tsprj',...invalid})});
        assert.match(arcadeProjectSource(files).diagnostics.join('\n'), /files and testFiles must be lists/);
    }
});
